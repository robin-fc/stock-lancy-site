import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchStocks } from '@/lib/stock-api';

export const dynamic = 'force-dynamic';

/** 股票搜索 API (东方财富搜索, 支持代码/名称/拼音) */
export async function GET(request: NextRequest) {
  try {
    // 从 Authorization header 获取 token 验证用户
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    // 验证用户身份
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    // 获取搜索关键词
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (!q.trim()) {
      return NextResponse.json({
        results: [],
      });
    }

    // 调用东方财富搜索接口
    const results = await searchStocks(q, 10);

    return NextResponse.json({
      results,
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
