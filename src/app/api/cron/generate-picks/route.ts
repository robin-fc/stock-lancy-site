import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  getQuote,
  getCompanyProfile,
  getCandles,
  calculateIndicators,
  DEFAULT_WATCHLIST,
} from '@/lib/stock-api';
import { analyzeStock } from '@/lib/ai-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 定时任务允许执行较长时间
export const maxDuration = 300;

/** 延迟函数 (毫秒) */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 每日生成 AI 选股 (定时任务) */
export async function POST(request: NextRequest) {
  try {
    // 验证 CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查是否为交易日 (周末跳过: 0=周日, 6=周六)
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        message: '今天是周末, A股休市, 跳过生成',
        skipped: true,
      });
    }

    const today = now.toISOString().split('T')[0];
    const serverClient = createServerClient();

    const results: {
      symbol: string;
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
        // 获取实时报价
        const quote = await getQuote(symbol);
        if (!quote || quote.current_price === 0) {
          results.push({
            symbol,
            status: 'skipped',
            message: '无法获取报价, 可能停牌或数据异常',
          });
          skipCount++;
          await delay(500);
          continue;
        }

        // 获取历史 K 线数据
        const candles = await getCandles(symbol, 'D');
        if (candles.length < 10) {
          results.push({
            symbol,
            status: 'skipped',
            message: 'K 线数据不足, 无法计算指标',
          });
          skipCount++;
          await delay(500);
          continue;
        }

        // 获取公司信息
        const profile = await getCompanyProfile(symbol);
        const name = profile?.name || defaultName || symbol;
        const sector = profile?.sector || null;

        // 计算技术指标
        const indicators = calculateIndicators(candles);

        // 调用 AI 分析
        const analysis = await analyzeStock(
          symbol,
          name,
          quote,
          candles,
          indicators
        );

        // 邀请制下所有用户均为会员, 不再区分 pro_only
        const isProOnly = false;

        // 判断是否为精选 (强烈买入且高置信度)
        const isFeatured =
          analysis.signal === 'strong_buy' && analysis.confidence >= 75;

        // 存入 stock_picks 表 (使用 upsert 避免重复)
        const { error: insertError } = await serverClient
          .from('stock_picks')
          .upsert(
            {
              symbol,
              name,
              exchange: symbol.startsWith('6') ? 'SH' : 'SZ',
              sector,
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
              is_pro_only: isProOnly,
              view_count: 0,
            },
            { onConflict: 'pick_date,symbol' }
          );

        if (insertError) {
          results.push({
            symbol,
            status: 'error',
            message: insertError.message,
          });
          errorCount++;
        } else {
          results.push({
            symbol,
            status: 'success',
            signal: analysis.signal,
          });
          successCount++;
        }

        // 每次处理间隔 500ms, 东方财富 API 无严格限流
        await delay(500);
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        results.push({
          symbol,
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
