'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'
import { sendPushNotification } from '@/lib/web-push'
import { nowWIB } from '@/lib/time'

// ============================================================
// HELPER — Cek role admin
// ============================================================
async function assertAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null }
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))) {
    return { error: 'Anda tidak memiliki akses.', user: null }
  }
  return { error: null, user, db }
}

// ============================================================
// 1. BUAT UNDANGAN RAPAT
// ============================================================
export async function buatUndanganRapat(
  prevState: any,
  formData: FormData
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()

  const roles = await getUserRoles(db, user.id)
  if (!roles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))) {
    return { error: 'Anda tidak memiliki akses untuk membuat undangan rapat.' }
  }

  const agenda    = formData.get('agenda') as string
  const tanggal   = formData.get('tanggal') as string
  const waktu     = formData.get('waktu') as string
  const tempat    = formData.get('tempat') as string
  const catatan   = formData.get('catatan') as string
  // targetUserIds: JSON array of user IDs (dari checkbox yang terpilih)
  const targetUserIdsRaw = formData.get('targetUserIds') as string

  if (!agenda || !tanggal || !waktu || !tempat) {
    return { error: 'Semua kolom wajib (Agenda, Tanggal, Waktu, Tempat) harus diisi.' }
  }

  let targetUserIds: string[] = []
  try {
    targetUserIds = JSON.parse(targetUserIdsRaw || '[]')
  } catch {
    return { error: 'Format target pengguna tidak valid.' }
  }

  if (targetUserIds.length === 0) {
    return { error: 'Pilih minimal 1 peserta undangan.' }
  }

  // Pastikan user yang dipilih valid dan bukan diri sendiri
  const placeholders = targetUserIds.map(() => '?').join(',')
  const validUsers = await db.prepare(
    `SELECT id FROM "user" WHERE id IN (${placeholders}) AND banned = 0 AND id != ?`
  ).bind(...targetUserIds, user.id).all<any>()
  const validIds = (validUsers.results || []).map((u: any) => u.id)

  if (validIds.length === 0) {
    return { error: 'Tidak ada pengguna valid di target yang dipilih.' }
  }

  // Insert rapat
  const rapatInsert = await dbInsert<any>(db, 'undangan_rapat', {
    agenda, tanggal, waktu, tempat,
    catatan: catatan || null,
    pengundang_id: user.id
  })
  if (rapatInsert.error) return { error: rapatInsert.error }
  const rapatId = rapatInsert.data.id

  // Insert peserta (batch)
  const stmts = validIds.map((uid: string) =>
    db.prepare('INSERT INTO peserta_rapat (id, rapat_id, user_id) VALUES (lower(hex(randomblob(16))), ?, ?)')
      .bind(rapatId, uid)
  )
  try {
    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
  } catch (e: any) {
    return { error: 'Gagal menambahkan peserta: ' + e.message }
  }

  // Kirim Push Notification (user IDs spesifik)
  try {
    await sendPushNotification(
      {
        title: 'Undangan Rapat Baru',
        body: `Agenda: ${agenda} pada ${tanggal} jam ${waktu} di ${tempat}. Harap konfirmasi kehadiran Anda.`,
        url: '/dashboard/rapat'
      },
      { userIds: validIds }
    )
  } catch (e) {
    console.error('Gagal mengirim push notif rapat', e)
  }

  revalidatePath('/dashboard/rapat')
  return { success: `Undangan rapat berhasil dibuat dan dikirim ke ${validIds.length} pengguna.` }
}

// ============================================================
// 2. KONFIRMASI KEHADIRAN (peserta)
// ============================================================
export async function konfirmasiKehadiran(
  pesertaId: string,
  status: 'HADIR' | 'TIDAK_HADIR',
  alasan: string = ''
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const cek = await db.prepare('SELECT id FROM peserta_rapat WHERE id = ? AND user_id = ?').bind(pesertaId, user.id).first()
  if (!cek) return { error: 'Data peserta tidak valid atau bukan milik Anda.' }

  await dbUpdate(db, 'peserta_rapat', {
    status_kehadiran: status,
    alasan_tidak_hadir: alasan || null,
    waktu_respon: nowWIB().toISOString()
  }, { id: pesertaId })

  revalidatePath('/dashboard/rapat')
  return { success: 'Konfirmasi kehadiran berhasil disimpan.' }
}

