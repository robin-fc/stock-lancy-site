import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** 用户登录 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    // 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    // 调用 Supabase 登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
