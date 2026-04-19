'use server'

import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireAuth(featureId: string) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, featureId)
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

function generateId() {
  return crypto.randomUUID()
}

function recalcStatus(totalDibayar: number, totalDiskon: number, nominal: number): string {
  const sisa = nominal - totalDibayar - totalDiskon
  if (sisa <= 0) return 'lunas'
  if (totalDibayar > 0) return 'nyicil'
  return 'belum_bayar'
}

// ─── DSPT ───────────────────────────────────────────────────────────────────

export async function getDsptList(filters?: { status?: string; angkatan?: string }) {
  const { db } = await requireAuth('keuangan-dspt')
  // LEFT JOIN dari siswa → semua siswa tampil, termasuk yang belum punya tagihan DSPT
  let query = `
    SELECT
      d.id, d.siswa_id AS dspt_siswa_id, d.nominal_target, d.total_dibayar, d.total_diskon,
      COALESCE(d.status, 'tidak_ada') as status, d.catatan,
      s.id as siswa_id, s.nama_lengkap, s.nisn,
      s.tahun_masuk,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN fin_dspt d ON d.siswa_id = s.id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE 1=1
  `
  const params: any[] = []
  if (filters?.status && filters.status !== 'semua') {
    if (filters.status === 'tidak_ada') {
      query += ' AND d.id IS NULL'
    } else {
      query += ' AND d.status = ?'; params.push(filters.status)
    }
  }
  if (filters?.angkatan && filters.angkatan !== 'semua') {
    query += ` AND s.tahun_masuk = ?`; params.push(parseInt(filters.angkatan))
  }
  query += ' ORDER BY s.nama_lengkap ASC'
  const result = await db.prepare(query).bind(...params).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function createDspt(siswaId: string, nominalTarget: number, catatan?: string) {
  const { db } = await requireAuth('keuangan-dspt')
  const existing = await db.prepare('SELECT id FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first()
  if (existing) return { error: 'Siswa ini sudah memiliki tagihan DSPT', success: null }
  await db.prepare(`
    INSERT INTO fin_dspt (id, siswa_id, nominal_target, catatan)
    VALUES (?, ?, ?, ?)
  `).bind(generateId(), siswaId, nominalTarget, catatan ?? null).run()
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: 'Tagihan DSPT berhasil dibuat' }
}

export async function getSiswaTemplate(angkatan?: number) {
  const { db } = await requireAuth('keuangan-dspt')
  let query = `
    SELECT s.nama_lengkap, s.nisn, s.tahun_masuk,
           k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE 1=1
  `
  const params: any[] = []
  if (angkatan) { query += ' AND s.tahun_masuk = ?'; params.push(angkatan) }
  query += ' ORDER BY k.tingkat ASC, k.nomor_kelas ASC, s.nama_lengkap ASC'
  const result = await db.prepare(query).bind(...params).all<any>()
  return { data: result.results ?? [] }
}

export async function searchSiswa(q: string) {
  const { db } = await requireAuth('keuangan-dspt')
  if (!q || q.trim().length < 2) return { data: [] }
  const term = `%${q.trim()}%`
  const result = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn,
           k.tingkat, k.nomor_kelas, k.kelompok,
           s.tahun_masuk
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.nama_lengkap LIKE ? OR s.nisn LIKE ?
    ORDER BY s.nama_lengkap ASC
    LIMIT 20
  `).bind(term, term).all<any>()
  return { data: result.results ?? [] }
}

export async function updateDsptTarget(dsptId: string, nominalTarget: number, catatan?: string) {
  const { db } = await requireAuth('keuangan-dspt')
  const rec = await db.prepare('SELECT total_dibayar, total_diskon FROM fin_dspt WHERE id = ?').bind(dsptId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  const status = recalcStatus(rec.total_dibayar ?? 0, rec.total_diskon ?? 0, nominalTarget)
  await db.prepare(`
    UPDATE fin_dspt SET nominal_target = ?, catatan = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(nominalTarget, catatan ?? null, status, dsptId).run()
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: 'Target DSPT berhasil diperbarui' }
}

export async function updateDsptPembayaran(dsptId: string, totalDibayar: number) {
  const { db } = await requireAuth('keuangan-dspt')
  const rec = await db.prepare('SELECT nominal_target, total_diskon FROM fin_dspt WHERE id = ?').bind(dsptId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  const status = recalcStatus(totalDibayar, rec.total_diskon ?? 0, rec.nominal_target)
  await db.prepare(`
    UPDATE fin_dspt SET total_dibayar = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(totalDibayar, status, dsptId).run()
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: 'Pembayaran DSPT berhasil diperbarui' }
}

export async function tandaiDsptLunas(dsptId: string) {
  const { db } = await requireAuth('keuangan-dspt')
  const rec = await db.prepare('SELECT nominal_target, total_diskon FROM fin_dspt WHERE id = ?').bind(dsptId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  const totalDibayar = Math.max(0, (rec.nominal_target ?? 0) - (rec.total_diskon ?? 0))
  await db.prepare(`
    UPDATE fin_dspt SET total_dibayar = ?, status = 'lunas', updated_at = datetime('now') WHERE id = ?
  `).bind(totalDibayar, dsptId).run()
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: 'DSPT berhasil ditandai lunas' }
}

export async function setNominalDsptMassal(angkatan: number, nominal: number) {
  const { db } = await requireAuth('keuangan-dspt')
  // Buat DSPT baru untuk yang belum ada, update nominal untuk yang sudah ada
  const siswaRes = await db.prepare(`
    SELECT s.id as siswa_id FROM siswa s WHERE s.tahun_masuk = ?
  `).bind(angkatan).all<{ siswa_id: string }>()
  const siswaList = siswaRes.results ?? []
  if (!siswaList.length) return { error: 'Tidak ada siswa untuk angkatan ini', success: null }

  const existingRes = await db.prepare(
    'SELECT id, siswa_id, total_dibayar, total_diskon FROM fin_dspt WHERE siswa_id IN (SELECT id FROM siswa WHERE tahun_masuk = ?)'
  ).bind(angkatan).all<any>()
  const existingMap = new Map((existingRes.results ?? []).map(r => [r.siswa_id, r]))

  const stmts: any[] = []
  for (const { siswa_id } of siswaList) {
    const ex = existingMap.get(siswa_id)
    if (ex) {
      const status = recalcStatus(ex.total_dibayar ?? 0, ex.total_diskon ?? 0, nominal)
      stmts.push(db.prepare(`UPDATE fin_dspt SET nominal_target = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).bind(nominal, status, ex.id))
    } else {
      stmts.push(db.prepare(`INSERT INTO fin_dspt (id, siswa_id, nominal_target) VALUES (?, ?, ?)`).bind(generateId(), siswa_id, nominal))
    }
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: `Nominal DSPT Rp ${nominal.toLocaleString('id-ID')} berhasil diset untuk ${stmts.length} siswa angkatan ${angkatan}` }
}

