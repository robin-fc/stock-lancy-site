import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';
import type { AnalysisFactor } from '@/types';

export const dynamic = 'force-dynamic';

/** 获取当前因子权重公式 */
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

    const serverClient = createServerClient();

    // 查询 analysis_factors 表所有启用的因子
    const { data: factors, error } = await serverClient
      .from('analysis_factors')
      .select('*')
      .eq('is_active', true)
      .order('factor_key', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: '获取因子权重失败', detail: error.message },
        { status: 500 }
      );
    }

    const factorList = (factors || []) as AnalysisFactor[];

    // 计算权重总和
    const totalWeight = factorList.reduce(
      (sum, f) => sum + (f.weight || 0),
      0
    );

    return NextResponse.json({
      factors: factorList,
      total_weight: totalWeight,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
