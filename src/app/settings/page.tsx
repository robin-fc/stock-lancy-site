"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Crown,
  Settings as SettingsIcon,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading, initialized, init, logout, refreshProfile } =
    useAuthStore();

  const [name, setName] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const [emailNotify, setEmailNotify] = React.useState(true);

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  React.useEffect(() => {
    if (initialized && !loading && !profile) {
      router.replace("/login");
    }
  }, [initialized, loading, profile, router]);

  // 同步 name 到表单
  React.useEffect(() => {
    if (profile) setName(profile.name || "");
  }, [profile]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);

    if (!profile) return;
    if (!name.trim()) {
      setNameError("用户名不能为空");
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      if (error) {
        setNameError("保存失败，请稍后重试");
        return;
      }

      await refreshProfile();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch {
      setNameError("网络错误，请稍后重试");
    } finally {
      setSavingName(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading size="lg" text="加载中..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loading text="正在跳转登录..." />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 标题 */}
          <div className="mb-8">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <SettingsIcon size={24} className="text-[var(--accent)]" />
              账号设置
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              管理您的个人信息、会员订阅和偏好设置
            </p>
          </div>

          <div className="space-y-6">
            {/* 个人信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User size={18} className="text-[var(--accent)]" />
                  个人信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 头像 */}
                <div className="flex items-center gap-4">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-semibold text-white">
                      {profile.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      头像
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      头像暂不支持自定义修改
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleSaveName}
                  className="space-y-4 border-t border-[var(--border)] pt-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="用户名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={savingName}
                      placeholder="请输入用户名"
                    />
                    <Input
                      label="邮箱"
                      value={profile.email}
                      disabled
                      readOnly
                    />
                  </div>

                  {nameError && (
                    <p className="flex items-center gap-1 text-xs text-[var(--red)]">
                      <AlertCircle size={12} /> {nameError}
                    </p>
                  )}
                  {nameSaved && (
                    <p className="flex items-center gap-1 text-xs text-[var(--green)]">
                      <CheckCircle2 size={12} /> 用户名已保存
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={savingName}>
                      {savingName ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      保存修改
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setName(profile.name || "")}
                      disabled={savingName}
                    >
                      重置
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 会员管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown size={18} className="text-[var(--yellow)]" />
                  会员管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--yellow)]/10">
                      <Crown
                        size={20}
                        className="text-[var(--yellow)]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          会员
                        </p>
                        <Badge variant="green">有效</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        会员状态：有效，享受全部功能
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  本站为邀请制私密平台，所有注册会员均享有完整权限，无需额外订阅或升级。
                </p>
              </CardContent>
            </Card>

            {/* 偏好设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell size={18} className="text-[var(--accent)]" />
                  偏好设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      邮件通知
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      接收每日选股信号和价格提醒邮件
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailNotify}
                    onClick={() => setEmailNotify((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      emailNotify
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailNotify ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-xs text-[var(--text-muted)]">
                    更多偏好设置即将推出
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 账号操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail size={18} className="text-[var(--accent)]" />
                  账号
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      退出登录
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      退出当前账号，下次需要重新登录
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="text-[var(--red)] hover:bg-[var(--red)]/10"
                  >
                    <LogOut size={14} /> 退出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
