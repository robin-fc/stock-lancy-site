-- stock-lancy-site 迁移: 盘中4次快照 + 策略演进分析
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ========== 11. intraday_snapshots (盘中快照) ==========
-- 每个交易日4次快照: morning_open(9:30), morning_close(11:30), afternoon_open(13:00), afternoon_close(15:00)
CREATE TABLE IF NOT EXISTS public.intraday_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,                    -- 股票代码
  name TEXT NOT NULL,                      -- 股票名称
  snapshot_date DATE NOT NULL,             -- 交易日期
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('morning_open', 'morning_close', 'afternoon_open', 'afternoon_close')),
  -- 快照数据
  price NUMERIC(12,4) NOT NULL,            -- 快照时刻价格
  change_pct NUMERIC(8,4) NOT NULL DEFAULT 0, -- 当日涨跌幅
  volume BIGINT NOT NULL DEFAULT 0,        -- 成交量
  turnover NUMERIC(20,2) NOT NULL DEFAULT 0, -- 成交额(万元)
  -- 技术指标快照
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 与上一个快照的变化
  price_change NUMERIC(12,4),              -- 相对上一快照的价格变化
  price_change_pct NUMERIC(8,4),           -- 相对上一快照的涨跌幅
  volume_change_pct NUMERIC(8,4),          -- 相对上一快照的量比变化
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 唯一约束: 每只股票每天每个时段只有一条快照
  UNIQUE(symbol, snapshot_date, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_intraday_snapshots_date ON public.intraday_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_intraday_snapshots_symbol ON public.intraday_snapshots(symbol, snapshot_date);

-- ========== 12. strategy_evolution (策略演进) ==========
-- AI 基于盘中4次快照对比分析, 生成策略洞察和调整建议
CREATE TABLE IF NOT EXISTS public.strategy_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_date DATE NOT NULL UNIQUE,      -- 分析日期
  -- 盘中对比数据摘要
  morning_session JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 上午时段: open→close 的变化统计
  afternoon_session JSONB NOT NULL DEFAULT '{}'::jsonb, -- 下午时段: open→close 的变化统计
  full_day JSONB NOT NULL DEFAULT '{}'::jsonb,         -- 全天: morning_open→afternoon_close
  -- 表现最佳/最差的股票
  top_performers JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 涨幅前列
  bottom_performers JSONB NOT NULL DEFAULT '[]'::jsonb, -- 跌幅前列
  -- AI 分析结果
  ai_insight TEXT NOT NULL,                -- AI 生成的策略洞察(Markdown)
  pattern_findings JSONB NOT NULL DEFAULT '[]'::jsonb, -- 发现的规律 [{pattern, description, confidence}]
  strategy_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb, -- 建议的因子权重调整 {factor_key: delta}
  -- 与昨日对比
  comparison_with_yesterday JSONB,         -- 与上一个交易日的对比
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== RLS 策略 ==========
ALTER TABLE public.intraday_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view intraday_snapshots" ON public.intraday_snapshots FOR SELECT TO authenticated USING (true);

ALTER TABLE public.strategy_evolution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view strategy_evolution" ON public.strategy_evolution FOR SELECT TO authenticated USING (true);
