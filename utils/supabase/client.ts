// BUAT FILE BARU
// Lokasi: utils/supabase/client.ts
// Fungsi: Digunakan secara eksklusif di Client Components (file dengan "use client").

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}