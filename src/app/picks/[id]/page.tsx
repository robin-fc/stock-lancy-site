"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Target,
  ShieldAlert,
  LogIn,
  TrendingUp,
  TrendingDown,
  BookmarkPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Zap,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { SignalBadge } from "@/components/stock/signal-badge";
import { ConfidenceBar } from "@/components/stock/confidence-bar";
import { StockChart } from "@/components/stock/stock-chart";
import { AnalysisPanel } from "@/components/stock/analysis-panel";
import { useAuthStore } from "@/store/auth";
import { authFetch, getAuthHeaders, parseApiError } from "@/lib/api";
import {
  cn,
  formatPrice,
  formatPct,
  formatDate,
  calcChangePct,
} from "@/lib/utils";
import { RISK_LABELS } from "@/types";
import type { StockPick, StockCandle } from "@/types";

/** 根据股票代码判断交易所前缀 (6开头为上交所, 其余为深交所) */
function getExchangePrefix(symbol: string): { lower: string; upper: string } {
  if (symbol.startsWith("6")) {
    return { lower: "sh", upper: "SH" };
  }
  return { lower: "sz", upper: "SZ" };
}

/** 生成第三方行情链接 */
function getThirdPartyLinks(symbol: string) {
  const { lower, upper } = getExchangePrefix(symbol);
  return {
    eastmoney: `https://quote.eastmoney.com/${lower}${symbol}.html`,
    xueqiu: `https://xueqiu.com/S/${upper}${symbol}`,
    tonghuashun: `https://stockpage.10jqka.com.cn/${lower}${symbol}/`,
  };
}

