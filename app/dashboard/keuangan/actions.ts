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
  let sukses = 0; const gagal: string[] = []
  for (const row of rows) {
    // Cari siswa by NISN dulu, fallback ke nama
    let siswa: any = null
    if (row.nisn) siswa = await db.prepare('SELECT id FROM siswa WHERE nisn = ?').bind(row.nisn).first()
    if (!siswa && row.nama) siswa = await db.prepare('SELECT id FROM siswa WHERE LOWER(nama_lengkap) = LOWER(?)').bind(row.nama).first()
    if (!siswa) { gagal.push(row.nisn ?? row.nama ?? '?'); continue }
    const existing = await db.prepare('SELECT id, total_diskon FROM fin_dspt WHERE siswa_id = ?').bind(siswa.id).first<any>()
    const status = recalcStatus(row.total_dibayar, existing?.total_diskon ?? 0, row.nominal_target)
    if (existing) {
      await db.prepare(`UPDATE fin_dspt SET nominal_target=?, total_dibayar=?, status=?, catatan=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.nominal_target, row.total_dibayar, status, row.catatan ?? existing.catatan ?? null, existing.id).run()
    } else {
      await db.prepare(`INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, status, catatan) VALUES (?,?,?,?,?,?)`)
        .bind(generateId(), siswa.id, row.nominal_target, row.total_dibayar, status, row.catatan ?? null).run()
    }
    sukses++
  }
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: gagal.length ? `${gagal.length} baris gagal (siswa tidak ditemukan): ${gagal.slice(0, 5).join(', ')}` : null, success: `${sukses} data DSPT berhasil diimport`, sukses, gagal }
}

// ─── SPP Setting ────────────────────────────────────────────────────────────

export async function getSppSettings() {
  const { db } = await requireAuth('keuangan-spp')
  const result = await db.prepare('SELECT * FROM fin_spp_setting ORDER BY tingkat ASC').all<any>()
  return { data: result.results ?? [], error: null }
}

export async function updateSppSetting(tingkat: number, nominal: number, aktif: number) {
  const { db, userId } = await requireAuth('keuangan-spp')
  await db.prepare(`
    UPDATE fin_spp_setting
    SET nominal = ?, aktif = ?, updated_by = ?, updated_at = datetime('now')
    WHERE tingkat = ?
  `).bind(nominal, aktif, userId, tingkat).run()
  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: 'Pengaturan SPP berhasil disimpan' }
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

export async function generateSppBulanan(tahun: number, bulan: number, tahunMasuk?: number) {
  const { db } = await requireAuth('keuangan-spp')

  // Ambil semua setting nominal per tingkat (aktif maupun tidak — nominal tetap dipakai)
  const settings = await db.prepare('SELECT * FROM fin_spp_setting').all<any>()
  const nominalByTingkat: Record<number, number> = {}
  for (const s of settings.results ?? []) nominalByTingkat[s.tingkat] = s.nominal

  // Ambil siswa target: filter by angkatan jika dipilih
  let siswaQuery = `
    SELECT s.id AS siswa_id, k.tingkat
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE 1=1
  `
  const siswaParams: any[] = []
  if (tahunMasuk) { siswaQuery += ' AND s.tahun_masuk = ?'; siswaParams.push(tahunMasuk) }

  const siswaList = await db.prepare(siswaQuery).bind(...siswaParams).all<any>()
  if (!siswaList.results?.length) return { error: 'Tidak ada siswa ditemukan', success: null }

  // Ambil semua tagihan yang sudah ada untuk bulan+tahun ini dalam SATU query (hindari N+1)
  const existingRes = await db.prepare(
    'SELECT siswa_id FROM fin_spp_tagihan WHERE bulan = ? AND tahun = ?'
  ).bind(bulan, tahun).all<{ siswa_id: string }>()
  const existingSet = new Set((existingRes.results ?? []).map(r => r.siswa_id))

  const stmts: D1PreparedStatement[] = []
  let totalGenerated = 0

  for (const row of siswaList.results) {
    if (!existingSet.has(row.siswa_id)) {
      const nominal = nominalByTingkat[row.tingkat] ?? 0
      stmts.push(db.prepare(
        'INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal) VALUES (?, ?, ?, ?, ?)'
      ).bind(generateId(), row.siswa_id, bulan, tahun, nominal))
      totalGenerated++
    }
  }

  if (stmts.length > 0) {
    // D1 batch max ~100 — proses per chunk
    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
  }

  revalidatePath('/dashboard/keuangan/spp')
  return { error: null, success: `${totalGenerated} tagihan SPP berhasil digenerate` }
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
  let sukses = 0; const gagal: string[] = []
  for (const row of rows) {
    let siswa: any = null
    if (row.nisn) siswa = await db.prepare('SELECT id FROM siswa WHERE nisn = ?').bind(row.nisn).first()
    if (!siswa && row.nama) siswa = await db.prepare('SELECT id FROM siswa WHERE LOWER(nama_lengkap) = LOWER(?)').bind(row.nama).first()
    if (!siswa) { gagal.push(row.nisn ?? row.nama ?? '?'); continue }
    const existing = await db.prepare('SELECT id, total_diskon FROM fin_spp_tagihan WHERE siswa_id=? AND bulan=? AND tahun=?')
      .bind(siswa.id, row.bulan, row.tahun).first<any>()
    const status = recalcStatus(row.total_dibayar, existing?.total_diskon ?? 0, row.nominal)
    if (existing) {
      await db.prepare(`UPDATE fin_spp_tagihan SET nominal=?, total_dibayar=?, status=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.nominal, row.total_dibayar, status, existing.id).run()
    } else {
      await db.prepare(`INSERT INTO fin_spp_tagihan (id, siswa_id, bulan, tahun, nominal, total_dibayar, status) VALUES (?,?,?,?,?,?,?)`)
        .bind(generateId(), siswa.id, row.bulan, row.tahun, row.nominal, row.total_dibayar, status).run()
    }
    sukses++
  }
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

  const [siswa, dspt, sppTagihan, kopTagihan, transaksi, janjiList] = await Promise.all([
    db.prepare(`
      SELECT s.*, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_spp_tagihan WHERE siswa_id = ? ORDER BY tahun DESC, bulan DESC').bind(siswaId).all<any>(),
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
    sppTagihan: sppTagihan.results ?? [],
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

async function recalcTagihanStatus(db: D1Database, details: Array<{ refType: string; refId: string; jumlah: number }>) {
  for (const d of details) {
    const tabel = refTypeToTable(d.refType)
    if (!tabel) continue
    const row = await db.prepare(
      `SELECT total_dibayar, total_diskon, ${d.refType === 'dspt' ? 'nominal_target AS nominal' : 'nominal'} FROM ${tabel} WHERE id = ?`
    ).bind(d.refId).first<any>()
    if (!row) continue
    const status = recalcStatus(row.total_dibayar, row.total_diskon, row.nominal)
    await db.prepare(`UPDATE ${tabel} SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, d.refId).run()

    // Jika koperasi_item, recalc juga header tagihan koperasi
    if (d.refType === 'koperasi_item') {
      const item = await db.prepare('SELECT tagihan_id FROM fin_koperasi_tagihan_item WHERE id = ?').bind(d.refId).first<any>()
      if (item) {
        const agg = await db.prepare(`
          SELECT SUM(total_dibayar) as td, SUM(total_diskon) as tdk, SUM(nominal) as nom
          FROM fin_koperasi_tagihan_item WHERE tagihan_id = ?
        `).bind(item.tagihan_id).first<any>()
        if (agg) {
          const hStatus = recalcStatus(agg.td ?? 0, agg.tdk ?? 0, agg.nom ?? 0)
          await db.prepare(`
            UPDATE fin_koperasi_tagihan
            SET total_dibayar=?, total_diskon=?, status=?, updated_at=datetime('now')
            WHERE id=?
          `).bind(agg.td ?? 0, agg.tdk ?? 0, hStatus, item.tagihan_id).run()
        }
      }
    }
  }
}
