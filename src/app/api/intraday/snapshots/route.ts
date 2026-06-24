import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import type { IntradaySnapshot } from '@/types';

export const dynamic = 'force-dynamic';

/** 标准化日期字符串为 YYYY-MM-DD 格式 */
function normalizeDateString(input: string): string | null {
  const trimmed = input.trim();

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

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
  const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = parsed.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 前端读取盘中快照数据 */
export async function GET(request: NextRequest) {
  try {
    // 从 Authorization header 验证用户
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: '未登录, 请先登录' },
        { status: 401 }
      );
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json(
        { error: '认证失败, 请重新登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const symbol = searchParams.get('symbol');

    // 默认今天, 校验日期格式
    const today = new Date().toISOString().split('T')[0];
    const date = dateParam ? normalizeDateString(dateParam) || today : today;

    const serverClient = createServerClient();

    // 查询 intraday_snapshots 表
    let query = serverClient
      .from('intraday_snapshots')
      .select('*')
      .eq('snapshot_date', date)
      .order('symbol', { ascending: true })
      .order('snapshot_type', { ascending: true });

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    const { data: snapshots, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '获取盘中快照失败', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      snapshots: (snapshots || []) as IntradaySnapshot[],
      date,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
