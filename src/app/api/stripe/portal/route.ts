import { NextRequest, NextResponse } from 'next/server';
// 以下 imports 保留用于二期恢复 Stripe 支付功能
import { supabase, createServerClient } from '@/lib/supabase';
import { createPortalSession } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * 创建 Stripe Customer Portal Session (管理订阅)
 *
 * 注意: Stripe 支付功能暂时关闭 (二期再上), 当前直接返回 503。
 * 二期恢复时, 将下方的 return 语句删除并恢复原有逻辑即可。
 */
export async function POST(request: NextRequest) {
  // 避免未使用变量警告 (二期恢复时删除此行)
  void request;
  void supabase;
  void createServerClient;
  void createPortalSession;

  return NextResponse.json(
    { error: '订阅管理功能即将上线', comingSoon: true },
    { status: 503 }
  );
}