export async function importDsptBulk(rows: { nisn?: string; nama?: string; nominal_target: number; total_dibayar: number; catatan?: string }[]) {
  const { db } = await requireAuth('keuangan-dspt')
  if (!rows.length) return { error: null, success: '0 data diimport', sukses: 0, gagal: [] }

  // 1 subrequest: load semua siswa by NISN sekaligus
  const nisnList = rows.map(r => r.nisn).filter(Boolean) as string[]
  const namaList = rows.map(r => r.nama).filter(Boolean) as string[]
  const siswaNisnMap = new Map<string, string>()  // nisn → siswa_id
  const siswaNamaMap = new Map<string, string>()  // nama_lower → siswa_id

  if (nisnList.length) {
    const ph = nisnList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, nisn FROM siswa WHERE nisn IN (${ph})`).bind(...nisnList).all<any>()
    for (const s of res.results ?? []) siswaNisnMap.set(s.nisn, s.id)
  }
  if (namaList.length) {
    const ph = namaList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, LOWER(nama_lengkap) as nama_l FROM siswa WHERE LOWER(nama_lengkap) IN (${ph.replace(/\?/g, 'LOWER(?)')})`).bind(...namaList).all<any>()
    for (const s of res.results ?? []) siswaNamaMap.set(s.nama_l, s.id)
  }

  // 1 subrequest: load semua fin_dspt yang sudah ada untuk siswa ini
  const allSiswaIds = [...new Set([...siswaNisnMap.values(), ...siswaNamaMap.values()])]
  const existingMap = new Map<string, any>()  // siswa_id → fin_dspt row
  if (allSiswaIds.length) {
    const ph = allSiswaIds.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, siswa_id, total_diskon, catatan FROM fin_dspt WHERE siswa_id IN (${ph})`).bind(...allSiswaIds).all<any>()
    for (const r of res.results ?? []) existingMap.set(r.siswa_id, r)
  }

  const stmts: D1PreparedStatement[] = []
  let sukses = 0; const gagal: string[] = []

  for (const row of rows) {
    const siswaId = (row.nisn ? siswaNisnMap.get(row.nisn) : undefined)
      ?? (row.nama ? siswaNamaMap.get(row.nama.toLowerCase()) : undefined)
    if (!siswaId) { gagal.push(row.nisn ?? row.nama ?? '?'); continue }

    const existing = existingMap.get(siswaId)
    const status = recalcStatus(row.total_dibayar, existing?.total_diskon ?? 0, row.nominal_target)
    if (existing) {
      stmts.push(db.prepare(`UPDATE fin_dspt SET nominal_target=?, total_dibayar=?, status=?, catatan=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.nominal_target, row.total_dibayar, status, row.catatan ?? existing.catatan ?? null, existing.id))
    } else {
      stmts.push(db.prepare(`INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, status, catatan) VALUES (?,?,?,?,?,?)`)
        .bind(generateId(), siswaId, row.nominal_target, row.total_dibayar, status, row.catatan ?? null))
    }
    sukses++
  }

  // 1 subrequest: batch semua insert/update
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: gagal.length ? `${gagal.length} baris gagal (siswa tidak ditemukan): ${gagal.slice(0, 5).join(', ')}` : null, success: `${sukses} data DSPT berhasil diimport`, sukses, gagal }
}

// ─── SPP Mulai (tanggal mulai per angkatan / per siswa) ────────────────────

export async function getSppMulaiList() {
  const { db } = await requireAuth('keuangan-spp')
  const res = await db.prepare(`
    SELECT * FROM fin_spp_mulai ORDER BY tahun_masuk DESC
  `).all<any>()
  return { data: res.results ?? [] }
}

export async function setSppMulaiAngkatan(tahunMasuk: number, bulanMulai: number, tahunMulai: number) {
  const { db } = await requireAuth('keuangan-spp')
  const existing = await db.prepare(
    `SELECT id FROM fin_spp_mulai WHERE tahun_masuk = ? AND siswa_id IS NULL`
  ).bind(tahunMasuk).first<any>()
  if (existing) {
    await db.prepare(`
      UPDATE fin_spp_mulai SET bulan_mulai=?, tahun_mulai=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(bulanMulai, tahunMulai, existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO fin_spp_mulai (id, tahun_masuk, bulan_mulai, tahun_mulai)
      VALUES (?, ?, ?, ?)
    `).bind(generateId(), tahunMasuk, bulanMulai, tahunMulai).run()
  }
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Pengaturan mulai SPP disimpan' }
}

export async function setSppMulaiSiswa(siswaId: string, bulanMulai: number, tahunMulai: number) {
  const { db } = await requireAuth('keuangan-spp')
  const existing = await db.prepare(
    `SELECT id FROM fin_spp_mulai WHERE siswa_id = ?`
  ).bind(siswaId).first<any>()
  if (existing) {
    await db.prepare(`
      UPDATE fin_spp_mulai SET bulan_mulai=?, tahun_mulai=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(bulanMulai, tahunMulai, existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO fin_spp_mulai (id, siswa_id, bulan_mulai, tahun_mulai)
      VALUES (?, ?, ?, ?)
    `).bind(generateId(), siswaId, bulanMulai, tahunMulai).run()
  }
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Override mulai SPP siswa disimpan' }
}

// ─── SPP Setting ────────────────────────────────────────────────────────────

export async function getSppSettings() {
  const { db } = await requireAuth('keuangan-spp')
  const result = await db.prepare('SELECT * FROM fin_spp_setting ORDER BY tingkat ASC').all<any>()
  return { data: result.results ?? [], error: null }
}

export async function updateSppSetting(tingkat: number, nominal: number, aktif: number) {
  const { db, userId } = await requireAuth('keuangan-spp')

  // 1. Update setting
  await db.prepare(`
    UPDATE fin_spp_setting
    SET nominal = ?, aktif = ?, updated_by = ?, updated_at = datetime('now')
    WHERE tingkat = ?
  `).bind(nominal, aktif, userId, tingkat).run()

  // 2. Timpa nominal semua tagihan yang belum lunas di tingkat ini
  //    (yang sudah lunas tidak diubah agar histori bayar tetap akurat)
  const siswaSubquery = `
    SELECT s.id FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE k.tingkat = ?
  `
  if (nominal === 0) {
    // Nominal 0 = tidak ada tagihan → hapus semua tagihan yang belum ada bayar nyata
    // (termasuk yang status='lunas' palsu akibat nominal=0 sebelumnya)
    await db.prepare(`
      DELETE FROM fin_spp_tagihan
      WHERE total_dibayar = 0
        AND siswa_id IN (${siswaSubquery})
    `).bind(tingkat).run()
  } else {
    // Nominal > 0 → update nominal + recalc status
    // Guard: hanya ubah tagihan yang belum ada bayaran nyata (total_dibayar=0)
    // agar histori siswa yang sudah bayar tidak terganggu
    await db.prepare(`
      UPDATE fin_spp_tagihan
      SET nominal    = ?,
          updated_at = datetime('now'),
          status = CASE
            WHEN (total_dibayar + total_diskon) >= ? THEN 'lunas'
            WHEN total_dibayar > 0                   THEN 'nyicil'
            ELSE 'belum_bayar'
          END
      WHERE total_dibayar = 0
        AND siswa_id IN (${siswaSubquery})
    `).bind(nominal, nominal, tingkat).run()
  }

  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Pengaturan SPP disimpan & nominal tagihan diperbarui' }
}

