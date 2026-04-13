// Lokasi: app/dashboard/presensi/actions.ts
'use server'

import { getDB, dbSelectOne } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { todayWIB, nowWIB, currentTimeWIB } from '@/lib/time'
import { uploadFotoPresensi } from '@/utils/r2'
import { getUserRoles } from '@/lib/features'


// ============================================================
// GET PENGATURAN PRESENSI
// ============================================================
export async function getPengaturanPresensi() {
  const db = await getDB()
  const row = await db.prepare('SELECT * FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>()
  return row || { jam_masuk: '07:00', jam_pulang: '14:00', batas_telat_menit: 15, batas_pulang_cepat_menit: 15, hari_kerja: '[1,2,3,4,5,6]' }
}

// ============================================================
// GET DAFTAR PEGAWAI STRUKTURAL (yang wajib presensi)
// ============================================================
export async function getPegawaiStruktural() {
  const db = await getDB()
  const result = await db.prepare(`
    SELECT u.id, u.nama_lengkap, u.email, u.domisili_pegawai,
           j.nama as jabatan_nama
    FROM "user" u
    INNER JOIN master_jabatan_struktural j ON u.jabatan_struktural_id = j.id
    ORDER BY j.urutan ASC, u.nama_lengkap ASC
  `).all<any>()
  return result.results || []
}

// ============================================================
// GET PRESENSI HARI INI
// ============================================================
export async function getPresensiHariIni() {
  const db = await getDB()
  const today = todayWIB()
  const result = await db.prepare(`
    SELECT p.*, u.nama_lengkap, u.domisili_pegawai, j.nama as jabatan_nama
    FROM presensi_pegawai p
    JOIN "user" u ON p.user_id = u.id
    LEFT JOIN master_jabatan_struktural j ON u.jabatan_struktural_id = j.id
    WHERE p.tanggal = ?
    ORDER BY u.nama_lengkap ASC
  `).bind(today).all<any>()
  return result.results || []
}

// ============================================================
// CATAT PRESENSI MASUK
// ============================================================
export async function catatPresensiMasuk(userId: string, diinputOleh: string, catatan?: string) {
  const db = await getDB()
  const today = todayWIB()
  const { hours, minutes, hhmm: jamMasuk } = currentTimeWIB()

  // Check existing
  const existing = await db.prepare('SELECT id, jam_masuk FROM presensi_pegawai WHERE user_id = ? AND tanggal = ?')
    .bind(userId, today).first<any>()
  if (existing?.jam_masuk) return { error: 'Presensi masuk sudah tercatat hari ini.' }

  // Get setting for telat check
  const setting = await db.prepare('SELECT jam_masuk, batas_telat_menit FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>()
  const batasJam = setting?.jam_masuk || '07:00'
  const batasTelat = setting?.batas_telat_menit || 15

  // Calculate telat
  const [bH, bM] = batasJam.split(':').map(Number)
  const batasMinutes = bH * 60 + bM + batasTelat
  const nowMinutes = hours * 60 + minutes
  const isTelat = nowMinutes > batasMinutes ? 1 : 0

  if (existing) {
    // Update existing record (might have been set to sakit/izin first, then came in)
    await db.prepare(`
      UPDATE presensi_pegawai SET jam_masuk = ?, status = 'hadir', is_telat = ?, catatan = ?, diinput_oleh = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(jamMasuk, isTelat, catatan || null, diinputOleh, existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO presensi_pegawai (id, user_id, tanggal, jam_masuk, status, is_telat, catatan, diinput_oleh)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'hadir', ?, ?, ?)
    `).bind(userId, today, jamMasuk, isTelat, catatan || null, diinputOleh).run()
  }

  revalidatePath('/dashboard/presensi')
  return { success: true, jam: jamMasuk, telat: isTelat === 1 }
}

// ============================================================
// CATAT PRESENSI PULANG
// ============================================================
export async function catatPresensiPulang(userId: string, diinputOleh: string) {
  const db = await getDB()
  const today = todayWIB()
  const { hours, minutes, hhmm: jamPulang } = currentTimeWIB()

  const existing = await db.prepare('SELECT id, jam_pulang FROM presensi_pegawai WHERE user_id = ? AND tanggal = ?')
    .bind(userId, today).first<any>()
  if (!existing) return { error: 'Belum ada presensi masuk hari ini.' }
  if (existing.jam_pulang) return { error: 'Presensi pulang sudah tercatat.' }

  // Check pulang cepat
  const setting = await db.prepare('SELECT jam_pulang, batas_pulang_cepat_menit FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>()
  const batasJamPulang = setting?.jam_pulang || '14:00'
  const batasCepat = setting?.batas_pulang_cepat_menit || 15

  const [pH, pM] = batasJamPulang.split(':').map(Number)
  const batasPulangMinutes = pH * 60 + pM - batasCepat
  const nowMinutes = hours * 60 + minutes
  const isPulangCepat = nowMinutes < batasPulangMinutes ? 1 : 0

  await db.prepare(`
    UPDATE presensi_pegawai SET jam_pulang = ?, is_pulang_cepat = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(jamPulang, isPulangCepat, existing.id).run()

  revalidatePath('/dashboard/presensi')
  return { success: true, jam: jamPulang, pulangCepat: isPulangCepat === 1 }
}

// ============================================================
// EDIT WAKTU PRESENSI (resepsionis adjust)
// ============================================================
export async function editWaktuPresensi(presensiId: string, jamMasuk: string | null, jamPulang: string | null, diinputOleh: string) {
  const db = await getDB()
  
  // SECURE: Hanya super admin yang bisa edit waktu
  const roles = await getUserRoles(db, diinputOleh)
  if (!roles.includes('super_admin')) return { error: 'Terbatas: Hanya Super Admin yang dapat menyesuaikan waktu presensi.' }

  const existing = await db.prepare('SELECT * FROM presensi_pegawai WHERE id = ?').bind(presensiId).first<any>()
  if (!existing) return { error: 'Data presensi tidak ditemukan.' }

  const setting = await db.prepare('SELECT * FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>()

  const updates: Record<string, any> = { updated_at: nowWIB().toISOString(), diinput_oleh: diinputOleh }

  if (jamMasuk !== null) {
    updates.jam_masuk = jamMasuk
    // Recalculate telat
    const [bH, bM] = (setting?.jam_masuk || '07:00').split(':').map(Number)
    const [mH, mM] = jamMasuk.split(':').map(Number)
    const batas = bH * 60 + bM + (setting?.batas_telat_menit || 15)
    updates.is_telat = (mH * 60 + mM) > batas ? 1 : 0
  }

  if (jamPulang !== null) {
    updates.jam_pulang = jamPulang
    // Recalculate pulang cepat
    const [pH, pM] = (setting?.jam_pulang || '14:00').split(':').map(Number)
    const [jH, jM] = jamPulang.split(':').map(Number)
    const batas = pH * 60 + pM - (setting?.batas_pulang_cepat_menit || 15)
    updates.is_pulang_cepat = (jH * 60 + jM) < batas ? 1 : 0
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  const vals = Object.values(updates)
  await db.prepare(`UPDATE presensi_pegawai SET ${sets} WHERE id = ?`).bind(...vals, presensiId).run()

  revalidatePath('/dashboard/presensi')
  revalidatePath('/dashboard/monitoring-presensi')
  return { success: 'Waktu presensi berhasil disesuaikan.' }
}

// ============================================================
// SET STATUS (sakit/izin/alfa/dinas_luar) — tanpa jam
// ============================================================
export async function setStatusPresensi(userId: string, status: string, diinputOleh: string, catatan?: string): Promise<{ success?: boolean; error?: string }> {
  const db = await getDB()

  // SECURE: Hanya super admin yang bisa set status manual
  const roles = await getUserRoles(db, diinputOleh)
  if (!roles.includes('super_admin')) return { error: 'Terbatas: Hanya Super Admin yang dapat menetapkan status presensi secara manual.' }

  const today = todayWIB()

  try {
    const existing = await db.prepare('SELECT id FROM presensi_pegawai WHERE user_id = ? AND tanggal = ?')
      .bind(userId, today).first<any>()

    if (existing) {
      await db.prepare(`
      UPDATE presensi_pegawai SET status = ?, jam_masuk = NULL, jam_pulang = NULL, is_telat = 0, is_pulang_cepat = 0, catatan = ?, diinput_oleh = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(status, catatan || null, diinputOleh, existing.id).run()
    } else {
      await db.prepare(`
      INSERT INTO presensi_pegawai (id, user_id, tanggal, status, catatan, diinput_oleh)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)
    `).bind(userId, today, status, catatan || null, diinputOleh).run()
    }

    revalidatePath('/dashboard/presensi')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Gagal menyimpan status presensi.' }
  }
}

// ============================================================
// SIMPAN FOTO PRESENSI KE R2
// ============================================================
export async function simpanFotoPresensi(formData: FormData) {
  const file = formData.get('file') as File
  const userId = formData.get('userId') as string
  const action = formData.get('action') as string
  const tanggal = todayWIB()

  if (!file || !userId || !action) return { error: 'Data tidak lengkap.' }

  try {
    const res = await uploadFotoPresensi(file, userId, action, tanggal)
    return res
  } catch (e: any) {
    return { error: e.message || 'Gagal mengunggah foto ke R2.' }
  }
}

