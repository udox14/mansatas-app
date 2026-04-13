import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { sendPushNotification } from '@/lib/web-push'
import { nowWIB } from '@/lib/time'

/**
 * Master Cron Dispatcher — dipanggil setiap menit oleh Cloudflare Cron Trigger.
 * Cek tabel jadwal_notifikasi, lalu kirim yang jamnya sesuai jam sekarang (WIB).
 * 
 * GET /api/cron/reminder-jadwal
 * Auth: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('Authorization')
  const isCron = req.headers.get('cf-cron') !== null // Cloudflare internal header
  if (!isCron && authHeader !== `Bearer ${process.env.CRON_SECRET || 'mansatas-cron'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = await getDB()
    const now = nowWIB()

    // Jam & menit sekarang WIB
    const jammenit = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
    const hariIni = now.getUTCDay() === 0 ? 7 : now.getUTCDay() // 1=Sen … 7=Min

    // Ambil semua jadwal aktif yang jamnya = sekarang
    const { results: jadwals } = await db.prepare(`
      SELECT * FROM jadwal_notifikasi
      WHERE is_active = 1 AND jam = ?
    `).bind(jammenit).all<any>()

    if (!jadwals || jadwals.length === 0) {
      return NextResponse.json({ message: `Tidak ada jadwal untuk jam ${jammenit}` })
    }

    const log: any[] = []

    for (const jadwal of jadwals) {
      // Cek hari aktif
      let hariAktif: number[] = [1, 2, 3, 4, 5, 6]
      try { hariAktif = JSON.parse(jadwal.hari_aktif || '[1,2,3,4,5,6]') } catch {}
      if (!hariAktif.includes(hariIni)) {
        log.push({ jadwal: jadwal.nama, skipped: 'hari tidak aktif' })
        continue
      }

      // Tentukan target push
      let target: any = {}
      const targetType = jadwal.target_type || 'all'

      if (targetType === 'all') {
        target.all = true
      } else if (targetType === 'role') {
        target.role = jadwal.target_role
      } else if (targetType === 'guru') {
        // Khusus: kirim ke guru yang punya jadwal mengajar hari ini
        const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
        if (!ta) { log.push({ jadwal: jadwal.nama, skipped: 'tidak ada tahun ajaran aktif' }); continue }
        const { results: guruRows } = await db.prepare(`
          SELECT DISTINCT pm.guru_id FROM jadwal_mengajar jm
          JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
          WHERE jm.hari = ? AND jm.tahun_ajaran_id = ?
        `).bind(hariIni, ta.id).all<any>()
        const guruIds = (guruRows || []).map((r: any) => r.guru_id)
        if (guruIds.length === 0) { log.push({ jadwal: jadwal.nama, skipped: 'tidak ada guru mengajar hari ini' }); continue }
        target.userIds = guruIds
      } else if (targetType === 'custom') {
        let ids: string[] = []
        try { ids = JSON.parse(jadwal.target_user_ids || '[]') } catch {}
        if (ids.length === 0) { log.push({ jadwal: jadwal.nama, skipped: 'target_user_ids kosong' }); continue }
        target.userIds = ids
      }

      const result = await sendPushNotification(
        { title: jadwal.judul, body: jadwal.isi, url: jadwal.url || '/dashboard' },
        target
      )

      log.push({
        jadwal: jadwal.nama,
        jam: jadwal.jam,
        targetType,
        sent: result.sent || 0,
        success: result.success,
      })
    }

    return NextResponse.json({
      success: true,
      waktu: now.toISOString(),
      jammenit,
      hariIni,
      processed: log.length,
      log,
    })

  } catch (error: any) {
    console.error('Cron Dispatcher Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
