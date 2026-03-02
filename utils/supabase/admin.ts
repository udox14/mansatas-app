// BUAT FILE BARU
// Lokasi: utils/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

// Fungsi ini HANYA boleh dipanggil dari Server Actions atau Route Handlers.
// JANGAN PERNAH panggil ini dari Client Component!
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}