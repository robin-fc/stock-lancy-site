"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Brain,
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  AlertCircle,
  Loader2,
  Zap,
  Camera,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { AnalysisPanel } from "@/components/stock/analysis-panel";
import { useAuthStore } from "@/store/auth";
import { authFetch, parseApiError } from "@/lib/api";
import { cn, formatPrice, formatPct, formatDate, truncate } from "@/lib/utils";
import {
  SNAPSHOT_LABELS,
  FACTOR_LABELS,
  type IntradaySnapshot,
  type StrategyEvolution,
  type SnapshotType,
} from "@/types";

// ========== 常量 ==========

const SNAPSHOT_ORDER: SnapshotType[] = [
  "morning_open",
  "morning_close",
  "afternoon_open",
  "afternoon_close",
];

const SNAPSHOT_CARD_THEME: Record<
  SnapshotType,
  { color: string; iconBg: string; icon: React.ReactNode }
> = {
  morning_open: {
    color: "var(--accent)",
    iconBg: "bg-[var(--accent)]/10",
    icon: <Clock size={18} className="text-[var(--accent)]" />,
  },
  morning_close: {
    color: "var(--yellow)",
    iconBg: "bg-[var(--yellow)]/10",
    icon: <Clock size={18} className="text-[var(--yellow)]" />,
  },
  afternoon_open: {
    color: "var(--orange)",
    iconBg: "bg-[var(--orange)]/10",
    icon: <Clock size={18} className="text-[var(--orange)]" />,
  },
  afternoon_close: {
    color: "var(--green)",
    iconBg: "bg-[var(--green)]/10",
    icon: <Activity size={18} className="text-[var(--green)]" />,
  },
};

// ========== 类型 ==========

interface StockSnapshotGroup {
  symbol: string;
  name: string;
  snapshots: Record<SnapshotType, IntradaySnapshot | undefined>;
}

interface SessionStats {
  avg_change_pct: number;
  up_count: number;
  down_count: number;
  max_gain: { symbol: string; name: string; pct: number } | null;
  max_loss: { symbol: string; name: string; pct: number } | null;
  count: number;
}

// ========== 辅助函数 ==========

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function toDateOnly(s: string): string {
  return s.split("T")[0];
}

function formatVolume(vol: number): string {
  if (vol >= 1e8) return (vol / 1e8).toFixed(2) + "亿";
  if (vol >= 1e4) return (vol / 1e4).toFixed(2) + "万";
  return String(vol);
}

function formatTurnover(val: number): string {
  if (val >= 1e4) return (val / 1e4).toFixed(2) + "亿";
  return val.toFixed(2) + "万";
}

/** 将置信度归一化到 0-100 */
function normalizeConfidence(c: number): number {
  if (c <= 1) return c * 100;
  return Math.max(0, Math.min(100, c));
}

function groupSnapshotsBySymbol(
  snapshots: IntradaySnapshot[]
): StockSnapshotGroup[] {
  const map = new Map<string, StockSnapshotGroup>();
  for (const s of snapshots) {
    if (!map.has(s.symbol)) {
      map.set(s.symbol, {
        symbol: s.symbol,
        name: s.name,
        snapshots: {
          morning_open: undefined,
          morning_close: undefined,
          afternoon_open: undefined,
          afternoon_close: undefined,
        },
      });
    }
    map.get(s.symbol)!.snapshots[s.snapshot_type] = s;
  }
  return Array.from(map.values());
}

/** 计算某一时段快照的平均涨跌幅和涨跌家数 */
function computeSnapshotTypeStats(
  snapshots: IntradaySnapshot[],
  type: SnapshotType
) {
  const filtered = snapshots.filter((s) => s.snapshot_type === type);
  if (filtered.length === 0) return null;
  const avgChange =
    filtered.reduce((sum, s) => sum + s.change_pct, 0) / filtered.length;
  const upCount = filtered.filter((s) => s.change_pct > 0).length;
  const downCount = filtered.filter((s) => s.change_pct < 0).length;
  // 平均时段变化 (相对上一快照)
  const withPrev = filtered.filter((s) => s.price_change_pct != null);
  const avgSessionChange =
    withPrev.length > 0
      ? withPrev.reduce((sum, s) => sum + (s.price_change_pct ?? 0), 0) /
        withPrev.length
      : null;
  return { avgChange, upCount, downCount, count: filtered.length, avgSessionChange };
}

