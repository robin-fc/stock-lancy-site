-- stock-lancy-site 迁移: AI分析深度升级 - 因子公式 + 用户反馈
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ========== 9. analysis_factors (分析因子公式) ==========
-- 存储各分析因子的定义和权重, 权重通过用户反馈动态调整
CREATE TABLE IF NOT EXISTS public.analysis_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_key TEXT UNIQUE NOT NULL,        -- 因子标识: technical, fundamental, policy, market_sentiment, industry, financial_report, momentum, value
  factor_name TEXT NOT NULL,              -- 因子中文名: 技术面, 基本面, 政策面, 市场情绪, 行业面, 财报面, 动量策略, 价值策略
  weight NUMERIC(5,4) NOT NULL DEFAULT 0.125,  -- 权重 0~1, 初始均分
  description TEXT,                       -- 因子说明
  is_active BOOLEAN NOT NULL DEFAULT true,-- 是否启用
  adjustment_count INTEGER NOT NULL DEFAULT 0, -- 被用户反馈调整的次数
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 初始化 8 个因子, 权重均分 (各 0.125)
INSERT INTO public.analysis_factors (factor_key, factor_name, weight, description) VALUES
  ('technical',       '技术面分析',   0.125, 'RSI、MACD、均线系统、布林带等技术指标综合研判'),
  ('fundamental',     '基本面分析',   0.125, '市盈率、市净率、总市值、行业估值水平'),
  ('policy',          '政策面分析',   0.125, '国家政策、行业监管、产业扶持方向'),
  ('market_sentiment','市场情绪',     0.125, '资金流向、成交量变化、市场恐慌/贪婪指数'),
  ('industry',        '行业面分析',   0.125, '行业景气度、竞争格局、产业链位置'),
  ('financial_report','财报面分析',   0.125, '营收增长、利润变化、现金流、资产负债率'),
  ('momentum',        '动量策略',     0.125, '近期涨跌幅、相对强度、趋势延续性'),
  ('value',           '价值策略',     0.125, '估值分位、安全边际、内在价值评估')
ON CONFLICT (factor_key) DO NOTHING;

-- ========== 10. analysis_feedback (用户反馈) ==========
-- 用户对 AI 分析结果进行打分和反馈, 用于调整因子权重
CREATE TABLE IF NOT EXISTS public.analysis_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.stock_ai_analysis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 用户评分: 1=完全没用, 2=不太有用, 3=一般, 4=比较有用, 5=非常有用
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  -- 用户反馈: 哪些因子分析得好, 哪些不好
  helpful_factors TEXT[],    -- 用户认为有帮助的因子
  missing_factors TEXT[],    -- 用户认为缺失的因子
  comment TEXT,              -- 文字反馈
  -- 系统根据反馈自动计算的权重调整建议
  weight_adjustments JSONB,  -- { "technical": +0.02, "fundamental": -0.01, ... }
  applied BOOLEAN NOT NULL DEFAULT false, -- 权重调整是否已应用
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, user_id) -- 每个用户对每条分析只能反馈一次
);

CREATE INDEX IF NOT EXISTS idx_analysis_feedback_user ON public.analysis_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_analysis ON public.analysis_feedback(analysis_id);

-- ========== 更新 stock_ai_analysis 表: 新增因子分解字段 ==========
-- 存储每个因子的独立评分和贡献度
ALTER TABLE public.stock_ai_analysis ADD COLUMN IF NOT EXISTS factor_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
-- 格式: { "technical": { "score": 65, "weight": 0.125, "contribution": 8.125, "detail": "RSI超卖..." }, ... }
ALTER TABLE public.stock_ai_analysis ADD COLUMN IF NOT EXISTS strategies JSONB NOT NULL DEFAULT '[]'::jsonb;
-- 多策略交叉印证: [{ "strategy": "技术策略", "signal": "hold", "score": 43 }, ...]
ALTER TABLE public.stock_ai_analysis ADD COLUMN IF NOT EXISTS formula_version TEXT NOT NULL DEFAULT 'v1';

-- ========== RLS 策略 ==========
ALTER TABLE public.analysis_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view analysis_factors" ON public.analysis_factors FOR SELECT TO authenticated USING (true);

ALTER TABLE public.analysis_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own feedback" ON public.analysis_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own feedback" ON public.analysis_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own feedback" ON public.analysis_feedback FOR UPDATE TO authenticated USING (user_id = auth.uid());
