// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import type { SlotJam, PolaJam } from './types'
import { setSystemSetting, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { ensureRiwayatKelasSnapshotColumns, formatKelasSnapshot } from '@/lib/riwayat-kelas'

// ============================================================
// TAMBAH TAHUN AJARAN
// ============================================================
export async function tambahTahunAjaran(prevState: any, formData: FormData) {
  const db = await getDB()

  const rawJurusan = formData.get('daftar_jurusan') as string
  let daftar_jurusan = ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
  if (rawJurusan) {
    try { daftar_jurusan = JSON.parse(rawJurusan) } catch {}
  }
  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')

  const rawJam = formData.get('jam_pelajaran') as string
  let jam_pelajaran: PolaJam[] = []
  if (rawJam) {
    try { jam_pelajaran = JSON.parse(rawJam) } catch {}
  }

  const payload = {
    nama: formData.get('nama') as string,
    semester: parseInt(formData.get('semester') as string),
    is_active: 0,
    daftar_jurusan: JSON.stringify(daftar_jurusan),
    jam_pelajaran: JSON.stringify(jam_pelajaran),
  }

  const result = await dbInsert(db, 'tahun_ajaran', payload)
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Tahun Ajaran berhasil ditambahkan' }
}

// ============================================================
// SET AKTIF TAHUN AJARAN
// ============================================================
export async function setAktifTahunAjaran(id: string) {
  const db = await getDB()
  try {
    await ensureRiwayatKelasSnapshotColumns(db)

    const currentActive = await db
      .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; nama: string; semester: number }>()

    const nextActive = await db
      .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ id: string; nama: string; semester: number }>()

    if (!nextActive) return { error: 'Tahun ajaran tujuan tidak ditemukan.' }

    const chunkSize = 100
    if (currentActive?.id) {
      const currentRows = (await db
        .prepare(
          `SELECT s.id, s.kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
           FROM siswa s
           JOIN kelas k ON k.id = s.kelas_id
           WHERE s.status = 'aktif'
             AND s.kelas_id IS NOT NULL`
        )
        .all<{ id: string; kelas_id: string; tingkat: number; nomor_kelas: string; kelompok: string }>()).results ?? []

      for (let i = 0; i < currentRows.length; i += chunkSize) {
        const chunk = currentRows.slice(i, i + chunkSize)
        await db.batch(chunk.map(row =>
          db
            .prepare(
              `INSERT INTO riwayat_kelas (siswa_id, kelas_id, tahun_ajaran_id, kelas_tingkat, kelas_nomor, kelas_kelompok, kelas_nama)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(siswa_id, tahun_ajaran_id)
               DO UPDATE SET
                 kelas_id = excluded.kelas_id,
                 kelas_tingkat = excluded.kelas_tingkat,
                 kelas_nomor = excluded.kelas_nomor,
                 kelas_kelompok = excluded.kelas_kelompok,
                 kelas_nama = excluded.kelas_nama`
            )
            .bind(row.id, row.kelas_id, currentActive.id, row.tingkat, row.nomor_kelas, row.kelompok, formatKelasSnapshot(row.tingkat, row.nomor_kelas, row.kelompok))
        ))
      }
    }

    const targetRows = (await db
      .prepare(
        `SELECT rk.siswa_id, rk.kelas_id
         FROM riwayat_kelas rk
         JOIN siswa s ON s.id = rk.siswa_id
         WHERE rk.tahun_ajaran_id = ?
           AND s.status = 'aktif'`
      )
      .bind(id)
      .all<{ siswa_id: string; kelas_id: string }>()).results ?? []

    for (let i = 0; i < targetRows.length; i += chunkSize) {
      const chunk = targetRows.slice(i, i + chunkSize)
      await db.batch(chunk.map(row =>
        db
          .prepare('UPDATE siswa SET kelas_id = ?, updated_at = ? WHERE id = ? AND status = ?')
          .bind(row.kelas_id, new Date().toISOString(), row.siswa_id, 'aktif')
      ))
    }

    await db.batch([
      db.prepare('UPDATE tahun_ajaran SET is_active = 0'),
      db.prepare('UPDATE tahun_ajaran SET is_active = 1 WHERE id = ?').bind(id),
    ])

    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/plotting')
    revalidatePath('/dashboard/siswa')
  } catch (e: any) {
    return { error: e.message }
  }
  revalidatePath('/', 'layout')
  return { success: 'Tahun Ajaran berhasil diaktifkan dan kelas aktif siswa disinkronkan dari riwayat.' }
}

// ============================================================
// HAPUS TAHUN AJARAN
// ============================================================
export async function hapusTahunAjaran(id: string, isActive: boolean) {
  if (isActive) {
    return { error: 'Tidak bisa menghapus Tahun Ajaran yang sedang aktif. Aktifkan tahun ajaran lain terlebih dahulu.' }
  }
  const db = await getDB()
  const result = await dbDelete(db, 'tahun_ajaran', { id })
  if (result.error) return { error: 'Gagal menghapus: ' + result.error }
  revalidatePath('/', 'layout')
  return { success: 'Tahun Ajaran berhasil dihapus.' }
}

