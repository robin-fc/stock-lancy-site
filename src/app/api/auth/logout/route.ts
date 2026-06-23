import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** 用户登出 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    // 服务端无存储 session, 尝试登出并忽略错误
    // 客户端会自行清除本地 session
    if (token) {
      await supabase.auth.signOut().catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: '已登出',
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
