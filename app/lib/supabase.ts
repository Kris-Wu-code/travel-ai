import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupaClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** Typed browser client — for 'use client' components */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** Typed admin client — for API routes using service role key */
export function createAdminClient() {
  return createSupaClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Singleton browser client */
export const supabase = createClient()

