import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** 获取当前用户自选股列表 */
export async function GET(request: NextRequest) {
  try {
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

    // 查询用户自选股列表, 按排序顺序返回
    const { data: watchlist, error } = await serverClient
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: '获取自选股列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      watchlist: watchlist || [],
      total: watchlist?.length || 0,
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/** 添加自选股 */
export async function POST(request: NextRequest) {
  try {
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
    const { symbol, name, notes } = body as {
      symbol?: string;
      name?: string;
      notes?: string;
    };

    // 参数校验
    if (!symbol) {
      return NextResponse.json(
        { error: '股票代码为必填项' },
        { status: 400 }
      );
    }

    const serverClient = createServerClient();

    // 检查是否已存在 (user_id + symbol 唯一约束)
    const { data: existing } = await serverClient
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '该股票已在自选股列表中' },
        { status: 409 }
      );
    }

    // 获取当前最大 sort_order
    const { data: maxOrder } = await serverClient
      .from('watchlist')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxOrder?.sort_order || 0) + 1;

    // 插入自选股
    const { data: item, error } = await serverClient
      .from('watchlist')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
        notes: notes || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: '添加自选股失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      item,
      message: '添加成功',
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
