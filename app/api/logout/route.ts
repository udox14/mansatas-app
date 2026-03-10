// Lokasi: app/api/logout/route.ts
import { NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Hapus semua cookie yang ada (termasuk session Better Auth apapun namanya)
  for (const cookie of allCookies) {
    cookieStore.delete(cookie.name)
  }

  // Hapus session dari DB berdasarkan token yang ketemu
  const sessionCookie = allCookies.find(c =>
    c.name.includes('session_token') || c.name.includes('session')
  )
  if (sessionCookie?.value) {
    try {
      const db = await getDB()
      const token = sessionCookie.value.split('.')[0]
      await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
    } catch (_) {}
  }

  // Hard redirect ke login
  return NextResponse.redirect(new URL('/login', 'https://mansatas-app.drudox.workers.dev'), {
    status: 302,
  })
}