// Lokasi: app/(auth)/login/page.tsx
// Middleware dihapus karena tidak didukung Next.js 16 + OpenNext Cloudflare.
// Redirect user yang sudah login ditangani di sini (server component).

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LoginClient from './login-client'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Jika sudah login, langsung redirect ke dashboard
  if (user) {
    redirect('/dashboard')
  }

  return <LoginClient />
}