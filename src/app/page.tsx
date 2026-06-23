"use client";

import * as React from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Activity,
  Radar,
  BookmarkPlus,
  ArrowRight,
  Check,
  TrendingUp,
  Sparkles,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { PickCard } from "@/components/stock/pick-card";
import { getAuthHeaders } from "@/lib/api";
import { MAX_USERS } from "@/types";
import type { StockPick } from "@/types";

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI 深度分析",
    desc: "基于大语言模型与技术指标，对每只 A 股生成多维度深度分析报告，洞察投资机会。",
  },
  {
    icon: Activity,
    title: "实时 A 股技术指标",
    desc: "RSI、MACD、均线系统、布林带等核心技术指标实时计算，精准捕捉 A 股买卖时机。",
  },
  {
    icon: Radar,
    title: "智能选股信号",
    desc: "从强烈买入到强烈卖出五级信号体系，结合置信度评分，量化每一条 A 股选股建议。",
  },
  {
    icon: BookmarkPlus,
    title: "自选股管理",
    desc: "自定义 A 股自选股列表，设置价格提醒区间，不错过任何一个关键价位。",
  },
];

const MEMBER_BENEFITS = [
  "无限查看所有 AI 选股",
  "完整 AI 深度分析报告",
  "实时 A 股技术指标",
  "自选股管理 & 价格提醒",
  "每日自动选股推送",
];

export default function HomePage() {
  const [featured, setFeatured] = React.useState<StockPick[]>([]);
  const [loadingPicks, setLoadingPicks] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function loadFeatured() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/picks?limit=20", { headers });
        if (!res.ok) return;
        const data = await res.json();
        const picks: StockPick[] = data.picks || [];
        const featuredPicks = picks.filter((p) => p.is_featured).slice(0, 3);
        const result =
          featuredPicks.length > 0 ? featuredPicks : picks.slice(0, 3);
        if (!cancelled) setFeatured(result);
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setLoadingPicks(false);
      }
    }
    loadFeatured();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero 区域 */}
        <section className="relative overflow-hidden grid-bg">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="blue" className="mb-6">
                <Sparkles size={12} /> A 股智能选股 · 邀请制
              </Badge>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                AI 驱动的
                <span className="gradient-text"> A 股智能选股平台</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
                专注中国 A 股市场，基于人工智能与量化技术指标，每日为您生成精准选股信号。本站为私密邀请制平台，仅限 {MAX_USERS} 位会员，享受全部功能。
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/register">
                    申请邀请 <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <Link href="/picks">
                    查看选股 <TrendingUp size={18} />
                  </Link>
                </Button>
              </div>

              {/* 数据统计 */}
              <div className="mt-16 grid grid-cols-3 gap-4 sm:gap-8">
                {[
                  { label: "覆盖 A 股", value: "5000+" },
                  { label: "每日选股", value: "20+" },
                  { label: "信号准确率", value: "68%" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 功能特性区 */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              为什么选择 AI 选股器
            </h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              四大核心能力，全方位赋能您的投资决策
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} hover className="p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                  <feature.icon className="text-[var(--accent)]" size={22} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[var(--text-primary)]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {feature.desc}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* 精选选股展示 */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)]/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  精选选股
                </h2>
                <p className="mt-3 text-[var(--text-secondary)]">
                  AI 精选的高置信度选股信号
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                <Link href="/picks">
                  查看全部 <ArrowRight size={14} />
                </Link>
              </Button>
            </div>

            {loadingPicks ? (
              <Loading text="加载精选选股..." className="py-16" />
            ) : featured.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center gap-3 py-16">
                <TrendingUp
                  size={32}
                  className="text-[var(--text-muted)]"
                />
                <p className="text-sm text-[var(--text-secondary)]">
                  暂无精选选股，请稍后再来
                </p>
              </Card>
            )}

            <div className="mt-8 text-center sm:hidden">
              <Button variant="outline" asChild>
                <Link href="/picks">
                  查看全部选股 <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 邀请制会员说明 */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              邀请制会员
            </h2>
            <p className="mt-3 text-[var(--text-secondary)]">
              私密邀请制平台，仅限 {MAX_USERS} 位会员，全部功能无限制
            </p>
          </div>

          <div className="mx-auto max-w-2xl">
            <Card
              hover
              className="relative flex flex-col border-[var(--accent)]/40 p-8"
            >
              <div className="absolute -top-3 right-8">
                <Badge variant="yellow">
                  <Sparkles size={12} /> 邀请制
                </Badge>
              </div>
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  会员权益
                </CardTitle>
                <CardDescription>
                  所有会员享有完整权限，无需付费
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="mt-6 space-y-3">
                  {MEMBER_BENEFITS.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <Check
                        size={16}
                        className="shrink-0 text-[var(--accent)]"
                      />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <div className="mt-6">
                <Button className="w-full" asChild>
                  <Link href="/register">
                    申请邀请 <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>

          {/* 三大特点 */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                <Users className="text-[var(--accent)]" size={22} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
                仅限 {MAX_USERS} 人
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                私密邀请制，名额有限
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--green)]/10">
                <ShieldCheck className="text-[var(--green)]" size={22} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
                完整权限
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                所有功能全部开放
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--yellow)]/10">
                <Sparkles className="text-[var(--yellow)]" size={22} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
                A 股智能选股
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                AI 驱动，每日更新
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--border)] bg-[var(--surface)]/30">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              立即开始您的 A 股智能投资之旅
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">
              本站为邀请制平台，持有邀请码即可注册，享受全部 AI 选股功能。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  申请邀请 <ArrowRight size={18} />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/login">已有账号？登录</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
