"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, Mail, Lock, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuthStore();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    const { error: loginError } = await login(email, password);
    if (loginError) {
      setError(loginError);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10">
              <TrendingUp className="text-[var(--accent)]" size={26} />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              欢迎回来
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              登录您的 AI 选股器账号
            </p>
          </div>

          <Card className="p-6">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    label="邮箱"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={loading}
                  />
                  <Mail
                    size={16}
                    className="pointer-events-none absolute right-3 top-[38px] text-[var(--text-muted)]"
                  />
                </div>

                <div className="relative">
                  <Input
                    label="密码"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <Lock
                    size={16}
                    className="pointer-events-none absolute right-3 top-[38px] text-[var(--text-muted)]"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2.5">
                    <AlertCircle
                      size={16}
                      className="mt-0.5 shrink-0 text-[var(--red)]"
                    />
                    <p className="text-sm text-[var(--red)]">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "登录中..." : "登录"}
                </Button>
              </form>

              <div className="mt-6 border-t border-[var(--border)] pt-4 text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  还没有账号？{" "}
                  <Link
                    href="/register"
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    立即注册
                  </Link>
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  需要邀请码注册？本站为邀请制平台
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
