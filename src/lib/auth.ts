import { supabase } from './supabase';
import type { Profile } from '@/types';

/** 注册新用户 (带邀请码) */
export async function signUp(email: string, password: string, name?: string, invitationCode?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: name || '', invitation_code: invitationCode || '' },
    },
  });
  return { data, error };
}

/** 登录 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/** 登出 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** 获取当前 session */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** 获取当前用户 profile */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * 检查用户是否为会员
 * 邀请制下所有注册用户均为会员, 直接返回 true
 */
export function isProUser(profile: Profile | null): boolean {
  if (!profile) return false;
  return true;
}

/**
 * 检查用户是否能查看选股
 * 邀请制下所有用户无限制
 */
export function canViewPick(profile: Profile | null): { canView: boolean; remaining: number } {
  if (!profile) return { canView: false, remaining: 0 };
  return { canView: true, remaining: Infinity };
}

/** 增加用户今日查看次数 (邀请制下无需限制, 保留接口兼容) */
export async function incrementDailyViews(_userId: string) {
  // 邀请制下不限制查看次数, 空实现
}

/** 服务端: 获取用户 profile (使用 service role) */
export async function getProfileServer(userId: string): Promise<Profile | null> {
  const { createServerClient } = await import('./supabase');
  const serverClient = createServerClient();

  const { data, error } = await serverClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}
