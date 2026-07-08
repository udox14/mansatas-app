import { getSession, getParentSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { NextRequest, NextResponse } from 'next/server'

// Simpan FCM device token. Deteksi sesi: staff (user_id) atau orang tua (siswa_id).
export async function POST(req: NextRequest) {
  try {
    const [staff, parent] = await Promise.all([getSession(), getParentSession()])

    let ownerType: 'staff' | 'parent'
    let userId: string | null = null
    let siswaId: string | null = null

    if (staff?.user) {
      ownerType = 'staff'
      userId = staff.user.id
    } else if (parent?.user) {
      ownerType = 'parent'
      // ParentAuthUser dikunci ke siswa_id
      siswaId = (parent.user as any).siswa_id || (parent.user as any).siswaId || (parent.user as any).id
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token, platform } = await req.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || ''
    const db = await getDB()

    // UPSERT by token (token bisa pindah akun/perangkat)
    await db
      .prepare(
        `INSERT INTO fcm_tokens (token, owner_type, user_id, siswa_id, platform, user_agent, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(token) DO UPDATE SET
           owner_type = excluded.owner_type,
           user_id    = excluded.user_id,
           siswa_id   = excluded.siswa_id,
           platform   = excluded.platform,
           user_agent = excluded.user_agent,
           updated_at = datetime('now')`
      )
      .bind(token, ownerType, userId, siswaId, platform || null, userAgent)
      .run()

    return NextResponse.json({ success: true, message: 'FCM token saved' })
  } catch (error: any) {
    console.error('FCM register error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 400 })
    const db = await getDB()
    await db.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(token).run()
    return NextResponse.json({ success: true, message: 'FCM token removed' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
