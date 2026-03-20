import { createClient } from '@supabase/supabase-js'

// 空 storage 实现（传给 Supabase auth config，避免服务端访问 localStorage）
const noopStorage = {
  getItem: (_key: string): string | null => null,
  setItem: (_key: string, _value: string): void => {},
  removeItem: (_key: string): void => {},
}

const authConfig = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  storage: noopStorage,
}

// 服务端专用客户端（service role，完全写权限）
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: authConfig }
  )
}

// 公开查询客户端（anon key，只读）
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: authConfig }
  )
}
