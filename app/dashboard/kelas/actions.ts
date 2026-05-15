// Lokasi: app/dashboard/kelas/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelect, dbBatchInsert } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import { todayWIB } from '@/lib/time'

// ============================================================
// HELPER: Sinkronisasi role 'wali_kelas' di tabel user_roles
// Dipanggil setiap kali wali_kelas_id kelas berubah.
// - guruIdBaru  : ID guru yang BARU ditugaskan (atau null jika dikosongkan)
// - guruIdLama  : ID guru yang SEBELUMNYA ditugaskan (atau null jika tidak ada)
// ============================================================
async function syncWaliKelasRole(
  db: D1Database,
  guruIdBaru: string | null,
  guruIdLama: string | null
) {
  const stmts: D1PreparedStatement[] = []

  // ── 1. Tambahkan role ke guru BARU ──────────────────────────
  if (guruIdBaru) {
    stmts.push(
      db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)')
        .bind(guruIdBaru, 'wali_kelas')
    )
  }

  // ── 2. Cabut role dari guru LAMA (jika beda & tidak menjadi
  //       wali kelas di kelas lain) ────────────────────────────
  if (guruIdLama && guruIdLama !== guruIdBaru) {
    const masihWali = await db
      .prepare('SELECT 1 FROM kelas WHERE wali_kelas_id = ? LIMIT 1')
      .bind(guruIdLama)
      .first<{ 1: number }>()
    if (!masihWali) {
      stmts.push(
        db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?')
          .bind(guruIdLama, 'wali_kelas')
      )
    }
  }

  if (stmts.length > 0) {
    await db.batch(stmts)
  }
}

// ============================================================
// 1. CRUD KELAS
// ============================================================
export async function tambahKelas(prevState: any, formData: FormData) {
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
  await syncWaliKelasRole(db, wali_kelas_id, null)

  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil ditambahkan!' }
}

export async function editKelas(id: string, payload: any) {
  const db = await getDB()
  const result = await dbUpdate(db, 'kelas', payload, { id })
  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil diperbarui!' }
}

export async function hapusKelas(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'kelas', { id })
  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Kelas berhasil dihapus!' }
}

export async function importKelasMassal(dataExcel: any[]) {
  const db = await getDB()

  // Ambil data guru untuk pencocokan nama wali kelas
  const guruRows = await db.prepare('SELECT id, nama_lengkap FROM "user"').all<any>()
  const mapGuru = new Map<string, string>()
  guruRows.results.forEach((g: any) => {
    if (g.nama_lengkap) mapGuru.set(g.nama_lengkap.toLowerCase().trim(), g.id)
  })

  const toInsert: any[] = []
  const waliKelasIds = new Set<string>() // Kumpulkan semua guru yang jadi wali kelas
  for (const row of dataExcel) {
    const tingkat = parseInt(row.TINGKAT)
    const kelompok = String(row.KELOMPOK || 'UMUM').trim()
    const nomor_kelas = String(row.NOMOR_KELAS || '').trim()
    const kapasitas = parseInt(row.KAPASITAS) || 36
    const namaGuru = String(row.WALI_KELAS || '').trim().toLowerCase()
    if (!tingkat || !nomor_kelas) continue

    const wali_kelas_id = namaGuru && mapGuru.has(namaGuru) ? mapGuru.get(namaGuru) : null
    toInsert.push({ tingkat, kelompok, nomor_kelas, kapasitas, wali_kelas_id })
    if (wali_kelas_id) waliKelasIds.add(wali_kelas_id)
  }

  if (toInsert.length > 0) {
    const { error } = await dbBatchInsert(db, 'kelas', toInsert)
    if (error) return { error, success: null }
  }

  // Sync role wali_kelas untuk semua guru yang diimport sebagai wali kelas
  if (waliKelasIds.size > 0) {
    const roleStmts = [...waliKelasIds].map(guruId =>
      db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(guruId, 'wali_kelas')
    )
    await db.batch(roleStmts)
  }

  revalidatePath('/dashboard/kelas')
  return { error: null, success: `Berhasil mengimport ${toInsert.length} kelas.` }
}

