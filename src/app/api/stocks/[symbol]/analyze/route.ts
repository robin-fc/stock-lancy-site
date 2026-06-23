import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import {
  getQuote,
  getCandles,
  calculateIndicators,
} from '@/lib/stock-api';
import { analyzeStock, setFactorWeights } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 手动触发 AI 分析并缓存到 stock_ai_analysis 表 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: '缺少股票代码' },
        { status: 400 }
      );
    }

    // 从 Authorization header 验证用户, 获取 userId
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // 并行获取报价和 K 线数据, 减少总耗时
    const [quoteResult, candlesResult] = await Promise.all([
      getQuote(symbol),
      getCandles(symbol, 'D'),
    ]);

    const quote = quoteResult;
    if (!quote || quote.current_price === 0) {
      return NextResponse.json(
        { error: '无法获取股票数据，可能已停牌' },
        { status: 400 }
      );
    }

    const candles = candlesResult;
    if (candles.length < 10) {
      return NextResponse.json(
        { error: 'K 线数据不足, 无法计算技术指标' },
        { status: 400 }
      );
    }

    // 计算技术指标
    const indicators = calculateIndicators(candles);

    // 使用报价中的名称
    const name = quote.name || symbol;

    // 服务端客户端 (用于读取因子权重、基本面缓存, 以及保存分析结果)
    const serverClient = createServerClient();

    // 1. 从数据库 analysis_factors 表加载当前因子权重, 注入到 AI 分析服务
    const { data: factorRows } = await serverClient
      .from('analysis_factors')
      .select('factor_key, weight')
      .eq('is_active', true);

    if (factorRows && factorRows.length > 0) {
      setFactorWeights(
        factorRows.map(
          (f: { factor_key: string; weight: number }) => ({
            key: f.factor_key,
            weight: f.weight,
          })
        )
      );
    }

    // 2. 查询缓存的基本面数据 (按 symbol 查询, 没有则传 null)
    let basicInfo: {
      pe_ratio: number | null;
      pb_ratio: number | null;
      market_cap: number | null;
      sector: string | null;
    } | null = null;

    const { data: cachedBasic } = await serverClient
      .from('stock_basic_info')
      .select('pe_ratio, pb_ratio, market_cap, sector')
      .eq('symbol', symbol)
      .single();

    if (cachedBasic) {
      basicInfo = {
        pe_ratio: cachedBasic.pe_ratio,
        pb_ratio: cachedBasic.pb_ratio,
        market_cap: cachedBasic.market_cap,
        sector: cachedBasic.sector,
      };
    }

    // 3. 调用 AI 分析生成结果 (内部有 8 秒超时和 fallback 机制)
    const analysis = await analyzeStock(
      symbol,
      name,
      quote,
      candles,
      indicators,
      basicInfo
    );

    // 4. upsert 到 stock_ai_analysis 表 (symbol 唯一约束, 自动覆盖旧分析)
    const { data: savedAnalysis, error: upsertError } = await serverClient
      .from('stock_ai_analysis')
      .upsert(
        {
          symbol,
          name,
          signal: analysis.signal,
          confidence: analysis.confidence,
          entry_price: analysis.entry_price,
          target_price: analysis.target_price,
          stop_loss: analysis.stop_loss,
          analysis: analysis.analysis,
          summary: analysis.summary,
          key_factors: analysis.key_factors,
          risk_level: analysis.risk_level,
          indicators: indicators as unknown as Record<string, number>,
          triggered_by: userId,
          factor_scores: analysis.factor_scores,
          strategies: analysis.strategies,
          formula_version: analysis.formula_version,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'symbol' }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: '保存 AI 分析结果失败', detail: upsertError.message },
        { status: 500 }
      );
    }

    // 返回 AI 分析结果
    return NextResponse.json({
      analysis: savedAnalysis || analysis,
      message: 'AI 分析完成',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
