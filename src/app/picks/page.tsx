"use client";

import * as React from "react";
import { Filter, Calendar, Search, TrendingUp, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";
import { PickCard } from "@/components/stock/pick-card";
import { useAuthStore } from "@/store/auth";
import { getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SIGNAL_LABELS } from "@/types";
import type { StockPick, Signal } from "@/types";

const SIGNAL_FILTERS: { value: Signal | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "strong_buy", label: SIGNAL_LABELS.strong_buy },
  { value: "buy", label: SIGNAL_LABELS.buy },
  { value: "hold", label: SIGNAL_LABELS.hold },
  { value: "sell", label: SIGNAL_LABELS.sell },
  { value: "strong_sell", label: SIGNAL_LABELS.strong_sell },
];

export default function PicksPage() {
  const { initialized, init } = useAuthStore();

  const [picks, setPicks] = React.useState<StockPick[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [signalFilter, setSignalFilter] = React.useState<Signal | "all">("all");
  const [dateFilter, setDateFilter] = React.useState("");

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // 加载选股数据
  const loadPicks = React.useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set("limit", "50");
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

  function handleReset() {
    setSignalFilter("all");
    setDateFilter("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <TrendingUp size={24} className="text-[var(--accent)]" />
              选股列表
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              浏览 AI 生成的选股信号，按信号类型和日期筛选
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

              {/* 日期筛选 + 操作 */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="sm:w-56">
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

                <div className="flex items-center gap-2">
                  {(signalFilter !== "all" || dateFilter) && (
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      清除筛选
                    </Button>
                  )}
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

          {/* 结果统计 */}
          {!loading && (
            <div className="mb-4 flex items-center gap-2">
              <Search size={14} className="text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                共找到 <span className="font-semibold text-[var(--text-primary)]">{picks.length}</span> 条选股
              </p>
            </div>
          )}

          {/* 选股列表 */}
          {loading ? (
            <Loading text="加载选股数据..." className="py-20" />
          ) : picks.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} />
              ))}
            </div>
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
                  {signalFilter !== "all" || dateFilter
                    ? "尝试调整筛选条件或清除筛选"
                    : "请稍后再来查看最新选股"}
                </p>
              </div>
              {(signalFilter !== "all" || dateFilter) && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  清除筛选
                </Button>
              )}
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