export async function getSppTagihanList(filters: { bulan: number; tahun: number; status?: string }) {
  const { db } = await requireAuth('keuangan-spp')
  // LEFT JOIN dari siswa → semua siswa muncul, termasuk yang belum punya tagihan bulan ini
  let query = `
    SELECT
      t.id,
      s.id AS siswa_id, s.nama_lengkap, s.nisn, s.tahun_masuk,
      COALESCE(t.bulan, ?) AS bulan,
      COALESCE(t.tahun, ?) AS tahun,
      COALESCE(t.nominal, 0) AS nominal,
      COALESCE(t.total_dibayar, 0) AS total_dibayar,
      COALESCE(t.total_diskon, 0) AS total_diskon,
      COALESCE(t.status, 'tidak_ada') AS status,
      k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN fin_spp_tagihan t ON t.siswa_id = s.id AND t.bulan = ? AND t.tahun = ?
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE 1=1
  `
  const params: any[] = [filters.bulan, filters.tahun, filters.bulan, filters.tahun]
  if (filters.status && filters.status !== 'semua') {
    if (filters.status === 'tidak_ada') {
      query += ' AND t.id IS NULL'
    } else {
      query += ' AND t.status = ?'; params.push(filters.status)
    }
  }
  query += ' ORDER BY s.nama_lengkap ASC'
  const result = await db.prepare(query).bind(...params).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function buatSppTagihanSiswa(siswaId: string, bulan: number, tahun: number, nominal: number) {
  const { db } = await requireAuth('keuangan-spp')
  const exists = await db.prepare(
    'SELECT id FROM fin_spp_tagihan WHERE siswa_id = ? AND bulan = ? AND tahun = ?'
  ).bind(siswaId, bulan, tahun).first()
  if (exists) return { error: 'Tagihan sudah ada untuk periode ini', success: null }
  await db.prepare(
    'INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal) VALUES (?, ?, ?, ?, ?)'
  ).bind(generateId(), siswaId, bulan, tahun, nominal).run()
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Tagihan SPP berhasil dibuat' }
}

/** Buat tagihan SPP massal untuk semua siswa yang sudah melewati tanggal mulai SPP-nya.
 *  Menghormati fin_spp_mulai — siswa yang belum mulai tidak dibuatkan tagihan.
 */
export async function buatTagihanMassal(tahun: number, bulan: number, tahunMasuk?: number) {
  const { db } = await requireAuth('keuangan-spp')

  // Nominal per tingkat
  const settings = await db.prepare('SELECT tingkat, nominal FROM fin_spp_setting').all<any>()
  const nominalByTingkat: Record<number, number> = {}
  for (const s of settings.results ?? []) nominalByTingkat[s.tingkat] = s.nominal

  // Ambil semua siswa beserta tingkat dan tanggal mulai SPP-nya
  // Override per-siswa diutamakan, fallback ke level angkatan
  let siswaQuery = `
    SELECT
      s.id AS siswa_id,
      s.tahun_masuk,
      k.tingkat,
      COALESCE(
        (SELECT bulan_mulai FROM fin_spp_mulai WHERE siswa_id = s.id LIMIT 1),
        (SELECT bulan_mulai FROM fin_spp_mulai WHERE tahun_masuk = s.tahun_masuk AND siswa_id IS NULL LIMIT 1)
      ) AS bulan_mulai,
      COALESCE(
        (SELECT tahun_mulai FROM fin_spp_mulai WHERE siswa_id = s.id LIMIT 1),
        (SELECT tahun_mulai FROM fin_spp_mulai WHERE tahun_masuk = s.tahun_masuk AND siswa_id IS NULL LIMIT 1)
      ) AS tahun_mulai
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE 1=1
  `
  const siswaParams: any[] = []
  if (tahunMasuk) { siswaQuery += ' AND s.tahun_masuk = ?'; siswaParams.push(tahunMasuk) }

  const siswaList = await db.prepare(siswaQuery).bind(...siswaParams).all<any>()
  if (!siswaList.results?.length) return { error: 'Tidak ada siswa ditemukan', success: null }

  // Filter: hanya siswa yang sudah melewati tanggal mulai untuk periode ini
  const eligible = (siswaList.results ?? []).filter(row => {
    if (!row.bulan_mulai || !row.tahun_mulai) return false // belum diatur = skip
    if (row.tahun_mulai > tahun) return false
    if (row.tahun_mulai === tahun && row.bulan_mulai > bulan) return false
    return true
  })
  if (!eligible.length) return { error: 'Tidak ada siswa yang memenuhi kriteria mulai SPP untuk periode ini', success: null }

  // Tagihan yang sudah ada
  const existingRes = await db.prepare(
    'SELECT siswa_id FROM fin_spp_tagihan WHERE bulan = ? AND tahun = ?'
  ).bind(bulan, tahun).all<{ siswa_id: string }>()
  const existingSet = new Set((existingRes.results ?? []).map(r => r.siswa_id))

  const stmts: D1PreparedStatement[] = []
  for (const row of eligible) {
    if (!existingSet.has(row.siswa_id)) {
      const nominal = nominalByTingkat[row.tingkat] ?? 0
      stmts.push(db.prepare(
        'INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal) VALUES (?, ?, ?, ?, ?)'
      ).bind(generateId(), row.siswa_id, bulan, tahun, nominal))
    }
  }

  if (stmts.length > 0) {
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  }

  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: `${stmts.length} tagihan SPP berhasil dibuat (dari ${eligible.length} siswa eligible)` }
}

