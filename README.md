# AI 选股器 (stock.lancy.site)

AI 驱动的 A 股智能选股平台，基于技术指标和人工智能分析，每日生成精准选股信号。邀请制私密平台，仅限 10 位会员。

## 功能特性

- **AI 深度分析** - 基于 Agnes 2.0 Flash 对 A 股进行多维度分析
- **实时技术指标** - RSI、MACD、均线系统、布林带等技术指标自动计算
- **智能选股信号** - 强烈买入/买入/持有/卖出/强烈卖出五级信号
- **自选股管理** - 添加自选股、设置价格提醒
- **邀请制会员** - 仅限 10 位邀请用户，全员完整权限，无功能限制
- **每日自动选股** - Vercel Cron 定时任务，交易日每天自动生成选股
- **A 股数据** - 使用东方财富免费 API，无需 API Key

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 16 + React 19 | App Router, Tailwind CSS v4 |
| 数据库 | Supabase (PostgreSQL) | 免费版: 500MB 存储, 50K MAU |
| 认证 | Supabase Auth | 邮箱密码 + 邀请码注册 |
| 股票数据 | 东方财富 API | 免费, 无需 API Key |
| AI 分析 | Agnes 2.0 Flash | 免费, 兼容 OpenAI 格式, 1M 上下文 |
| 部署 | Vercel | 免费版, 自动部署 + Cron 定时任务 |
| 状态管理 | Zustand | 轻量级状态管理 |
| 图表 | Recharts | 股票 K 线图表 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入以下配置：

```bash
# Supabase (https://supabase.com)
# 创建项目后, 在 Settings > API 获取
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Agnes AI (https://agnes-ai.com)
# 可选: 不填则使用技术指标生成基础分析
AGNES_API_KEY=sk-xxx

# 应用配置
NEXT_PUBLIC_APP_URL=https://stock.lancy.site
CRON_SECRET=自定义随机字符串
```

### 3. 初始化数据库

在 Supabase Dashboard → SQL Editor 中执行 `supabase/init.sql`。

执行后会自动创建 10 个邀请码：
```
AI-7K3M-9P2X, AI-4N8Q-1R6T, AI-2W5Y-8C3B, AI-9F1H-6D4J, AI-3V7L-2G8N
AI-6A9S-5E3K, AI-8Z2U-4M7P, AI-1X6R-9Q4W, AI-5B3T-7Y1F, AI-4D8C-2H6J
```

每个邀请码只能使用一次，最多注册 10 位用户。

### 4. 本地开发

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Vercel

### 1. 导入项目

在 Vercel Dashboard 中导入 Git 仓库，选择 `stock-lancy-site` 目录。

### 2. 配置环境变量

在 Vercel 项目设置中添加环境变量（同 `.env.example`）。

### 3. 配置域名

在 Vercel 项目设置 → Domains 中添加 `stock.lancy.site`。

Namecheap DNS 配置（已配置）：
- 类型: CNAME
- 主机: stock
- 值: cname.vercel-dns.com

## 定时任务

Vercel Cron 配置在 `vercel.json` 中：
- 每个交易日（周一至周五）北京时间 16:00 (UTC 08:00) 自动生成选股
- A 股 15:00 收盘后执行，确保当日数据完整
- 通过 `CRON_SECRET` 验证请求

## 会员方案

邀请制，仅限 10 位会员，全员完整权限：

| 功能 | 会员 |
|------|------|
| 选股查看 | 无限 |
| AI 深度分析 | ✅ |
| 精选选股 | ✅ |
| 自选股管理 | ✅ |
| 价格提醒 | ✅ |
| 技术指标 | 完整 |

> 在线支付功能（Stripe）为二期规划，当前通过邀请码注册。

## A 股股票池

默认关注 25 只 A 股，覆盖白酒、银行、新能源、科技、消费、半导体、军工等板块：

- 白酒: 贵州茅台(600519), 五粮液(000858)
- 银行/金融: 招商银行(600036), 中国平安(601318), 工商银行(601398), 平安银行(000001)
- 新能源: 宁德时代(300750), 比亚迪(002594), 隆基绿能(601012)
- 科技: 东方财富(300059), 海康威视(002415), 中兴通讯(000063), 科大讯飞(002230)
- 消费/医药: 恒瑞医药(600276), 美的集团(000333), 伊利股份(600887)
- 半导体: 中芯国际(688981), 紫光国微(002049)
- 其他: 航发动力(600893), 长城汽车(601633), 浦发银行(600000) 等

## 项目结构

```
stock-lancy-site/
├── src/
│   ├── app/              # Next.js App Router 页面
│   │   ├── api/          # API 路由
│   │   ├── dashboard/    # 仪表盘
│   │   ├── picks/        # 选股列表/详情
│   │   ├── watchlist/    # 自选股
│   │   ├── pricing/      # 会员说明
│   │   ├── login/        # 登录
│   │   ├── register/     # 注册(需邀请码)
│   │   ├── settings/     # 设置
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 落地页
│   ├── components/       # React 组件
│   │   ├── ui/           # 基础 UI 组件
│   │   ├── layout/       # 布局组件
│   │   └── stock/        # 股票相关组件
│   ├── lib/              # 工具库
│   ├── store/            # Zustand 状态管理
│   └── types/            # TypeScript 类型
├── supabase/
│   └── init.sql          # 数据库初始化 SQL (含10个邀请码)
├── .env.example          # 环境变量模板
├── vercel.json           # Vercel 部署配置
└── package.json
```

## License

MIT
