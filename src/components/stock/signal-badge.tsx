import { cn } from "@/lib/utils";
import { SIGNAL_LABELS, SIGNAL_COLORS } from "@/types";
import type { Signal } from "@/types";

export interface SignalBadgeProps {
  signal: Signal;
  size?: "sm" | "md";
  className?: string;
}

/**
 * 信号标签
 * 买入信号红色 (中国习惯), 卖出信号绿色
 */
export function SignalBadge({ signal, size = "md", className }: SignalBadgeProps) {
  const label = SIGNAL_LABELS[signal];
  const color = SIGNAL_COLORS[signal];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold",
        color,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      {label}
    </span>
  );
}
