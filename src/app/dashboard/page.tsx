"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Radar,
  Bookmark,
  Trophy,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { PickCard } from "@/components/stock/pick-card";
import { useAuthStore } from "@/store/auth";
import { authFetch } from "@/lib/api";
import type { StockPick, WatchlistItem } from "@/types";

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <Loading size="lg" text="加载中..." />
          </div>
          <Footer />
        </div>
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { profile, loading, initialized, init } = useAuthStore();

  const [picks, setPicks] = React.useState<StockPick[]>([]);
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);

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

  // 加载数据
  React.useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadData() {
      setDataLoading(true);
      try {
        const [picksRes, watchRes] = await Promise.all([
          authFetch("/api/picks?limit=20"),
          authFetch("/api/watchlist").catch(() => null),
        ]);

        if (!cancelled) {
          if (picksRes.ok) {
            const picksData = await picksRes.json();
            setPicks(picksData.picks || []);
          }
          if (watchRes && watchRes.ok) {
            const watchData = await watchRes.json();
            setWatchlist(watchData.watchlist || []);
          }
        }
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [profile]);

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

  // 未登录 (正在跳转)
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

  // 统计数据
  const today = new Date().toISOString().split("T")[0];
  const todayPicks = picks.filter((p) => p.pick_date?.split("T")[0] === today);
  const strongBuyCount = picks.filter(
    (p) => p.signal === "strong_buy"
  ).length;
  const featuredPicks = picks.filter((p) => p.is_featured).slice(0, 3);
  const latestPicks = picks.slice(0, 5);
  const watchlistPreview = watchlist.slice(0, 5);

  const stats = [
    {
      label: "今日选股",
      value: todayPicks.length,
      icon: TrendingUp,
      color: "text-[var(--accent)]",
      bg: "bg-[var(--accent)]/10",
    },
    {
      label: "强烈买入信号",
      value: strongBuyCount,
      icon: Radar,
      color: "text-[var(--red)]",
      bg: "bg-[var(--red)]/10",
    },
    {
      label: "自选股数量",
      value: watchlist.length,
      icon: Bookmark,
      color: "text-[var(--green)]",
      bg: "bg-[var(--green)]/10",
    },
    {
      label: "本周胜率",
      value: "68%",
      icon: Trophy,
      color: "text-[var(--yellow)]",
      bg: "bg-[var(--yellow)]/10",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 欢迎区 */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                欢迎回来，{profile.name || "投资者"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="yellow">会员</Badge>
                <span className="text-xs text-[var(--text-muted)]">
                  享受全部功能，无限制查看
                </span>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
                  >
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {dataLoading ? (
            <Loading text="加载选股数据..." className="py-20" />
          ) : (
            <div className="space-y-8">
              {/* 精选选股 */}
              {featuredPicks.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                      <Sparkles size={18} className="text-[var(--yellow)]" />
                      精选选股
                    </h2>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/picks">
                        查看全部 <ArrowRight size={14} />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredPicks.map((pick) => (
                      <PickCard key={pick.id} pick={pick} />
                    ))}
                  </div>
                </section>
              )}

              {/* 最新选股 */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                    <TrendingUp size={18} className="text-[var(--accent)]" />
                    最新选股
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/picks">
                      查看全部 <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
                {latestPicks.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {latestPicks.map((pick) => (
                      <PickCard key={pick.id} pick={pick} />
                    ))}
                  </div>
                ) : (
                  <Card className="flex flex-col items-center justify-center gap-3 py-12">
                    <TrendingUp
                      size={28}
                      className="text-[var(--text-muted)]"
                    />
                    <p className="text-sm text-[var(--text-secondary)]">
                      暂无选股数据
                    </p>
                  </Card>
                )}
              </section>

              {/* 自选股概览 */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                    <Bookmark size={18} className="text-[var(--green)]" />
                    自选股概览
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/watchlist">
                      管理自选股 <ArrowRight size={14} />
                    </Link>
                  </Button>
                </div>
                {watchlistPreview.length > 0 ? (
                  <Card>
                    <CardContent className="divide-y divide-[var(--border)] p-0">
                      {watchlistPreview.map((item) => (
                        <Link
                          key={item.id}
                          href="/watchlist"
                          className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-hover)] text-xs font-bold text-[var(--text-primary)]">
                              {item.symbol.slice(0, 2)}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {item.symbol}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {item.name}
                              </p>
                            </div>
                          </div>
                          {item.notes && (
                            <p className="hidden max-w-[200px] truncate text-xs text-[var(--text-muted)] sm:block">
                              {item.notes}
                            </p>
                          )}
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="flex flex-col items-center justify-center gap-3 py-12">
                    <Bookmark size={28} className="text-[var(--text-muted)]" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      还没有自选股
                    </p>
                    <Button size="sm" asChild>
                      <Link href="/watchlist">添加自选股</Link>
                    </Button>
                  </Card>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
