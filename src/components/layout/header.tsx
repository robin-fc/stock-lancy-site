"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  TrendingUp,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/picks", label: "选股" },
  { href: "/intraday", label: "盘中分析" },
  { href: "/watchlist", label: "自选股" },
  { href: "/pricing", label: "会员" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuthStore();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭用户菜单
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 路由切换时关闭移动端菜单
  React.useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="text-[var(--accent)]" size={24} />
          <span className="text-[var(--text-primary)]">AI选股器</span>
        </Link>

        {/* 桌面端导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "text-[var(--text-primary)] bg-[var(--surface-hover)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* 桌面端用户区 */}
        <div className="hidden items-center gap-3 md:flex">
          {profile ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
              >
                {/* 头像 */}
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                    {profile.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
                <span className="max-w-[100px] truncate text-[var(--text-primary)]">
                  {profile.name || profile.email}
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-[var(--text-secondary)] transition-transform",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {/* 下拉菜单 */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl animate-fade-in">
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {profile.name || "用户"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {profile.email}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                      会员
                    </span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    <LayoutDashboard size={16} /> 仪表盘
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    <Settings size={16} /> 设置
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--red)]"
                  >
                    <LogOut size={16} /> 退出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">登录</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">注册</Link>
              </Button>
            </>
          )}
        </div>

        {/* 移动端汉堡按钮 */}
        <button
          className="flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="菜单"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* 移动端菜单 */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] md:hidden animate-fade-in">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-[var(--border)]" />

            {profile ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                      {profile.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {profile.name || "用户"}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                      会员
                    </span>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <LayoutDashboard size={16} /> 仪表盘
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={16} /> 设置
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--red)]"
                >
                  <LogOut size={16} /> 退出
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-1">
                <Button variant="outline" size="md" asChild>
                  <Link href="/login">
                    <UserIcon size={16} /> 登录
                  </Link>
                </Button>
                <Button size="md" asChild>
                  <Link href="/register">注册</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
