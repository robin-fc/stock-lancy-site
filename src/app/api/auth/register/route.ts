import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

/** 用户注册 (邀请制: 需要有效邀请码) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, invitation_code } = body as {
      email?: string;
      password?: string;
      name?: string;
      invitation_code?: string;
    };

    // 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少 6 位' },
        { status: 400 }
      );
    }

    // 邀请码必填校验
    if (!invitation_code || !invitation_code.trim()) {
      return NextResponse.json(
        { error: '邀请码为必填项' },
        { status: 400 }
      );
    }

    // 使用服务端客户端验证邀请码 (绕过 RLS)
    const serverClient = createServerClient();
    const { data: inviteRecord, error: inviteQueryError } = await serverClient
      .from('invitation_codes')
      .select('id, code, used_by')
      .eq('code', invitation_code.trim())
      .is('used_by', null)
      .maybeSingle();

    if (inviteQueryError) {
      return NextResponse.json(
        { error: '邀请码验证失败, 请稍后重试' },
        { status: 500 }
      );
    }

    if (!inviteRecord) {
      return NextResponse.json(
        { error: '无效或已使用的邀请码' },
        { status: 400 }
      );
    }

    // 邀请码验证通过, 调用 Supabase 注册
    const redirectTo = process.env.NEXT_PUBLIC_APP_URL || 'https://stock.lancy.site';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
          invitation_code: invitation_code.trim(),
        },
        emailRedirectTo: `${redirectTo}/dashboard`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // 注册成功后, 标记邀请码为已使用
    if (data.user) {
      const userId = data.user.id;

      // 更新邀请码: 设置 used_by 和 used_at
      await serverClient
        .from('invitation_codes')
        .update({
          used_by: userId,
          used_at: new Date().toISOString(),
        })
        .eq('id', inviteRecord.id);

      // 显式确保 profiles 表的 plan 设为 'pro' (数据库默认已是 pro, 这里做双重保障)
      await serverClient
        .from('profiles')
        .update({ plan: 'pro' })
        .eq('id', userId);
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: '注册成功',
    });
  } catch {
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
