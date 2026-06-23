"use client";

import * as React from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { StockCandle } from "@/types";
import { formatDate, formatPrice } from "@/lib/utils";

export interface StockChartProps {
  data: StockCandle[];
  height?: number;
  className?: string;
}

/** 自定义 Tooltip 的 props */
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: StockCandle }>;
}

/** 自定义 Tooltip */
function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-[var(--text-secondary)]">
        {formatDate(point.date)}
      </p>
      <p className="font-semibold text-[var(--text-primary)]">
        收盘: {formatPrice(point.close)}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[var(--text-muted)]">
        <span>开: {formatPrice(point.open)}</span>
        <span>高: {formatPrice(point.high)}</span>
        <span>低: {formatPrice(point.low)}</span>
        <span>量: {point.volume.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function StockChart({ data, height = 300, className }: StockChartProps) {
  const memoData = React.useMemo(() => data, [data]);

  if (!memoData || memoData.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-muted)]"
        style={{ height }}
      >
        暂无图表数据
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={memoData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="stockLineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#262626"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDate(v).slice(5)}
            tick={{ fill: "#525252", fontSize: 11 }}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fill: "#525252", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "#404040", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", stroke: "#0a0a0a", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
