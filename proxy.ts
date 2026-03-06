// TIMPA SELURUH ISI FILE INI
// Lokasi: proxy.ts (sejajar dengan package.json di root folder)

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Memanggil getUser() akan me-refresh token jika sudah kedaluwarsa
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // PERBAIKAN LOGIKA RUTE DI SINI
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')

  // 1. Proteksi Halaman Dashboard:
  // Jika user belum login TAPI mencoba akses /dashboard, tendang ke /login
  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Proteksi Halaman Login:
  // Jika user SUDAH login dan mencoba buka /login, arahkan ke /dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Jika mencoba akses '/' (Landing Page) atau route publik lainnya, biarkan saja lolos!
  return supabaseResponse
}

// Konfigurasi matcher tetap sama
export const config = {
  matcher: [
    /*
     * Match semua request paths kecuali untuk:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, dll (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}