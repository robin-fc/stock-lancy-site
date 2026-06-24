import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import type { StrategyEvolution } from '@/types';

export const dynamic = 'force-dynamic';

/** 前端读取策略演进分析 */
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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;

    const serverClient = createServerClient();

    // 查询 strategy_evolution 表, 按分析日期倒序
    const { data: evolutions, error } = await serverClient
      .from('strategy_evolution')
      .select('*')
      .order('analysis_date', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: '获取策略演进分析失败', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      evolutions: (evolutions || []) as StrategyEvolution[],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
