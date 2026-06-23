import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** 获取选股列表 (邀请制: 所有用户均可查看完整数据) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const signal = searchParams.get('signal');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    // 使用服务端客户端查询 (绕过 RLS)
    const serverClient = createServerClient();
    let query = serverClient
      .from('stock_picks')
      .select('*')
      .order('pick_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // 按日期筛选
    if (date) {
      query = query.eq('pick_date', date);
    }

    // 按信号筛选
    if (signal) {
      query = query.eq('signal', signal);
    }

    const { data: picks, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '获取选股列表失败' },
        { status: 500 }
      );
    }

    // 邀请制下所有用户均为完整权限会员, 直接返回完整数据 (包含 analysis)
    return NextResponse.json({
      picks: picks || [],
      total: (picks || []).length,
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
