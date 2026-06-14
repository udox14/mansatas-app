import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db'
import { deleteFromR2 } from '@/utils/r2'
import { nowWIB } from '@/lib/time'

/**
 * Purge siswa terhapus (soft delete) yang sudah lewat masa retensi.
 * Hard delete: hapus baris fin_* (FK tanpa CASCADE) + foto R2, lalu DELETE siswa.
 * Tabel anak lain (akademik/tahfidz/parent/sp/absensi) auto via ON DELETE CASCADE.
 *
 * Dijalankan cron tiap menit, tapi hanya eksekusi sekali sehari (jam 02:xx WIB).
 *
 * GET /api/cron/purge-siswa
 * Auth: Bearer {CRON_SECRET}
 */
const RETENTION_DAYS = 90

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Gate: hanya jalan jam 02 WIB (hindari purge tiap menit)
  const now = nowWIB()
  if (now.getUTCHours() !== 2) {
    return NextResponse.json({ skipped: 'bukan jam purge (02:xx WIB)' })
  }

  try {
    const db = await getDB()

    // Siswa yang soft-deleted lewat retensi
    const { results: targets } = await db.prepare(`
      SELECT id, foto_url FROM siswa
      WHERE status = 'dihapus'
        AND deleted_at IS NOT NULL
        AND deleted_at < datetime('now', '-${RETENTION_DAYS} days')
    `).all<{ id: string; foto_url: string | null }>()

    if (!targets || targets.length === 0) {
      return NextResponse.json({ message: 'Tidak ada siswa untuk dipurge.' })
    }

    let purged = 0
    const errors: any[] = []

    for (const siswa of targets) {
      try {
        // fin_* FK ke siswa TANPA ON DELETE CASCADE → hapus manual, urut dependency
        // (anak sebelum induk), lalu DELETE siswa (cascade ke tabel anak lain).
        await db.batch([
          db.prepare('DELETE FROM fin_dspt_audit_log WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_payment_submissions WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_transaksi WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_diskon WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_janji_bayar WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_spp_tagihan WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_spp_mulai WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_spp_saldo_awal WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM fin_dspt WHERE siswa_id = ?').bind(siswa.id),
          db.prepare('DELETE FROM siswa WHERE id = ?').bind(siswa.id),
        ])

        if (siswa.foto_url) {
          try { await deleteFromR2(siswa.foto_url) } catch {}
        }
        purged++
      } catch (e: any) {
        errors.push({ id: siswa.id, error: e?.message || String(e) })
      }
    }

    return NextResponse.json({
      success: true,
      retention_days: RETENTION_DAYS,
      candidates: targets.length,
      purged,
      errors,
    })
  } catch (error: any) {
    console.error('Purge Siswa Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
