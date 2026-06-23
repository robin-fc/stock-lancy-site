import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "green"
  | "red"
  | "orange"
  | "blue"
  | "gray"
  | "yellow";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-green-500/10 text-green-500 border-green-500/20",
  red: "bg-red-500/10 text-red-500 border-red-500/20",
  orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  gray: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "gray", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
