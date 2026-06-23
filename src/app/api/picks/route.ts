import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * 标准化日期字符串为 YYYY-MM-DD 格式
 * 支持传入 YYYY-MM-DD 或 Date 可解析的字符串, 无效时返回 null
 */
function normalizeDateString(input: string): string | null {
  const trimmed = input.trim();

  // 已经是 YYYY-MM-DD 格式, 校验合法性
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const dateObj = new Date(`${y}-${m}-${d}T00:00:00Z`);
    if (
      isNaN(dateObj.getTime()) ||
      dateObj.getUTCFullYear() !== parseInt(y, 10) ||
      dateObj.getUTCMonth() + 1 !== parseInt(m, 10) ||
      dateObj.getUTCDate() !== parseInt(d, 10)
    ) {
      return null;
    }
    return `${y}-${m}-${d}`;
  }

  // 尝试解析其他格式并转换为 YYYY-MM-DD
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
  const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = parsed.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

    // 按日期筛选 (确保格式为 YYYY-MM-DD)
    if (date) {
      // 标准化日期格式: 前端传入 YYYY-MM-DD, 这里做格式校验与兜底
      const normalizedDate = normalizeDateString(date);
      if (normalizedDate) {
        query = query.eq('pick_date', normalizedDate);
      }
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