/** Batch: buat tagihan jika belum ada, lalu tandai lunas semua bulan sekaligus — 1 batch write */
export async function simpanSppBulanTerpilih(
  siswaId: string,
  bulanList: number[],  // bulan yang dipilih
  tahun: number,
) {
  const { db } = await requireAuth('keuangan-spp')
  if (!bulanList.length) return { error: 'Tidak ada bulan dipilih', success: null }

  // Nominal dari setting (butuh tingkat siswa)
  const siswaRow = await db.prepare(`
    SELECT s.id, k.tingkat FROM siswa s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?
  `).bind(siswaId).first<any>()
  const setting = siswaRow?.tingkat
    ? await db.prepare('SELECT nominal FROM fin_spp_setting WHERE tingkat = ?').bind(siswaRow.tingkat).first<any>()
    : null
  const nominal = setting?.nominal ?? 0

  // Tagihan yang sudah ada untuk bulan-bulan ini
  const placeholders = bulanList.map(() => '?').join(',')
  const existing = await db.prepare(
    `SELECT id, bulan, nominal AS nom, total_diskon FROM fin_spp_tagihan WHERE siswa_id = ? AND tahun = ? AND bulan IN (${placeholders})`
  ).bind(siswaId, tahun, ...bulanList).all<any>()
  const existingMap = new Map<number, any>()
  for (const r of existing.results ?? []) existingMap.set(r.bulan, r)

  const stmts: D1PreparedStatement[] = []
  for (const bulan of bulanList) {
    const ex = existingMap.get(bulan)
    if (ex) {
      // Sudah ada → update jadi lunas
      const dibayar = Math.max(0, (ex.nom ?? nominal) - (ex.total_diskon ?? 0))
      stmts.push(db.prepare(
        `UPDATE fin_spp_tagihan SET total_dibayar = ?, status = 'lunas', updated_at = datetime('now') WHERE id = ?`
      ).bind(dibayar, ex.id))
    } else {
      // Belum ada → insert + langsung lunas
      const id = generateId()
      const dibayar = Math.max(0, nominal)
      stmts.push(db.prepare(
        `INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal, total_dibayar, status) VALUES (?, ?, ?, ?, ?, ?, 'lunas')`
      ).bind(id, siswaId, bulan, tahun, nominal, dibayar))
    }
  }

  if (stmts.length) await db.batch(stmts)
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: `${bulanList.length} bulan SPP berhasil disimpan` }
}

export async function tandaiSppLunas(tagihanId: string) {
  const { db } = await requireAuth('keuangan-spp')
  const rec = await db.prepare('SELECT nominal, total_diskon FROM fin_spp_tagihan WHERE id = ?').bind(tagihanId).first<any>()
  if (!rec) return { error: 'Tagihan tidak ditemukan', success: null }
  const totalDibayar = Math.max(0, (rec.nominal ?? 0) - (rec.total_diskon ?? 0))
  await db.prepare(`UPDATE fin_spp_tagihan SET total_dibayar = ?, status = 'lunas', updated_at = datetime('now') WHERE id = ?`)
    .bind(totalDibayar, tagihanId).run()
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'SPP berhasil ditandai lunas' }
}

export async function updateSppTagihanNominal(tagihanId: string, nominal: number, totalDibayar: number) {
  const { db } = await requireAuth('keuangan-spp')
  const rec = await db.prepare('SELECT total_diskon FROM fin_spp_tagihan WHERE id = ?').bind(tagihanId).first<any>()
  if (!rec) return { error: 'Tagihan tidak ditemukan', success: null }
  const status = recalcStatus(totalDibayar, rec.total_diskon ?? 0, nominal)
  await db.prepare(`UPDATE fin_spp_tagihan SET nominal=?, total_dibayar=?, status=?, updated_at=datetime('now') WHERE id=?`)
    .bind(nominal, totalDibayar, status, tagihanId).run()
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Tagihan SPP berhasil diperbarui' }
}

export async function importSppBulk(rows: { nisn?: string; nama?: string; bulan: number; tahun: number; nominal: number; total_dibayar: number }[]) {
  const { db } = await requireAuth('keuangan-spp')
  if (!rows.length) return { error: null, success: '0 data diimport', sukses: 0, gagal: [] }

  // 1 subrequest: load semua siswa sekaligus
  const nisnList = rows.map(r => r.nisn).filter(Boolean) as string[]
  const namaList = rows.map(r => r.nama).filter(Boolean) as string[]
  const siswaNisnMap = new Map<string, string>()
  const siswaNamaMap = new Map<string, string>()

  if (nisnList.length) {
    const ph = nisnList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, nisn FROM siswa WHERE nisn IN (${ph})`).bind(...nisnList).all<any>()
    for (const s of res.results ?? []) siswaNisnMap.set(s.nisn, s.id)
  }
  if (namaList.length) {
    const ph = namaList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, LOWER(nama_lengkap) as nama_l FROM siswa WHERE LOWER(nama_lengkap) IN (${ph.replace(/\?/g, 'LOWER(?)')})`).bind(...namaList).all<any>()
    for (const s of res.results ?? []) siswaNamaMap.set(s.nama_l, s.id)
  }

  // Tentukan periode unik yang ada di rows agar bisa pre-load tagihan
  const allSiswaIds = [...new Set([...siswaNisnMap.values(), ...siswaNamaMap.values()])]
  const periodeSet = new Set(rows.map(r => `${r.bulan}-${r.tahun}`))
  const existingMap = new Map<string, any>()  // `${siswa_id}-${bulan}-${tahun}` → tagihan row

  // 1 subrequest per periode unik (biasanya cuma 1 periode saat import)
  for (const periode of periodeSet) {
    const [bulan, tahun] = periode.split('-').map(Number)
    if (!allSiswaIds.length) break
    const ph = allSiswaIds.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, siswa_id, total_diskon FROM fin_spp_tagihan WHERE bulan=? AND tahun=? AND siswa_id IN (${ph})`)
      .bind(bulan, tahun, ...allSiswaIds).all<any>()
    for (const r of res.results ?? []) existingMap.set(`${r.siswa_id}-${bulan}-${tahun}`, r)
  }

  const stmts: D1PreparedStatement[] = []
  let sukses = 0; const gagal: string[] = []

  for (const row of rows) {
    const siswaId = (row.nisn ? siswaNisnMap.get(row.nisn) : undefined)
      ?? (row.nama ? siswaNamaMap.get(row.nama.toLowerCase()) : undefined)
    if (!siswaId) { gagal.push(row.nisn ?? row.nama ?? '?'); continue }

    const key = `${siswaId}-${row.bulan}-${row.tahun}`
    const existing = existingMap.get(key)
    const status = recalcStatus(row.total_dibayar, existing?.total_diskon ?? 0, row.nominal)
    if (existing) {
      stmts.push(db.prepare(`UPDATE fin_spp_tagihan SET nominal=?, total_dibayar=?, status=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.nominal, row.total_dibayar, status, existing.id))
    } else {
      stmts.push(db.prepare(`INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal, total_dibayar, status) VALUES (?,?,?,?,?,?,?)`)
        .bind(generateId(), siswaId, row.bulan, row.tahun, row.nominal, row.total_dibayar, status))
    }
    sukses++
  }

  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  revalidatePath('/dashboard/keuangan/spp')
  return { error: gagal.length ? `${gagal.length} baris gagal: ${gagal.slice(0, 5).join(', ')}` : null, success: `${sukses} tagihan SPP berhasil diimport`, sukses, gagal }
}

// ─── Koperasi ───────────────────────────────────────────────────────────────