/** 计算某只股票在指定时段的变化百分比 */
function getStockSessionChange(
  group: StockSnapshotGroup,
  session: "morning" | "afternoon" | "full_day"
): number | null {
  const s = group.snapshots;
  if (session === "morning") {
    if (s.morning_close?.price_change_pct != null)
      return s.morning_close.price_change_pct;
    if (s.morning_open && s.morning_close && s.morning_open.price > 0) {
      return (
        ((s.morning_close.price - s.morning_open.price) / s.morning_open.price) *
        100
      );
    }
  } else if (session === "afternoon") {
    if (s.afternoon_close?.price_change_pct != null)
      return s.afternoon_close.price_change_pct;
    if (s.afternoon_open && s.afternoon_close && s.afternoon_open.price > 0) {
      return (
        ((s.afternoon_close.price - s.afternoon_open.price) /
          s.afternoon_open.price) *
        100
      );
    }
  } else if (session === "full_day") {
    if (s.morning_open && s.afternoon_close && s.morning_open.price > 0) {
      return (
        ((s.afternoon_close.price - s.morning_open.price) /
          s.morning_open.price) *
        100
      );
    }
  }
  return null;
}

/** 计算时段统计 */
function computeSessionStats(
  groups: StockSnapshotGroup[],
  session: "morning" | "afternoon" | "full_day"
): SessionStats | null {
  const changes: { symbol: string; name: string; pct: number }[] = [];
  for (const g of groups) {
    const pct = getStockSessionChange(g, session);
    if (pct != null) changes.push({ symbol: g.symbol, name: g.name, pct });
  }
  if (changes.length === 0) return null;
  const avg = changes.reduce((s, c) => s + c.pct, 0) / changes.length;
  const up = changes.filter((c) => c.pct > 0).length;
  const down = changes.filter((c) => c.pct < 0).length;
  const maxGain = changes.reduce((m, c) => (c.pct > m.pct ? c : m), changes[0]);
  const maxLoss = changes.reduce((m, c) => (c.pct < m.pct ? c : m), changes[0]);
  return {
    avg_change_pct: avg,
    up_count: up,
    down_count: down,
    max_gain: maxGain,
    max_loss: maxLoss,
    count: changes.length,
  };
}

// ========== 子组件 ==========

/** 涨跌家数对比进度条 */
function UpDownBar({ up, down }: { up: number; down: number }) {
  const total = up + down;
  const upPct = total > 0 ? (up / total) * 100 : 0;
  const downPct = total > 0 ? (down / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--red)]">↑ {up} 上涨</span>
        <span className="text-[var(--green)]">{down} 下跌 ↓</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="bg-[var(--red)] transition-all duration-500"
          style={{ width: `${upPct}%` }}
        />
        <div
          className="bg-[var(--green)] transition-all duration-500"
          style={{ width: `${downPct}%` }}
        />
      </div>
    </div>
  );
}

/** 涨跌幅颜色 (A股: 红涨绿跌) */
function pctColor(pct: number | null | undefined): string {
  if (pct == null) return "text-[var(--text-muted)]";
  if (pct > 0) return "text-[var(--red)]";
  if (pct < 0) return "text-[var(--green)]";
  return "text-[var(--text-secondary)]";
}

