"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  Trash2,
  Pencil,
  Bell,
  X,
  Check,
  Loader2,
  AlertCircle,
  Bookmark,
  Search,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { useAuthStore } from "@/store/auth";
import { authFetch, parseApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { WatchlistItem } from "@/types";

export default function WatchlistPage() {
  const router = useRouter();
  const { profile, loading, initialized, init } = useAuthStore();

  const [items, setItems] = React.useState<WatchlistItem[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);

  // 添加表单
  const [newSymbol, setNewSymbol] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  // 编辑状态
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editNotes, setEditNotes] = React.useState("");
  const [editHigh, setEditHigh] = React.useState("");
  const [editLow, setEditLow] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  React.useEffect(() => {
    if (initialized && !loading && !profile) {
      router.replace("/login");
    }
  }, [initialized, loading, profile, router]);

  // 加载自选股
  const loadWatchlist = React.useCallback(async () => {
    if (!profile) return;
    setDataLoading(true);
    try {
      const res = await authFetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        setItems(data.watchlist || []);
      }
    } catch {
      // 静默失败
    } finally {
      setDataLoading(false);
    }
  }, [profile]);

  React.useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // 添加自选股
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    if (!newSymbol.trim()) {
      setAddError("请输入股票代码");
      return;
    }

    setAdding(true);
    try {
      const res = await authFetch("/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          symbol: newSymbol.trim(),
          name: newName.trim() || newSymbol.trim().toUpperCase(),
        }),
      });

      if (res.status === 409) {
        setAddError("该股票已在自选股列表中");
        return;
      }
      if (!res.ok) {
        setAddError(await parseApiError(res));
        return;
      }

      setNewSymbol("");
      setNewName("");
      await loadWatchlist();
    } catch {
      setAddError("网络错误，请稍后重试");
    } finally {
      setAdding(false);
    }
  }

  // 开始编辑
  function startEdit(item: WatchlistItem) {
    setEditingId(item.id);
    setEditNotes(item.notes || "");
    setEditHigh(
      item.alert_price_high != null ? String(item.alert_price_high) : ""
    );
    setEditLow(
      item.alert_price_low != null ? String(item.alert_price_low) : ""
    );
    setActionError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNotes("");
    setEditHigh("");
    setEditLow("");
  }

  // 保存编辑
  async function handleSave(item: WatchlistItem) {
    setSavingId(item.id);
    setActionError(null);

    const body: Record<string, unknown> = { notes: editNotes || null };
    if (editHigh.trim()) {
      const v = parseFloat(editHigh);
      if (!isNaN(v)) body.alert_price_high = v;
    } else {
      body.alert_price_high = null;
    }
    if (editLow.trim()) {
      const v = parseFloat(editLow);
      if (!isNaN(v)) body.alert_price_low = v;
    } else {
      body.alert_price_low = null;
    }

    try {
      const res = await authFetch(`/api/watchlist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setActionError(await parseApiError(res));
        return;
      }

      setEditingId(null);
      await loadWatchlist();
    } catch {
      setActionError("网络错误，请稍后重试");
    } finally {
      setSavingId(null);
    }
  }

  // 删除
  async function handleDelete(item: WatchlistItem) {
    if (!confirm(`确定要删除 ${item.symbol} 吗？`)) return;

    setDeletingId(item.id);
    setActionError(null);
    try {
      const res = await authFetch(`/api/watchlist/${item.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setActionError(await parseApiError(res));
        return;
      }

      if (editingId === item.id) cancelEdit();
      await loadWatchlist();
    } catch {
      setActionError("网络错误，请稍后重试");
    } finally {
      setDeletingId(null);
    }
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
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 标题 */}
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <Bookmark size={24} className="text-[var(--green)]" />
              我的自选股
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              管理您关注的自选股，设置价格提醒
            </p>
          </div>

          {/* 添加表单 */}
          <Card className="mb-6 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <BookmarkPlus size={16} className="text-[var(--accent)]" />
              添加自选股
            </h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="股票代码 (如 600519)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="股票名称 (可选)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={adding}
                />
              </div>
              <Button type="submit" disabled={adding} className="shrink-0">
                {adding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <BookmarkPlus size={16} />
                )}
                添加
              </Button>
            </form>
            {addError && (
              <p className="mt-2 flex items-center gap-1 text-xs text-[var(--red)]">
                <AlertCircle size={12} /> {addError}
              </p>
            )}
          </Card>

          {actionError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2">
              <AlertCircle size={14} className="text-[var(--red)]" />
              <p className="text-xs text-[var(--red)]">{actionError}</p>
            </div>
          )}

          {/* 自选股列表 */}
          {dataLoading ? (
            <Loading text="加载自选股..." className="py-16" />
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const isSaving = savingId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <Card key={item.id} className="p-4">
                    {isEditing ? (
                      /* 编辑模式 */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-[var(--text-primary)]">
                              {item.symbol}
                            </span>
                            <span className="text-sm text-[var(--text-secondary)]">
                              {item.name}
                            </span>
                          </div>
                          <Badge variant="gray">编辑中</Badge>
                        </div>

                        <Input
                          label="备注"
                          placeholder="添加备注..."
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          disabled={isSaving}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="价格提醒上限"
                            type="number"
                            step="0.01"
                            placeholder="如 200.00"
                            value={editHigh}
                            onChange={(e) => setEditHigh(e.target.value)}
                            disabled={isSaving}
                          />
                          <Input
                            label="价格提醒下限"
                            type="number"
                            step="0.01"
                            placeholder="如 150.00"
                            value={editLow}
                            onChange={(e) => setEditLow(e.target.value)}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(item)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            <X size={14} /> 取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 展示模式 */
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-hover)] text-xs font-bold text-[var(--text-primary)]">
                              {item.symbol.slice(0, 2)}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">
                                {item.symbol}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {item.name}
                              </p>
                            </div>
                          </div>

                          {item.notes && (
                            <p className="mt-2 text-xs text-[var(--text-secondary)]">
                              {item.notes}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {(item.alert_price_high != null ||
                              item.alert_price_low != null) && (
                              <Badge variant="orange">
                                <Bell size={10} /> 价格提醒
                              </Badge>
                            )}
                            {item.alert_price_high != null && (
                              <span className="text-xs text-[var(--text-muted)]">
                                上限: ¥{item.alert_price_high.toFixed(2)}
                              </span>
                            )}
                            {item.alert_price_low != null && (
                              <span className="text-xs text-[var(--text-muted)]">
                                下限: ¥{item.alert_price_low.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xs text-[var(--text-muted)]">
                              添加于 {formatDate(item.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(item)}
                            disabled={isDeleting}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item)}
                            disabled={isDeleting}
                            className="text-[var(--red)] hover:bg-[var(--red)]/10"
                          >
                            {isDeleting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)]">
                <Search size={28} className="text-[var(--text-muted)]" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-[var(--text-primary)]">
                  还没有自选股
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  在上方输入股票代码，添加您关注的股票
                </p>
              </div>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
