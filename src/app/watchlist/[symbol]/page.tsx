"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Building2,
  BarChart3,
  Clock,
  Globe,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, LoadingOverlay } from "@/components/ui/loading";
import { StockChart } from "@/components/stock/stock-chart";
import { AnalysisPanel } from "@/components/stock/analysis-panel";
import { SignalBadge } from "@/components/stock/signal-badge";
import { ConfidenceBar } from "@/components/stock/confidence-bar";
import { useAuthStore } from "@/store/auth";
import { authFetch, parseApiError } from "@/lib/api";
import {
  cn,
  formatPrice,
  formatPct,
  formatDate,
  formatDateTime,
} from "@/lib/utils";
import { RISK_LABELS } from "@/types";
import type {
  StockQuote,
  StockCandle,
  TechnicalIndicators,
  StockBasicInfo,
  StockAIAnalysis,
} from "@/types";

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

/** 格式化市值 (元 → 亿/万) */
function formatMarketCap(value: number | null | undefined): string {
  if (value == null) return "--";
  if (value >= 1_0000_0000) {
    return `¥${(value / 1_0000_0000).toFixed(2)}亿`;
  }
  if (value >= 1_0000) {
    return `¥${(value / 1_0000).toFixed(2)}万`;
  }
  return `¥${value.toFixed(2)}`;
}

