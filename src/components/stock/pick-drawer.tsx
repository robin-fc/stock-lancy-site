"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  X,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { SignalBadge } from "@/components/stock/signal-badge";
import { ConfidenceBar } from "@/components/stock/confidence-bar";
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
import type { StockPick } from "@/types";

export interface PickDrawerProps {
  /** 选股 ID, 为 null 时抽屉关闭 */
  pickId: string | null;
  onClose: () => void;
}

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

/** 风险等级对应的颜色 */
function getRiskColor(level: StockPick["risk_level"]): string {
  switch (level) {
    case "low":
      return "text-[var(--green)]";
    case "medium":
      return "text-[var(--yellow)]";
    case "high":
      return "text-[var(--red)]";
    default:
      return "text-[var(--text-secondary)]";
  }
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

export function PickDrawer({ pickId, onClose }: PickDrawerProps) {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [pick, setPick] = React.useState<StockPick | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 自选股状态
  const [watchlistAdded, setWatchlistAdded] = React.useState(false);
  const [watchlistLoading, setWatchlistLoading] = React.useState(false);
  const [watchlistError, setWatchlistError] = React.useState<string | null>(
    null
  );

  // 控制 DOM 是否挂载 (用于滑出/滑入动画)
  const [mounted, setMounted] = React.useState(false);
  // 控制可见状态 (驱动 transition)
  const [visible, setVisible] = React.useState(false);

  // 当 pickId 变化时加载数据
  React.useEffect(() => {
    if (!pickId) {
      // 关闭: 触发滑出动画, 动画结束后卸载
      setVisible(false);
      return;
    }

    // 打开: 挂载并触发滑入
    setMounted(true);
    setError(null);
    setPick(null);
    setWatchlistAdded(false);
    setWatchlistError(null);

    // 下一帧触发滑入动画
    const raf = requestAnimationFrame(() => setVisible(true));

    let cancelled = false;
    async function loadPick() {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/picks/${pickId}`, { headers });
        if (cancelled) return;

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
        if (!cancelled) setPick(data as StockPick);
      } catch {
        if (!cancelled) setError("网络错误，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pickId]);

  // ESC 键关闭
  React.useEffect(() => {
    if (!pickId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    // 打开时锁定 body 滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [pickId, onClose]);

  // 滑出动画结束后卸载
  function handleTransitionEnd() {
    if (!visible && !pickId) {
      setMounted(false);
    }
  }

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

  if (!mounted) return null;

  const changePct =
    pick?.current_price != null && pick?.entry_price != null
      ? calcChangePct(pick.current_price, pick.entry_price)
      : null;
  const isUp = (changePct ?? 0) >= 0;

  const ind = pick?.indicators || {};
  const indicatorRows = [
    { label: "RSI (14)", value: ind.rsi },
    { label: "MACD", value: ind.macd },
    { label: "MACD 信号线", value: ind.macd_signal },
    { label: "MA5", value: ind.ma5 },
    { label: "MA10", value: ind.ma10 },
    { label: "MA20", value: ind.ma20 },
    { label: "MA60", value: ind.ma60 },
    { label: "布林带上轨", value: ind.boll_upper },
    { label: "布林带下轨", value: ind.boll_lower },
  ];

  const thirdPartyLinks = pick ? getThirdPartyLinks(pick.symbol) : null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="选股详情"
    >
      {/* 背景遮罩 */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-[var(--surface)] shadow-2xl transition-transform duration-300 ease-out sm:w-[600px]",
          visible ? "translate-x-0" : "translate-x-full"
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* 顶部固定区: 标题 + 关闭按钮 */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4">
          {loading || !pick ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              加载中...
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {pick.symbol}
                </h2>
                <SignalBadge signal={pick.signal} size="sm" />
                {pick.is_featured && (
                  <Badge variant="yellow">精选</Badge>
                )}
                {pick.is_pro_only && (
                  <Badge variant="orange">PRO</Badge>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                {pick.name}
                {pick.exchange && ` · ${pick.exchange}`}
                {pick.sector && ` · ${pick.sector}`}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>选股日期：{formatDate(pick.pick_date)}</span>
                <span>·</span>
                <span>浏览 {pick.view_count} 次</span>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <Loading size="lg" text="加载选股详情..." className="py-20" />
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <AlertCircle size={36} className="text-[var(--red)]" />
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>
                关闭
              </Button>
            </div>
          ) : pick ? (
            <div className="space-y-5">
              {/* 价格区 */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      当前价格
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                      {formatPrice(pick.current_price)}
                    </p>
                  </div>
                  {changePct != null && (
                    <div
                      className={cn(
                        "flex items-center gap-1 text-sm font-semibold",
                        isUp
                          ? "text-[var(--red)]"
                          : "text-[var(--green)]"
                      )}
                    >
                      {isUp ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {formatPct(changePct)}
                      <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                        相对入场
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
                  <div>
                    <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <LogIn size={11} /> 入场价
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {formatPrice(pick.entry_price)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Target size={11} /> 目标价
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--red)]">
                      {formatPrice(pick.target_price)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <ShieldAlert size={11} /> 止损价
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--green)]">
                      {formatPrice(pick.stop_loss)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">
                      风险等级
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        getRiskColor(pick.risk_level)
                      )}
                    >
                      {RISK_LABELS[pick.risk_level]}
                    </span>
                  </div>
                  <ConfidenceBar value={pick.confidence} />
                </div>
              </div>

              {/* 操作区: 自选股 + 第三方链接 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {watchlistAdded ? (
                    <Button variant="outline" size="sm" disabled>
                      <CheckCircle2
                        size={14}
                        className="text-[var(--green)]"
                      />
                      已添加自选
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddWatchlist}
                      disabled={watchlistLoading}
                    >
                      {watchlistLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <BookmarkPlus size={14} />
                      )}
                      加入自选
                    </Button>
                  )}
                </div>
                {watchlistError && (
                  <p className="text-xs text-[var(--red)]">{watchlistError}</p>
                )}

                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <Globe size={13} className="text-[var(--accent)]" />
                    第三方行情
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {thirdPartyLinks && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={thirdPartyLinks.eastmoney}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            东方财富
                            <ExternalLink size={11} />
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={thirdPartyLinks.xueqiu}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            雪球
                            <ExternalLink size={11} />
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={thirdPartyLinks.tonghuashun}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            同花顺
                            <ExternalLink size={11} />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* AI 分析报告 */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Zap size={15} className="text-[var(--accent)]" />
                  AI 深度分析报告
                </h3>
                <AnalysisPanel
                  analysis={
                    pick.analysis ||
                    "## 分析报告\n\n本选股暂无完整 AI 深度分析报告。\n\n- 基本面分析\n- 技术面解读\n- 资金面动向\n- 风险提示与操作建议"
                  }
                />
              </div>

              {/* 关键因素 */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Target size={15} className="text-[var(--accent)]" />
                  关键因素
                </h3>
                {pick.key_factors && pick.key_factors.length > 0 ? (
                  <ul className="space-y-2.5">
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
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                      一句话总结
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      {pick.summary}
                    </p>
                  </div>
                )}
              </div>

              {/* 技术指标 */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Activity size={15} className="text-[var(--accent)]" />
                  技术指标
                </h3>
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
                          <td className="py-2 pr-4 text-sm text-[var(--text-primary)]">
                            {row.label}
                          </td>
                          <td className="py-2 pr-4 text-right text-sm font-semibold text-[var(--text-primary)]">
                            {row.value != null
                              ? row.value.toFixed(2)
                              : "--"}
                          </td>
                          <td className="py-2 text-xs text-[var(--text-muted)]">
                            {getIndicatorDesc(row.label)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
