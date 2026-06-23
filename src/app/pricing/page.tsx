"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Crown,
  Sparkles,
  Users,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth";
import { MAX_USERS } from "@/types";

const MEMBER_BENEFITS = [
  "无限查看所有 AI 选股",
  "完整 AI 深度分析报告",
  "实时 A 股技术指标",
  "自选股管理 & 价格提醒",
  "每日自动选股推送",
];

export default function PricingPage() {
  const { profile, initialized, init } = useAuthStore();

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  const isLoggedIn = !!profile;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          {/* 标题 */}
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--yellow)]/10">
              <Crown className="text-[var(--yellow)]" size={26} />
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
              邀请制会员
            </h1>
            <p className="mt-4 text-[var(--text-secondary)]">
              本站为私密邀请制平台，仅限 {MAX_USERS} 位会员，所有会员享有完整权限
            </p>
          </div>

          {/* 会员卡片 */}
          <Card
            hover
            className="relative mx-auto max-w-xl flex flex-col border-[var(--accent)]/40 p-8"
          >
            <div className="absolute -top-3 left-8">
              <Badge variant="yellow">
                <Sparkles size={12} /> 邀请制
              </Badge>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
                  会员
                  <Crown size={20} className="text-[var(--yellow)]" />
                </h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                私密邀请制，全部功能，无限制使用
              </p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-[var(--text-primary)]">
                ¥0
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                {" "}
                / 邀请制免费
              </span>
            </div>

            <ul className="mb-8 space-y-3">
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

            <div className="mt-auto">
              {isLoggedIn ? (
                <Button variant="outline" className="w-full" size="lg" disabled>
                  <Crown size={18} /> 您已是会员
                </Button>
              ) : (
                <Button className="w-full" size="lg" asChild>
                  <Link href="/register">
                    需要邀请码才能注册 <ArrowRight size={18} />
                  </Link>
                </Button>
              )}
            </div>
          </Card>

          {/* 说明区 */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
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
                所有会员功能全部开放
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

          {/* 常见问题 */}
          <div className="mt-16">
            <h3 className="mb-6 text-center text-xl font-bold text-[var(--text-primary)]">
              常见问题
            </h3>
            <div className="mx-auto max-w-2xl space-y-4">
              {[
                {
                  q: "如何获得邀请码？",
                  a: "本站为私密邀请制平台，邀请码由站长定向发放给受邀用户。如您已收到邀请码，可在注册页面填写后完成注册。",
                },
                {
                  q: "会员需要付费吗？",
                  a: "不需要。邀请制下所有注册会员均享有完整权限，无需付费订阅。支付功能将在二期上线。",
                },
                {
                  q: "会员有什么权限？",
                  a: "所有会员享有完整权限：无限查看所有 AI 选股、完整 AI 深度分析报告、实时 A 股技术指标、自选股管理与价格提醒、每日自动选股推送等全部功能。",
                },
              ].map((item) => (
                <Card key={item.q} className="p-5">
                  <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    {item.q}
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.a}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
