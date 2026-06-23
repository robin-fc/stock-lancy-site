import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import {
  getQuote,
  getCandles,
  calculateIndicators,
  DEFAULT_WATCHLIST,
} from '@/lib/stock-api';
import { analyzeStock } from '@/lib/ai-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 选股生成处理时间较长 (25只股票 × ~2秒 = 50秒), 设置最大执行时间
export const maxDuration = 300;

/** 延迟函数 (毫秒) */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 手动触发选股生成 (登录用户即可触发, 不需要 CRON_SECRET) */
export async function POST(request: NextRequest) {
  try {
    // 从 Authorization header 验证用户 (登录用户即可触发)
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

    const today = new Date().toISOString().split('T')[0];
    const serverClient = createServerClient();

    const results: {
      symbol: string;
      name: string;
      status: 'success' | 'skipped' | 'error';
      signal?: string;
      message?: string;
    }[] = [];

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // 遍历默认关注 A 股股票池
    for (const stock of DEFAULT_WATCHLIST) {
      const { symbol, name: defaultName } = stock;
      try {
        // 1. 获取实时报价
        const quote = await getQuote(symbol);
        if (!quote || quote.current_price === 0) {
          results.push({
            symbol,
            name: defaultName,
            status: 'skipped',
            message: '无法获取报价, 可能停牌或数据异常',
          });
          skipCount++;
          await delay(500);
          continue;
        }

        // 2. 获取 K 线数据
        const candles = await getCandles(symbol, 'D');
        if (candles.length < 10) {
          results.push({
            symbol,
            name: defaultName,
            status: 'skipped',
            message: 'K 线数据不足, 无法计算指标',
          });
          skipCount++;
          await delay(500);
          continue;
        }

        // 3. 计算技术指标
        const indicators = calculateIndicators(candles);

        const name = quote.name || defaultName || symbol;

        // 4. 调用 AI 分析
        const analysis = await analyzeStock(
          symbol,
          name,
          quote,
          candles,
          indicators
        );

        // 判断是否为精选 (强烈买入且高置信度)
        const isFeatured =
          analysis.signal === 'strong_buy' && analysis.confidence >= 75;

        // upsert 到 stock_picks 表 (onConflict: 'pick_date,symbol')
        const { error: insertError } = await serverClient
          .from('stock_picks')
          .upsert(
            {
              symbol,
              name,
              exchange: symbol.startsWith('6') ? 'SH' : 'SZ',
              sector: null,
              signal: analysis.signal,
              confidence: analysis.confidence,
              entry_price: analysis.entry_price,
              target_price: analysis.target_price,
              stop_loss: analysis.stop_loss,
              current_price: quote.current_price,
              analysis: analysis.analysis,
              summary: analysis.summary,
              key_factors: analysis.key_factors,
              risk_level: analysis.risk_level,
              indicators: indicators as unknown as Record<string, number>,
              pick_date: today,
              is_featured: isFeatured,
              is_pro_only: false,
              view_count: 0,
            },
            { onConflict: 'pick_date,symbol' }
          );

        if (insertError) {
          results.push({
            symbol,
            name,
            status: 'error',
            message: insertError.message,
          });
          errorCount++;
        } else {
          results.push({
            symbol,
            name,
            status: 'success',
            signal: analysis.signal,
          });
          successCount++;
        }

        // 每次处理间隔 500ms
        await delay(500);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        results.push({
          symbol,
          name: defaultName,
          status: 'error',
          message,
        });
        errorCount++;
        await delay(500);
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      total: DEFAULT_WATCHLIST.length,
      success_count: successCount,
      error_count: errorCount,
      skip_count: skipCount,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
