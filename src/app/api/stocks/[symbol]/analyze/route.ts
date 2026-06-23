import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import {
  getQuote,
  getCandles,
  calculateIndicators,
  getBasicInfo,
} from '@/lib/stock-api';
import { analyzeStock } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

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

    // 1. 获取实时报价
    const quote = await getQuote(symbol);
    if (!quote || quote.current_price === 0) {
      return NextResponse.json(
        { error: '无法获取股票数据' },
        { status: 400 }
      );
    }

    // 2. 获取 K 线数据
    const candles = await getCandles(symbol, 'D');
    if (candles.length < 10) {
      return NextResponse.json(
        { error: 'K 线数据不足, 无法计算技术指标' },
        { status: 400 }
      );
    }

    // 3. 计算技术指标
    const indicators = calculateIndicators(candles);

    // 获取股票名称 (优先用报价中的名称, 其次基本面, 最后用代码)
    let name = quote.name || symbol;
    const basicInfo = await getBasicInfo(symbol);
    if (basicInfo?.name) {
      name = basicInfo.name;
    }

    // 4. 调用 AI 分析生成结果
    const analysis = await analyzeStock(symbol, name, quote, candles, indicators);

    // 5. upsert 到 stock_ai_analysis 表 (symbol 唯一约束, 自动覆盖旧分析)
    const serverClient = createServerClient();
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

    // 6. 返回 AI 分析结果
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
