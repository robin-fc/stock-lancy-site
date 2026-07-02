"use client";

import * as React from "react";
import {
  Filter,
  Calendar,
  Search,
  TrendingUp,
  RefreshCw,
  Zap,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, LoadingOverlay } from "@/components/ui/loading";
import { SignalBadge } from "@/components/stock/signal-badge";
import { PickDrawer } from "@/components/stock/pick-drawer";
import { useAuthStore } from "@/store/auth";
import { authFetch, getAuthHeaders, parseApiError } from "@/lib/api";
import { cn, formatPrice, formatDate } from "@/lib/utils";
import { SIGNAL_LABELS, RISK_LABELS } from "@/types";
import type { StockPick, Signal, RiskLevel } from "@/types";

const SIGNAL_FILTERS: { value: Signal | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "strong_buy", label: SIGNAL_LABELS.strong_buy },
  { value: "buy", label: SIGNAL_LABELS.buy },
  { value: "hold", label: SIGNAL_LABELS.hold },
  { value: "sell", label: SIGNAL_LABELS.sell },
  { value: "strong_sell", label: SIGNAL_LABELS.strong_sell },
];

/** 每页条数 */
const PAGE_SIZE = 15;

/** 可排序字段 */
type SortKey = "confidence" | "current_price" | "pick_date";
type SortDir = "asc" | "desc";

/** 表格列定义 */
interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  sortKey?: SortKey;
  align?: "left" | "right" | "center";
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "symbol", label: "代码", sortable: false, align: "left" },
  { key: "name", label: "名称", sortable: false, align: "left" },
  { key: "signal", label: "信号", sortable: false, align: "left" },
  {
    key: "confidence",
    label: "置信度",
    sortable: true,
    sortKey: "confidence",
    align: "right",
  },
  {
    key: "current_price",
    label: "当前价",
    sortable: true,
    sortKey: "current_price",
    align: "right",
  },
  { key: "entry_price", label: "入场价", sortable: false, align: "right" },
  { key: "target_price", label: "目标价", sortable: false, align: "right" },
  { key: "stop_loss", label: "止损价", sortable: false, align: "right" },
  { key: "risk_level", label: "风险", sortable: false, align: "center" },
  {
    key: "pick_date",
    label: "日期",
    sortable: true,
    sortKey: "pick_date",
    align: "right",
  },
];

/** 判断是否为创业板/科创板 (300 开头为创业板, 688 开头为科创板) */
function isGEMorSTAR(symbol: string): boolean {
  return symbol.startsWith("300") || symbol.startsWith("688");
}

/** 获取交易所标签 (SH/SZ) */
function getExchangeTag(symbol: string): string {
  return symbol.startsWith("6") ? "SH" : "SZ";
}

/** 风险等级对应的 Badge 变体 */
function getRiskBadgeVariant(
  level: RiskLevel
): "green" | "yellow" | "red" {
  switch (level) {
    case "low":
      return "green";
    case "medium":
      return "yellow";
    case "high":
      return "red";
  }
}