// ============================================================
// 2. INLINE EDIT & BATCH SAVE
// ============================================================
export async function editKelasForm(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string

  // Ambil wali kelas lama sebelum diupdate
  const existing = await db.prepare('SELECT wali_kelas_id FROM kelas WHERE id = ?').bind(id).first<{ wali_kelas_id: string | null }>()
  const guruIdLama = existing?.wali_kelas_id ?? null

  const wali_raw = formData.get('wali_kelas_id') as string
  const guruIdBaru = wali_raw === 'none' ? null : wali_raw
  const payload = {
    tingkat: parseInt(formData.get('tingkat') as string),
    kelompok: formData.get('kelompok') as string,
    nomor_kelas: formData.get('nomor_kelas') as string,
    wali_kelas_id: guruIdBaru,
    kapasitas: parseInt(formData.get('kapasitas') as string) || 36,
  }

  const result = await dbUpdate(db, 'kelas', payload, { id })
  if (result.error) return { error: result.error, success: null }

  // Sync role wali_kelas otomatis
  await syncWaliKelasRole(db, guruIdBaru, guruIdLama)

  revalidatePath('/dashboard/kelas')
  revalidatePath(`/dashboard/kelas/${id}`)
  return { error: null, success: 'Data Rombongan Belajar berhasil diperbarui!' }
}

export async function setWaliKelas(kelasId: string, guruId: string | null) {
  const db = await getDB()
  const guruIdBaru = guruId === 'none' ? null : guruId

  // Ambil wali kelas lama
  const existing = await db.prepare('SELECT wali_kelas_id FROM kelas WHERE id = ?').bind(kelasId).first<{ wali_kelas_id: string | null }>()
  const guruIdLama = existing?.wali_kelas_id ?? null

  const result = await dbUpdate(db, 'kelas', { wali_kelas_id: guruIdBaru }, { id: kelasId })
  if (result.error) return { error: result.error, success: null }

  // Sync role wali_kelas otomatis
  await syncWaliKelasRole(db, guruIdBaru, guruIdLama)

  revalidatePath('/dashboard/kelas')
  return { error: null, success: 'Wali kelas berhasil ditugaskan!' }
}

export async function setStatusKbmKelas(kelasId: string, aktif: boolean) {
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'kelas',
    { kbm_nonaktif_mulai: aktif ? null : todayWIB() },
    { id: kelasId }
  )
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  return {
    error: null,
    success: aktif
      ? 'Kelas diaktifkan lagi untuk kewajiban KBM.'
      : 'Kelas dinonaktifkan dari kewajiban KBM mulai hari ini.',
  }
}

export async function setStatusKbmTingkat(tingkat: number, aktif: boolean) {
  const db = await getDB()
  const result = await db.prepare(
    'UPDATE kelas SET kbm_nonaktif_mulai = ? WHERE tingkat = ?'
  ).bind(aktif ? null : todayWIB(), tingkat).run()

  if (!result.success) return { error: 'Gagal memperbarui status KBM tingkat kelas.', success: null }

  revalidatePath('/dashboard/kelas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  return {
    error: null,
    success: aktif
      ? `Kelas ${tingkat} diaktifkan lagi untuk kewajiban KBM.`
      : `Kelas ${tingkat} dinonaktifkan dari kewajiban KBM mulai hari ini.`,
  }
}

export async function batchUpdateKelas(
  updates: { id: string; kelompok?: string; wali_kelas_id?: string | null }[]
) {
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
  const db = await getDB()
  const result = await dbUpdate(db, 'siswa', { kelas_id: kelasId }, { id: siswaId })
  if (result.error) return { error: result.error }
  revalidatePath(`/dashboard/kelas/${kelasId}`)
  revalidatePath('/dashboard/kelas')
  return { success: 'Berhasil memasukkan siswa ke kelas!' }
}

export async function getKelasTujuanMutasi(tingkat: number, currentKelasId: string) {
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

export async function prosesMutasi(payload: {
  siswaIdLama: string
  kelasIdLama: string
  kelasIdTujuan: string
  siswaIdBarter: string | null
}) {
  const db = await getDB()

  try {
    if (payload.siswaIdBarter) {
      // Atomic swap via D1 batch (pengganti PostgreSQL RPC swap_siswa_kelas)
      await db.batch([
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(payload.kelasIdTujuan, payload.siswaIdLama),
        db
          .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
          .bind(payload.kelasIdLama, payload.siswaIdBarter),
      ])
    } else {
      await db
        .prepare('UPDATE siswa SET kelas_id = ? WHERE id = ?')
        .bind(payload.kelasIdTujuan, payload.siswaIdLama)
        .run()
    }

    revalidatePath(`/dashboard/kelas/${payload.kelasIdLama}`)
    revalidatePath(`/dashboard/kelas/${payload.kelasIdTujuan}`)
    revalidatePath('/dashboard/kelas')
    return { success: 'Proses mutasi siswa berhasil!' }
  } catch (err: any) {
    return { error: err.message || 'Terjadi kesalahan sistem saat mutasi.' }
  }
}

// ============================================================
// ASSIGN GURU BK KE KELAS (super_admin only)
// ============================================================

// Ambil data untuk modal assign BK: semua kelas + guru BK + mapping existing
export async function getDataAssignBK() {
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
  } catch (e: any) {
    return { error: e?.message ?? 'Gagal menyimpan.' }
  }
}
