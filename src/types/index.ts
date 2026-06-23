// ========== 数据库类型 ==========

export type Plan = 'free' | 'pro';
export type Signal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: Plan;
  membership_expires_at: string | null;
  stripe_customer_id: string | null;
  daily_views: number;
  daily_views_date: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  plan: Plan;
  interval: 'month' | 'year' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockPick {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  signal: Signal;
  confidence: number;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  current_price: number | null;
  analysis: string;
  summary: string;
  key_factors: string[];
  risk_level: RiskLevel;
  indicators: Record<string, number>;
  pick_date: string;
  is_featured: boolean;
  view_count: number;
  is_pro_only: boolean;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  notes: string | null;
  alert_price_high: number | null;
  alert_price_low: number | null;
  sort_order: number;
  created_at: string;
}

export interface PickView {
  id: string;
  user_id: string;
  pick_id: string;
  viewed_at: string;
}

export interface PickPerformance {
  id: string;
  pick_id: string;
  recorded_at: string;
  price: number;
  change_pct: number;
}

// ========== API 类型 ==========

export interface StockQuote {
  symbol: string;
  name: string;
  current_price: number;
  change: number;
  change_pct: number;
  high: number;
  low: number;
  open: number;
  prev_close: number;
  volume: number;
}

export interface StockCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macd_signal: number;
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  boll_upper: number;
  boll_lower: number;
}

// ========== 配置常量 ==========

/** 最大用户数 (邀请制, 10人) */
export const MAX_USERS = 10;

export const SIGNAL_LABELS: Record<Signal, string> = {
  strong_buy: '强烈买入',
  buy: '买入',
  hold: '持有',
  sell: '卖出',
  strong_sell: '强烈卖出',
};

export const SIGNAL_COLORS: Record<Signal, string> = {
  strong_buy: 'text-red-600 bg-red-50 border-red-200',
  buy: 'text-orange-600 bg-orange-50 border-orange-200',
  hold: 'text-gray-600 bg-gray-50 border-gray-200',
  sell: 'text-green-600 bg-green-50 border-green-200',
  strong_sell: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: '体验版',
  pro: '会员',
};

/** 邀请码 */
export interface InvitationCode {
  id: string;
  code: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

/** 股票基本信息缓存 */
export interface StockBasicInfo {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  updated_at: string;
}

/** AI分析报告缓存 */
export interface StockAIAnalysis {
  id: string;
  symbol: string;
  name: string;
  signal: Signal;
  confidence: number;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  analysis: string;
  summary: string;
  key_factors: string[];
  risk_level: RiskLevel;
  indicators: Record<string, number>;
  triggered_by: string | null;
  created_at: string;
  // 新增: 因子分解
  factor_scores?: Record<string, { score: number; weight: number; contribution: number; detail: string }>;
  strategies?: { strategy: string; signal: Signal; score: number; reason: string }[];
  formula_version?: string;
}

/** 分析因子定义 */
export interface AnalysisFactor {
  id: string;
  factor_key: string;
  factor_name: string;
  weight: number;
  description: string | null;
  is_active: boolean;
  adjustment_count: number;
  created_at: string;
  updated_at: string;
}

/** 用户反馈 */
export interface AnalysisFeedback {
  id: string;
  analysis_id: string;
  user_id: string;
  rating: number;
  helpful_factors: string[] | null;
  missing_factors: string[] | null;
  comment: string | null;
  weight_adjustments: Record<string, number> | null;
  applied: boolean;
  created_at: string;
}

/** 因子标识 */
export type FactorKey =
  | 'technical'
  | 'fundamental'
  | 'policy'
  | 'market_sentiment'
  | 'industry'
  | 'financial_report'
  | 'momentum'
  | 'value';

export const FACTOR_LABELS: Record<string, string> = {
  technical: '技术面分析',
  fundamental: '基本面分析',
  policy: '政策面分析',
  market_sentiment: '市场情绪',
  industry: '行业面分析',
  financial_report: '财报面分析',
  momentum: '动量策略',
  value: '价值策略',
};

/** 股票搜索结果 */
export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  pinyin?: string;
}
