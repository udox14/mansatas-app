// BUAT FILE BARU
// Lokasi: utils/supabase/server.ts (Buat folder utils/supabase terlebih dahulu di root)
// Fungsi: Digunakan secara eksklusif di Server Components, Server Actions, dan Route Handlers.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Error ini wajar terjadi jika dipanggil dari Server Component.
            // Server Component tidak bisa set cookies, hanya Server Actions/Route Handlers.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Sama seperti set, abaikan jika dipanggil dari Server Component
          }
        },
      },
    }
  )
}