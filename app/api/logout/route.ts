// app/api/logout/route.ts
import { NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { cookies } from 'next/headers'
import { COOKIE_NAME } from '@/utils/auth'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Cari session cookie (new + legacy names)
  const sessionCookie = allCookies.find(c =>
    c.name === COOKIE_NAME ||
    c.name.includes('session_token') || 
    c.name.includes('session')
  )
  if (sessionCookie?.value) {
    try {
      const db = await getDB()
      const token = sessionCookie.value.split('.')[0]
      await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
    } catch (_) {}
  }

  // Hapus semua cookie
  for (const cookie of allCookies) {
    cookieStore.delete(cookie.name)
  }

  return NextResponse.redirect(new URL('/login', 'https://mansatas-app.drudox.workers.dev'), {
    status: 302,
  })
}