/** 格式化成交量 */
function formatVolume(value: number | null | undefined): string {
  if (value == null) return "--";
  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}亿手`;
  }
  if (value >= 1_0000) {
    return `${(value / 1_0000).toFixed(2)}万手`;
  }
  return `${value.toLocaleString()}手`;
}

interface DetailData {
  quote: StockQuote | null;
  candles: StockCandle[];
  indicators: TechnicalIndicators | null;
  basic_info: StockBasicInfo | null;
  ai_analysis: StockAIAnalysis | null;
}

export default function WatchlistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;

  const { profile, loading: authLoading, initialized, init } = useAuthStore();

  const [data, setData] = React.useState<DetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // AI 分析状态
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  React.useEffect(() => {
    if (initialized && !authLoading && !profile) {
      router.replace("/login");
    }
  }, [initialized, authLoading, profile, router]);

  // 加载股票详情
  const loadDetail = React.useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/stocks/${symbol}/detail`);
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      const json = await res.json();
      setData({
        quote: json.quote,
        candles: json.candles || [],
        indicators: json.indicators,
        basic_info: json.basic_info,
        ai_analysis: json.ai_analysis,
      });
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  React.useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // 触发 AI 分析
  async function handleAnalyze() {
    if (!symbol) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await authFetch(`/api/stocks/${symbol}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        setAnalyzeError(await parseApiError(res));
        return;
      }
      const json = await res.json();
      if (data) {
        setData({ ...data, ai_analysis: json.analysis });
      }
    } catch {
      setAnalyzeError("网络错误，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  }

  // 鉴权加载中
  if (!initialized || authLoading) {
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

  // 详情加载中
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading size="lg" text="加载股票详情..." />
        </div>
        <Footer />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <Card className="max-w-md p-8 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-[var(--red)]" />
            <h1 className="mb-2 text-lg font-bold text-[var(--text-primary)]">
              无法加载股票详情
            </h1>
            <p className="mb-6 text-sm text-[var(--text-secondary)]">{error}</p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={loadDetail}>
                <RefreshCw size={16} /> 重新加载
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/watchlist">
                  <ArrowLeft size={16} /> 返回自选股
                </Link>
              </Button>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const quote = data?.quote;
  const candles = data?.candles || [];
  const indicators = data?.indicators;
  const basicInfo = data?.basic_info;
  const aiAnalysis = data?.ai_analysis;

  // 股票名称: 优先用 basic_info, 其次 quote
  const stockName = basicInfo?.name || quote?.name || symbol;
  // 交易所: 优先用 basic_info, 其次根据代码推断
  const exchange =
    basicInfo?.exchange ||
    (symbol.startsWith("6") ? "SH" : "SZ");

  const thirdPartyLinks = getThirdPartyLinks(symbol);

  const isUp = (quote?.change_pct ?? 0) >= 0;

  // 技术指标行
  const indicatorRows: { label: string; value: number | null | undefined; desc: string }[] = [
    { label: "RSI (14)", value: indicators?.rsi, desc: "超买>70，超卖<30" },
    { label: "MACD", value: indicators?.macd, desc: "快线，上穿信号线看多" },
    { label: "MACD 信号线", value: indicators?.macd_signal, desc: "慢线，MACD 参考基准" },
    { label: "MA5", value: indicators?.ma5, desc: "5 日均线，短期趋势" },
    { label: "MA10", value: indicators?.ma10, desc: "10 日均线，短中期趋势" },
    { label: "MA20", value: indicators?.ma20, desc: "20 日均线，中期趋势" },
    { label: "MA60", value: indicators?.ma60, desc: "60 日均线，长期趋势" },
    { label: "布林带上轨", value: indicators?.boll_upper, desc: "压力位，价格触及易回落" },
    { label: "布林带下轨", value: indicators?.boll_lower, desc: "支撑位，价格触及易反弹" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {analyzing && <LoadingOverlay text="正在生成 AI 分析，约需30秒..." />}

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 返回按钮 */}
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/watchlist">
              <ArrowLeft size={16} /> 返回自选股
            </Link>
          </Button>

          {/* a. 顶部信息: 代码+名称, 实时价格+涨跌幅, 交易所标签 */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                  {symbol}
                </h1>
                <Badge variant="blue">{exchange}</Badge>
                {basicInfo?.sector && (
                  <Badge variant="gray">{basicInfo.sector}</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {stockName}
              </p>

              {/* 实时价格 + 涨跌幅 */}
              {quote && (
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <p className="text-3xl font-bold text-[var(--text-primary)]">
                      {formatPrice(quote.current_price)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex flex-col items-start gap-0.5 pb-1",
                      isUp ? "text-[var(--red)]" : "text-[var(--green)]"
                    )}
                  >
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      {isUp ? (
                        <TrendingUp size={16} />
                      ) : (
                        <TrendingDown size={16} />
                      )}
                      {quote.change != null && (
                        <span>
                          {isUp ? "+" : ""}
                          {quote.change.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold">
                      {formatPct(quote.change_pct)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 刷新按钮 */}
            <Button variant="outline" size="sm" onClick={loadDetail}>
              <RefreshCw size={14} /> 刷新行情
            </Button>
          </div>

          {/* b. 第三方链接区 */}
          <Card className="mb-6 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Globe size={16} className="text-[var(--accent)]" />
                第三方行情
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={thirdPartyLinks.eastmoney}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    东方财富
                    <ExternalLink size={12} />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={thirdPartyLinks.xueqiu}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    雪球
                    <ExternalLink size={12} />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
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

          {/* 行情明细 */}
          {quote && (
            <Card className="mb-6 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <BarChart3 size={18} className="text-[var(--accent)]" />
                行情明细
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">今开</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {formatPrice(quote.open)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">昨收</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {formatPrice(quote.prev_close)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">最高</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--red)]">
                    {formatPrice(quote.high)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">最低</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--green)]">
                    {formatPrice(quote.low)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">成交量</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {formatVolume(quote.volume)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">涨跌额</p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      isUp ? "text-[var(--red)]" : "text-[var(--green)]"
                    )}
                  >
                    {quote.change != null
                      ? `${isUp ? "+" : ""}${quote.change.toFixed(2)}`
                      : "--"}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* c. K线图表区 */}
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* d. 技术指标表格 */}
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Activity size={18} className="text-[var(--accent)]" />
                技术指标
              </h2>
              {indicators ? (
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
                            {row.value != null ? row.value.toFixed(2) : "--"}
                          </td>
                          <td className="py-2.5 text-xs text-[var(--text-muted)]">
                            {row.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  暂无技术指标数据
                </p>
              )}
            </Card>

            {/* e. 基本面数据 */}
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Building2 size={18} className="text-[var(--accent)]" />
                基本面数据
              </h2>
              {basicInfo ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">市盈率 (PE)</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {basicInfo.pe_ratio != null
                        ? basicInfo.pe_ratio.toFixed(2)
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">市净率 (PB)</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {basicInfo.pb_ratio != null
                        ? basicInfo.pb_ratio.toFixed(2)
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">总市值</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {formatMarketCap(basicInfo.market_cap)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">行业板块</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {basicInfo.sector || "--"}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">交易所</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {basicInfo.exchange || exchange}
                    </p>
                  </div>
                  {basicInfo.updated_at && (
                    <p className="col-span-2 text-xs text-[var(--text-muted)]">
                      数据更新于 {formatDateTime(basicInfo.updated_at)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  暂无基本面数据
                </p>
              )}
            </Card>
          </div>

          {/* f. AI分析区 */}
          <Card className="mt-6 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <Zap size={18} className="text-[var(--accent)]" />
                AI 深度分析
              </h2>
              {aiAnalysis ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  重新分析
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  生成AI分析
                </Button>
              )}
            </div>

            {analyzeError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">
                <AlertCircle size={14} className="shrink-0 text-[var(--red)]" />
                <p className="text-xs text-[var(--red)]">{analyzeError}</p>
              </div>
            )}

            {aiAnalysis ? (
              <div className="space-y-4">
                {/* 信号 + 置信度 + 分析时间 */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                  <SignalBadge signal={aiAnalysis.signal} />
                  <Badge variant="gray">
                    {RISK_LABELS[aiAnalysis.risk_level]}
                  </Badge>
                  <div className="min-w-[140px] flex-1">
                    <ConfidenceBar value={aiAnalysis.confidence} />
                  </div>
                  {aiAnalysis.created_at && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Clock size={12} />
                      分析时间: {formatDateTime(aiAnalysis.created_at)}
                    </span>
                  )}
                </div>

                {/* 分析内容 */}
                <AnalysisPanel analysis={aiAnalysis.analysis} />

                {/* 关键因素 */}
                {aiAnalysis.key_factors && aiAnalysis.key_factors.length > 0 && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
                    <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                      关键因素
                    </p>
                    <ul className="space-y-2">
                      {aiAnalysis.key_factors.map((factor, i) => (
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
                  </div>
                )}

                {/* 一句话总结 */}
                {aiAnalysis.summary && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
                    <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                      一句话总结
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      {aiAnalysis.summary}
                    </p>
                  </div>
                )}

                {/* 价格建议 */}
                {(aiAnalysis.entry_price != null ||
                  aiAnalysis.target_price != null ||
                  aiAnalysis.stop_loss != null) && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-center">
                      <p className="text-xs text-[var(--text-muted)]">建议入场价</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {formatPrice(aiAnalysis.entry_price)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-center">
                      <p className="text-xs text-[var(--text-muted)]">目标价</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--red)]">
                        {formatPrice(aiAnalysis.target_price)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-center">
                      <p className="text-xs text-[var(--text-muted)]">止损价</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--green)]">
                        {formatPrice(aiAnalysis.stop_loss)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)]">
                  <Zap size={24} className="text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  暂无AI分析
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  点击上方"生成AI分析"按钮，获取该股票的 AI 深度分析报告
                </p>
              </div>
            )}
          </Card>

          {/* 底部操作 */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/watchlist">
                <ArrowLeft size={16} /> 返回自选股列表
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
