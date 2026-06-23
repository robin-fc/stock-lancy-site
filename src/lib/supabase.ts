import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 浏览器端 Supabase 客户端 (使用 anon key, 受 RLS 保护) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** 服务端 Supabase 客户端 (使用 service_role key, 绕过 RLS) */
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

/** 从请求中获取当前用户 */
export async function getCurrentUser(req?: Request) {
  let accessToken: string | null = null;

  if (req) {
    // 从 Authorization header 获取
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7);
    }
  } else if (typeof window !== 'undefined') {
    // 浏览器端从 localStorage 获取
    const stored = localStorage.getItem('sb-access-token');
    if (stored) accessToken = stored;
  }

  if (!accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return data.user;
}

/** 获取用户 profile */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}
