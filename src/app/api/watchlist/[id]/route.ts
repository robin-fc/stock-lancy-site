import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** 删除自选股 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    // 验证用户
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const serverClient = createServerClient();

    // 删除自选股 (确保是当前用户的)
    const { error, count } = await serverClient
      .from('watchlist')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: '删除自选股失败' },
        { status: 500 }
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: '自选股不存在或无权操作' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/** 更新自选股 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    // 验证用户
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const body = await request.json();
    const { notes, alert_price_high, alert_price_low } = body as {
      notes?: string;
      alert_price_high?: number | null;
      alert_price_low?: number | null;
    };

    // 构建更新对象 (只更新提供的字段)
    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (alert_price_high !== undefined) updateData.alert_price_high = alert_price_high;
    if (alert_price_low !== undefined) updateData.alert_price_low = alert_price_low;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    const serverClient = createServerClient();

    // 更新自选股 (确保是当前用户的)
    const { data: item, error } = await serverClient
      .from('watchlist')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !item) {
      return NextResponse.json(
        { error: '更新失败, 自选股不存在或无权操作' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      item,
      message: '更新成功',
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
