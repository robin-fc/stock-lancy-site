-- stock-lancy-site Supabase 数据库初始化
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ========== 1. profiles ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  -- 邀请制: 所有注册用户均为 pro 会员
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('free', 'pro')),
  membership_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  daily_views INTEGER NOT NULL DEFAULT 0,
  daily_views_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 1.1 invitation_codes (邀请码, 10人限制) ==========
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 预生成 10 个邀请码
INSERT INTO public.invitation_codes (code) VALUES
  ('AI-7K3M-9P2X'),
  ('AI-4N8Q-1R6T'),
  ('AI-2W5Y-8C3B'),
  ('AI-9F1H-6D4J'),
  ('AI-3V7L-2G8N'),
  ('AI-6A9S-5E3K'),
  ('AI-8Z2U-4M7P'),
  ('AI-1X6R-9Q4W'),
  ('AI-5B3T-7Y1F'),
  ('AI-4D8C-2H6J')
ON CONFLICT (code) DO NOTHING;

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 2. subscriptions (Stripe 订阅记录) ==========
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  interval TEXT CHECK (interval IN ('month', 'year')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 3. stock_picks (AI 选股结果) ==========
CREATE TABLE IF NOT EXISTS public.stock_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 股票信息
  symbol TEXT NOT NULL,           -- 股票代码, 如 AAPL
  name TEXT NOT NULL,             -- 股票名称, 如 Apple Inc.
  exchange TEXT NOT NULL DEFAULT 'US', -- 交易所/市场
  sector TEXT,                    -- 行业板块
  -- 选股信号
  signal TEXT NOT NULL CHECK (signal IN ('strong_buy', 'buy', 'hold', 'sell', 'strong_sell')),
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  -- 价格信息
  entry_price NUMERIC(12,4),      -- 建议买入价
  target_price NUMERIC(12,4),     -- 目标价
  stop_loss NUMERIC(12,4),        -- 止损价
  current_price NUMERIC(12,4),    -- 当前价格
  -- AI 分析
  analysis TEXT NOT NULL,         -- AI 分析报告 (Markdown)
  summary TEXT NOT NULL,          -- 一句话总结
  key_factors JSONB NOT NULL DEFAULT '[]'::jsonb, -- 关键因素列表
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  -- 技术指标
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb, -- RSI, MACD, MA 等
  -- 元数据
  pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_featured BOOLEAN NOT NULL DEFAULT false,  -- 是否精选
  view_count INTEGER NOT NULL DEFAULT 0,
  -- 仅 Pro 用户可见的深度分析
  is_pro_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 按日期+代码创建唯一索引, 避免重复
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_picks_date_symbol ON public.stock_picks(pick_date, symbol);
-- 按日期查询索引
CREATE INDEX IF NOT EXISTS idx_stock_picks_date ON public.stock_picks(pick_date DESC);
-- 按信号查询索引
CREATE INDEX IF NOT EXISTS idx_stock_picks_signal ON public.stock_picks(signal);

-- ========== 4. watchlist (用户自选股) ==========
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT,
  alert_price_high NUMERIC(12,4), -- 价格上限提醒
  alert_price_low NUMERIC(12,4),  -- 价格下限提醒
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);

-- ========== 5. pick_views (选股查看记录, 用于限额) ==========
CREATE TABLE IF NOT EXISTS public.pick_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES public.stock_picks(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pick_views_user ON public.pick_views(user_id, viewed_at DESC);

-- ========== 6. pick_performance (选股表现追踪) ==========
CREATE TABLE IF NOT EXISTS public.pick_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES public.stock_picks(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price NUMERIC(12,4) NOT NULL,
  change_pct NUMERIC(8,4) NOT NULL DEFAULT 0, -- 相对 entry_price 的涨跌幅
  UNIQUE(pick_id, recorded_at)
);

-- ========== 7. stock_basic_info (股票基本信息缓存) ==========
-- 首次访问时从东方财富拉取并缓存, 永久存储, 减少API调用
CREATE TABLE IF NOT EXISTS public.stock_basic_info (
  symbol TEXT PRIMARY KEY,           -- 股票代码, 如 600519
  name TEXT NOT NULL,                -- 股票名称, 如 贵州茅台
  exchange TEXT NOT NULL DEFAULT 'SH', -- 交易所 SH/SZ/BJ
  sector TEXT,                       -- 行业板块
  market_cap NUMERIC(20,2),          -- 总市值(亿元)
  pe_ratio NUMERIC(12,2),            -- 市盈率
  pb_ratio NUMERIC(12,2),            -- 市净率
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- 最后更新时间
);

-- ========== 8. stock_ai_analysis (AI分析报告缓存) ==========
-- 手动触发AI分析, 每只股票保留1条(覆盖旧建议)
CREATE TABLE IF NOT EXISTS public.stock_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,              -- 股票代码
  name TEXT NOT NULL,                -- 股票名称
  -- AI分析结果
  signal TEXT NOT NULL CHECK (signal IN ('strong_buy', 'buy', 'hold', 'sell', 'strong_sell')),
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  entry_price NUMERIC(12,4),
  target_price NUMERIC(12,4),
  stop_loss NUMERIC(12,4),
  analysis TEXT NOT NULL,            -- 详细分析报告 (Markdown)
  summary TEXT NOT NULL,             -- 一句话总结
  key_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb, -- 技术指标快照
  -- 触发信息
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- 触发用户
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 每只股票只保留1条, 新分析覆盖旧分析
  UNIQUE(symbol)
);

CREATE INDEX IF NOT EXISTS idx_stock_ai_analysis_symbol ON public.stock_ai_analysis(symbol);

-- ========== RLS 策略 ==========

-- profiles: 用户只能读写自己的
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- subscriptions: 用户只能查看自己的
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- stock_picks: 所有人可查看非 Pro 专属的, Pro 专属的需要验证会员
-- 由于 RLS 无法直接检查会员状态, 我们在 API 层做权限控制
-- 这里允许所有认证用户查看, API 层根据 plan 过滤
ALTER TABLE public.stock_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view picks" ON public.stock_picks FOR SELECT TO authenticated USING (true);

-- watchlist: 用户只能操作自己的
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own watchlist" ON public.watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlist" ON public.watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON public.watchlist FOR DELETE USING (auth.uid() = user_id);

-- pick_views: 用户只能操作自己的
ALTER TABLE public.pick_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pick_views" ON public.pick_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pick_views" ON public.pick_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- pick_performance: 所有人可读
ALTER TABLE public.pick_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view performance" ON public.pick_performance FOR SELECT USING (true);

-- invitation_codes: 认证用户可验证邀请码 (只读), 管理通过 service_role
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can check invitation codes" ON public.invitation_codes FOR SELECT TO authenticated USING (true);

-- stock_basic_info: 所有认证用户可读
ALTER TABLE public.stock_basic_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view stock_basic_info" ON public.stock_basic_info FOR SELECT TO authenticated USING (true);

-- stock_ai_analysis: 所有认证用户可读
ALTER TABLE public.stock_ai_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view stock_ai_analysis" ON public.stock_ai_analysis FOR SELECT TO authenticated USING (true);

-- ========== 更新时间戳触发器 ==========
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========== 辅助函数: 检查用户是否为 Pro ==========
CREATE OR REPLACE FUNCTION public.is_pro_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_plan TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  SELECT plan, membership_expires_at INTO user_plan, expires_at
  FROM public.profiles WHERE id = user_uuid;

  IF user_plan IS NULL THEN
    RETURN false;
  END IF;

  IF user_plan = 'pro' THEN
    IF expires_at IS NULL OR expires_at > now() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
