-- stock-lancy-site 增量迁移脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 适用于已执行过 init.sql 的项目, 只创建新增的表和策略

-- ========== 7. stock_basic_info (股票基本信息缓存) ==========
CREATE TABLE IF NOT EXISTS public.stock_basic_info (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'SH',
  sector TEXT,
  market_cap NUMERIC(20,2),
  pe_ratio NUMERIC(12,2),
  pb_ratio NUMERIC(12,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 8. stock_ai_analysis (AI分析报告缓存) ==========
CREATE TABLE IF NOT EXISTS public.stock_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('strong_buy', 'buy', 'hold', 'sell', 'strong_sell')),
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  entry_price NUMERIC(12,4),
  target_price NUMERIC(12,4),
  stop_loss NUMERIC(12,4),
  analysis TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol)
);

CREATE INDEX IF NOT EXISTS idx_stock_ai_analysis_symbol ON public.stock_ai_analysis(symbol);

-- ========== RLS 策略 ==========
ALTER TABLE public.stock_basic_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view stock_basic_info" ON public.stock_basic_info FOR SELECT TO authenticated USING (true);

ALTER TABLE public.stock_ai_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view stock_ai_analysis" ON public.stock_ai_analysis FOR SELECT TO authenticated USING (true);
