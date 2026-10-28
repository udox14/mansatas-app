// Lokasi: app/dashboard/kelas/actions.ts
'use server'

import { dbInsert, dbUpdate, dbDelete, dbSelect, dbBatchInsert } from '@/utils/db'
import { getDB } from '@/utils/db-server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import { createActivityDiff, logActivity } from '@/lib/activity-log'
import { ADMINISTRATIVE_ROLES, requireActionAccess } from '@/lib/action-security'
import { syncAllWaliKelasRoles } from '@/lib/kelas-role-service'
import { syncSiswaRiwayatKelas } from '@/lib/riwayat-kelas'
import { publicServerError } from '@/lib/security-log'
import { z } from 'zod'
import { isImportChunkWithinLimits } from '@/lib/payload-limits'

const idSchema = z.string().trim().min(1).max(100)
const kelasUpdateSchema = z.object({
  tingkat: z.number().int().min(1).max(12).optional(),
  kelompok: z.string().trim().max(50).optional(),
  nomor_kelas: z.string().trim().min(1).max(20).optional(),
  kapasitas: z.number().int().min(1).max(100).optional(),
  wali_kelas_id: idSchema.nullable().optional(),
  km_siswa_id: idSchema.nullable().optional(),
}).strict()
const kelasImportRowSchema = z.object({
  TINGKAT: z.union([z.string(), z.number()]),
  KELOMPOK: z.union([z.string(), z.number()]).optional(),
  NOMOR_KELAS: z.union([z.string(), z.number()]),
  KAPASITAS: z.union([z.string(), z.number()]).optional(),
  WALI_KELAS: z.string().optional(),
}).strict()
const mutasiSchema = z.object({
  siswaIdLama: idSchema,
  kelasIdLama: idSchema,
  kelasIdTujuan: idSchema,
  siswaIdBarter: idSchema.nullable(),
}).strict()

// ============================================================
// HELPER: Sinkronisasi role 'wali_kelas' di tabel user_roles
// ============================================================
async function syncWaliKelasRole(db: D1Database, _guruIdBaru?: string | null, _guruIdLama?: string | null) {
  await syncAllWaliKelasRoles(db)
}