export default function PicksPage() {
  const { initialized, init } = useAuthStore();

  const [picks, setPicks] = React.useState<StockPick[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [signalFilter, setSignalFilter] = React.useState<Signal | "all">("all");
  const [dateFilter, setDateFilter] = React.useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [excludeGEM, setExcludeGEM] = React.useState(false);

  // 排序状态
  const [sortKey, setSortKey] = React.useState<SortKey>("pick_date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // 分页状态
  const [page, setPage] = React.useState(1);

  // 抽屉状态
  const [selectedPickId, setSelectedPickId] = React.useState<string | null>(
    null
  );

  // 生成选股状态
  const [generating, setGenerating] = React.useState(false);
  const [generateMsg, setGenerateMsg] = React.useState<string | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // 加载选股数据
  const loadPicks = React.useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (signalFilter !== "all") params.set("signal", signalFilter);
      if (dateFilter) params.set("date", dateFilter);

      const res = await fetch(`/api/picks?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPicks(data.picks || []);
      } else {
        setPicks([]);
      }
    } catch {
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }, [signalFilter, dateFilter]);

  React.useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  // 筛选/排序变化时回到第一页
  React.useEffect(() => {
    setPage(1);
  }, [signalFilter, dateFilter, excludeGEM, sortKey, sortDir]);

  function handleReset() {
    setSignalFilter("all");
    setDateFilter(new Date().toISOString().split("T")[0]);
    setExcludeGEM(false);
  }

  // 切换排序
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // 生成今日选股
  async function handleGenerate() {
    setGenerating(true);
    setGenerateMsg("正在生成选股，约需1分钟...");
    setGenerateError(null);
    try {
      const res = await authFetch("/api/picks/generate", { method: "POST" });
      if (!res.ok) {
        setGenerateError(await parseApiError(res));
        return;
      }
      const data = await res.json();
      const successCount = data.success_count ?? 0;
      const errorCount = data.error_count ?? 0;
      setGenerateMsg(
        `生成完成：成功 ${successCount} 条${errorCount > 0 ? `，失败 ${errorCount} 条` : ""}`
      );
      await loadPicks();
      setTimeout(() => setGenerateMsg(null), 3000);
    } catch {
      setGenerateError("网络错误，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  // 客户端筛选 + 排序 + 分页
  const processedPicks = React.useMemo(() => {
    let result = [...picks];

    // 排除创业板/科创板
    if (excludeGEM) {
      result = result.filter((p) => !isGEMorSTAR(p.symbol));
    }

    // 排序
    result.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "confidence") {
        av = a.confidence;
        bv = b.confidence;
      } else if (sortKey === "current_price") {
        av = a.current_price ?? -Infinity;
        bv = b.current_price ?? -Infinity;
      } else {
        // pick_date
        av = a.pick_date;
        bv = b.pick_date;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [picks, excludeGEM, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedPicks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPicks = processedPicks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // 表头排序图标
  function renderSortIcon(col: ColumnDef) {
    if (!col.sortable) return null;
    const isActive = sortKey === col.sortKey;
    if (!isActive) {
      return (
        <ArrowUpDown
          size={12}
          className="text-[var(--text-muted)] opacity-50"
        />
      );
    }
    return sortDir === "asc" ? (
      <ChevronUp size={14} className="text-[var(--accent)]" />
    ) : (
      <ChevronDown size={14} className="text-[var(--accent)]" />
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {generating && <LoadingOverlay text="正在生成选股，约需1分钟..." />}

          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <TrendingUp size={24} className="text-[var(--accent)]" />
              选股列表
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              浏览 AI 生成的选股信号，点击行查看详情
            </p>
          </div>

          {/* 筛选栏 */}
          <Card className="mb-6 p-4">
            <div className="flex flex-col gap-4">
              {/* 信号筛选 */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <Filter size={13} /> 信号类型
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIGNAL_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setSignalFilter(f.value)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        signalFilter === f.value
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[#404040] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 日期筛选 + 创业板开关 + 操作 */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="sm:w-48">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                      <Calendar size={13} /> 选股日期
                    </label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                    />
                  </div>

                  {/* 排除创业板/科创板开关 */}
                  <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[#404040]">
                    <input
                      type="checkbox"
                      checked={excludeGEM}
                      onChange={(e) => setExcludeGEM(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-[var(--border)] accent-[var(--accent)]"
                    />
                    <span>排除创业板/科创板</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {(signalFilter !== "all" ||
                    dateFilter ||
                    excludeGEM) && (
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      清除筛选
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    生成今日选股
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPicks}
                    disabled={loading}
                  >
                    <RefreshCw
                      size={14}
                      className={loading ? "animate-spin" : ""}
                    />
                    刷新
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* 生成提示 */}
          {generateMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2">
              <Zap size={14} className="shrink-0 text-[var(--accent)]" />
              <p className="text-xs text-[var(--accent)]">{generateMsg}</p>
            </div>
          )}
          {generateError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">
              <AlertCircle size={14} className="shrink-0 text-[var(--red)]" />
              <p className="text-xs text-[var(--red)]">{generateError}</p>
            </div>
          )}

          {/* 结果统计 */}
          {!loading && (
            <div className="mb-4 flex items-center gap-2">
              <Search size={14} className="text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                共找到{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {processedPicks.length}
                </span>{" "}
                条选股
                {totalPages > 1 && (
                  <>
                    ，第{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {currentPage}
                    </span>
                    /{totalPages} 页
                  </>
                )}
              </p>
            </div>
          )}

          {/* 选股表格 */}
          {loading ? (
            <Loading text="加载选股数据..." className="py-20" />
          ) : processedPicks.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() =>
                            col.sortable && col.sortKey && handleSort(col.sortKey)
                          }
                          className={cn(
                            "px-3 py-3 text-xs font-medium text-[var(--text-secondary)] select-none",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.align !== "right" &&
                              col.align !== "center" &&
                              "text-left",
                            col.sortable &&
                              "cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              col.align === "right" && "flex-row-reverse"
                            )}
                          >
                            {col.label}
                            {renderSortIcon(col)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedPicks.map((pick) => {
                      const isSelected = selectedPickId === pick.id;
                      return (
                        <tr
                          key={pick.id}
                          onClick={() => setSelectedPickId(pick.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-[var(--accent)]/10"
                              : "hover:bg-[var(--surface-hover)]"
                          )}
                        >
                          {/* 代码 */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                                {pick.symbol}
                              </span>
                              <span className="rounded border border-[var(--border)] px-1 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                                {getExchangeTag(pick.symbol)}
                              </span>
                            </div>
                          </td>
                          {/* 名称 */}
                          <td className="px-3 py-3">
                            <div className="text-sm text-[var(--text-primary)]">
                              {pick.name}
                            </div>
                            {pick.sector && (
                              <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                {pick.sector}
                              </div>
                            )}
                          </td>
                          {/* 信号 */}
                          <td className="px-3 py-3">
                            <SignalBadge signal={pick.signal} size="sm" />
                          </td>
                          {/* 置信度 */}
                          <td className="px-3 py-3">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-sm font-semibold text-[var(--text-primary)]">
                                {pick.confidence.toFixed(0)}%
                              </span>
                              <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--border)]">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    pick.confidence > 70
                                      ? "bg-[var(--red)]"
                                      : pick.confidence >= 40
                                        ? "bg-[var(--text-secondary)]"
                                        : "bg-[var(--green)]"
                                  )}
                                  style={{ width: `${pick.confidence}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* 当前价 */}
                          <td className="px-3 py-3 text-right text-sm font-medium text-[var(--text-primary)]">
                            {formatPrice(pick.current_price)}
                          </td>
                          {/* 入场价 */}
                          <td className="px-3 py-3 text-right text-sm text-[var(--text-secondary)]" title="AI建议的买入价格">
                            {formatPrice(pick.entry_price)}
                          </td>
                          {/* 目标价 */}
                          <td
                            className={cn(
                              "px-3 py-3 text-right text-sm font-medium",
                              pick.signal === "sell" || pick.signal === "strong_sell"
                                ? "text-[var(--green)]"
                                : "text-[var(--red)]"
                            )}
                            title={
                              pick.signal === "sell" || pick.signal === "strong_sell"
                                ? "预期下跌目标价"
                                : "预期上涨目标价"
                            }
                          >
                            {formatPrice(pick.target_price)}
                          </td>
                          {/* 止损价 */}
                          <td className="px-3 py-3 text-right text-sm font-medium text-[var(--green)]" title="跌破此价建议止损">
                            {formatPrice(pick.stop_loss)}
                          </td>
                          {/* 风险 */}
                          <td className="px-3 py-3 text-center">
                            <Badge variant={getRiskBadgeVariant(pick.risk_level)}>
                              {RISK_LABELS[pick.risk_level]}
                            </Badge>
                          </td>
                          {/* 日期 */}
                          <td className="px-3 py-3 text-right text-xs text-[var(--text-muted)]">
                            {formatDate(pick.pick_date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row">
                  <p className="text-xs text-[var(--text-muted)]">
                    共 {processedPicks.length} 条，每页 {PAGE_SIZE} 条
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="上一页"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {generatePageNumbers(currentPage, totalPages).map(
                      (p, idx) =>
                        p === "..." ? (
                          <span
                            key={`ellipsis-${idx}`}
                            className="flex h-8 w-8 items-center justify-center text-xs text-[var(--text-muted)]"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={cn(
                              "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
                              p === currentPage
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            {p}
                          </button>
                        )
                    )}

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage >= totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="下一页"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)]">
                <Search size={28} className="text-[var(--text-muted)]" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-[var(--text-primary)]">
                  暂无符合条件的选股
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {signalFilter !== "all" ||
                  dateFilter ||
                  excludeGEM
                    ? "尝试调整筛选条件或清除筛选"
                    : "点击下方按钮，立即生成今日选股"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  生成今日选股
                </Button>
                {(signalFilter !== "all" ||
                  dateFilter ||
                  excludeGEM) && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    清除筛选
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </main>

      <Footer />

      {/* 侧滑抽屉 */}
      <PickDrawer
        pickId={selectedPickId}
        onClose={() => setSelectedPickId(null)}
      />
    </div>
  );
}

/** 生成分页页码 (带省略号) */
function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const result: (number | "...")[] = [1];

  if (current > 3) {
    result.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    result.push(i);
  }

  if (current < total - 2) {
    result.push("...");
  }

  result.push(total);
  return result;
}
