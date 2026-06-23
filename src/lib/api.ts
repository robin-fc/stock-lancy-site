import { supabase } from './supabase';

/** 获取当前用户的 access_token */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** 构建带认证信息的请求 headers */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 带认证的 fetch 封装
 * 自动从 supabase session 获取 access_token 并放入 Authorization header
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  const mergedHeaders: Record<string, string> = { ...headers };
  if (options.headers) {
    const optsHeaders = options.headers as Record<string, string>;
    Object.assign(mergedHeaders, optsHeaders);
  }
  return fetch(url, { ...options, headers: mergedHeaders });
}

/** 统一解析 API 错误响应 */
export async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || `请求失败 (${res.status})`;
  } catch {
    return `请求失败 (${res.status})`;
  }
}
