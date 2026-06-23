import Link from "next/link";
import {
  Target,
  ShieldAlert,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { StockPick } from "@/types";
import {
  cn,
  formatPrice,
  formatPct,
  formatDate,
  calcChangePct,
  truncate,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignalBadge } from "./signal-badge";
import { ConfidenceBar } from "./confidence-bar";

export interface PickCardProps {
  pick: StockPick;
  className?: string;
}

export function PickCard({ pick, className }: PickCardProps) {
  // 涨跌幅: 当前价相对入场价
  const changePct =
    pick.current_price != null && pick.entry_price != null
      ? calcChangePct(pick.current_price, pick.entry_price)
      : null;
  const isUp = (changePct ?? 0) >= 0;

  return (
    <Card
      hover
      className={cn(
        "relative flex flex-col overflow-hidden p-4",
        className
      )}
    >
      <Link href={`/picks/${pick.id}`} className="flex flex-1 flex-col">
        {/* 头部: 代码 + 名称 + 信号 */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold text-[var(--text-primary)]">
                {pick.symbol}
              </h3>
              {pick.is_featured && (
                <Badge variant="yellow">精选</Badge>
              )}
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {pick.name}
              {pick.exchange && ` · ${pick.exchange}`}
            </p>
          </div>
          <SignalBadge signal={pick.signal} size="sm" />
        </div>

        {/* 价格 + 涨跌幅 */}
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-[var(--text-muted)]">当前价格</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {formatPrice(pick.current_price)}
            </p>
          </div>
          {changePct != null && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-semibold",
                isUp ? "text-[var(--red)]" : "text-[var(--green)]"
              )}
            >
              {isUp ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              {formatPct(changePct)}
            </div>
          )}
        </div>

        {/* 置信度 */}
        <div className="mb-3">
          <ConfidenceBar value={pick.confidence} />
        </div>

        {/* 目标价 / 止损价 */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <Target size={11} /> 目标价
            </p>
            <p className="text-sm font-semibold text-[var(--red)]">
              {formatPrice(pick.target_price)}
            </p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <ShieldAlert size={11} /> 止损价
            </p>
            <p className="text-sm font-semibold text-[var(--green)]">
              {formatPrice(pick.stop_loss)}
            </p>
          </div>
        </div>

        {/* 一句话总结 */}
        <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          {truncate(pick.summary, 80)}
        </p>

        {/* 关键因素 (前2个) */}
        {pick.key_factors && pick.key_factors.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pick.key_factors.slice(0, 2).map((factor, i) => (
              <span
                key={i}
                className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
              >
                {truncate(factor, 20)}
              </span>
            ))}
          </div>
        )}

        {/* 底部: 日期 */}
        <div className="mt-auto flex items-center gap-1 border-t border-[var(--border)] pt-2 text-[10px] text-[var(--text-muted)]">
          <Calendar size={11} />
          {formatDate(pick.pick_date)}
        </div>
      </Link>
    </Card>
  );
}