export async function getMasterItemKoperasi() {
  const { db } = await requireAuth('keuangan-koperasi')
  const result = await db.prepare(
    'SELECT * FROM fin_koperasi_master_item ORDER BY urutan ASC, nama_item ASC'
  ).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function saveMasterItem(data: { id?: string; nama_item: string; nominal_default: number; urutan: number }) {
  const { db } = await requireAuth('keuangan-koperasi')
  if (data.id) {
    await db.prepare(
      'UPDATE fin_koperasi_master_item SET nama_item=?, nominal_default=?, urutan=? WHERE id=?'
    ).bind(data.nama_item, data.nominal_default, data.urutan, data.id).run()
  } else {
    await db.prepare(
      'INSERT INTO fin_koperasi_master_item (id, nama_item, nominal_default, urutan) VALUES (?,?,?,?)'
    ).bind(generateId(), data.nama_item, data.nominal_default, data.urutan).run()
  }
  revalidatePath('/dashboard/keuangan/koperasi')
  return { error: null, success: 'Item berhasil disimpan' }
}

export async function hapusMasterItem(id: string) {
  const { db } = await requireAuth('keuangan-koperasi')
  // Cek apakah item ini sudah dipakai di tagihan
  const used = await db.prepare(
    'SELECT COUNT(*) as c FROM fin_koperasi_tagihan_item WHERE master_item_id = ?'
  ).bind(id).first<{ c: number }>()
  if (used && used.c > 0) {
    return { error: `Item tidak bisa dihapus karena sudah dipakai di ${used.c} tagihan`, success: null }
  }
  await db.prepare('DELETE FROM fin_koperasi_master_item WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/keuangan/koperasi')
  return { error: null, success: 'Item berhasil dihapus' }
}

export async function getKoperasiTagihanList(filters?: { status?: string; angkatan?: string }) {
  const { db } = await requireAuth('keuangan-koperasi')
  let query = `
    SELECT
      t.id, t.siswa_id, t.tahun_ajaran_id, t.total_nominal,
      t.total_dibayar, t.total_diskon, t.status,
      s.nama_lengkap, s.nisn,
      s.tahun_masuk,
      k.tingkat, k.nomor_kelas, k.kelompok,
      ta.nama AS nama_tahun_ajaran
    FROM fin_koperasi_tagihan t
    JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN tahun_ajaran ta ON ta.id = t.tahun_ajaran_id
    WHERE 1=1
  `
  const params: any[] = []
  if (filters?.status && filters.status !== 'semua') { query += ' AND t.status = ?'; params.push(filters.status) }
  if (filters?.angkatan && filters.angkatan !== 'semua') { query += ` AND s.tahun_masuk = ?`; params.push(parseInt(filters.angkatan)) }
  query += ' ORDER BY s.nama_lengkap ASC'
  const result = await db.prepare(query).bind(...params).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function getKoperasiTagihanDetail(tagihanId: string) {
  const { db } = await requireAuth('keuangan-koperasi')
  const items = await db.prepare(`
    SELECT * FROM fin_koperasi_tagihan_item WHERE tagihan_id = ? ORDER BY nama_item ASC
  `).bind(tagihanId).all<any>()
  return { data: items.results ?? [], error: null }
}

export async function createKoperasiTagihan(siswaId: string, tahunAjaranId: string, items: Array<{ masterItemId?: string; namaItem: string; nominal: number }>) {
  const { db } = await requireAuth('keuangan-koperasi')

  const existing = await db.prepare(
    'SELECT id FROM fin_koperasi_tagihan WHERE siswa_id = ? AND tahun_ajaran_id = ?'
  ).bind(siswaId, tahunAjaranId).first()
  if (existing) return { error: 'Tagihan koperasi sudah ada untuk siswa ini di tahun ajaran ini', success: null }

  if (!items.length) return { error: 'Minimal 1 item diperlukan', success: null }

  const totalNominal = items.reduce((s, i) => s + i.nominal, 0)
  const tagihanId = generateId()

  const stmts: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO fin_koperasi_tagihan (id, siswa_id, tahun_ajaran_id, total_nominal)
      VALUES (?, ?, ?, ?)
    `).bind(tagihanId, siswaId, tahunAjaranId, totalNominal),
    ...items.map(item =>
      db.prepare(`
        INSERT INTO fin_koperasi_tagihan_item (id, tagihan_id, master_item_id, nama_item, nominal)
        VALUES (?, ?, ?, ?, ?)
      `).bind(generateId(), tagihanId, item.masterItemId ?? null, item.namaItem, item.nominal)
    ),
  ]

  await db.batch(stmts)
  revalidatePath('/dashboard/keuangan/koperasi')
  revalidatePath(`/dashboard/keuangan/siswa/${siswaId}`)
  return { error: null, success: 'Tagihan koperasi berhasil dibuat' }
}

export async function generateKoperasiTagihanBulk(tahunAjaranId: string) {
  const { db } = await requireAuth('keuangan-koperasi')

  // Ambil master item yang aktif
  const masterItems = await db.prepare(
    'SELECT * FROM fin_koperasi_master_item WHERE aktif = 1 ORDER BY urutan ASC'
  ).all<any>()
  if (!masterItems.results?.length) return { error: 'Tidak ada master item koperasi yang aktif', success: null }

  // Ambil semua siswa kelas 10 aktif yang belum memiliki tagihan koperasi di tahun ajaran ini
  const siswaList = await db.prepare(`
    SELECT DISTINCT s.id
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    WHERE k.tingkat = 10
    AND s.id NOT IN (
      SELECT siswa_id FROM fin_koperasi_tagihan WHERE tahun_ajaran_id = ?
    )
  `).bind(tahunAjaranId).all<any>()

  if (!siswaList.results?.length) return { error: 'Semua siswa kelas 10 sudah memiliki tagihan koperasi', success: null }

  const totalNominal = masterItems.results.reduce((s: number, i: any) => s + i.nominal_default, 0)
  let generated = 0

  for (const siswa of siswaList.results) {
    const tagihanId = generateId()
    const stmts: D1PreparedStatement[] = [
      db.prepare(`
        INSERT INTO fin_koperasi_tagihan (id, siswa_id, tahun_ajaran_id, total_nominal)
        VALUES (?, ?, ?, ?)
      `).bind(tagihanId, siswa.id, tahunAjaranId, totalNominal),
      ...masterItems.results.map((item: any) =>
        db.prepare(`
          INSERT INTO fin_koperasi_tagihan_item (id, tagihan_id, master_item_id, nama_item, nominal)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), tagihanId, item.id, item.nama_item, item.nominal_default)
      ),
    ]
    await db.batch(stmts)
    generated++
  }

  revalidatePath('/dashboard/keuangan/koperasi')
  return { error: null, success: `${generated} tagihan koperasi berhasil digenerate` }
}

// ─── Transaksi ──────────────────────────────────────────────────────────────

