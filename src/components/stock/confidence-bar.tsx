import { cn } from "@/lib/utils";

export interface ConfidenceBarProps {
  /** 置信度 0-100 */
  value: number;
  className?: string;
  /** 是否显示数值 */
  showValue?: boolean;
}

/**
 * 置信度进度条
 * >70 红色 (看多), 40-70 灰色, <40 绿色 (看空)
 */
export function ConfidenceBar({
  value,
  className,
  showValue = true,
}: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  let barColor: string;
  let textColor: string;
  let label: string;

  if (clamped > 70) {
    barColor = "bg-[var(--red)]";
    textColor = "text-[var(--red)]";
    label = "看多";
  } else if (clamped >= 40) {
    barColor = "bg-[var(--text-secondary)]";
    textColor = "text-[var(--text-secondary)]";
    label = "中性";
  } else {
    barColor = "bg-[var(--green)]";
    textColor = "text-[var(--green)]";
    label = "看空";
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">置信度</span>
        {showValue && (
          <span className={cn("text-xs font-semibold", textColor)}>
            {clamped.toFixed(0)}% · {label}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