// ============================================================
// SIMPAN DAFTAR JURUSAN
// ============================================================
export async function simpanDaftarJurusan(tahun_ajaran_id: string, daftar_jurusan: string[]) {
  const db = await getDB()
  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')
  const result = await dbUpdate(db, 'tahun_ajaran', { daftar_jurusan: JSON.stringify(daftar_jurusan) }, { id: tahun_ajaran_id })
  if (result.error) return { error: result.error }
  revalidatePath('/', 'layout')
  return { success: 'Daftar Master Jurusan berhasil diperbarui!' }
}

// ============================================================
// SIMPAN JAM PELAJARAN (pola per hari)
// ============================================================
export async function simpanJamPelajaran(tahun_ajaran_id: string, pola_jam: PolaJam[]) {
  try {
    if (!tahun_ajaran_id) return { error: 'ID tahun ajaran tidak valid.' }
    if (!pola_jam || !Array.isArray(pola_jam) || pola_jam.length === 0) {
      return { error: 'Minimal harus ada 1 pola jam.' }
    }

    // Sanitize ketat sebelum apapun
    const sanitized = pola_jam.map((p, idx) => ({
      id: String(p.id ?? `pola_${idx}`),
      nama: String(p.nama ?? `Pola ${idx + 1}`),
      hari: Array.isArray(p.hari) ? p.hari.map(Number).filter(h => h >= 1 && h <= 6) : [],
      slots: Array.isArray(p.slots) ? p.slots.map((s: any) => ({
        id: Number(s.id ?? 0),
        nama: String(s.nama ?? ''),
        mulai: String(s.mulai ?? ''),
        selesai: String(s.selesai ?? ''),
      })) : [],
    }))

    // Serialisasi manual — pastikan tidak ada circular/undefined
    const jsonStr = JSON.stringify(sanitized)

    const db = await getDB()
    await db.prepare(
      'UPDATE tahun_ajaran SET jam_pelajaran = ? WHERE id = ?'
    ).bind(jsonStr, tahun_ajaran_id).run()

    revalidatePath('/', 'layout')
    return { success: 'Jam pelajaran berhasil disimpan!' }
  } catch (e: any) {
    return { error: String(e?.message ?? e ?? 'Terjadi kesalahan tidak diketahui.') }
  }
}

// ============================================================
// GET JAM PELAJARAN (helper untuk modul lain)
// ============================================================
export async function getPolaJamByTA(tahun_ajaran_id: string): Promise<PolaJam[]> {
  const db = await getDB()
  const row = await db.prepare('SELECT jam_pelajaran FROM tahun_ajaran WHERE id = ?').bind(tahun_ajaran_id).first<any>()
  if (!row?.jam_pelajaran) return []
  try { return JSON.parse(row.jam_pelajaran) } catch { return [] }
}

// ============================================================
// PENGATURAN GLOBAL
// ============================================================
export async function setAgendaTimeRestrictionEnabled(enabled: boolean) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  await setSystemSetting(
    SYSTEM_SETTING_KEYS.agendaTimeRestriction,
    enabled ? '1' : '0'
  )

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/agenda')
  return { success: true }
}

export async function setAgendaLateSetting(
  enabled: boolean,
  thresholdMinutes: number,
  thresholdByJam: Record<string, number> = {}
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  const sanitizedMinutes = Math.max(0, Math.min(240, Math.floor(Number(thresholdMinutes) || 0)))
  const sanitizedByJam = Object.fromEntries(
    Object.entries(thresholdByJam)
      .map(([jamKe, minutes]) => [
        String(Math.floor(Number(jamKe))),
        Math.max(0, Math.min(240, Math.floor(Number(minutes) || 0))),
      ])
      .filter(([jamKe]) => Number.isInteger(Number(jamKe)) && Number(jamKe) > 0)
  )

  await setSystemSetting(SYSTEM_SETTING_KEYS.agendaLateEnabled, enabled ? '1' : '0')
  await setSystemSetting(SYSTEM_SETTING_KEYS.agendaLateThresholdMinutes, String(sanitizedMinutes))
  await setSystemSetting(SYSTEM_SETTING_KEYS.agendaLateThresholdByJam, JSON.stringify(sanitizedByJam))

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  return { success: true }
}

export async function setAttendanceTimeRestrictionEnabled(enabled: boolean) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  await setSystemSetting(
    SYSTEM_SETTING_KEYS.attendanceTimeRestriction,
    enabled ? '1' : '0'
  )

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/kehadiran')
  return { success: true }
}

export async function setAttendanceSkipIncompleteForDailyStatusEnabled(enabled: boolean) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  await setSystemSetting(
    SYSTEM_SETTING_KEYS.attendanceSkipIncompleteForDailyStatus,
    enabled ? '1' : '0'
  )

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/siswa')
  return { success: true }
}

export async function setHeroSettings(bgUrl: string, runningText: string, textColor: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  await setSystemSetting(SYSTEM_SETTING_KEYS.heroBackgroundImageUrl, bgUrl)
  await setSystemSetting(SYSTEM_SETTING_KEYS.heroRunningText, runningText)
  await setSystemSetting(SYSTEM_SETTING_KEYS.heroTextColor, textColor)

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}