export async function catatTransaksi(payload: {
  siswaId: string
  kategori: 'dspt' | 'spp' | 'koperasi'
  metodeBayar: 'tunai' | 'transfer'
  details: Array<{ refType: string; refId: string; jumlah: number }>
}) {
  const { db, userId } = await requireAuth('keuangan-koperasi')

  const jumlahTotal = payload.details.reduce((sum, d) => sum + d.jumlah, 0)
  if (jumlahTotal <= 0) return { error: 'Jumlah pembayaran tidak valid', success: null }

  // Generate nomor kuitansi
  const seq = await db.prepare(
    "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
  ).first<{ counter: number }>()
  const year = new Date().getFullYear()
  const kat = payload.kategori.toUpperCase()
  const nomorKuitansi = `KWT-${kat}-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`

  const transaksiId = generateId()

  // Batch semua operasi
  const stmts: D1PreparedStatement[] = []

  // Insert header transaksi
  stmts.push(db.prepare(`
    INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(transaksiId, payload.siswaId, payload.kategori, payload.metodeBayar, jumlahTotal, userId, nomorKuitansi))

  // Insert detail + update tagihan
  for (const d of payload.details) {
    stmts.push(db.prepare(`
      INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah)
      VALUES (?, ?, ?, ?, ?)
    `).bind(generateId(), transaksiId, d.refType, d.refId, d.jumlah))

    // Update total_dibayar di tabel tagihan ybs
    const tabel = refTypeToTable(d.refType)
    if (tabel) {
      stmts.push(db.prepare(`
        UPDATE ${tabel}
        SET total_dibayar = total_dibayar + ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(d.jumlah, d.refId))
    }
  }

  await db.batch(stmts)

  // Recalculate status (setelah batch selesai)
  await recalcTagihanStatus(db, payload.details)

  revalidatePath('/dashboard/keuangan')
  return { error: null, success: 'Transaksi berhasil disimpan', data: { transaksiId, nomorKuitansi } }
}

export async function voidTransaksi(transaksiId: string, alasan: string) {
  const { db, userId } = await requireAuth('keuangan-koperasi')

  const trx = await db.prepare('SELECT * FROM fin_transaksi WHERE id = ?').bind(transaksiId).first<any>()
  if (!trx) return { error: 'Transaksi tidak ditemukan', success: null }
  if (trx.is_void) return { error: 'Transaksi sudah di-void sebelumnya', success: null }

  const details = await db.prepare(
    'SELECT * FROM fin_transaksi_detail WHERE transaksi_id = ?'
  ).bind(transaksiId).all<any>()

  const stmts: D1PreparedStatement[] = []

  // Mark void
  stmts.push(db.prepare(`
    UPDATE fin_transaksi
    SET is_void=1, void_at=datetime('now'), void_oleh=?, void_alasan=?
    WHERE id=?
  `).bind(userId, alasan, transaksiId))

  // Kurangi total_dibayar di setiap tagihan yang direferensi
  for (const d of details.results ?? []) {
    const tabel = refTypeToTable(d.ref_type)
    if (tabel) {
      stmts.push(db.prepare(`
        UPDATE ${tabel}
        SET total_dibayar = MAX(0, total_dibayar - ?), updated_at = datetime('now')
        WHERE id = ?
      `).bind(d.jumlah, d.ref_id))
    }
  }

  await db.batch(stmts)
  await recalcTagihanStatus(db, (details.results ?? []).map(d => ({ refType: d.ref_type, refId: d.ref_id, jumlah: d.jumlah })))

  revalidatePath('/dashboard/keuangan')
  return { error: null, success: 'Transaksi berhasil di-void' }
}

// ─── Diskon ─────────────────────────────────────────────────────────────────

export async function beriDiskon(payload: {
  siswaId: string
  targetType: 'dspt' | 'spp_tagihan' | 'koperasi_item'
  targetId: string
  jumlah: number
  alasan: string
  keterangan?: string
}) {
  const { db, userId } = await requireAuth('keuangan-dspt')

  const tabel = refTypeToTable(payload.targetType)
  if (!tabel) return { error: 'Target tidak valid', success: null }

  await db.prepare(`
    INSERT INTO fin_diskon (id, siswa_id, target_type, target_id, jumlah, alasan, keterangan, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(generateId(), payload.siswaId, payload.targetType, payload.targetId,
    payload.jumlah, payload.alasan, payload.keterangan ?? null, userId).run()

  await db.prepare(`
    UPDATE ${tabel}
    SET total_diskon = total_diskon + ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(payload.jumlah, payload.targetId).run()

  await recalcTagihanStatus(db, [{ refType: payload.targetType, refId: payload.targetId, jumlah: 0 }])

  revalidatePath('/dashboard/keuangan')
  return { error: null, success: 'Keringanan berhasil diberikan' }
}

// ─── Kas Keluar ─────────────────────────────────────────────────────────────

export async function getKasKeluarList(filters?: { bulan?: number; tahun?: number }) {
  const { db } = await requireAuth('keuangan-kas-keluar')
  let query = `
    SELECT k.*, u.nama_lengkap AS nama_pembuat
    FROM fin_kas_keluar k
    LEFT JOIN "user" u ON u.id = k.dibuat_oleh
    WHERE 1=1
  `
  const params: any[] = []
  if (filters?.bulan) { query += ` AND strftime('%m', k.tanggal) = ?`; params.push(String(filters.bulan).padStart(2, '0')) }
  if (filters?.tahun) { query += ` AND strftime('%Y', k.tanggal) = ?`; params.push(String(filters.tahun)) }
  query += ' ORDER BY k.tanggal DESC'
  const result = await db.prepare(query).bind(...params).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function catatKasKeluar(payload: {
  jumlah: number
  keterangan: string
  kategori: string
  metode: 'tunai' | 'transfer'
  tanggal: string
}) {
  const { db, userId } = await requireAuth('keuangan-kas-keluar')
  await db.prepare(`
    INSERT INTO fin_kas_keluar (id, jumlah, keterangan, kategori, metode, tanggal, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(generateId(), payload.jumlah, payload.keterangan, payload.kategori,
    payload.metode, payload.tanggal, userId).run()
  revalidatePath('/dashboard/keuangan/kas-keluar')
  return { error: null, success: 'Pengeluaran berhasil dicatat' }
}

export async function hapusKasKeluar(id: string) {
  const { db } = await requireAuth('keuangan-kas-keluar')
  await db.prepare('DELETE FROM fin_kas_keluar WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/keuangan/kas-keluar')
  return { error: null, success: 'Data pengeluaran dihapus' }
}

// ── [DEV] Reset semua data keuangan ─────────────────────────────────────────
export async function devResetDataKeuangan() {
  const { db } = await requireAuth('keuangan-dashboard')
  await db.batch([
    db.prepare('DELETE FROM fin_transaksi_detail'),
    db.prepare('DELETE FROM fin_transaksi'),
    db.prepare('DELETE FROM fin_diskon'),
    db.prepare('DELETE FROM fin_janji_bayar'),
    db.prepare('DELETE FROM fin_dspt'),
    db.prepare('DELETE FROM fin_spp_tagihan'),
    db.prepare('DELETE FROM fin_koperasi_tagihan_item'),
    db.prepare('DELETE FROM fin_koperasi_tagihan'),
    db.prepare('DELETE FROM fin_kas_keluar'),
    db.prepare("UPDATE fin_nomor_kuitansi_seq SET counter = 0 WHERE id = 'singleton'"),
  ])
  revalidatePath('/dashboard/keuangan')
  return { error: null, success: 'Semua data keuangan berhasil dihapus' }
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export async function getDashboardStats(tahunAjaran?: string) {
  const { db } = await requireAuth('keuangan-dashboard')
  const tahun = tahunAjaran ? parseInt(tahunAjaran) : new Date().getFullYear()

  const [dsptStats, sppStats, kasKeluarStats] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) as total_siswa,
        SUM(nominal_target) as total_target,
        SUM(total_dibayar) as total_dibayar,
        SUM(total_diskon) as total_diskon,
        SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) as lunas,
        SUM(CASE WHEN status='nyicil' THEN 1 ELSE 0 END) as nyicil,
        SUM(CASE WHEN status='belum_bayar' THEN 1 ELSE 0 END) as belum_bayar
      FROM fin_dspt
    `).first<any>(),
    db.prepare(`
      SELECT
        COUNT(*) as total_tagihan,
        SUM(nominal) as total_nominal,
        SUM(total_dibayar) as total_dibayar,
        SUM(CASE WHEN status='lunas' THEN 1 ELSE 0 END) as lunas,
        SUM(CASE WHEN status='belum_bayar' THEN 1 ELSE 0 END) as belum_bayar
      FROM fin_spp_tagihan
      WHERE tahun = ?
    `).bind(tahun).first<any>(),
    db.prepare(`
      SELECT SUM(jumlah) as total_keluar
      FROM fin_kas_keluar
      WHERE strftime('%Y', tanggal) = ?
    `).bind(String(tahun)).first<any>(),
  ])

  // Cashflow bulanan masuk (dari transaksi yang tidak di-void)
  const cashflowMasuk = await db.prepare(`
    SELECT
      CAST(strftime('%m', created_at) AS INTEGER) as bulan,
      SUM(jumlah_total) as total
    FROM fin_transaksi
    WHERE is_void = 0 AND strftime('%Y', created_at) = ?
    GROUP BY strftime('%m', created_at)
    ORDER BY bulan ASC
  `).bind(String(tahun)).all<any>()

  // Cashflow bulanan keluar
  const cashflowKeluar = await db.prepare(`
    SELECT
      CAST(strftime('%m', tanggal) AS INTEGER) as bulan,
      SUM(jumlah) as total
    FROM fin_kas_keluar
    WHERE strftime('%Y', tanggal) = ?
    GROUP BY strftime('%m', tanggal)
    ORDER BY bulan ASC
  `).bind(String(tahun)).all<any>()

  return {
    dspt: dsptStats,
    spp: sppStats,
    kasKeluar: kasKeluarStats,
    cashflowMasuk: cashflowMasuk.results ?? [],
    cashflowKeluar: cashflowKeluar.results ?? [],
    error: null,
  }
}

