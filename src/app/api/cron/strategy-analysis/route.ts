import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { analyzeIntradayPatterns } from '@/lib/ai-service';
import type { SnapshotType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 快照类型 */
const SNAPSHOT_TYPES: SnapshotType[] = [
  'morning_open',
  'morning_close',
  'afternoon_open',
  'afternoon_close',
];

/** 单只股票的4个快照数据 */
interface StockSnapshots {
  symbol: string;
  name: string;
  morning_open: { price: number; change_pct: number; volume: number } | null;
  morning_close: { price: number; change_pct: number; volume: number } | null;
  afternoon_open: { price: number; change_pct: number; volume: number } | null;
  afternoon_close: { price: number; change_pct: number; volume: number } | null;
}

/** 时段统计结果 */
interface SessionStat {
  avg_change_pct: number;
  up_count: number;
  down_count: number;
  max_gain: { symbol: string; name: string; pct: number } | null;
  max_loss: { symbol: string; name: string; pct: number } | null;
}

/** 计算某一时段的统计 (基于每只股票的时段涨跌幅) */
function computeSessionStat(
  changes: { symbol: string; name: string; pct: number }[]
): SessionStat {
  if (changes.length === 0) {
    return {
      avg_change_pct: 0,
      up_count: 0,
      down_count: 0,
      max_gain: null,
      max_loss: null,
    };
  }

  const avg =
    changes.reduce((sum, c) => sum + c.pct, 0) / changes.length;
  const upCount = changes.filter((c) => c.pct > 0).length;
  const downCount = changes.filter((c) => c.pct < 0).length;

  let maxGain = changes[0];
  let maxLoss = changes[0];
  for (const c of changes) {
    if (c.pct > maxGain.pct) maxGain = c;
    if (c.pct < maxLoss.pct) maxLoss = c;
  }

  return {
    avg_change_pct: Math.round(avg * 100) / 100,
    up_count: upCount,
    down_count: downCount,
    max_gain: { symbol: maxGain.symbol, name: maxGain.name, pct: Math.round(maxGain.pct * 100) / 100 },
    max_loss: { symbol: maxLoss.symbol, name: maxLoss.name, pct: Math.round(maxLoss.pct * 100) / 100 },
  };
}

/** 收盘后策略分析 (对比4次快照, AI 生成策略洞察) */
export async function POST(request: NextRequest) {
  try {
    // 验证身份: 支持 CRON_SECRET 或 用户登录 token
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret') || '';

    let isAuthorized = false;
    if (headerToken && headerToken === process.env.CRON_SECRET) isAuthorized = true;
    if (querySecret && querySecret === process.env.CRON_SECRET) isAuthorized = true;
    if (!isAuthorized && headerToken) {
      const { data: userData } = await supabase.auth.getUser(headerToken);
      if (userData.user) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const serverClient = createServerClient();

    // 1. 查询当天所有4类快照数据
    const { data: rawSnapshots, error: snapshotError } = await serverClient
      .from('intraday_snapshots')
      .select('*')
      .eq('snapshot_date', today)
      .in('snapshot_type', SNAPSHOT_TYPES);

    if (snapshotError) {
      return NextResponse.json(
        { error: '查询快照数据失败', detail: snapshotError.message },
        { status: 500 }
      );
    }

    if (!rawSnapshots || rawSnapshots.length === 0) {
      return NextResponse.json(
        { error: '当天无快照数据, 请先执行快照采集' },
        { status: 400 }
      );
    }

    // 2. 按股票分组, 构建每只股票的4个快照
    const stockMap = new Map<string, StockSnapshots>();

    for (const row of rawSnapshots) {
      const symbol = row.symbol;
      if (!stockMap.has(symbol)) {
        stockMap.set(symbol, {
          symbol,
          name: row.name || symbol,
          morning_open: null,
          morning_close: null,
          afternoon_open: null,
          afternoon_close: null,
        });
      }
      const entry = stockMap.get(symbol)!;
      const snapshotData = {
        price: row.price,
        change_pct: row.change_pct,
        volume: row.volume,
      };
      entry[row.snapshot_type as SnapshotType] = snapshotData;
    }

    const stockSnapshots = Array.from(stockMap.values());

    // 3. 计算各时段每只股票的价格变化
    const morningChanges: { symbol: string; name: string; pct: number }[] = [];
    const afternoonChanges: { symbol: string; name: string; pct: number }[] = [];
    const fullDayChanges: { symbol: string; name: string; pct: number }[] = [];

    for (const stock of stockSnapshots) {
      // 上午时段: morning_open → morning_close
      if (stock.morning_open && stock.morning_close && stock.morning_open.price > 0) {
        const pct =
          ((stock.morning_close.price - stock.morning_open.price) /
            stock.morning_open.price) *
          100;
        morningChanges.push({ symbol: stock.symbol, name: stock.name, pct });
      }
      // 下午时段: afternoon_open → afternoon_close
      if (
        stock.afternoon_open &&
        stock.afternoon_close &&
        stock.afternoon_open.price > 0
      ) {
        const pct =
          ((stock.afternoon_close.price - stock.afternoon_open.price) /
            stock.afternoon_open.price) *
          100;
        afternoonChanges.push({ symbol: stock.symbol, name: stock.name, pct });
      }
      // 全天: morning_open → afternoon_close
      if (
        stock.morning_open &&
        stock.afternoon_close &&
        stock.morning_open.price > 0
      ) {
        const pct =
          ((stock.afternoon_close.price - stock.morning_open.price) /
            stock.morning_open.price) *
          100;
        fullDayChanges.push({ symbol: stock.symbol, name: stock.name, pct });
      }
    }

    // 4. 计算时段统计
    const morningStat = computeSessionStat(morningChanges);
    const afternoonStat = computeSessionStat(afternoonChanges);
    const fullDayStat = computeSessionStat(fullDayChanges);

    // 5. 找出 top_performers (涨幅前5) 和 bottom_performers (跌幅前5)
    // 查询今天的 stock_picks 获取信号
    const { data: todayPicks } = await serverClient
      .from('stock_picks')
      .select('symbol, signal')
      .eq('pick_date', today);

    const signalMap = new Map<string, string>();
    for (const pick of todayPicks || []) {
      signalMap.set(pick.symbol, pick.signal);
    }

    const sortedByPct = [...fullDayChanges].sort((a, b) => b.pct - a.pct);
    const topPerformers = sortedByPct.slice(0, 5).map((c) => ({
      symbol: c.symbol,
      name: c.name,
      change_pct: c.pct,
      signal: signalMap.get(c.symbol) || 'hold',
    }));
    const bottomPerformers = sortedByPct
      .slice(-5)
      .reverse()
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        change_pct: c.pct,
        signal: signalMap.get(c.symbol) || 'hold',
      }));

    // 6. 查询昨天的 strategy_evolution 记录用于对比
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    const { data: yesterdayRecord } = await serverClient
      .from('strategy_evolution')
      .select('analysis_date, morning_session, afternoon_session, full_day, ai_insight')
      .eq('analysis_date', yesterdayDate)
      .maybeSingle();

    // 构建与昨天的对比数据
    const comparisonWithYesterday: Record<string, unknown> = {};
    if (yesterdayRecord) {
      const yMorning = yesterdayRecord.morning_session as { avg_change_pct?: number } | null;
      const yAfternoon = yesterdayRecord.afternoon_session as { avg_change_pct?: number } | null;
      const yFullDay = yesterdayRecord.full_day as { avg_change_pct?: number } | null;
      comparisonWithYesterday.yesterday_date = yesterdayRecord.analysis_date;
      comparisonWithYesterday.morning_avg_change_diff =
        morningStat.avg_change_pct - (yMorning?.avg_change_pct || 0);
      comparisonWithYesterday.afternoon_avg_change_diff =
        afternoonStat.avg_change_pct - (yAfternoon?.avg_change_pct || 0);
      comparisonWithYesterday.full_day_avg_change_diff =
        fullDayStat.avg_change_pct - (yFullDay?.avg_change_pct || 0);
      comparisonWithYesterday.yesterday_insight = yesterdayRecord.ai_insight || null;
    } else {
      comparisonWithYesterday.yesterday_date = null;
      comparisonWithYesterday.note = '昨日无策略演进记录';
    }

    // 7. 调用 AI 生成策略洞察
    const sessionStats = {
      morning: {
        avg_change_pct: morningStat.avg_change_pct,
        up_count: morningStat.up_count,
        down_count: morningStat.down_count,
      },
      afternoon: {
        avg_change_pct: afternoonStat.avg_change_pct,
        up_count: afternoonStat.up_count,
        down_count: afternoonStat.down_count,
      },
      full_day: {
        avg_change_pct: fullDayStat.avg_change_pct,
        up_count: fullDayStat.up_count,
        down_count: fullDayStat.down_count,
      },
    };

    const aiResult = await analyzeIntradayPatterns(
      stockSnapshots,
      sessionStats,
      (yesterdayRecord?.ai_insight as string) || null
    );

    // 8. upsert 到 strategy_evolution 表
    const { error: upsertError } = await serverClient
      .from('strategy_evolution')
      .upsert(
        {
          analysis_date: today,
          morning_session: morningStat,
          afternoon_session: afternoonStat,
          full_day: fullDayStat,
          top_performers: topPerformers,
          bottom_performers: bottomPerformers,
          ai_insight: aiResult.ai_insight,
          pattern_findings: aiResult.pattern_findings,
          strategy_adjustments: aiResult.strategy_adjustments,
          comparison_with_yesterday: comparisonWithYesterday,
        },
        { onConflict: 'analysis_date' }
      );

    if (upsertError) {
      return NextResponse.json(
        { error: '保存策略演进分析失败', detail: upsertError.message },
        { status: 500 }
      );
    }

    // 9. 如果 AI 建议了因子权重调整, 应用到 analysis_factors 表
    const adjustments = aiResult.strategy_adjustments;
    const hasAdjustments =
      adjustments && Object.keys(adjustments).length > 0 &&
      Object.values(adjustments).some((v) => v !== 0);

    if (hasAdjustments) {
      // 查询当前所有启用的因子
      const { data: factors } = await serverClient
        .from('analysis_factors')
        .select('id, factor_key, weight, adjustment_count')
        .eq('is_active', true);

      if (factors && factors.length > 0) {
        let totalWeight = 0;
        const updatedFactors: {
          id: string;
          new_weight: number;
          adjustment_count: number;
        }[] = [];

        for (const factor of factors) {
          const key = factor.factor_key;
          const adjustment = adjustments[key] || 0;
          let newWeight = factor.weight + adjustment;
          // 权重下限保护
          if (newWeight < 0.01) newWeight = 0.01;
          updatedFactors.push({
            id: factor.id,
            new_weight: newWeight,
            adjustment_count: factor.adjustment_count + 1,
          });
          totalWeight += newWeight;
        }

        // 归一化: 确保所有权重之和 = 1.0
        if (totalWeight > 0) {
          for (const f of updatedFactors) {
            f.new_weight =
              Math.round((f.new_weight / totalWeight) * 10000) / 10000;
          }
        }

        // 更新 analysis_factors 表
        for (const f of updatedFactors) {
          await serverClient
            .from('analysis_factors')
            .update({
              weight: f.new_weight,
              adjustment_count: f.adjustment_count,
              updated_at: new Date().toISOString(),
            })
            .eq('id', f.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      ai_insight_length: aiResult.ai_insight.length,
      pattern_count: aiResult.pattern_findings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
