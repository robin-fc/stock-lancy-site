import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import {
  getQuote,
  getCandles,
  calculateIndicators,
  getBasicInfo,
} from '@/lib/stock-api';
import type { StockBasicInfo, StockAIAnalysis } from '@/types';

export const dynamic = 'force-dynamic';

/** 获取股票详情 (含基本面缓存 + 实时行情 + 技术指标 + AI分析缓存) */
export async function GET(
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

    // 从 Authorization header 验证用户
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

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';

    const serverClient = createServerClient();

    // 1. 查询缓存的基本面数据
    let basicInfo: StockBasicInfo | null = null;
    const { data: cachedBasic } = await serverClient
      .from('stock_basic_info')
      .select('*')
      .eq('symbol', symbol)
      .single();

    if (cachedBasic) {
      basicInfo = cachedBasic as StockBasicInfo;
    }

    // 2. 如果没有缓存或 force=1, 调用 getBasicInfo 获取并 upsert
    if (!basicInfo || force) {
      const freshBasic = await getBasicInfo(symbol);
      if (freshBasic) {
        const { data: upserted } = await serverClient
          .from('stock_basic_info')
          .upsert(
            {
              symbol,
              name: freshBasic.name,
              exchange: freshBasic.exchange,
              sector: freshBasic.sector,
              market_cap: freshBasic.market_cap,
              pe_ratio: freshBasic.pe_ratio,
              pb_ratio: freshBasic.pb_ratio,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'symbol' }
          )
          .select()
          .single();

        if (upserted) {
          basicInfo = upserted as StockBasicInfo;
        } else if (!basicInfo) {
          // upsert 失败且无缓存时, 使用原始数据兜底
          basicInfo = {
            symbol,
            name: freshBasic.name,
            exchange: freshBasic.exchange,
            sector: freshBasic.sector,
            market_cap: freshBasic.market_cap,
            pe_ratio: freshBasic.pe_ratio,
            pb_ratio: freshBasic.pb_ratio,
            updated_at: new Date().toISOString(),
          };
        }
      }
    }

    // 3. 获取实时报价 (不缓存, 实时)
    const quote = await getQuote(symbol);

    // 4. 获取 K 线数据 (不缓存, 实时)
    const candles = await getCandles(symbol, 'D');

    // 5. 计算技术指标
    const indicators = candles.length > 0 ? calculateIndicators(candles) : null;

    // 6. 查询缓存的 AI 分析 (如果有)
    let aiAnalysis: StockAIAnalysis | null = null;
    const { data: cachedAnalysis } = await serverClient
      .from('stock_ai_analysis')
      .select('*')
      .eq('symbol', symbol)
      .single();

    if (cachedAnalysis) {
      aiAnalysis = cachedAnalysis as StockAIAnalysis;
    }

    // 7. 返回结果, candles 只返回最近 60 天数据
    const recentCandles = candles.slice(-60);

    return NextResponse.json({
      quote,
      candles: recentCandles,
      indicators,
      basic_info: basicInfo,
      ai_analysis: aiAnalysis,
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