// ─── Buku Besar Siswa ───────────────────────────────────────────────────────

export async function getBukuBesarSiswa(siswaId: string) {
  const { db } = await requireAuth('keuangan-dspt')

  const [siswa, dspt, sppTagihan, sppMulaiRow, kopTagihan, transaksi, janjiList] = await Promise.all([
    db.prepare(`
      SELECT s.*, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_spp_tagihan WHERE siswa_id = ? ORDER BY tahun DESC, bulan DESC').bind(siswaId).all<any>(),
    // Per-siswa override dulu, jika tidak ada cari level angkatan
    db.prepare(`
      SELECT m.bulan_mulai, m.tahun_mulai FROM fin_spp_mulai m
      WHERE m.siswa_id = ?
      UNION ALL
      SELECT m2.bulan_mulai, m2.tahun_mulai FROM fin_spp_mulai m2
      INNER JOIN siswa s2 ON s2.tahun_masuk = m2.tahun_masuk
      WHERE s2.id = ? AND m2.siswa_id IS NULL
      LIMIT 1
    `).bind(siswaId, siswaId).first<any>(),
    db.prepare(`
      SELECT t.*, GROUP_CONCAT(i.nama_item, ', ') as item_names
      FROM fin_koperasi_tagihan t
      LEFT JOIN fin_koperasi_tagihan_item i ON i.tagihan_id = t.id
      WHERE t.siswa_id = ?
      GROUP BY t.id
    `).bind(siswaId).first<any>(),
    db.prepare(`
      SELECT t.*, u.nama_lengkap as nama_input
      FROM fin_transaksi t
      LEFT JOIN "user" u ON u.id = t.input_oleh
      WHERE t.siswa_id = ?
      ORDER BY t.created_at DESC
    `).bind(siswaId).all<any>(),
    db.prepare('SELECT * FROM fin_janji_bayar WHERE siswa_id = ? ORDER BY tanggal_janji ASC').bind(siswaId).all<any>(),
  ])

  // ── Auto-create tagihan SPP dari mulai s/d bulan ini ────────────────────
  let freshSppTagihan = sppTagihan.results ?? []
  if (sppMulaiRow && siswa) {
    const now = new Date()
    const nowBulan = now.getMonth() + 1
    const nowTahun = now.getFullYear()

    // Hitung semua bulan yang seharusnya ada (mulai → sekarang)
    const expectedMonths: { bulan: number; tahun: number }[] = []
    let b = sppMulaiRow.bulan_mulai as number
    let t = sppMulaiRow.tahun_mulai as number
    while (t < nowTahun || (t === nowTahun && b <= nowBulan)) {
      expectedMonths.push({ bulan: b, tahun: t })
      b++; if (b > 12) { b = 1; t++ }
    }

    if (expectedMonths.length > 0) {
      // Cek mana yang belum ada
      const existingSet = new Set(freshSppTagihan.map((r: any) => `${r.bulan}-${r.tahun}`))
      const missing = expectedMonths.filter(m => !existingSet.has(`${m.bulan}-${m.tahun}`))

      if (missing.length > 0) {
        // Ambil nominal dari setting sesuai tingkat
        const setting = siswa.tingkat
          ? await db.prepare('SELECT nominal FROM fin_spp_setting WHERE tingkat = ?').bind(siswa.tingkat).first<any>()
          : null
        const nominal = setting?.nominal ?? 0

        const stmts = missing.map(m =>
          db.prepare('INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal) VALUES (?,?,?,?,?)')
            .bind(generateId(), siswaId, m.bulan, m.tahun, nominal)
        )
        // Batch per 100
        for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))

        // Fetch ulang setelah insert
        const updated = await db.prepare(
          'SELECT * FROM fin_spp_tagihan WHERE siswa_id = ? ORDER BY tahun DESC, bulan DESC'
        ).bind(siswaId).all<any>()
        freshSppTagihan = updated.results ?? []
      }
    }
  }

  let kopItems: any[] = []
  if (kopTagihan) {
    const items = await db.prepare(
      'SELECT * FROM fin_koperasi_tagihan_item WHERE tagihan_id = ? ORDER BY nama_item ASC'
    ).bind(kopTagihan.id).all<any>()
    kopItems = items.results ?? []
  }

  return {
    siswa,
    dspt,
    sppTagihan: freshSppTagihan,
    sppMulai: sppMulaiRow ?? null,
    kopTagihan,
    kopItems,
    transaksi: transaksi.results ?? [],
    janjiList: janjiList.results ?? [],
    error: null,
  }
}

export async function simpanJanjiBayar(payload: {
  siswaId: string
  targetType: string
  targetId: string
  tanggalJanji: string
  catatan?: string
}) {
  const { db, userId } = await requireAuth('keuangan-dspt')
  const existing = await db.prepare(
    'SELECT id FROM fin_janji_bayar WHERE siswa_id = ? AND target_type = ? AND target_id = ?'
  ).bind(payload.siswaId, payload.targetType, payload.targetId).first<any>()

  if (existing) {
    await db.prepare(`
      UPDATE fin_janji_bayar SET tanggal_janji=?, catatan=?, updated_at=datetime('now') WHERE id=?
    `).bind(payload.tanggalJanji, payload.catatan ?? null, existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO fin_janji_bayar (id, siswa_id, target_type, target_id, tanggal_janji, catatan, dibuat_oleh)
      VALUES (?,?,?,?,?,?,?)
    `).bind(generateId(), payload.siswaId, payload.targetType, payload.targetId,
      payload.tanggalJanji, payload.catatan ?? null, userId).run()
  }
  revalidatePath(`/dashboard/keuangan/siswa/${payload.siswaId}`)
  return { error: null, success: 'Janji bayar berhasil disimpan' }
}

// ─── Laporan ────────────────────────────────────────────────────────────────

export async function getRekapAngkatan() {
  const { db } = await requireAuth('keuangan-laporan')
  const result = await db.prepare(`
    SELECT
      s.tahun_masuk,
      COUNT(DISTINCT s.id) as total_siswa,
      COUNT(DISTINCT CASE WHEN d.status='lunas' THEN d.id END) as dspt_lunas,
      COUNT(DISTINCT CASE WHEN d.status='nyicil' THEN d.id END) as dspt_nyicil,
      COUNT(DISTINCT CASE WHEN d.status='belum_bayar' OR d.id IS NULL THEN s.id END) as dspt_belum,
      COALESCE(SUM(d.nominal_target),0) as dspt_target,
      COALESCE(SUM(d.total_dibayar),0) as dspt_dibayar
    FROM siswa s
    LEFT JOIN fin_dspt d ON d.siswa_id = s.id
    GROUP BY s.tahun_masuk
    ORDER BY s.tahun_masuk DESC
  `).all<any>()
  return { data: result.results ?? [], error: null }
}

// ─── Util ────────────────────────────────────────────────────────────────────

function refTypeToTable(refType: string): string | null {
  switch (refType) {
    case 'dspt': return 'fin_dspt'
    case 'spp_tagihan': return 'fin_spp_tagihan'
    case 'koperasi_item': return 'fin_koperasi_tagihan_item'
    default: return null
  }
}

// recalcTagihanStatus — O(5 subrequests) regardless of item count
// Sebelumnya O(n*5): tiap item = SELECT+UPDATE+SELECT tagihan_id+SELECT agg+UPDATE header
// → Mentok Cloudflare free-tier limit 50 subrequests/invocation untuk koperasi banyak item
async function recalcTagihanStatus(db: D1Database, details: Array<{ refType: string; refId: string; jumlah: number }>) {
  if (!details.length) return

  // Kelompokkan id per tipe agar bisa IN query sekaligus
  const byType = new Map<string, string[]>()
  for (const d of details) {
    const ids = byType.get(d.refType) ?? []
    ids.push(d.refId)
    byType.set(d.refType, ids)
  }

  const updateStmts: D1PreparedStatement[] = []
  const kopItemIds: string[] = byType.get('koperasi_item') ?? []

  // 1 subrequest per tipe (max 3 tipe: dspt, spp_tagihan, koperasi_item)
  for (const [refType, ids] of byType) {
    const tabel = refTypeToTable(refType)
    if (!tabel) continue
    const ph = ids.map(() => '?').join(',')
    const nomField = refType === 'dspt' ? 'nominal_target AS nominal' : 'nominal'
    const res = await db.prepare(
      `SELECT id, total_dibayar, total_diskon, ${nomField} FROM ${tabel} WHERE id IN (${ph})`
    ).bind(...ids).all<any>()
    for (const row of res.results ?? []) {
      updateStmts.push(db.prepare(
        `UPDATE ${tabel} SET status=?, updated_at=datetime('now') WHERE id=?`
      ).bind(recalcStatus(row.total_dibayar, row.total_diskon, row.nominal), row.id))
    }
  }

  // 1 subrequest: batch semua status update sekaligus
  if (updateStmts.length) await db.batch(updateStmts)

  // Recalc header koperasi (jika ada koperasi_item)
  if (kopItemIds.length) {
    const ph = kopItemIds.map(() => '?').join(',')
    // 1 subrequest: ambil tagihan_ids
    const itemsRes = await db.prepare(
      `SELECT DISTINCT tagihan_id FROM fin_koperasi_tagihan_item WHERE id IN (${ph})`
    ).bind(...kopItemIds).all<{ tagihan_id: string }>()
    const tagIds = (itemsRes.results ?? []).map(r => r.tagihan_id)
    if (tagIds.length) {
      // 1 subrequest: aggregate semua header sekaligus
      const ph2 = tagIds.map(() => '?').join(',')
      const aggRes = await db.prepare(`
        SELECT tagihan_id,
          SUM(total_dibayar) as td, SUM(total_diskon) as tdk, SUM(nominal) as nom
        FROM fin_koperasi_tagihan_item WHERE tagihan_id IN (${ph2})
        GROUP BY tagihan_id
      `).bind(...tagIds).all<any>()
      const headerStmts = (aggRes.results ?? []).map((agg: any) =>
        db.prepare(`
          UPDATE fin_koperasi_tagihan
          SET total_dibayar=?, total_diskon=?, status=?, updated_at=datetime('now')
          WHERE id=?
        `).bind(agg.td ?? 0, agg.tdk ?? 0, recalcStatus(agg.td ?? 0, agg.tdk ?? 0, agg.nom ?? 0), agg.tagihan_id)
      )
      // 1 subrequest: batch semua header update
      if (headerStmts.length) await db.batch(headerStmts)
    }
  }
  // Total: max 7 subrequests, vs sebelumnya O(n*5)
}