/** 时段概览卡片 */
function SnapshotOverviewCard({
  type,
  stats,
  sessionChangeLabel,
  sessionChange,
}: {
  type: SnapshotType;
  stats: ReturnType<typeof computeSnapshotTypeStats>;
  sessionChangeLabel?: string;
  sessionChange?: number | null;
}) {
  const theme = SNAPSHOT_CARD_THEME[type];
  const label = SNAPSHOT_LABELS[type];
  return (
    <Card className="border-l-4" style={{ borderLeftColor: theme.color }}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              theme.iconBg
            )}
          >
            {theme.icon}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {label}
          </span>
        </div>
        {stats ? (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">平均涨跌幅</p>
              <p
                className={cn(
                  "text-xl font-bold",
                  pctColor(stats.avgChange)
                )}
              >
                {formatPct(stats.avgChange)}
              </p>
            </div>
            {sessionChangeLabel && sessionChange != null && (
              <div>
                <p className="text-xs text-[var(--text-muted)]">
                  {sessionChangeLabel}
                </p>
                <p
                  className={cn(
                    "text-sm font-medium",
                    pctColor(sessionChange)
                  )}
                >
                  {formatPct(sessionChange)}
                </p>
              </div>
            )}
            <UpDownBar up={stats.upCount} down={stats.downCount} />
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">
            暂无数据
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 时段统计列 */
function SessionStatsColumn({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: SessionStats | null;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h4>
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {stats ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              平均变化
            </span>
            <span
              className={cn(
                "text-sm font-bold",
                pctColor(stats.avg_change_pct)
              )}
            >
              {formatPct(stats.avg_change_pct)}
            </span>
          </div>
          <UpDownBar up={stats.up_count} down={stats.down_count} />
          {stats.max_gain && (
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
              <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <TrendingUp size={12} className="text-[var(--red)]" /> 最大涨幅
              </span>
              <div className="text-right">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {stats.max_gain.name}
                </p>
                <p className="text-xs text-[var(--red)]">
                  {formatPct(stats.max_gain.pct)}
                </p>
              </div>
            </div>
          )}
          {stats.max_loss && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <TrendingDown size={12} className="text-[var(--green)]" /> 最大跌幅
              </span>
              <div className="text-right">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {stats.max_loss.name}
                </p>
                <p className="text-xs text-[var(--green)]">
                  {formatPct(stats.max_loss.pct)}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-[var(--text-muted)]">
          暂无数据
        </p>
      )}
    </Card>
  );
}

/** 股票快照表格 */
function StockSnapshotTable({ groups }: { groups: StockSnapshotGroup[] }) {
  const [sortDesc, setSortDesc] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggleRow(symbol: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  // 排序: 按全天变化%
  const sorted = React.useMemo(() => {
    const withChange = groups.map((g) => ({
      group: g,
      fullDayChange: getStockSessionChange(g, "full_day"),
    }));
    withChange.sort((a, b) => {
      const av = a.fullDayChange ?? -Infinity;
      const bv = b.fullDayChange ?? -Infinity;
      return sortDesc ? bv - av : av - bv;
    });
    return withChange;
  }, [groups, sortDesc]);

  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-12">
        <Activity size={28} className="text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          该日期暂无快照数据
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)] text-xs text-[var(--text-secondary)]">
              <th className="px-3 py-3 text-left font-medium">代码</th>
              <th className="px-3 py-3 text-left font-medium">名称</th>
              <th className="px-3 py-3 text-right font-medium">开盘价</th>
              <th className="px-3 py-3 text-right font-medium">休市价</th>
              <th className="px-3 py-3 text-right font-medium">下午开盘</th>
              <th className="px-3 py-3 text-right font-medium">收盘价</th>
              <th className="px-3 py-3 text-right font-medium">上午变化%</th>
              <th className="px-3 py-3 text-right font-medium">下午变化%</th>
              <th
                className="cursor-pointer select-none px-3 py-3 text-right font-medium hover:text-[var(--text-primary)]"
                onClick={() => setSortDesc((v) => !v)}
              >
                <span className="inline-flex items-center gap-1">
                  全天变化%
                  {sortDesc ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronUp size={12} />
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ group, fullDayChange }) => {
              const s = group.snapshots;
              const morningChange = getStockSessionChange(group, "morning");
              const afternoonChange = getStockSessionChange(group, "afternoon");
              const isExpanded = expanded.has(group.symbol);
              return (
                <React.Fragment key={group.symbol}>
                  <tr
                    className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
                    onClick={() => toggleRow(group.symbol)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronUp
                            size={14}
                            className="text-[var(--text-muted)]"
                          />
                        ) : (
                          <ChevronDown
                            size={14}
                            className="text-[var(--text-muted)]"
                          />
                        )}
                        <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                          {group.symbol}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {group.name}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                      {s.morning_open ? formatPrice(s.morning_open.price) : "--"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                      {s.morning_close ? formatPrice(s.morning_close.price) : "--"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                      {s.afternoon_open
                        ? formatPrice(s.afternoon_open.price)
                        : "--"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                      {s.afternoon_close
                        ? formatPrice(s.afternoon_close.price)
                        : "--"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-medium",
                        pctColor(morningChange)
                      )}
                    >
                      {formatPct(morningChange)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-medium",
                        pctColor(afternoonChange)
                      )}
                    >
                      {formatPct(afternoonChange)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-bold",
                        pctColor(fullDayChange)
                      )}
                    >
                      {formatPct(fullDayChange)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {SNAPSHOT_ORDER.map((st) => (
                            <SnapshotDetailCard
                              key={st}
                              snapshot={s[st]}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** 快照详情卡片 (展开行内) */
function SnapshotDetailCard({
  snapshot,
}: {
  snapshot: IntradaySnapshot | undefined;
}) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
        <p className="text-xs text-[var(--text-muted)]">无快照数据</p>
      </div>
    );
  }
  const label = SNAPSHOT_LABELS[snapshot.snapshot_type];
  const indicatorEntries = Object.entries(snapshot.indicators || {}).slice(0, 6);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
        {label}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">价格</span>
          <span className="font-medium text-[var(--text-primary)]">
            {formatPrice(snapshot.price)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">当日涨跌</span>
          <span className={pctColor(snapshot.change_pct)}>
            {formatPct(snapshot.change_pct)}
          </span>
        </div>
        {snapshot.price_change_pct != null && (
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">时段变化</span>
            <span className={pctColor(snapshot.price_change_pct)}>
              {formatPct(snapshot.price_change_pct)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">成交量</span>
          <span className="text-[var(--text-secondary)]">
            {formatVolume(snapshot.volume)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">成交额</span>
          <span className="text-[var(--text-secondary)]">
            {formatTurnover(snapshot.turnover)}
          </span>
        </div>
        {snapshot.volume_change_pct != null && (
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">量比变化</span>
            <span className={pctColor(snapshot.volume_change_pct)}>
              {formatPct(snapshot.volume_change_pct)}
            </span>
          </div>
        )}
        {indicatorEntries.length > 0 && (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <p className="mb-1 text-[var(--text-muted)]">技术指标</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {indicatorEntries.map(([k, v]) => (
                <span key={k} className="text-[var(--text-secondary)]">
                  {k.toUpperCase()}:{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {typeof v === "number" ? v.toFixed(2) : v}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 策略调整条形图 */
function StrategyAdjustmentChart({
  adjustments,
}: {
  adjustments: Record<string, number>;
}) {
  const entries = Object.entries(adjustments);
  if (entries.length === 0) return null;
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.01);

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const label = FACTOR_LABELS[key] ?? key;
        const isPositive = value > 0;
        const widthPct = (Math.abs(value) / maxAbs) * 50;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">{label}</span>
              <span
                className={cn(
                  "font-semibold",
                  isPositive ? "text-[var(--red)]" : "text-[var(--green)]"
                )}
              >
                {value > 0 ? "+" : ""}
                {value.toFixed(2)}
              </span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-[var(--border)]">
              <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--text-muted)]" />
              {isPositive ? (
                <div
                  className="absolute left-1/2 top-0 h-full rounded-r-full bg-[var(--red)] transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              ) : (
                <div
                  className="absolute right-1/2 top-0 h-full rounded-l-full bg-[var(--green)] transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 表现最佳/最差股票列表 */
function PerformersList({
  title,
  performers,
  isGain,
}: {
  title: string;
  performers: { symbol: string; name: string; change_pct: number; signal: string }[];
  isGain: boolean;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        {isGain ? (
          <TrendingUp size={14} className="text-[var(--red)]" />
        ) : (
          <TrendingDown size={14} className="text-[var(--green)]" />
        )}
        {title}
      </p>
      {performers.length > 0 ? (
        <div className="space-y-1.5">
          {performers.map((p, i) => (
            <div
              key={`${p.symbol}-${i}`}
              className="flex items-center justify-between rounded-md bg-[var(--surface-hover)] px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                  {p.symbol}
                </span>
                <span className="ml-1.5 truncate text-xs text-[var(--text-secondary)]">
                  {p.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {p.signal && (
                  <Badge variant="gray" className="text-[10px]">
                    {p.signal}
                  </Badge>
                )}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    pctColor(p.change_pct)
                  )}
                >
                  {formatPct(p.change_pct)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">暂无数据</p>
      )}
    </div>
  );
}

/** AI 策略洞察区 */
function StrategyInsightSection({
  evolution,
}: {
  evolution: StrategyEvolution;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <Brain size={18} className="text-[var(--accent)]" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              AI策略洞察 - {formatDate(evolution.analysis_date)}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              基于当日4次快照对比分析
            </p>
          </div>
        </div>

        {/* AI 洞察文本 */}
        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
          <AnalysisPanel analysis={evolution.ai_insight} />
        </div>

        {/* 发现的规律 */}
        {evolution.pattern_findings.length > 0 && (
          <div className="mb-5">
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              发现的规律
            </h4>
            <div className="space-y-3">
              {evolution.pattern_findings.map((p, i) => {
                const conf = normalizeConfidence(p.confidence);
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {p.pattern}
                      </span>
                      <Badge
                        variant={
                          conf > 70 ? "red" : conf > 40 ? "yellow" : "green"
                        }
                      >
                        置信度 {conf.toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="mb-2 text-xs text-[var(--text-secondary)]">
                      {p.description}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          conf > 70
                            ? "bg-[var(--red)]"
                            : conf > 40
                            ? "bg-[var(--yellow)]"
                            : "bg-[var(--green)]"
                        )}
                        style={{ width: `${conf}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 策略调整建议 */}
        {Object.keys(evolution.strategy_adjustments).length > 0 && (
          <div className="mb-5">
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              策略调整建议
            </h4>
            <StrategyAdjustmentChart
              adjustments={evolution.strategy_adjustments}
            />
          </div>
        )}

        {/* 涨幅前5 / 跌幅前5 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PerformersList
            title="涨幅前5"
            performers={evolution.top_performers}
            isGain
          />
          <PerformersList
            title="跌幅前5"
            performers={evolution.bottom_performers}
            isGain={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** 历史策略演进区 */
function HistoryEvolutionSection({
  evolutions,
}: {
  evolutions: StrategyEvolution[];
}) {
  const [showHistory, setShowHistory] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    new Set()
  );

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (evolutions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setShowHistory((v) => !v)}
        >
          <span className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <History size={18} className="text-[var(--accent)]" />
            历史策略演进
            <Badge variant="gray">最近{evolutions.length}天</Badge>
          </span>
          {showHistory ? (
            <ChevronUp size={18} className="text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown size={18} className="text-[var(--text-secondary)]" />
          )}
        </button>

        {showHistory && (
          <div className="mt-4 space-y-2">
            {evolutions.map((evo) => {
              const isExpanded = expandedIds.has(evo.id);
              return (
                <div
                  key={evo.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]"
                >
                  <button
                    className="flex w-full items-start justify-between gap-3 p-3 text-left"
                    onClick={() => toggleExpanded(evo.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatDate(evo.analysis_date)}
                        </span>
                        <Badge variant="blue">
                          {evo.pattern_findings.length} 个规律
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {truncate(evo.ai_insight, 100)}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        size={16}
                        className="mt-0.5 shrink-0 text-[var(--text-muted)]"
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        className="mt-0.5 shrink-0 text-[var(--text-muted)]"
                      />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="space-y-4 border-t border-[var(--border)] p-3">
                      <div className="rounded-md bg-[var(--bg)] p-3">
                        <AnalysisPanel analysis={evo.ai_insight} />
                      </div>

                      {evo.pattern_findings.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                            发现的规律
                          </p>
                          <div className="space-y-2">
                            {evo.pattern_findings.map((p, i) => {
                              const conf = normalizeConfidence(p.confidence);
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 rounded-md bg-[var(--bg)] px-3 py-2"
                                >
                                  <span className="text-xs font-medium text-[var(--text-primary)]">
                                    {p.pattern}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                                    {p.description}
                                  </span>
                                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                                    {conf.toFixed(0)}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {Object.keys(evo.strategy_adjustments).length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                            策略调整
                          </p>
                          <StrategyAdjustmentChart
                            adjustments={evo.strategy_adjustments}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <PerformersList
                          title="涨幅前5"
                          performers={evo.top_performers}
                          isGain
                        />
                        <PerformersList
                          title="跌幅前5"
                          performers={evo.bottom_performers}
                          isGain={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== 主页面组件 ==========

export default function IntradayPage() {
  const router = useRouter();
  const { profile, loading, initialized, init } = useAuthStore();

  const [selectedDate, setSelectedDate] = React.useState(getTodayString());
  const [snapshots, setSnapshots] = React.useState<IntradaySnapshot[] | null>(
    null
  );
  const [evolutions, setEvolutions] = React.useState<StrategyEvolution[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = React.useState(true);
  const [evolutionsLoading, setEvolutionsLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 手动触发快照采集
  const [triggeringType, setTriggeringType] = React.useState<SnapshotType | null>(null);
  const [triggerMsg, setTriggerMsg] = React.useState<string | null>(null);
  const [triggerError, setTriggerError] = React.useState<string | null>(null);

  // 初始化 auth store
  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // 未登录跳转
  React.useEffect(() => {
    if (initialized && !loading && !profile) {
      router.replace("/login");
    }
  }, [initialized, loading, profile, router]);

  // 加载快照数据
  const loadSnapshots = React.useCallback(
    async (date: string, isRefresh = false) => {
      if (!profile) return;
      if (isRefresh) setRefreshing(true);
      else setSnapshotsLoading(true);
      setError(null);
      try {
        const res = await authFetch(
          `/api/intraday/snapshots?date=${encodeURIComponent(date)}`
        );
        if (!res.ok) {
          setError(await parseApiError(res));
          return;
        }
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setSnapshotsLoading(false);
        setRefreshing(false);
      }
    },
    [profile]
  );

  // 加载策略演进数据
  const loadEvolutions = React.useCallback(async () => {
    if (!profile) return;
    setEvolutionsLoading(true);
    try {
      const res = await authFetch("/api/intraday/strategy?limit=10");
      if (res.ok) {
        const data = await res.json();
        setEvolutions(data.evolutions || []);
      }
    } catch {
      // 静默失败
    } finally {
      setEvolutionsLoading(false);
    }
  }, [profile]);

  // 日期变化时重新加载快照
  React.useEffect(() => {
    if (profile) loadSnapshots(selectedDate);
  }, [profile, selectedDate, loadSnapshots]);

  // 加载策略演进 (仅一次)
  React.useEffect(() => {
    if (profile) loadEvolutions();
  }, [profile, loadEvolutions]);

  // 计算派生数据
  const groupedSnapshots = React.useMemo(
    () => (snapshots ? groupSnapshotsBySymbol(snapshots) : []),
    [snapshots]
  );

  const snapshotStatsMap = React.useMemo(() => {
    const map: Record<SnapshotType, ReturnType<typeof computeSnapshotTypeStats>> = {
      morning_open: null,
      morning_close: null,
      afternoon_open: null,
      afternoon_close: null,
    };
    if (!snapshots) return map;
    for (const type of SNAPSHOT_ORDER) {
      map[type] = computeSnapshotTypeStats(snapshots, type);
    }
    return map;
  }, [snapshots]);

  const fullDayStats = React.useMemo(
    () => computeSessionStats(groupedSnapshots, "full_day"),
    [groupedSnapshots]
  );

  const morningStats = React.useMemo(
    () => computeSessionStats(groupedSnapshots, "morning"),
    [groupedSnapshots]
  );

  const afternoonStats = React.useMemo(
    () => computeSessionStats(groupedSnapshots, "afternoon"),
    [groupedSnapshots]
  );

  // 当天的策略演进
  const currentEvolution = React.useMemo(() => {
    return evolutions.find(
      (e) => toDateOnly(e.analysis_date) === selectedDate
    );
  }, [evolutions, selectedDate]);

  // 历史策略演进 (排除当天)
  const historyEvolutions = React.useMemo(() => {
    return evolutions.filter(
      (e) => toDateOnly(e.analysis_date) !== selectedDate
    );
  }, [evolutions, selectedDate]);

  // 手动触发快照采集
  async function handleTriggerSnapshot(type: SnapshotType) {
    setTriggeringType(type);
    setTriggerMsg(null);
    setTriggerError(null);
    try {
      const res = await authFetch(
        `/api/cron/intraday-snapshot?type=${type}`,
        { method: "POST" }
      );
      if (!res.ok) {
        setTriggerError(await parseApiError(res));
        return;
      }
      const data = await res.json();
      if (data.skipped) {
        setTriggerMsg(data.message || "今天非交易日，已跳过");
      } else {
        setTriggerMsg(
          `「${SNAPSHOT_LABELS[type]}」采集完成：成功 ${data.success_count} 条${data.error_count > 0 ? `，失败 ${data.error_count} 条` : ""}`
        );
        // 如果是收盘快照，提示策略分析也在进行
        if (type === "afternoon_close") {
          setTriggerMsg(
            `「收盘」快照采集完成，AI策略分析已自动触发，请稍后刷新查看`
          );
        }
        // 刷新快照数据
        await loadSnapshots(selectedDate, true);
        // 如果是收盘，也刷新策略演进
        if (type === "afternoon_close") {
          setTimeout(() => loadEvolutions(), 5000);
        }
      }
      // 5秒后清除提示
      setTimeout(() => setTriggerMsg(null), 5000);
    } catch {
      setTriggerError("网络错误，请稍后重试");
    } finally {
      setTriggeringType(null);
    }
  }

  // 手动触发策略分析
  async function handleTriggerAnalysis() {
    setTriggeringType("afternoon_close" as SnapshotType);
    setTriggerMsg(null);
    setTriggerError(null);
    try {
      const res = await authFetch("/api/cron/strategy-analysis", {
        method: "POST",
      });
      if (!res.ok) {
        setTriggerError(await parseApiError(res));
        return;
      }
      const data = await res.json();
      setTriggerMsg(
        `AI策略分析完成，发现 ${data.pattern_count || 0} 个规律`
      );
      await loadEvolutions();
      setTimeout(() => setTriggerMsg(null), 5000);
    } catch {
      setTriggerError("网络错误，请稍后重试");
    } finally {
      setTriggeringType(null);
    }
  }

  function handleRefresh() {
    loadSnapshots(selectedDate, true);
    loadEvolutions();
  }

  // 加载中
  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading size="lg" text="加载中..." />
        </div>
        <Footer />
      </div>
    );
  }

  // 未登录
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading text="正在跳转登录..." />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 1. 页面标题 */}
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <Activity size={24} className="text-[var(--accent)]" />
              盘中分析
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              4次快照对比 · AI策略演进
            </p>
          </div>

          {/* 2. 日期选择栏 */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Calendar
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="date"
                value={selectedDate}
                max={getTodayString()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] [color-scheme:dark]"
              />
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0"
            >
              {refreshing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              刷新
            </Button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-4 py-3">
              <AlertCircle size={16} className="text-[var(--red)]" />
              <p className="text-sm text-[var(--red)]">{error}</p>
            </div>
          )}

          {/* 快照采集触发栏 */}
          <Card className="mb-6 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <Camera size={13} /> 手动采集快照（点击对应时段按钮触发数据采集）
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {SNAPSHOT_ORDER.map((type) => {
                  const theme = SNAPSHOT_CARD_THEME[type];
                  const isTriggering = triggeringType === type;
                  const hasData = snapshotStatsMap[type] != null;
                  return (
                    <button
                      key={type}
                      onClick={() => handleTriggerSnapshot(type)}
                      disabled={triggeringType !== null}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50",
                        hasData
                          ? "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-primary)]"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      )}
                      style={hasData ? { borderLeftWidth: "3px", borderLeftColor: theme.color } : undefined}
                    >
                      {isTriggering ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : hasData ? (
                        <CheckCircle2 size={14} style={{ color: theme.color }} />
                      ) : (
                        <Camera size={14} />
                      )}
                      {SNAPSHOT_LABELS[type]}
                      {hasData && (
                        <span className="text-[var(--text-muted)]">✓</span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={handleTriggerAnalysis}
                  disabled={triggeringType !== null}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:opacity-50"
                >
                  {triggeringType === "afternoon_close" && triggerMsg?.includes("策略") ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <BarChart3 size={14} />
                  )}
                  AI策略分析
                </button>
              </div>
              {triggerMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2">
                  <CheckCircle2 size={14} className="shrink-0 text-[var(--green)]" />
                  <p className="text-xs text-[var(--green)]">{triggerMsg}</p>
                </div>
              )}
              {triggerError && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">
                  <AlertCircle size={14} className="shrink-0 text-[var(--red)]" />
                  <p className="text-xs text-[var(--red)]">{triggerError}</p>
                </div>
              )}
            </div>
          </Card>

          {/* 加载中 */}
          {snapshotsLoading ? (
            <Loading text="加载快照数据..." className="py-20" />
          ) : (
            <div className="space-y-8">
              {/* 3. 时段概览卡片 */}
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                  <Clock size={18} className="text-[var(--accent)]" />
                  时段概览
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {SNAPSHOT_ORDER.map((type) => {
                    const stats = snapshotStatsMap[type];
                    let sessionLabel: string | undefined;
                    let sessionVal: number | null | undefined;
                    if (type === "morning_close") {
                      sessionLabel = "上午时段变化";
                      sessionVal = stats?.avgSessionChange ?? null;
                    } else if (type === "afternoon_open") {
                      sessionLabel = "午后变化";
                      sessionVal = stats?.avgSessionChange ?? null;
                    } else if (type === "afternoon_close") {
                      sessionLabel = "全天变化";
                      sessionVal = fullDayStats?.avg_change_pct ?? null;
                    }
                    return (
                      <SnapshotOverviewCard
                        key={type}
                        type={type}
                        stats={stats}
                        sessionChangeLabel={sessionLabel}
                        sessionChange={sessionVal}
                      />
                    );
                  })}
                </div>
              </section>

              {/* 4. 时段对比统计 */}
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                  <TrendingUp size={18} className="text-[var(--accent)]" />
                  时段对比统计
                </h2>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <SessionStatsColumn
                    title="上午时段"
                    subtitle="开盘 → 休市"
                    stats={morningStats}
                  />
                  <SessionStatsColumn
                    title="下午时段"
                    subtitle="下午开盘 → 收盘"
                    stats={afternoonStats}
                  />
                  <SessionStatsColumn
                    title="全天"
                    subtitle="开盘 → 收盘"
                    stats={fullDayStats}
                  />
                </div>
              </section>

              {/* 5. 股票快照表格 */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                    <Activity size={18} className="text-[var(--accent)]" />
                    股票快照明细
                  </h2>
                  {groupedSnapshots.length > 0 && (
                    <Badge variant="gray">
                      共 {groupedSnapshots.length} 只
                    </Badge>
                  )}
                </div>
                <StockSnapshotTable groups={groupedSnapshots} />
              </section>

              {/* 6. AI策略洞察 */}
              <section>
                {evolutionsLoading ? (
                  <Loading text="加载策略洞察..." className="py-10" />
                ) : currentEvolution ? (
                  <StrategyInsightSection evolution={currentEvolution} />
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
                      <Brain size={28} className="text-[var(--text-muted)]" />
                      <p className="text-sm text-[var(--text-secondary)]">
                        收盘后将生成 AI 策略洞察
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        当日 {formatDate(selectedDate)} 暂无策略分析数据
                      </p>
                    </CardContent>
                  </Card>
                )}
              </section>

              {/* 7. 历史策略演进 */}
              {!evolutionsLoading && historyEvolutions.length > 0 && (
                <section>
                  <HistoryEvolutionSection evolutions={historyEvolutions} />
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
