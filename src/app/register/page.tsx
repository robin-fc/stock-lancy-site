"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, User, Mail, Lock, KeyRound, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading } = useAuthStore();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [invitationCode, setInvitationCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (!invitationCode.trim()) {
      setError("请输入邀请码");
      return;
    }

    const { error: registerError } = await register(
      email,
      password,
      name,
      invitationCode.trim()
    );
    if (registerError) {
      setError(registerError);
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
              创建账号
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              本站为邀请制，需要邀请码才能注册
            </p>
          </div>

          <Card className="p-6">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    label="用户名"
                    type="text"
                    placeholder="请输入用户名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    disabled={loading}
                  />
                  <User
                    size={16}
                    className="pointer-events-none absolute right-3 top-[38px] text-[var(--text-muted)]"
                  />
                </div>

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
                    placeholder="至少 6 个字符"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <Lock
                    size={16}
                    className="pointer-events-none absolute right-3 top-[38px] text-[var(--text-muted)]"
                  />
                </div>

                <div className="relative">
                  <Input
                    label="邀请码"
                    type="text"
                    placeholder="请输入邀请码"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value)}
                    autoComplete="off"
                    disabled={loading}
                  />
                  <KeyRound
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
                  {loading ? "注册中..." : "注册"}
                </Button>
              </form>

              <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
                注册即表示您同意我们的服务条款。本平台提供的所有内容仅供参考，不构成投资建议。
              </p>

              <div className="mt-4 border-t border-[var(--border)] pt-4 text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  已有账号？{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    立即登录
                  </Link>
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
