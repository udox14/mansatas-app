// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import type { SlotJam, PolaJam } from './types'
import { setSystemSetting, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { DASHBOARD_VISIBILITY_KEY, type VisibilityMap } from '@/lib/dashboard-visibility'
import { DASHBOARD_WIDGETS_CONFIG_KEY, WIDGET_CATALOG_META, type WidgetsConfigMap } from '@/lib/dashboard-widgets-meta'
import { ensureRiwayatKelasSnapshotColumns, formatKelasSnapshot } from '@/lib/riwayat-kelas'
import { uploadToR2 } from '@/utils/r2'
import { createActivityDiff, logActivity } from '@/lib/activity-log'

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

  const result = await dbInsert<any>(db, 'tahun_ajaran', payload)
  if (result.error) return { error: result.error, success: null }

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'create_tahun_ajaran',
    summary: `Menambahkan tahun ajaran ${payload.nama} semester ${payload.semester}`,
    entityType: 'tahun_ajaran',
    entityId: result.data?.id,
    entityLabel: `${payload.nama} SMT ${payload.semester}`,
    after: result.data ?? payload,
  })

  revalidatePath('/', 'layout')
  return { error: null, success: 'Tahun Ajaran berhasil ditambahkan' }
}

// ============================================================
// SET VISIBILITAS ITEM DASHBOARD (per role)
// ============================================================
export async function setDashboardItemVisibility(visibility: VisibilityMap) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  // Bersihkan: hanya simpan entri false (item tampil = default)
  const cleaned: VisibilityMap = {}
  for (const [groupKey, items] of Object.entries(visibility || {})) {
    if (!items || typeof items !== 'object') continue
    const hidden: Record<string, boolean> = {}
    for (const [itemId, visible] of Object.entries(items)) {
      if (visible === false) hidden[itemId] = false
    }
    if (Object.keys(hidden).length > 0) cleaned[groupKey] = hidden
  }

  try {
    await setSystemSetting(DASHBOARD_VISIBILITY_KEY, JSON.stringify(cleaned))
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal menyimpan pengaturan dashboard' }
  }

  revalidatePath('/dashboard')
  return { error: null, success: 'Pengaturan tampilan dashboard berhasil disimpan.' }
}

// ============================================================
// SET WIDGET TAMBAHAN PER DASHBOARD (katalog)
// ============================================================
export async function setDashboardExtraWidgets(config: WidgetsConfigMap) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const validIds = new Set(WIDGET_CATALOG_META.map(w => w.id))
  const cleaned: WidgetsConfigMap = {}
  for (const [groupKey, ids] of Object.entries(config || {})) {
    if (!Array.isArray(ids)) continue
    // buang id tak dikenal + duplikat, pertahankan urutan
    const seen = new Set<string>()
    const list = ids.filter(id => validIds.has(id) && !seen.has(id) && seen.add(id))
    if (list.length > 0) cleaned[groupKey] = list
  }

  try {
    await setSystemSetting(DASHBOARD_WIDGETS_CONFIG_KEY, JSON.stringify(cleaned))
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal menyimpan widget dashboard' }
  }

  revalidatePath('/dashboard')
  return { error: null, success: 'Widget dashboard berhasil disimpan.' }
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

    await logActivity({
      db,
      module: 'pengaturan',
      action: 'activate_tahun_ajaran',
      severity: 'warning',
      summary: `Mengaktifkan tahun ajaran ${nextActive.nama} semester ${nextActive.semester}`,
      entityType: 'tahun_ajaran',
      entityId: id,
      entityLabel: `${nextActive.nama} SMT ${nextActive.semester}`,
      before: { active: currentActive },
      after: { active: nextActive, restoredRows: targetRows.length },
    })

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
  const before = await db.prepare('SELECT * FROM tahun_ajaran WHERE id = ?').bind(id).first<any>()
  const result = await dbDelete(db, 'tahun_ajaran', { id })
  if (result.error) return { error: 'Gagal menghapus: ' + result.error }
  await logActivity({
    db,
    module: 'pengaturan',
    action: 'delete_tahun_ajaran',
    severity: 'danger',
    summary: `Menghapus tahun ajaran ${before?.nama || id}`,
    entityType: 'tahun_ajaran',
    entityId: id,
    entityLabel: before ? `${before.nama} SMT ${before.semester}` : id,
    before,
  })
  revalidatePath('/', 'layout')
  return { success: 'Tahun Ajaran berhasil dihapus.' }
}