// ============================================================
// 3. GET PESERTA RAPAT (admin — untuk "Lihat Peserta")
// ============================================================
export async function getPesertaRapat(rapatId: string) {
  const { error, user } = await assertAdmin()
  if (error || !user) return { error: error || 'Unauthorized', data: [] }

  const db = await getDB()
  // Verify ownership
  const rapat = await db.prepare(
    'SELECT id FROM undangan_rapat WHERE id = ? AND pengundang_id = ?'
  ).bind(rapatId, user.id).first()
  if (!rapat) return { error: 'Rapat tidak ditemukan atau bukan milik Anda.', data: [] }

  const result = await db.prepare(`
    SELECT
      pr.id as peserta_id,
      pr.status_kehadiran,
      pr.alasan_tidak_hadir,
      pr.waktu_respon,
      u.id as user_id,
      u.nama_lengkap,
      u.role
    FROM peserta_rapat pr
    JOIN "user" u ON pr.user_id = u.id
    WHERE pr.rapat_id = ?
    ORDER BY u.nama_lengkap ASC
  `).bind(rapatId).all<any>()

  return { error: null, data: result.results || [] }
}

// ============================================================
// 4. KIRIM ULANG UNDANGAN (push notif only, untuk pending)
// ============================================================
export async function kirimUlangUndangan(
  rapatId: string,
  pesertaId: string,
  namaGuru: string
) {
  const { error, user } = await assertAdmin()
  if (error || !user) return { error: error || 'Unauthorized' }

  const db = await getDB()

  // Verifikasi: peserta masih BELUM_RESPOND dan rapat milik pengundang
  const peserta = await db.prepare(`
    SELECT pr.id, u.id as user_id, ur.agenda, ur.tanggal, ur.waktu, ur.tempat
    FROM peserta_rapat pr
    JOIN undangan_rapat ur ON pr.rapat_id = ur.id
    JOIN "user" u ON pr.user_id = u.id
    WHERE pr.id = ? AND ur.id = ? AND ur.pengundang_id = ? AND pr.status_kehadiran = 'BELUM_RESPOND'
  `).bind(pesertaId, rapatId, user.id).first<any>()

  if (!peserta) return { error: 'Peserta tidak ditemukan, bukan pending, atau rapat bukan milik Anda.' }

  try {
    await sendPushNotification(
      {
        title: '🔔 Pengingat Undangan Rapat',
        body: `Agenda: ${peserta.agenda} pada ${peserta.tanggal} jam ${peserta.waktu}. Harap segera konfirmasi kehadiran Anda.`,
        url: '/dashboard/rapat'
      },
      { userIds: [peserta.user_id] }
    )
  } catch (e) {
    console.error('Gagal kirim ulang notif', e)
    return { error: 'Gagal mengirim notifikasi.' }
  }

  return { success: `Undangan telah dikirim ulang ke ${namaGuru}.` }
}

// ============================================================
// 5. HAPUS UNDANGAN EXPIRED (hanya jika tanggal sudah lewat)
// ============================================================
export async function hapusUndanganExpired(rapatId: string) {
  const { error, user } = await assertAdmin()
  if (error || !user) return { error: error || 'Unauthorized' }

  const db = await getDB()

  // Ambil rapat — harus milik pengundang dan sudah lewat hari ini
  const todayWIB = nowWIB().toISOString().split('T')[0]
  const rapat = await db.prepare(`
    SELECT id, tanggal FROM undangan_rapat
    WHERE id = ? AND pengundang_id = ? AND tanggal < ?
  `).bind(rapatId, user.id, todayWIB).first<any>()

  if (!rapat) return { error: 'Rapat tidak ditemukan, bukan milik Anda, atau belum expired.' }

  // Hapus peserta dulu (FK), lalu rapat
  await db.prepare('DELETE FROM peserta_rapat WHERE rapat_id = ?').bind(rapatId).run()
  await db.prepare('DELETE FROM undangan_rapat WHERE id = ?').bind(rapatId).run()

  revalidatePath('/dashboard/rapat')
  return { success: 'Undangan expired berhasil dihapus.' }
}

// ============================================================
// 6. GET SEMUA USER (untuk checkbox peserta di form)
// ============================================================
export async function getAllUsersForCheckbox() {
  const user = await getCurrentUser()
  if (!user) return []
  const db = await getDB()

  const result = await db.prepare(`
    SELECT u.id, u.nama_lengkap, u.role,
      GROUP_CONCAT(ur.role, ',') as extra_roles
    FROM "user" u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    WHERE u.banned = 0 AND u.id != ?
    GROUP BY u.id
    ORDER BY u.nama_lengkap ASC
  `).bind(user.id).all<any>()

  return (result.results || []).map((u: any) => ({
    id: u.id,
    nama_lengkap: u.nama_lengkap,
    role: u.role || '',
    all_roles: [u.role, ...(u.extra_roles ? u.extra_roles.split(',') : [])].filter(Boolean)
  }))
}
