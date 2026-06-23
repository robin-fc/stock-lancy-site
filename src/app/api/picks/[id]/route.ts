import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { StockPick } from '@/types';

export const dynamic = 'force-dynamic';

/** 获取单个选股详情 (邀请制: 所有用户均可查看完整详情) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: '缺少选股 ID' },
        { status: 400 }
      );
    }

    const serverClient = createServerClient();

    // 查询选股详情
    const { data: pick, error } = await serverClient
      .from('stock_picks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !pick) {
      return NextResponse.json(
        { error: '选股不存在' },
        { status: 404 }
      );
    }

    const pickData = pick as StockPick;

    // 增加选股浏览量
    await serverClient
      .from('stock_picks')
      .update({ view_count: (pickData.view_count || 0) + 1 })
      .eq('id', id);

    // 邀请制下所有用户均为完整权限会员, 直接返回完整详情 (包含 analysis)
    return NextResponse.json(pickData);
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