// ============================================================
// SIMPAN DAFTAR JURUSAN
// ============================================================
export async function simpanDaftarJurusan(tahun_ajaran_id: string, daftar_jurusan: string[]) {
  const db = await getDB()
  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')
  const before = await db.prepare('SELECT id, nama, semester, daftar_jurusan FROM tahun_ajaran WHERE id = ?').bind(tahun_ajaran_id).first<any>()
  const result = await dbUpdate(db, 'tahun_ajaran', { daftar_jurusan: JSON.stringify(daftar_jurusan) }, { id: tahun_ajaran_id })
  if (result.error) return { error: result.error }
  const after = { ...before, daftar_jurusan: JSON.stringify(daftar_jurusan) }
  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_daftar_jurusan',
    summary: `Mengubah daftar jurusan tahun ajaran ${before?.nama || tahun_ajaran_id}`,
    entityType: 'tahun_ajaran',
    entityId: tahun_ajaran_id,
    entityLabel: before ? `${before.nama} SMT ${before.semester}` : tahun_ajaran_id,
    before,
    after,
    diff: createActivityDiff(before, after),
  })
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
    const before = await db.prepare('SELECT id, nama, semester, jam_pelajaran FROM tahun_ajaran WHERE id = ?').bind(tahun_ajaran_id).first<any>()
    await db.prepare(
      'UPDATE tahun_ajaran SET jam_pelajaran = ? WHERE id = ?'
    ).bind(jsonStr, tahun_ajaran_id).run()

    const after = { ...before, jam_pelajaran: jsonStr }
    await logActivity({
      db,
      module: 'pengaturan',
      action: 'set_jam_pelajaran',
      summary: `Mengubah jam pelajaran tahun ajaran ${before?.nama || tahun_ajaran_id}`,
      entityType: 'tahun_ajaran',
      entityId: tahun_ajaran_id,
      entityLabel: before ? `${before.nama} SMT ${before.semester}` : tahun_ajaran_id,
      before,
      after,
      diff: createActivityDiff(before, after),
    })

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

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_agenda_time_restriction',
    summary: `${enabled ? 'Mengaktifkan' : 'Menonaktifkan'} pembatasan waktu agenda`,
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.agendaTimeRestriction,
    entityLabel: 'Pembatasan waktu agenda',
    after: { enabled },
  })

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

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_agenda_late_setting',
    summary: 'Mengubah pengaturan keterlambatan agenda',
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.agendaLateEnabled,
    entityLabel: 'Keterlambatan agenda',
    after: { enabled, thresholdMinutes: sanitizedMinutes, thresholdByJam: sanitizedByJam },
  })

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

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_attendance_time_restriction',
    summary: `${enabled ? 'Mengaktifkan' : 'Menonaktifkan'} pembatasan waktu absensi`,
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.attendanceTimeRestriction,
    entityLabel: 'Pembatasan waktu absensi',
    after: { enabled },
  })

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

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_attendance_incomplete_skip',
    summary: `${enabled ? 'Mengaktifkan' : 'Menonaktifkan'} skip absensi tidak lengkap`,
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.attendanceSkipIncompleteForDailyStatus,
    entityLabel: 'Skip absensi tidak lengkap',
    after: { enabled },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/siswa')
  return { success: true }
}

export async function setHeroSettings(bgUrl: string, runningText: string, textColor: string, runningTextBg: string, runningTextColor: string) {
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
  await setSystemSetting(SYSTEM_SETTING_KEYS.heroRunningTextBg, runningTextBg)
  await setSystemSetting(SYSTEM_SETTING_KEYS.heroRunningTextColor, runningTextColor)

  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_hero_settings',
    summary: 'Mengubah pengaturan hero dashboard',
    entityType: 'system_setting',
    entityId: 'hero',
    entityLabel: 'Hero dashboard',
    after: { bgUrl, runningText, textColor, runningTextBg, runningTextColor },
  })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function uploadHeroImageAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (userRow?.role !== 'super_admin') {
    return { error: 'Hanya Super Admin yang bisa mengubah pengaturan ini.' }
  }

  const file = formData.get('file') as File
  if (!file || !(file instanceof Blob)) return { error: 'Tidak ada file yang diunggah.' }

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `hero_image_${Date.now()}.${ext}`
  const uploadResult = await uploadToR2(file, 'system', fileName)

  if (uploadResult.error) return { error: `Gagal upload gambar: ${uploadResult.error}` }

  const urlToSave = uploadResult.url || ''
  await setSystemSetting(SYSTEM_SETTING_KEYS.heroBackgroundImageUrl, urlToSave)
  await logActivity({
    db,
    module: 'pengaturan',
    action: 'upload_hero_image',
    summary: 'Mengunggah gambar hero dashboard',
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.heroBackgroundImageUrl,
    entityLabel: 'Gambar hero dashboard',
    after: { url: urlToSave },
  })
  
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  
  return { success: true, url: urlToSave }
}
