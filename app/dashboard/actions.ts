// app/dashboard/actions.ts
'use server'

import { cookies } from 'next/headers'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { COOKIE_NAME } from '@/utils/auth'

export async function logout() {
  const cookieStore = await cookies()
  
  // Support both new and old cookie names
  const sessionCookie = 
    cookieStore.get(COOKIE_NAME) ||
    cookieStore.get('better-auth.session_token') ||
    cookieStore.get('__Secure-better-auth.session_token')
  
  if (sessionCookie?.value) {
    try {
      const db = await getDB()
      const token = sessionCookie.value.split('.')[0]
      await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
    } catch (_) {}
  }

  // Hapus semua cookie session
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete('better-auth.session_token')
  cookieStore.delete('__Secure-better-auth.session_token')
  
  redirect('/login')
}
