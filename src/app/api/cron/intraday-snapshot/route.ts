import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import {
  getQuote,
  getCandles,
  calculateIndicators,
  DEFAULT_WATCHLIST,
} from '@/lib/stock-api';
import type { SnapshotType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 定时任务允许执行较长时间 (遍历整个股票池 + 间隔)
export const maxDuration = 300;

/** 快照类型顺序 */
const SNAPSHOT_ORDER: SnapshotType[] = [
  'morning_open',
  'morning_close',
  'afternoon_open',
  'afternoon_close',
];

/** 延迟函数 (毫秒) */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 获取指定快照类型的前一个快照类型 */
function getPreviousSnapshotType(type: SnapshotType): SnapshotType | null {
  const idx = SNAPSHOT_ORDER.indexOf(type);
  if (idx <= 0) return null; // morning_open 没有同一天的前一个快照
  return SNAPSHOT_ORDER[idx - 1];
}

/** 采集盘中快照 (定时任务或用户手动触发) */
export async function POST(request: NextRequest) {
  try {
    // 验证身份: 支持 CRON_SECRET (定时任务) 或 用户登录 token (手动触发)
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret') || '';

    let isAuthorized = false;

    // 方式1: CRON_SECRET
    if (headerToken && headerToken === process.env.CRON_SECRET) {
      isAuthorized = true;
    }
    // 方式2: query param CRON_SECRET
    if (querySecret && querySecret === process.env.CRON_SECRET) {
      isAuthorized = true;
    }
    // 方式3: 用户登录 token
    if (!isAuthorized && headerToken) {
      const { data: userData } = await supabase.auth.getUser(headerToken);
      if (userData.user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 校验快照类型参数
    const type = searchParams.get('type') as SnapshotType | null;
    if (!type || !SNAPSHOT_ORDER.includes(type)) {
      return NextResponse.json(
        { error: '缺少或无效的 type 参数, 可选值: morning_open, morning_close, afternoon_open, afternoon_close' },
        { status: 400 }
      );
    }

    // 检查是否为交易日 (周末跳过: 0=周日, 6=周六)
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        message: '今天是周末, A股休市, 跳过快照采集',
        type,
        skipped: true,
      });
    }

    const today = now.toISOString().split('T')[0];
    const serverClient = createServerClient();

    // 确定前一个快照类型
    const prevType = getPreviousSnapshotType(type);

    let successCount = 0;
    let errorCount = 0;

    // 遍历默认关注 A 股股票池
    for (const stock of DEFAULT_WATCHLIST) {
      const { symbol, name: defaultName } = stock;
      try {
        // 获取实时报价 (getQuote 内部已有3次重试)
        const quote = await getQuote(symbol);
        if (!quote) {
          errorCount++;
          await delay(500);
          continue;
        }

        // 获取历史 K 线数据并计算技术指标
        const candles = await getCandles(symbol, 'D');
        const indicators =
          candles.length >= 10 ? calculateIndicators(candles) : null;

        const name = quote.name || defaultName || symbol;

        // 查询前一个快照数据, 计算价格/成交量变化
        let priceChange: number | null = null;
        let priceChangePct: number | null = null;
        let volumeChangePct: number | null = null;

        if (prevType) {
          // 同一天的前一个快照
          const { data: prevSnapshot } = await serverClient
            .from('intraday_snapshots')
            .select('price, volume')
            .eq('symbol', symbol)
            .eq('snapshot_date', today)
            .eq('snapshot_type', prevType)
            .maybeSingle();

          if (prevSnapshot && prevSnapshot.price > 0) {
            priceChange = quote.current_price - prevSnapshot.price;
            priceChangePct =
              (priceChange / prevSnapshot.price) * 100;
            if (prevSnapshot.volume > 0) {
              volumeChangePct =
                ((quote.volume - prevSnapshot.volume) / prevSnapshot.volume) * 100;
            }
          }
        }

        // 成交额估算 (价格 × 成交量)
        const turnover = quote.current_price * quote.volume;

        // upsert 到 intraday_snapshots 表
        const { error: upsertError } = await serverClient
          .from('intraday_snapshots')
          .upsert(
            {
              symbol,
              name,
              snapshot_date: today,
              snapshot_type: type,
              price: quote.current_price,
              change_pct: quote.change_pct,
              volume: quote.volume,
              turnover,
              indicators: indicators
                ? (indicators as unknown as Record<string, number>)
                : null,
              price_change: priceChange,
              price_change_pct: priceChangePct,
              volume_change_pct: volumeChangePct,
            },
            { onConflict: 'symbol,snapshot_date,snapshot_type' }
          );

        if (upsertError) {
          errorCount++;
        } else {
          successCount++;
        }

        // 每只股票间隔 500ms (增大间隔避免限流)
        await delay(500);
      } catch {
        errorCount++;
        await delay(500);
      }
    }

    // 如果是收盘快照, 在所有快照采集完成后自动调用策略分析 (内部调用, 不返回)
    if (type === 'afternoon_close') {
      try {
        const analysisUrl = new URL(
          '/api/cron/strategy-analysis',
          request.url
        );
        await fetch(analysisUrl.toString(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // 策略分析失败不影响快照采集结果
      }
    }

    return NextResponse.json({
      success: true,
      type,
      date: today,
      total: DEFAULT_WATCHLIST.length,
      success_count: successCount,
      error_count: errorCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
