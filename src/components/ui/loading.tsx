import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingSize = "sm" | "md" | "lg";

export interface LoadingProps {
  size?: LoadingSize;
  text?: string;
  className?: string;
}

const sizeMap: Record<LoadingSize, { icon: number; text: string }> = {
  sm: { icon: 14, text: "text-xs" },
  md: { icon: 20, text: "text-sm" },
  lg: { icon: 28, text: "text-base" },
};

export function Loading({ size = "md", text, className }: LoadingProps) {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="animate-spin text-[var(--accent)]"
        size={s.icon}
        aria-hidden="true"
      />
      {text && <span className={cn(s.text)}>{text}</span>}
      <span className="sr-only">加载中</span>
    </div>
  );
}

/** 全屏加载遮罩 */
export function LoadingOverlay({ text }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm">
      <Loading size="lg" text={text} />
    </div>
  );
}
