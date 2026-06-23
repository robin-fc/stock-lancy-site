import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化价格 (A股, 人民币 ¥ 前缀) */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '--';
  return `¥${price.toFixed(2)}`;
}

/** 格式化百分比 */
export function formatPct(pct: number | null | undefined): string {
  if (pct == null) return '--';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/** 格式化日期 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 格式化日期时间 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 计算相对入场价的变化百分比 */
export function calcChangePct(current: number, entry: number): number {
  if (entry === 0) return 0;
  return ((current - entry) / entry) * 100;
}

/** 涨跌颜色 */
export function priceColor(pct: number): string {
  if (pct > 0) return 'text-red-600';
  if (pct < 0) return 'text-green-600';
  return 'text-gray-600';
}

/** 截断文本 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
