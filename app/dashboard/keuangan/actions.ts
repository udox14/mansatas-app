'use server'

import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import { todayWIB } from '@/lib/time'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireAuth(featureId: string) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, featureId)
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

async function requireAnyAuth(featureIds: string[]) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  for (const featureId of featureIds) {
    if (await checkFeatureAccess(db, session.user.id, featureId)) {
      return { db, userId: session.user.id }
    }
  }
  throw new Error('Forbidden')
}

function generateId() {
  return crypto.randomUUID()
}

type DsptStatus = 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada'
const DSPT_ZERO_UNINPUT_START_YEAR = 2026

function isDsptZeroUninput(
  tahunMasuk: number | string | null | undefined,
  nominal: number | null | undefined,
  totalDibayar: number | null | undefined,
  totalDiskon: number | null | undefined,
) {
  return Number(tahunMasuk || 0) >= DSPT_ZERO_UNINPUT_START_YEAR
    && Number(nominal || 0) === 0
    && Number(totalDibayar || 0) === 0
    && Number(totalDiskon || 0) === 0
}

function recalcStatus(totalDibayar: number, totalDiskon: number, nominal: number): string {
  const sisa = nominal - totalDibayar - totalDiskon
  if (sisa <= 0) return 'lunas'
  if (totalDibayar > 0) return 'nyicil'
  return 'belum_bayar'
}

function recalcDsptStatus(
  totalDibayar: number,
  totalDiskon: number,
  nominal: number,
  tahunMasuk: number | string | null | undefined,
): DsptStatus {
  if (isDsptZeroUninput(tahunMasuk, nominal, totalDibayar, totalDiskon)) return 'tidak_ada'
  return recalcStatus(totalDibayar, totalDiskon, nominal) as DsptStatus
}

async function ensurePaymentSubmissionTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS fin_payment_submissions (
      id TEXT PRIMARY KEY,
      siswa_id TEXT NOT NULL REFERENCES siswa(id),
      dspt_id TEXT NOT NULL REFERENCES fin_dspt(id),
      kategori TEXT NOT NULL DEFAULT 'dspt' CHECK(kategori IN ('dspt')),
      metode_bayar TEXT NOT NULL DEFAULT 'transfer' CHECK(metode_bayar IN ('transfer', 'qris')),
      jumlah INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'belum_upload' CHECK(status IN ('belum_upload', 'menunggu_konfirmasi', 'terkonfirmasi', 'ditolak')),
      bukti_url TEXT,
      bukti_uploaded_at TEXT,
      confirmed_by TEXT REFERENCES "user"(id),
      confirmed_at TEXT,
      rejected_by TEXT REFERENCES "user"(id),
      rejected_at TEXT,
      reject_reason TEXT,
      transaksi_id TEXT REFERENCES fin_transaksi(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

const SPP_REGULER_DISABLED_MESSAGE = 'SPP reguler dinonaktifkan. Gunakan pembayaran tunggakan awal SPP saja.'

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
      k.tingkat, k.nomor_kelas, k.kelompok,
      mb.metode_bayar_set
    FROM siswa s
    LEFT JOIN fin_dspt d ON d.siswa_id = s.id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN (
      SELECT td.ref_id, GROUP_CONCAT(DISTINCT t.metode_bayar) AS metode_bayar_set
      FROM fin_transaksi_detail td
      JOIN fin_transaksi t ON t.id = td.transaksi_id
      WHERE td.ref_type = 'dspt'
        AND t.is_void = 0
      GROUP BY td.ref_id
    ) mb ON mb.ref_id = d.id
    WHERE 1=1
  `
  const params: any[] = []
  if (filters?.angkatan && filters.angkatan !== 'semua') {
    query += ` AND s.tahun_masuk = ?`; params.push(parseInt(filters.angkatan))
  }
  query += ' ORDER BY s.nama_lengkap ASC'
  const result = await db.prepare(query).bind(...params).all<any>()
  const data = (result.results ?? []).map((row: any) => ({
    ...row,
    status: row.id
      ? recalcDsptStatus(
          Number(row.total_dibayar || 0),
          Number(row.total_diskon || 0),
          Number(row.nominal_target || 0),
          row.tahun_masuk,
        )
      : 'tidak_ada',
  }))
  return {
    data: filters?.status && filters.status !== 'semua'
      ? data.filter((row: any) => row.status === filters.status)
      : data,
    error: null,
  }
}

export async function createDspt(siswaId: string, nominalTarget: number, catatan?: string) {
  const { db } = await requireAuth('keuangan-dspt')
  const siswa = await db.prepare('SELECT tahun_masuk FROM siswa WHERE id = ?').bind(siswaId).first<any>()
  const existing = await db.prepare('SELECT id, nominal_target, total_dibayar, total_diskon FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>()
  const status = recalcDsptStatus(0, 0, nominalTarget, siswa?.tahun_masuk)
  if (existing) {
    if (!isDsptZeroUninput(siswa?.tahun_masuk, existing.nominal_target, existing.total_dibayar, existing.total_diskon)) {
      return { error: 'Siswa ini sudah memiliki tagihan DSPT', success: null }
    }
    await db.prepare(`
      UPDATE fin_dspt
      SET nominal_target = ?, total_dibayar = 0, total_diskon = 0, status = ?, catatan = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(nominalTarget, status, catatan ?? null, existing.id).run()
    revalidatePath('/dashboard/keuangan/dspt')
    revalidatePath(`/dashboard/keuangan/siswa/${siswaId}`)
    return { error: null, success: 'Tagihan DSPT berhasil dibuat' }
  }
  await db.prepare(`
    INSERT INTO fin_dspt (id, siswa_id, nominal_target, status, catatan)
    VALUES (?, ?, ?, ?, ?)
  `).bind(generateId(), siswaId, nominalTarget, status, catatan ?? null).run()
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
  const rec = await db.prepare(`
    SELECT d.total_dibayar, d.total_diskon, d.siswa_id, s.tahun_masuk
    FROM fin_dspt d
    LEFT JOIN siswa s ON s.id = d.siswa_id
    WHERE d.id = ?
  `).bind(dsptId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  const status = recalcDsptStatus(rec.total_dibayar ?? 0, rec.total_diskon ?? 0, nominalTarget, rec.tahun_masuk)
  await db.prepare(`
    UPDATE fin_dspt SET nominal_target = ?, catatan = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(nominalTarget, catatan ?? null, status, dsptId).run()
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath(`/dashboard/keuangan/siswa/${rec.siswa_id}`)
  return { error: null, success: 'Target DSPT berhasil diperbarui' }
}

export async function updateDsptPembayaran(dsptId: string, totalDibayar: number) {
  const { db } = await requireAuth('keuangan-dspt')
  const rec = await db.prepare(`
    SELECT d.nominal_target, d.total_diskon, d.siswa_id, s.tahun_masuk
    FROM fin_dspt d
    LEFT JOIN siswa s ON s.id = d.siswa_id
    WHERE d.id = ?
  `).bind(dsptId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  const status = recalcDsptStatus(totalDibayar, rec.total_diskon ?? 0, rec.nominal_target, rec.tahun_masuk)
  await db.prepare(`
    UPDATE fin_dspt SET total_dibayar = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(totalDibayar, status, dsptId).run()
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath(`/dashboard/keuangan/siswa/${rec.siswa_id}`)
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
      const status = recalcDsptStatus(ex.total_dibayar ?? 0, ex.total_diskon ?? 0, nominal, angkatan)
      stmts.push(db.prepare(`UPDATE fin_dspt SET nominal_target = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).bind(nominal, status, ex.id))
    } else {
      const status = recalcDsptStatus(0, 0, nominal, angkatan)
      stmts.push(db.prepare(`INSERT INTO fin_dspt (id, siswa_id, nominal_target, status) VALUES (?, ?, ?, ?)`).bind(generateId(), siswa_id, nominal, status))
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
  const siswaNisnMap = new Map<string, { id: string; tahun_masuk: number | null }>()  // nisn → siswa
  const siswaNamaMap = new Map<string, { id: string; tahun_masuk: number | null }>()  // nama_lower → siswa

  if (nisnList.length) {
    const ph = nisnList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, nisn, tahun_masuk FROM siswa WHERE nisn IN (${ph})`).bind(...nisnList).all<any>()
    for (const s of res.results ?? []) siswaNisnMap.set(s.nisn, { id: s.id, tahun_masuk: s.tahun_masuk })
  }
  if (namaList.length) {
    const ph = namaList.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, tahun_masuk, LOWER(nama_lengkap) as nama_l FROM siswa WHERE LOWER(nama_lengkap) IN (${ph.replace(/\?/g, 'LOWER(?)')})`).bind(...namaList).all<any>()
    for (const s of res.results ?? []) siswaNamaMap.set(s.nama_l, { id: s.id, tahun_masuk: s.tahun_masuk })
  }

  // 1 subrequest: load semua fin_dspt yang sudah ada untuk siswa ini
  const allSiswaIds = [...new Set([...siswaNisnMap.values(), ...siswaNamaMap.values()].map(s => s.id))]
  const existingMap = new Map<string, any>()  // siswa_id → fin_dspt row
  if (allSiswaIds.length) {
    const ph = allSiswaIds.map(() => '?').join(',')
    const res = await db.prepare(`SELECT id, siswa_id, total_diskon, catatan FROM fin_dspt WHERE siswa_id IN (${ph})`).bind(...allSiswaIds).all<any>()
    for (const r of res.results ?? []) existingMap.set(r.siswa_id, r)
  }

  const stmts: D1PreparedStatement[] = []
  let sukses = 0; const gagal: string[] = []

  for (const row of rows) {
    const siswaMatch = (row.nisn ? siswaNisnMap.get(row.nisn) : undefined)
      ?? (row.nama ? siswaNamaMap.get(row.nama.toLowerCase()) : undefined)
    if (!siswaMatch) { gagal.push(row.nisn ?? row.nama ?? '?'); continue }
    const siswaId = siswaMatch.id

    const existing = existingMap.get(siswaId)
    const status = recalcDsptStatus(row.total_dibayar, existing?.total_diskon ?? 0, row.nominal_target, siswaMatch.tahun_masuk)
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

// ─── DSPT Lunas Massal (Migrasi) ────────────────────────────────────────────

/** Buat record fin_dspt dengan nominal=0, status='lunas' untuk semua siswa
 *  yang BELUM punya record DSPT sama sekali. Siswa yang sudah ada datanya aman. */
export async function tandaiLunasMigrasiDspt() {
  const { db } = await requireAuth('keuangan-dspt')
  // Ambil semua siswa yang BELUM ada di fin_dspt
  const res = await db.prepare(`
    SELECT s.id FROM siswa s
    WHERE s.id NOT IN (SELECT siswa_id FROM fin_dspt)
      AND s.tahun_masuk IN (2023, 2024, 2025)
  `).all<{ id: string }>()
  const siswaList = res.results ?? []
  if (!siswaList.length) return { error: null, success: '0 siswa — semua sudah punya data DSPT', jumlah: 0 }

  const stmts = siswaList.map(({ id }) =>
    db.prepare(`
      INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, status, catatan)
      VALUES (?, ?, 0, 0, 'lunas', 'Lunas (migrasi)')
    `).bind(generateId(), id)
  )
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: `${siswaList.length} siswa berhasil ditandai lunas DSPT (migrasi)`, jumlah: siswaList.length }
}

// ─── SPP Saldo Awal (data migrasi tanpa rincian bulan) ──────────────────────

export async function setSppSaldoAwal(siswaId: string, jumlah: number, keterangan?: string) {
  const { db } = await requireAuth('keuangan-spp')
  const existing = await db.prepare('SELECT id FROM fin_spp_saldo_awal WHERE siswa_id = ?').bind(siswaId).first<any>()
  if (existing) {
    const status = jumlah <= 0 ? 'lunas' : 'belum_bayar'
    await db.prepare(`
      UPDATE fin_spp_saldo_awal SET jumlah=?, keterangan=?, status=?, updated_at=datetime('now') WHERE id=?
    `).bind(jumlah, keterangan ?? null, status, existing.id).run()
  } else {
    const status = jumlah <= 0 ? 'lunas' : 'belum_bayar'
    await db.prepare(`
      INSERT INTO fin_spp_saldo_awal (id, siswa_id, jumlah, status, keterangan)
      VALUES (?, ?, ?, ?, ?)
    `).bind(generateId(), siswaId, jumlah, status, keterangan ?? null).run()
  }
  revalidatePath(`/dashboard/keuangan/siswa/${siswaId}`)
  return { error: null, success: 'Saldo awal SPP disimpan' }
}

export async function bayarSaldoAwalSpp(saldoAwalId: string, jumlahBayar: number) {
  const { db, userId } = await requireAuth('keuangan-spp')
  const rec = await db.prepare('SELECT siswa_id, jumlah, total_dibayar FROM fin_spp_saldo_awal WHERE id = ?').bind(saldoAwalId).first<any>()
  if (!rec) return { error: 'Data tidak ditemukan', success: null }
  if (jumlahBayar <= 0) return { error: 'Jumlah bayar harus lebih dari 0', success: null }
  const currentDibayar = rec.total_dibayar ?? 0
  const sisa = Math.max(0, rec.jumlah - currentDibayar)
  if (sisa <= 0) return { error: 'Tunggakan awal SPP sudah lunas', success: null }

  const jumlahTercatat = Math.min(sisa, jumlahBayar)
  const newDibayar = currentDibayar + jumlahTercatat
  const status = newDibayar >= rec.jumlah ? 'lunas' : newDibayar > 0 ? 'nyicil' : 'belum_bayar'
  const seq = await db.prepare(
    "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
  ).first<{ counter: number }>()
  const year = Number(todayWIB().slice(0, 4))
  const nomorKuitansi = `KWT-SPP-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
  const transaksiId = generateId()

  await db.batch([
    db.prepare(`
      UPDATE fin_spp_saldo_awal SET total_dibayar=?, status=?, updated_at=datetime('now') WHERE id=?
    `).bind(newDibayar, status, saldoAwalId),
    db.prepare(`
      INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi)
      VALUES (?, ?, 'spp', 'tunai', ?, ?, ?)
    `).bind(transaksiId, rec.siswa_id, jumlahTercatat, userId, nomorKuitansi),
    db.prepare(`
      INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah)
      VALUES (?, ?, 'spp_saldo_awal', ?, ?)
    `).bind(generateId(), transaksiId, saldoAwalId, jumlahTercatat),
  ])
  revalidatePath(`/dashboard/keuangan/siswa/${rec.siswa_id}`)
  revalidatePath('/dashboard/keuangan/spp')
  revalidatePath('/dashboard/keuangan/transaksi')
  return { error: null, success: `Pembayaran ${status === 'lunas' ? '— Tunggakan awal LUNAS!' : 'berhasil dicatat'}` }
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
  void db; void siswaId; void bulan; void tahun; void nominal
  return { error: SPP_REGULER_DISABLED_MESSAGE, success: null }
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

/** Batch: buat tagihan jika belum ada, lalu tandai lunas semua bulan sekaligus — 1 batch write */
export async function simpanSppBulanTerpilih(
  siswaId: string,
  bulanList: number[],  // bulan yang dipilih
  tahun: number,
) {
  const { db } = await requireAuth('keuangan-spp')
  void db; void siswaId; void bulanList; void tahun
  return { error: SPP_REGULER_DISABLED_MESSAGE, success: null }
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
  void db; void tagihanId
  return { error: SPP_REGULER_DISABLED_MESSAGE, success: null }
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
  void db; void tagihanId; void nominal; void totalDibayar
  return { error: SPP_REGULER_DISABLED_MESSAGE, success: null }
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
  void db; void rows
  return { error: SPP_REGULER_DISABLED_MESSAGE, success: '0 tagihan SPP diimport', sukses: 0, gagal: [] }
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
    const siswaId = (row.nisn ? siswaNisnMap.get(row.nisn as string) : undefined)
      ?? (row.nama ? siswaNamaMap.get((row.nama as string).toLowerCase()) : undefined)
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
  kategori: 'dspt' | 'spp'
  metodeBayar: 'tunai' | 'transfer'
  details: Array<{ refType: string; refId: string; jumlah: number }>
}) {
  const { db, userId } = await requireAuth('keuangan-dspt')
  if (payload.kategori === 'spp' || payload.details.some(d => d.refType === 'spp_tagihan')) {
    return { error: SPP_REGULER_DISABLED_MESSAGE, success: null }
  }

  const jumlahTotal = payload.details.reduce((sum, d) => sum + d.jumlah, 0)
  if (jumlahTotal <= 0) return { error: 'Jumlah pembayaran tidak valid', success: null }

  // Generate nomor kuitansi
  const seq = await db.prepare(
    "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
  ).first<{ counter: number }>()
  const year = Number(todayWIB().slice(0, 4))
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
    if (d.refType === 'dspt') {
      stmts.push(db.prepare(`
        UPDATE fin_dspt
        SET nominal_target = MAX(COALESCE(nominal_target, 0), COALESCE(total_dibayar, 0) + ? + COALESCE(total_diskon, 0)),
            total_dibayar = COALESCE(total_dibayar, 0) + ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(d.jumlah, d.jumlah, d.refId))
    } else if (tabel) {
      stmts.push(db.prepare(`
        UPDATE ${tabel}
        SET total_dibayar = COALESCE(total_dibayar, 0) + ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(d.jumlah, d.refId))
    }
  }

  await db.batch(stmts)

  // Recalculate status (setelah batch selesai)
  await recalcTagihanStatus(db, payload.details)

  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/transaksi')
  revalidatePath(`/dashboard/keuangan/siswa/${payload.siswaId}`)
  return { error: null, success: 'Transaksi berhasil disimpan', data: { transaksiId, nomorKuitansi } }
}

export async function getPendingDsptPaymentSubmissions() {
  const { db } = await requireAuth('keuangan-dspt')
  await ensurePaymentSubmissionTable(db)
  const result = await db.prepare(`
    SELECT
      p.id, p.siswa_id, p.dspt_id, p.metode_bayar, p.jumlah, p.status,
      p.bukti_url, p.bukti_uploaded_at, p.created_at,
      s.nama_lengkap, s.nisn, s.tahun_masuk,
      k.tingkat, k.nomor_kelas, k.kelompok,
      d.nominal_target, d.total_dibayar, d.total_diskon, d.status AS dspt_status
    FROM fin_payment_submissions p
    JOIN siswa s ON s.id = p.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    JOIN fin_dspt d ON d.id = p.dspt_id
    WHERE p.kategori = 'dspt' AND p.status = 'menunggu_konfirmasi'
    ORDER BY datetime(p.bukti_uploaded_at) ASC, datetime(p.created_at) ASC
  `).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function getDsptPaymentProofSubmissions() {
  const { db } = await requireAuth('keuangan-dspt')
  await ensurePaymentSubmissionTable(db)
  const result = await db.prepare(`
    SELECT
      p.id, p.siswa_id, p.dspt_id, p.metode_bayar, p.jumlah, p.status,
      p.bukti_url, p.bukti_uploaded_at, p.created_at, p.updated_at,
      p.confirmed_at, p.rejected_at, p.reject_reason, p.transaksi_id,
      s.nama_lengkap, s.nisn, s.tahun_masuk,
      k.tingkat, k.nomor_kelas, k.kelompok,
      d.nominal_target, d.total_dibayar, d.total_diskon, d.status AS dspt_status
    FROM fin_payment_submissions p
    JOIN siswa s ON s.id = p.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    JOIN fin_dspt d ON d.id = p.dspt_id
    WHERE p.kategori = 'dspt' AND p.bukti_url IS NOT NULL AND p.bukti_url != ''
    ORDER BY datetime(COALESCE(p.bukti_uploaded_at, p.updated_at, p.created_at)) DESC
  `).all<any>()
  return { data: result.results ?? [], error: null }
}

export async function konfirmasiDsptPaymentSubmission(submissionId: string) {
  const { db, userId } = await requireAuth('keuangan-dspt')
  await ensurePaymentSubmissionTable(db)

  const submission = await db.prepare(`
    SELECT p.*, d.nominal_target, d.total_dibayar, d.total_diskon
    FROM fin_payment_submissions p
    JOIN fin_dspt d ON d.id = p.dspt_id
    WHERE p.id = ?
  `).bind(submissionId).first<any>()
  if (!submission) return { error: 'Pengajuan pembayaran tidak ditemukan', success: null }
  if (submission.status !== 'menunggu_konfirmasi') return { error: 'Bukti pembayaran belum siap dikonfirmasi', success: null }
  if (!submission.bukti_url) return { error: 'Bukti pembayaran belum diupload', success: null }

  const jumlah = Number(submission.jumlah || 0)
  if (jumlah <= 0) return { error: 'Nominal pembayaran tidak valid', success: null }

  const seq = await db.prepare(
    "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
  ).first<{ counter: number }>()
  const year = Number(todayWIB().slice(0, 4))
  const nomorKuitansi = `KWT-DSPT-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
  const transaksiId = generateId()
  const metodeBayar = submission.metode_bayar === 'qris' ? 'qris' : 'transfer'

  await db.batch([
    db.prepare(`
      INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, bukti_transfer_url, jumlah_total, input_oleh, nomor_kuitansi)
      VALUES (?, ?, 'dspt', ?, ?, ?, ?, ?)
    `).bind(transaksiId, submission.siswa_id, metodeBayar, submission.bukti_url, jumlah, userId, nomorKuitansi),
    db.prepare(`
      INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah)
      VALUES (?, ?, 'dspt', ?, ?)
    `).bind(generateId(), transaksiId, submission.dspt_id, jumlah),
    db.prepare(`
      UPDATE fin_dspt
      SET nominal_target = MAX(COALESCE(nominal_target, 0), COALESCE(total_dibayar, 0) + ? + COALESCE(total_diskon, 0)),
          total_dibayar = COALESCE(total_dibayar, 0) + ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(jumlah, jumlah, submission.dspt_id),
    db.prepare(`
      UPDATE fin_payment_submissions
      SET status = 'terkonfirmasi',
          confirmed_by = ?,
          confirmed_at = datetime('now'),
          transaksi_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(userId, transaksiId, submissionId),
  ])

  await recalcTagihanStatus(db, [{ refType: 'dspt', refId: submission.dspt_id, jumlah }])

  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/transaksi')
  revalidatePath(`/dashboard/keuangan/siswa/${submission.siswa_id}`)
  revalidatePath('/portal-ortu')
  return { error: null, success: 'Bukti pembayaran berhasil dikonfirmasi', data: { transaksiId, nomorKuitansi } }
}

export async function tolakDsptPaymentSubmission(submissionId: string, reason: string) {
  const { db, userId } = await requireAuth('keuangan-dspt')
  await ensurePaymentSubmissionTable(db)
  const alasan = reason.trim()
  if (alasan.length < 3) return { error: 'Alasan penolakan wajib diisi', success: null }

  const submission = await db.prepare('SELECT siswa_id, status FROM fin_payment_submissions WHERE id = ?').bind(submissionId).first<any>()
  if (!submission) return { error: 'Pengajuan pembayaran tidak ditemukan', success: null }
  if (submission.status === 'terkonfirmasi') return { error: 'Pengajuan sudah terkonfirmasi dan tidak bisa ditolak', success: null }

  await db.prepare(`
    UPDATE fin_payment_submissions
    SET status = 'ditolak',
        rejected_by = ?,
        rejected_at = datetime('now'),
        reject_reason = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(userId, alasan, submissionId).run()

  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/portal-ortu')
  return { error: null, success: 'Bukti pembayaran ditolak' }
}

export async function voidTransaksi(transaksiId: string, alasan: string) {
  const { db, userId } = await requireAnyAuth(['keuangan-dspt', 'keuangan-spp'])

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
        SET total_dibayar = MAX(0, COALESCE(total_dibayar, 0) - ?), updated_at = datetime('now')
        WHERE id = ?
      `).bind(d.jumlah, d.ref_id))
    }
  }

  await db.batch(stmts)
  await recalcTagihanStatus(db, (details.results ?? []).map(d => ({ refType: d.ref_type, refId: d.ref_id, jumlah: d.jumlah })))

  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/transaksi')
  if (trx.siswa_id) revalidatePath(`/dashboard/keuangan/siswa/${trx.siswa_id}`)
  return { error: null, success: 'Transaksi berhasil di-void' }
}

// ─── Diskon ─────────────────────────────────────────────────────────────────

export async function beriDiskon(payload: {
  siswaId: string
  targetType: 'dspt' | 'spp_tagihan'
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
    SET total_diskon = COALESCE(total_diskon, 0) + ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(payload.jumlah, payload.targetId).run()

  await recalcTagihanStatus(db, [{ refType: payload.targetType, refId: payload.targetId, jumlah: 0 }])

  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  return { error: null, success: 'Keringanan berhasil diberikan' }
}

export async function batalkanDiskon(diskonId: string) {
  const { db } = await requireAuth('keuangan-dspt')

  const diskon = await db.prepare('SELECT * FROM fin_diskon WHERE id = ?').bind(diskonId).first<any>()
  if (!diskon) return { error: 'Data keringanan tidak ditemukan', success: null }

  const tabel = refTypeToTable(diskon.target_type)
  if (!tabel) return { error: 'Target keringanan tidak valid', success: null }

  await db.batch([
    db.prepare(`
      UPDATE ${tabel}
      SET total_diskon = MAX(0, COALESCE(total_diskon, 0) - ?), updated_at = datetime('now')
      WHERE id = ?
    `).bind(diskon.jumlah, diskon.target_id),
    db.prepare('DELETE FROM fin_diskon WHERE id = ?').bind(diskonId),
  ])

  await recalcTagihanStatus(db, [{ refType: diskon.target_type, refId: diskon.target_id, jumlah: 0 }])

  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath(`/dashboard/keuangan/siswa/${diskon.siswa_id}`)
  return { error: null, success: 'Keringanan berhasil dibatalkan' }
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
  const { db } = await requireAuth('keuangan-laporan')
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
  const { db } = await requireAuth('keuangan-laporan')
  const tahun = tahunAjaran ? parseInt(tahunAjaran) : Number(todayWIB().slice(0, 4))

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
  const { db } = await requireAnyAuth(['keuangan-dspt', 'keuangan-spp'])

  const [siswa, dspt, sppTagihan, sppMulaiRow, sppSaldoAwal, transaksi, janjiList, diskonList] = await Promise.all([
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
    db.prepare('SELECT * FROM fin_spp_saldo_awal WHERE siswa_id = ?').bind(siswaId).first<any>(),
    db.prepare(`
      SELECT t.*, u.nama_lengkap as nama_input
      FROM fin_transaksi t
      LEFT JOIN "user" u ON u.id = t.input_oleh
      WHERE t.siswa_id = ?
      ORDER BY t.created_at DESC
    `).bind(siswaId).all<any>(),
    db.prepare('SELECT * FROM fin_janji_bayar WHERE siswa_id = ? ORDER BY tanggal_janji ASC').bind(siswaId).all<any>(),
    db.prepare(`
      SELECT d.*, u.nama_lengkap AS nama_pembuat
      FROM fin_diskon d
      LEFT JOIN "user" u ON u.id = d.dibuat_oleh
      WHERE d.siswa_id = ?
      ORDER BY d.created_at DESC
    `).bind(siswaId).all<any>(),
  ])

  // SPP reguler sedang dinonaktifkan; hanya tunggakan awal yang ditagih.
  // Blok lama dipertahankan tidak aktif agar data lama masih bisa dibaca tanpa membuat tagihan baru.
  let freshSppTagihan = sppTagihan.results ?? []
  if (false && sppMulaiRow && siswa) {
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

  const transaksiRows = transaksi.results ?? []
  if (sppSaldoAwal && (sppSaldoAwal.total_dibayar ?? 0) > 0) {
    const recorded = await db.prepare(`
      SELECT SUM(CASE WHEN t.is_void = 0 THEN d.jumlah ELSE 0 END) AS total_recorded
      FROM fin_transaksi_detail d
      JOIN fin_transaksi t ON t.id = d.transaksi_id
      WHERE d.ref_type = 'spp_saldo_awal' AND d.ref_id = ?
    `).bind(sppSaldoAwal.id).first<{ total_recorded: number | null }>()
    const unrecorded = (sppSaldoAwal.total_dibayar ?? 0) - (recorded?.total_recorded ?? 0)
    if (unrecorded > 0) {
      transaksiRows.push({
        id: `spp-saldo-awal-${sppSaldoAwal.id}`,
        nomor_kuitansi: `SPP-AWAL-${String(sppSaldoAwal.id).slice(0, 8)}`,
        siswa_id: siswaId,
        kategori: 'spp',
        metode_bayar: 'tunai',
        jumlah_total: unrecorded,
        is_void: 0,
        void_alasan: null,
        created_at: sppSaldoAwal.updated_at ?? sppSaldoAwal.created_at,
        nama_input: 'Sistem',
        is_synthetic: 1,
      })
      transaksiRows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
  }

  const effectiveDspt = dspt
    ? {
        ...dspt,
        status: recalcDsptStatus(
          Number(dspt.total_dibayar || 0),
          Number(dspt.total_diskon || 0),
          Number(dspt.nominal_target || 0),
          siswa?.tahun_masuk,
        ),
      }
    : null

  return {
    siswa,
    dspt: effectiveDspt,
    sppTagihan: freshSppTagihan,
    sppMulai: sppMulaiRow ?? null,
    sppSaldoAwal: sppSaldoAwal ?? null,
    kopTagihan: null,
    kopItems: [],
    transaksi: transaksiRows,
    janjiList: janjiList.results ?? [],
    diskonList: diskonList.results ?? [],
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
    case 'spp_saldo_awal': return 'fin_spp_saldo_awal'
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
  // 1 subrequest per tipe (max 2 tipe: dspt, spp_tagihan)
  for (const [refType, ids] of byType) {
    const tabel = refTypeToTable(refType)
    if (!tabel) continue
    const ph = ids.map(() => '?').join(',')
    const nomField = refType === 'dspt'
      ? 't.nominal_target AS nominal'
      : refType === 'spp_saldo_awal'
        ? 'jumlah AS nominal'
        : 'nominal'
    const diskonField = refType === 'spp_saldo_awal' ? '0 AS total_diskon' : 'total_diskon'
    const query = refType === 'dspt'
      ? `SELECT t.id, t.total_dibayar, t.total_diskon, ${nomField}, s.tahun_masuk
         FROM fin_dspt t
         LEFT JOIN siswa s ON s.id = t.siswa_id
         WHERE t.id IN (${ph})`
      : `SELECT id, total_dibayar, ${diskonField}, ${nomField} FROM ${tabel} WHERE id IN (${ph})`
    const res = await db.prepare(query).bind(...ids).all<any>()
    for (const row of res.results ?? []) {
      updateStmts.push(db.prepare(
        `UPDATE ${tabel} SET status=?, updated_at=datetime('now') WHERE id=?`
      ).bind(
        refType === 'dspt'
          ? recalcDsptStatus(row.total_dibayar, row.total_diskon, row.nominal, row.tahun_masuk)
          : recalcStatus(row.total_dibayar, row.total_diskon, row.nominal),
        row.id,
      ))
    }
  }

  // 1 subrequest: batch semua status update sekaligus
  if (updateStmts.length) await db.batch(updateStmts)

  // Total: max 3 subrequests
}