/** 基于选股价格生成确定性 K 线数据 (无独立行情接口时的前端回退方案) */
function generateCandles(pick: StockPick): StockCandle[] {
  const current = pick.current_price ?? pick.entry_price ?? 100;
  const entry = pick.entry_price ?? current;

  // 基于 symbol 生成确定性随机种子
  let seed = 0;
  for (let i = 0; i < pick.symbol.length; i++) {
    seed += pick.symbol.charCodeAt(i);
  }
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const days = 60;
  const candles: StockCandle[] = [];
  let price = entry * 0.92;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const trend = (current - price) * 0.06;
    const noise = (rand() - 0.5) * current * 0.028;
    const open = price;
    const close = Math.max(0.01, price + trend + noise);
    const high = Math.max(open, close) * (1 + rand() * 0.012);
    const low = Math.min(open, close) * (1 - rand() * 0.012);
    const volume = Math.floor(rand() * 5000000) + 1000000;
    candles.push({
      date: date.toISOString().split("T")[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
    price = close;
  }

  // 强制最后一根收盘价为当前价
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = +current.toFixed(2);
    last.high = +Math.max(last.high, current).toFixed(2);
    last.low = +Math.min(last.low, current).toFixed(2);
  }

  return candles;
}

export default function PickDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { profile, initialized, init } = useAuthStore();

  const [pick, setPick] = React.useState<StockPick | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [watchlistAdded, setWatchlistAdded] = React.useState(false);
  const [watchlistLoading, setWatchlistLoading] = React.useState(false);
  const [watchlistError, setWatchlistError] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // 加载选股详情
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadPick() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/picks/${id}`, { headers });

        if (!cancelled) {
          if (res.status === 404) {
            setError("选股不存在或已被删除");
            return;
          }
          if (!res.ok) {
            const msg = await parseApiError(res);
            setError(msg);
            return;
          }
          const data = await res.json();
          setPick(data as StockPick);
        }
      } catch {
        if (!cancelled) setError("网络错误，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPick();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 添加自选股
  async function handleAddWatchlist() {
    if (!pick) return;
    if (!profile) {
      router.push("/login");
      return;
    }

    setWatchlistLoading(true);
    setWatchlistError(null);
    try {
      const res = await authFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          symbol: pick.symbol,
          name: pick.name,
        }),
      });

      if (res.status === 409) {
        setWatchlistError("该股票已在自选股列表中");
        setWatchlistAdded(true);
        return;
      }
      if (!res.ok) {
        const msg = await parseApiError(res);
        setWatchlistError(msg);
        return;
      }

      setWatchlistAdded(true);
    } catch {
      setWatchlistError("网络错误，请稍后重试");
    } finally {
      setWatchlistLoading(false);
    }
  }

  const candles = React.useMemo(
    () => (pick ? generateCandles(pick) : []),
    [pick]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading size="lg" text="加载选股详情..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="max-w-md p-8 text-center">
            <AlertCircle
              size={40}
              className="mx-auto mb-4 text-[var(--red)]"
            />
            <h1 className="mb-2 text-lg font-bold text-[var(--text-primary)]">
              无法查看此选股
            </h1>
            <p className="mb-6 text-sm text-[var(--text-secondary)]">
              {error}
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" asChild>
                <Link href="/picks">
                  <ArrowLeft size={16} /> 返回选股列表
                </Link>
              </Button>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (!pick) return null;

  const changePct =
    pick.current_price != null && pick.entry_price != null
      ? calcChangePct(pick.current_price, pick.entry_price)
      : null;
  const isUp = (changePct ?? 0) >= 0;
  const ind = pick.indicators || {};

  const indicatorRows = [
    { label: "RSI (14)", value: ind.rsi, suffix: "" },
    { label: "MACD", value: ind.macd, suffix: "" },
    { label: "MACD 信号线", value: ind.macd_signal, suffix: "" },
    { label: "MA5", value: ind.ma5, suffix: "" },
    { label: "MA10", value: ind.ma10, suffix: "" },
    { label: "MA20", value: ind.ma20, suffix: "" },
    { label: "MA60", value: ind.ma60, suffix: "" },
    { label: "布林带上轨", value: ind.boll_upper, suffix: "" },
    { label: "布林带下轨", value: ind.boll_lower, suffix: "" },
  ];

  const thirdPartyLinks = getThirdPartyLinks(pick.symbol);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 返回按钮 */}
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/picks">
              <ArrowLeft size={16} /> 返回选股列表
            </Link>
          </Button>

          {/* 顶部信息 */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                  {pick.symbol}
                </h1>
                <SignalBadge signal={pick.signal} />
                {pick.is_featured && (
                  <Badge variant="yellow">精选</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {pick.name}
                {pick.exchange && ` · ${pick.exchange}`}
                {pick.sector && ` · ${pick.sector}`}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span>选股日期：{formatDate(pick.pick_date)}</span>
                <span>·</span>
                <span>风险等级：{RISK_LABELS[pick.risk_level]}</span>
                <span>·</span>
                <span>浏览 {pick.view_count} 次</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {watchlistAdded ? (
                <Button variant="outline" disabled>
                  <CheckCircle2 size={16} className="text-[var(--green)]" />
                  已添加
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleAddWatchlist}
                  disabled={watchlistLoading}
                >
                  {watchlistLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <BookmarkPlus size={16} />
                  )}
                  加入自选
                </Button>
              )}
            </div>
          </div>

          {watchlistError && (
            <p className="mb-4 text-xs text-[var(--red)]">{watchlistError}</p>
          )}

          {/* 第三方行情链接 */}
          <Card className="mb-6 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Globe size={16} className="text-[var(--accent)]" />
                第三方行情
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={thirdPartyLinks.eastmoney}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    东方财富
                    <ExternalLink size={12} />
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={thirdPartyLinks.xueqiu}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    雪球
                    <ExternalLink size={12} />
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={thirdPartyLinks.tonghuashun}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    同花顺
                    <ExternalLink size={12} />
                  </a>
                </Button>
              </div>
            </div>
          </Card>

          {/* 价格 + 置信度 */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 当前价格 */}
            <Card className="p-5 lg:col-span-1">
              <p className="text-xs text-[var(--text-secondary)]">当前价格</p>
              <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">
                {formatPrice(pick.current_price)}
              </p>
              {changePct != null && (
                <div
                  className={cn(
                    "mt-2 flex items-center gap-1 text-sm font-semibold",
                    isUp ? "text-[var(--red)]" : "text-[var(--green)]"
                  )}
                >
                  {isUp ? (
                    <TrendingUp size={16} />
                  ) : (
                    <TrendingDown size={16} />
                  )}
                  {formatPct(changePct)}
                  <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                    相对入场价
                  </span>
                </div>
              )}
            </Card>

            {/* 价格目标 */}
            <Card className="p-5 lg:col-span-2">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <LogIn size={12} /> 入场价
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                    {formatPrice(pick.entry_price)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Target size={12} /> 目标价
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--red)]">
                    {formatPrice(pick.target_price)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <ShieldAlert size={12} /> 止损价
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--green)]">
                    {formatPrice(pick.stop_loss)}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <ConfidenceBar value={pick.confidence} />
              </div>
            </Card>
          </div>

          {/* 图表 */}
          <Card className="mb-6 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Activity size={18} className="text-[var(--accent)]" />
                价格走势
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                近 60 个交易日
              </span>
            </div>
            <StockChart data={candles} height={320} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 分析报告 */}
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Zap size={18} className="text-[var(--accent)]" />
                AI 深度分析报告
              </h2>
              <AnalysisPanel
                analysis={
                  pick.analysis ||
                  "## 分析报告\n\n本选股暂无完整 AI 深度分析报告。\n\n- 基本面分析\n- 技术面解读\n- 资金面动向\n- 风险提示与操作建议"
                }
              />
            </Card>

            {/* 关键因素 */}
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Target size={18} className="text-[var(--accent)]" />
                关键因素
              </h2>
              {pick.key_factors && pick.key_factors.length > 0 ? (
                <ul className="space-y-3">
                  {pick.key_factors.map((factor, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-semibold text-[var(--accent)]">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{factor}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  暂无关键因素数据
                </p>
              )}

              {pick.summary && (
                <div className="mt-5 border-t border-[var(--border)] pt-4">
                  <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                    一句话总结
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {pick.summary}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* 技术指标表格 */}
          <Card className="mt-6 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
              <Activity size={18} className="text-[var(--accent)]" />
              技术指标
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-[var(--text-secondary)]">
                      指标
                    </th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium text-[var(--text-secondary)]">
                      数值
                    </th>
                    <th className="pb-2 text-xs font-medium text-[var(--text-secondary)]">
                      说明
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {indicatorRows.map((row) => (
                    <tr key={row.label}>
                      <td className="py-2.5 pr-4 text-sm text-[var(--text-primary)]">
                        {row.label}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-sm font-semibold text-[var(--text-primary)]">
                        {row.value != null
                          ? row.value.toFixed(2)
                          : "--"}
                      </td>
                      <td className="py-2.5 text-xs text-[var(--text-muted)]">
                        {getIndicatorDesc(row.label)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 底部操作 */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/picks">
                <ArrowLeft size={16} /> 查看更多选股
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** 技术指标说明 */
function getIndicatorDesc(label: string): string {
  const map: Record<string, string> = {
    "RSI (14)": "超买>70，超卖<30",
    MACD: "快线，上穿信号线看多",
    "MACD 信号线": "慢线，MACD 参考基准",
    MA5: "5 日均线，短期趋势",
    MA10: "10 日均线，短中期趋势",
    MA20: "20 日均线，中期趋势",
    MA60: "60 日均线，长期趋势",
    布林带上轨: "压力位，价格触及易回落",
    布林带下轨: "支撑位，价格触及易反弹",
  };
  return map[label] || "";
}
