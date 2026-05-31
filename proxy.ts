import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const LAST_REFRESH_COOKIE = 'sb-session-refreshed-at'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Only refresh the session if enough time has passed since the last refresh
  const lastRefresh = Number(request.cookies.get(LAST_REFRESH_COOKIE)?.value || 0)
  const now = Date.now()

  if (now - lastRefresh > SESSION_REFRESH_INTERVAL_MS) {
    await supabase.auth.getUser()
    supabaseResponse.cookies.set(LAST_REFRESH_COOKIE, String(now), {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
    })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