// ============================================================
// 1. CRUD KELAS
// ============================================================
export async function tambahKelas(_prevState: unknown, formData: FormData) {
  await requireActionAccess('kelas', 'create', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const wali_kelas_id = (formData.get('wali_kelas_id') as string) || null
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const result = await dbInsert(db, 'kelas', payload)
  if (result.error) return { error: result.error, success: null }

  // Sync role wali_kelas otomatis
  await syncAllWaliKelasRoles(db)

  await logActivity({
    db,
    module: 'kelas',
    action: 'create',
    summary: `Menambahkan kelas ${formatNamaKelas(payload.tingkat, payload.nomor_kelas, payload.kelompok)}`,
    entityType: 'kelas',
    entityId: result.data?.id,
    entityLabel: formatNamaKelas(payload.tingkat, payload.nomor_kelas, payload.kelompok),
    after: result.data ?? payload,
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  return { error: null, success: 'Kelas berhasil ditambahkan!' }
}

export async function editKelas(id: string, payload: unknown) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const parsed = kelasUpdateSchema.safeParse(payload)
  if (!parsed.success) return { error: 'Data kelas tidak valid.', success: null }
  const safePayload = parsed.data
  if (Object.keys(safePayload).length === 0) return { error: 'Tidak ada perubahan yang valid.', success: null }
  const db = await getDB()
  const before = await db.prepare('SELECT * FROM kelas WHERE id = ?').bind(id).first<any>()
  if (!before) return { error: 'Kelas tidak ditemukan.', success: null }
  const result = await dbUpdate(db, 'kelas', safePayload, { id })
  if (result.error) return { error: result.error, success: null }
  await syncAllWaliKelasRoles(db)
  const after = { ...before, ...safePayload }
  await logActivity({
    db,
    module: 'kelas',
    action: 'update',
    summary: `Mengubah kelas ${formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok)}`,
    entityType: 'kelas',
    entityId: id,
    entityLabel: formatNamaKelas(after.tingkat, after.nomor_kelas, after.kelompok),
    before,
    after,
    diff: createActivityDiff(before, after),
  })
  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  return { error: null, success: 'Kelas berhasil diperbarui!' }
}

export async function hapusKelas(id: string) {
  await requireActionAccess('kelas', 'delete', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const before = await db.prepare('SELECT * FROM kelas WHERE id = ?').bind(id).first<any>()
  const result = await dbDelete(db, 'kelas', { id })
  if (result.error) return { error: result.error, success: null }
  await syncAllWaliKelasRoles(db)
  await logActivity({
    db,
    module: 'kelas',
    action: 'delete',
    severity: 'danger',
    summary: `Menghapus kelas ${before ? formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok) : id}`,
    entityType: 'kelas',
    entityId: id,
    entityLabel: before ? formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok) : id,
    before,
  })
  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  return { error: null, success: 'Kelas berhasil dihapus!' }
}

export async function importKelasMassal(dataExcel: unknown[]) {
  await requireActionAccess('kelas', 'create', { allowedRoles: ADMINISTRATIVE_ROLES })
  if (!isImportChunkWithinLimits(dataExcel)) {
    return { error: 'Data impor maksimal 500 baris dan 1 MB per chunk.', success: null }
  }
  const parsedRows = z.array(kelasImportRowSchema).max(500).safeParse(dataExcel)
  if (!parsedRows.success) return { error: 'Format data impor kelas tidak valid.', success: null }
  const db = await getDB()

  // Ambil data guru untuk pencocokan nama wali kelas
  const guruRows = await db.prepare('SELECT id, nama_lengkap FROM "user"').all<any>()
  const mapGuru = new Map<string, string>()
  guruRows.results.forEach((g: any) => {
    if (g.nama_lengkap) mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id)
  })

  const toInsert: any[] = []
  for (const row of parsedRows.data) {
    const tingkat = parseInt(String(row.TINGKAT), 10)
    const kelompok = String(row.KELOMPOK || 'UMUM').trim()
    const nomor_kelas = String(row.NOMOR_KELAS || '').trim()
    const kapasitas = parseInt(String(row.KAPASITAS ?? ''), 10) || 36
    const namaGuru = String(row.WALI_KELAS || '').trim().toLowerCase()
    if (!tingkat || !nomor_kelas) continue

    const wali_kelas_id = namaGuru && mapGuru.has(namaGuru) ? mapGuru.get(namaGuru) : null
    toInsert.push({ tingkat, kelompok, nomor_kelas, kapasitas, wali_kelas_id })
  }

  if (toInsert.length > 0) {
    const { error } = await dbBatchInsert(db, 'kelas', toInsert)
    if (error) return { error, success: null }
  }

  // Sync role wali_kelas untuk semua guru
  await syncAllWaliKelasRoles(db)

  await logActivity({
    db,
    module: 'kelas',
    action: 'bulk_import',
    summary: `Import massal ${toInsert.length} kelas`,
    metadata: { count: toInsert.length },
    targets: toInsert.map(row => ({
      type: 'kelas',
      label: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      metadata: row,
    })),
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  return { error: null, success: `Berhasil mengimport ${toInsert.length} kelas.` }
}

// ============================================================
// 2. INLINE EDIT & BATCH SAVE
// ============================================================
export async function editKelasForm(_prevState: unknown, formData: FormData) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const id = formData.get('id') as string

  const existing = await db.prepare('SELECT * FROM kelas WHERE id = ?').bind(id).first<any>()

  const wali_raw = formData.get('wali_kelas_id') as string
  const guruIdBaru = wali_raw === 'none' ? null : wali_raw
  const kmRaw = formData.get('km_siswa_id') as string
  const kmSiswaId = kmRaw === 'none' ? null : kmRaw

  if (kmSiswaId) {
    const kmValid = await db.prepare(
      'SELECT 1 FROM siswa WHERE id = ? AND kelas_id = ? AND status = ? LIMIT 1'
    ).bind(kmSiswaId, id, 'aktif').first()
    if (!kmValid) return { error: 'KM Kelas harus dipilih dari siswa aktif di kelas ini.', success: null }
  }

  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: guruIdBaru,
    km_siswa_id: kmSiswaId,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const result = await dbUpdate(db, 'kelas', payload, { id })
  if (result.error) return { error: result.error, success: null }

  // Sync role wali_kelas otomatis
  await syncAllWaliKelasRoles(db)

  const after = { ...existing, ...payload }
  await logActivity({
    db,
    module: 'kelas',
    action: 'update_form',
    summary: `Mengubah rombongan belajar ${existing ? formatNamaKelas(existing.tingkat, existing.nomor_kelas, existing.kelompok) : id}`,
    entityType: 'kelas',
    entityId: id,
    entityLabel: formatNamaKelas(after.tingkat, after.nomor_kelas, after.kelompok),
    before: existing,
    after,
    diff: createActivityDiff(existing, after),
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard/agenda-kelas')
  revalidatePath(`/dashboard/kelas/${id}`)
  return { error: null, success: 'Data Rombongan Belajar berhasil diperbarui!' }
}

export async function setWaliKelas(kelasId: string, guruId: string | null) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const guruIdBaru = guruId === 'none' ? null : guruId

  const existing = await db.prepare('SELECT * FROM kelas WHERE id = ?').bind(kelasId).first<any>()

  const result = await dbUpdate(db, 'kelas', { wali_kelas_id: guruIdBaru }, { id: kelasId })
  if (result.error) return { error: result.error, success: null }

  // Sync role wali_kelas otomatis
  await syncAllWaliKelasRoles(db)

  const after = { ...existing, wali_kelas_id: guruIdBaru }
  await logActivity({
    db,
    module: 'kelas',
    action: 'set_wali_kelas',
    summary: `Mengubah wali kelas ${existing ? formatNamaKelas(existing.tingkat, existing.nomor_kelas, existing.kelompok) : kelasId}`,
    entityType: 'kelas',
    entityId: kelasId,
    entityLabel: existing ? formatNamaKelas(existing.tingkat, existing.nomor_kelas, existing.kelompok) : kelasId,
    before: existing,
    after,
    diff: createActivityDiff(existing, after),
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/guru')
  return { error: null, success: 'Wali kelas berhasil ditugaskan!' }
}

function validateDateInput(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return date
}

export async function setStatusKbmKelas(kelasId: string, aktif: boolean, tanggalMulai?: string) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const tanggal = validateDateInput(tanggalMulai)
  if (!aktif && !tanggal) return { error: 'Tanggal mulai nonaktif wajib diisi.', success: null }
  const before = await db.prepare('SELECT * FROM kelas WHERE id = ?').bind(kelasId).first<any>()

  const result = await dbUpdate(
    db,
    'kelas',
    { kbm_nonaktif_mulai: aktif ? null : tanggal },
    { id: kelasId }
  )
  if (result.error) return { error: result.error, success: null }

  const after = { ...before, kbm_nonaktif_mulai: aktif ? null : tanggal }
  await logActivity({
    db,
    module: 'kelas',
    action: 'set_kbm_status',
    severity: aktif ? 'info' : 'warning',
    summary: aktif
      ? `Mengaktifkan kembali KBM kelas ${before ? formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok) : kelasId}`
      : `Menonaktifkan KBM kelas ${before ? formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok) : kelasId} mulai ${tanggal}`,
    entityType: 'kelas',
    entityId: kelasId,
    entityLabel: before ? formatNamaKelas(before.tingkat, before.nomor_kelas, before.kelompok) : kelasId,
    before,
    after,
    diff: createActivityDiff(before, after),
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/dashboard/agenda-kelas')
  return {
    error: null,
    success: aktif
      ? 'Kelas diaktifkan lagi untuk kewajiban KBM.'
      : `Kelas dinonaktifkan dari kewajiban KBM mulai ${tanggal}.`,
  }
}

export async function setStatusKbmTingkat(tingkat: number, aktif: boolean, tanggalMulai?: string) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const tanggal = validateDateInput(tanggalMulai)
  if (!aktif && !tanggal) return { error: 'Tanggal mulai nonaktif wajib diisi.', success: null }

  const result = await db.prepare(
    'UPDATE kelas SET kbm_nonaktif_mulai = ? WHERE tingkat = ?'
  ).bind(aktif ? null : tanggal, tingkat).run()

  if (!result.success) return { error: 'Gagal memperbarui status KBM tingkat kelas.', success: null }

  await logActivity({
    db,
    module: 'kelas',
    action: 'set_kbm_status_tingkat',
    severity: aktif ? 'info' : 'warning',
    summary: aktif
      ? `Mengaktifkan kembali KBM semua kelas tingkat ${tingkat}`
      : `Menonaktifkan KBM semua kelas tingkat ${tingkat} mulai ${tanggal}`,
    entityType: 'tingkat',
    entityId: String(tingkat),
    entityLabel: `Kelas ${tingkat}`,
    metadata: { tingkat, aktif, tanggalMulai: tanggal, affected: result.meta.changes },
  })

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/dashboard/agenda-kelas')
  return {
    error: null,
    success: aktif
      ? `Kelas ${tingkat} diaktifkan lagi untuk kewajiban KBM.`
      : `Kelas ${tingkat} dinonaktifkan dari kewajiban KBM mulai ${tanggal}.`,
  }
}

export async function batchUpdateKelas(
  updates: { id: string; kelompok?: string; wali_kelas_id?: string | null }[]
) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 500) {
    return { error: 'Perubahan massal harus berisi 1 sampai 500 kelas.', success: null }
  }
  const db = await getDB()

  // Hanya update yang mengubah wali_kelas_id
  const waliUpdates = updates.filter(u => u.wali_kelas_id !== undefined)

  try {
    // Ambil wali lama untuk semua kelas yang berubah wali_kelas_id-nya
    const oldWaliMap = new Map<string, string | null>()
    if (waliUpdates.length > 0) {
      const ids = waliUpdates.map(u => u.id)
      const placeholders = ids.map(() => '?').join(',')
      const rows = await db
        .prepare(`SELECT id, wali_kelas_id FROM kelas WHERE id IN (${placeholders})`)
        .bind(...ids)
        .all<{ id: string; wali_kelas_id: string | null }>()
      rows.results.forEach(r => oldWaliMap.set(r.id, r.wali_kelas_id))
    }

    const beforeRows = await db.prepare(`SELECT * FROM kelas WHERE id IN (${updates.map(() => '?').join(',')})`).bind(...updates.map(u => u.id)).all<any>()
    const beforeMap = new Map((beforeRows.results ?? []).map(row => [row.id, row]))

    const stmts = updates.map(update => {
      const payload: any = {}
      if (update.kelompok !== undefined) payload.kelompok = update.kelompok
      if (update.wali_kelas_id !== undefined) {
        payload.wali_kelas_id = update.wali_kelas_id === 'none' ? null : update.wali_kelas_id
      }
      const keys = Object.keys(payload)
      const sets = keys.map(k => `${k} = ?`).join(', ')
      const vals = keys.map(k => payload[k])
      return db.prepare(`UPDATE kelas SET ${sets} WHERE id = ?`).bind(...vals, update.id)
    })
    await db.batch(stmts)

    // Sync role wali_kelas untuk setiap perubahan
    for (const u of waliUpdates) {
      const guruIdBaru = u.wali_kelas_id === 'none' ? null : (u.wali_kelas_id ?? null)
      const guruIdLama = oldWaliMap.get(u.id) ?? null
      await syncWaliKelasRole(db, guruIdBaru, guruIdLama)
    }

    await logActivity({
      db,
      module: 'kelas',
      action: 'bulk_update',
      summary: `Menyimpan perubahan massal pada ${updates.length} kelas`,
      metadata: { count: updates.length },
      targets: updates.map(update => {
        const before = beforeMap.get(update.id)
        const after = { ...before, ...update }
        return {
          type: 'kelas',
          id: update.id,
          label: before ? formatNamaKelas(before.tingkat, before.nomor_kelas, after.kelompok ?? before.kelompok) : update.id,
          metadata: { before, after, diff: createActivityDiff(before, after) },
        }
      }),
    })

    revalidatePath('/dashboard/kelas')
    return { error: null, success: `Berhasil menyimpan perubahan pada ${updates.length} kelas!` }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan sistem saat menyimpan massal.', success: null }
  }
}

// ============================================================
// 3. DETAIL KELAS: MUTASI & TAMBAH SISWA
// ============================================================
export async function getSiswaTanpaKelas() {
  await requireActionAccess('kelas', 'read', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa
       WHERE kelas_id IS NULL AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .all<any>()
  return result.results
}

export async function assignSiswaKeKelas(siswaId: string, kelasId: string) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const before = await db.prepare('SELECT id, nama_lengkap, kelas_id FROM siswa WHERE id = ?').bind(siswaId).first<any>()
  const result = await dbUpdate(db, 'siswa', { kelas_id: kelasId }, { id: siswaId })
  if (!result.error) await syncSiswaRiwayatKelas(db, siswaId, kelasId)
  if (result.error) return { error: result.error }
  await logActivity({
    db,
    module: 'kelas',
    action: 'assign_siswa',
    summary: `Memasukkan siswa ${before?.nama_lengkap || siswaId} ke kelas`,
    entityType: 'siswa',
    entityId: siswaId,
    entityLabel: before?.nama_lengkap || siswaId,
    before,
    after: { ...before, kelas_id: kelasId },
    diff: createActivityDiff(before, { ...before, kelas_id: kelasId }),
    metadata: { kelasId },
  })
  revalidatePath(`/dashboard/kelas/${kelasId}`)
  revalidatePath('/dashboard/kelas')
  return { success: 'Berhasil memasukkan siswa ke kelas!' }
}

export async function getKelasTujuanMutasi(tingkat: number, currentKelasId: string) {
  await requireActionAccess('kelas', 'read', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const rows = await db
    .prepare(
      `SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas,
              COUNT(s.id) as jumlah_siswa
       FROM kelas k
       LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
       WHERE k.tingkat = ? AND k.id != ?
       GROUP BY k.id
       ORDER BY k.kelompok ASC, k.nomor_kelas ASC`
    )
    .bind(tingkat, currentKelasId)
    .all<any>()

  return rows.results.map((k: any) => ({
    id: k.id,
    nama: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
    kapasitas: k.kapasitas,
    jumlah_siswa: k.jumlah_siswa || 0,
  }))
}

export async function getSiswaUntukBarter(kelasId: string) {
  await requireActionAccess('kelas', 'read', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const result = await db
    .prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa
       WHERE kelas_id = ? AND status = 'aktif'
       ORDER BY nama_lengkap ASC`
    )
    .bind(kelasId)
    .all<any>()
  return result.results
}

export async function prosesMutasi(payload: unknown) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  const parsed = mutasiSchema.safeParse(payload)
  if (!parsed.success || parsed.data.kelasIdLama === parsed.data.kelasIdTujuan) {
    return { error: 'Data mutasi tidak valid.' }
  }
  const safePayload = parsed.data
  const db = await getDB()
  const siswaLama = await db.prepare('SELECT id, nama_lengkap, kelas_id FROM siswa WHERE id = ?').bind(safePayload.siswaIdLama).first<any>()
  if (!siswaLama || siswaLama.kelas_id !== safePayload.kelasIdLama) return { error: 'Data siswa atau kelas asal tidak sesuai.' }
  const siswaBarter = safePayload.siswaIdBarter
    ? await db.prepare('SELECT id, nama_lengkap, kelas_id FROM siswa WHERE id = ?').bind(safePayload.siswaIdBarter).first<any>()
    : null
  if (safePayload.siswaIdBarter && (!siswaBarter || siswaBarter.kelas_id !== safePayload.kelasIdTujuan)) {
    return { error: 'Data siswa barter atau kelas tujuan tidak sesuai.' }
  }

  try {
    if (safePayload.siswaIdBarter) {
      // Atomic swap via D1 batch (pengganti PostgreSQL RPC swap_siswa_kelas)
      await db.batch([
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(safePayload.kelasIdTujuan, safePayload.siswaIdLama),
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(safePayload.kelasIdLama, safePayload.siswaIdBarter),
      ])
    } else {
      await db
        .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
        .bind(safePayload.kelasIdTujuan, safePayload.siswaIdLama)
        .run()
    }

    await syncSiswaRiwayatKelas(db, safePayload.siswaIdLama, safePayload.kelasIdTujuan)
    if (safePayload.siswaIdBarter) {
      await syncSiswaRiwayatKelas(db, safePayload.siswaIdBarter, safePayload.kelasIdLama)
    }

    await logActivity({
      db,
      module: 'kelas',
      action: safePayload.siswaIdBarter ? 'swap_mutasi_siswa' : 'mutasi_siswa',
      severity: 'warning',
      summary: safePayload.siswaIdBarter
        ? `Mutasi barter siswa ${siswaLama?.nama_lengkap || safePayload.siswaIdLama} dengan ${siswaBarter?.nama_lengkap || safePayload.siswaIdBarter}`
        : `Mutasi siswa ${siswaLama?.nama_lengkap || safePayload.siswaIdLama} ke kelas tujuan`,
      entityType: 'siswa',
      entityId: safePayload.siswaIdLama,
      entityLabel: siswaLama?.nama_lengkap || safePayload.siswaIdLama,
      before: { siswaLama, siswaBarter },
      after: {
        siswaLama: { ...siswaLama, kelas_id: safePayload.kelasIdTujuan },
        siswaBarter: siswaBarter ? { ...siswaBarter, kelas_id: safePayload.kelasIdLama } : null,
      },
      metadata: safePayload,
      targets: [
        { type: 'siswa', id: safePayload.siswaIdLama, label: siswaLama?.nama_lengkap || safePayload.siswaIdLama },
        ...(safePayload.siswaIdBarter ? [{ type: 'siswa', id: safePayload.siswaIdBarter, label: siswaBarter?.nama_lengkap || safePayload.siswaIdBarter }] : []),
      ],
    })

    revalidatePath(`/dashboard/kelas/${safePayload.kelasIdLama}`)
    revalidatePath(`/dashboard/kelas/${safePayload.kelasIdTujuan}`)
    revalidatePath(`/dashboard/siswa/${safePayload.siswaIdLama}`)
    if (safePayload.siswaIdBarter) revalidatePath(`/dashboard/siswa/${safePayload.siswaIdBarter}`)
    revalidatePath('/dashboard/kelas')
    revalidatePath('/dashboard/siswa')
    return { success: 'Proses mutasi siswa berhasil!' }
  } catch (error) {
    return publicServerError('kelas.mutasi', error)
  }
}

// ============================================================
// ASSIGN GURU BK KE KELAS (super_admin only)
// ============================================================

// Ambil data untuk modal assign BK: semua kelas + guru BK + mapping existing
export async function getDataAssignBK() {
  await requireActionAccess('kelas', 'read', { allowedRoles: ADMINISTRATIVE_ROLES })
  const db = await getDB()
  const [guruBkAll, taAktif] = await Promise.all([
    db.prepare(`SELECT id, nama_lengkap FROM "user" WHERE role = 'guru_bk' ORDER BY nama_lengkap ASC`).all<any>(),
    db.prepare(`SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`).first<{ id: string }>(),
  ])
  // Ambil mapping hanya untuk TA aktif
  const mappingAll = taAktif
    ? await db.prepare(`SELECT guru_bk_id, kelas_id FROM kelas_binaan_bk WHERE tahun_ajaran_id = ?`).bind(taAktif.id).all<any>()
    : { results: [] }
  return {
    guruBkAll: guruBkAll.results || [],
    mappingAll: mappingAll.results || [],
    taAktifId: taAktif?.id ?? '',
  }
}

// Set kelas binaan satu guru BK (replace)
export async function setKelasBinaanBKFromKelas(guru_bk_id: string, kelas_ids: string[], tahun_ajaran_id: string) {
  await requireActionAccess('kelas', 'update', { allowedRoles: ADMINISTRATIVE_ROLES })
  if (!Array.isArray(kelas_ids) || kelas_ids.length > 100) return { error: 'Maksimal 100 kelas binaan.' }
  if (!tahun_ajaran_id) return { error: 'Tahun Ajaran aktif belum diatur.' }
  const db = await getDB()
  try {
    // Hapus binaan guru ini untuk TA ini saja (historis TA lain tetap aman)
    await db.prepare('DELETE FROM kelas_binaan_bk WHERE guru_bk_id = ? AND tahun_ajaran_id = ?').bind(guru_bk_id, tahun_ajaran_id).run()
    if (kelas_ids.length > 0) {
      const CHUNK = 10
      for (let i = 0; i < kelas_ids.length; i += CHUNK) {
        const chunk = kelas_ids.slice(i, i + CHUNK)
        const placeholders = chunk.map(() => `(lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))`).join(', ')
        const values = chunk.flatMap(kid => [guru_bk_id, kid, tahun_ajaran_id])
        await db.prepare(
          `INSERT OR IGNORE INTO kelas_binaan_bk (id, guru_bk_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
        ).bind(...values).run()
      }
    }
    revalidatePath('/', 'layout')
    return { success: 'Kelas binaan berhasil disimpan.' }
  } catch (error) {
    return publicServerError('kelas.set_kelas_binaan_bk', error)
  }
}
