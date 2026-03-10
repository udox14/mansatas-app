// Lokasi: app/dashboard/actions.ts
'use server'

import { cookies } from 'next/headers'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'

export async function logout() {
  const cookieStore = await cookies()
  
  // Coba dua nama cookie yang mungkin dipakai Better Auth
  const sessionCookie = 
    cookieStore.get('better-auth.session_token') ||
    cookieStore.get('__Secure-better-auth.session_token')
  
  if (sessionCookie?.value) {
    try {
      const db = await getDB()
      // Token format Better Auth: "token.hash" — ambil bagian pertama
      const token = sessionCookie.value.split('.')[0]
      await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
    } catch (_) {
      // Tetap lanjut logout meski hapus session gagal
    }
  }

  // Hapus semua kemungkinan nama cookie session
  cookieStore.delete('better-auth.session_token')
  cookieStore.delete('__Secure-better-auth.session_token')
  
  redirect('/login')
}