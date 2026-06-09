'use server'

import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import { dateInputWIB, todayWIB } from '@/lib/time'
import { getKuitansiTahunAjaran } from '@/lib/tahun-ajaran'
import type { KuitansiData } from '../components/kuitansi-print'

function generateId() { return crypto.randomUUID() }

function recalcStatusVal(totalDibayar: number, totalDiskon: number, nominal: number): string {
  const sisa = nominal - totalDibayar - totalDiskon
  if (sisa <= 0) return 'lunas'
  if (totalDibayar > 0) return 'nyicil'
  return 'belum_bayar'
}

async function requireAuth() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-daftar-ulang')
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

async function recalcItem(db: D1Database, refId: string) {
  const row = await db.prepare(
    'SELECT total_dibayar, total_diskon, nominal_target AS nominal FROM fin_dspt WHERE id = ?'
  ).bind(refId).first<any>()
  if (!row) return
  const status = recalcStatusVal(row.total_dibayar, row.total_diskon, row.nominal)
  await db.prepare("UPDATE fin_dspt SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, refId).run()
}

async function logDsptNominalAudit(db: D1Database, payload: {
  dsptId: string
  siswaId: string
  oldValue: number | null
  newValue: number
  action: 'create' | 'update'
  userId: string
}) {
  if (payload.action === 'update' && payload.oldValue === payload.newValue) return
  await db.prepare(`
    INSERT INTO fin_dspt_audit_log (
      id, dspt_id, siswa_id, field_name, old_value, new_value, action, source, dibuat_oleh
    )
    VALUES (?, ?, ?, 'nominal_target', ?, ?, ?, 'kasir_daftar_ulang', ?)
  `).bind(
    generateId(),
    payload.dsptId,
    payload.siswaId,
    payload.oldValue,
    payload.newValue,
    payload.action,
    payload.userId,
  ).run()
}

export interface DaftarUlangParams {
  siswaId: string
  tahunAjaranId: string
  dspt: {
    nominalTarget: number
    bayarSekarang: number
    metode: 'tunai' | 'transfer'
    diskon: number
    alasanDiskon: string
    existingDsptId: string | null
  }
}

export interface DaftarUlangResult {
  error: string | null
  kuitansiDspt: KuitansiData | null
}

export interface SiswaBaruDsptPageParams {
  page?: number
  pageSize?: number | 'semua'
  q?: string
}

export interface DaftarUlangTransaksiPageParams {
  page?: number
  pageSize?: number | 'semua'
  q?: string
  status?: 'aktif' | 'void' | 'semua'
}

function siswaBaruWhere(q?: string) {
  const params: any[] = []
  let where = "WHERE s.kelas_id IS NULL AND s.status = 'aktif'"
  if (q?.trim()) {
    where += ' AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ? OR s.asal_sekolah LIKE ?)'
    const term = `%${q.trim()}%`
    params.push(term, term, term)
  }
  return { where, params }
}

function revalidateDsptViews(siswaId?: string) {
  revalidatePath('/dashboard/keuangan')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/transaksi')
  revalidatePath('/dashboard/keuangan/daftar-ulang')
  if (siswaId) revalidatePath(`/dashboard/keuangan/siswa/${siswaId}`)
}

async function getTahunAjaranNama(db: D1Database, tahunAjaranId?: string | null) {
  if (tahunAjaranId) {
    const selected = await db.prepare('SELECT nama FROM tahun_ajaran WHERE id = ? LIMIT 1')
      .bind(tahunAjaranId)
      .first<{ nama: string | null }>()
    if (selected?.nama) return selected.nama
  }

  const active = await db.prepare('SELECT nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ nama: string | null }>()
  return active?.nama ?? '-'
}

export async function searchSiswaBaruDaftarUlang(q: string) {
  const { db } = await requireAuth()
  if (!q || q.trim().length < 2) return { data: [] }
  const term = `%${q.trim()}%`
  const result = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn,
           NULL AS tingkat, NULL AS nomor_kelas, NULL AS kelompok,
           s.tahun_masuk
    FROM siswa s
    WHERE s.kelas_id IS NULL
      AND s.status = 'aktif'
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap ASC
    LIMIT 20
  `).bind(term, term).all<any>()
  return { data: result.results ?? [] }
}

export async function getSiswaBaruDsptPage(params: SiswaBaruDsptPageParams = {}) {
  const { db } = await requireAuth()
  const page = Math.max(1, params.page ?? 1)
  const pageSize = params.pageSize ?? 25
  const { where, params: whereParams } = siswaBaruWhere(params.q)

  const totalRow = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM siswa s
    ${where}
  `).bind(...whereParams).first<{ total: number }>()

  let query = `
    SELECT
      s.id AS siswa_id, s.nama_lengkap, s.nisn, s.jenis_kelamin,
      s.asal_sekolah, s.tahun_masuk,
      d.id AS dspt_id, d.nominal_target, d.total_dibayar, d.total_diskon,
      COALESCE(d.status, 'tidak_ada') AS status
    FROM siswa s
    LEFT JOIN fin_dspt d ON d.siswa_id = s.id
    ${where}
    ORDER BY s.nama_lengkap ASC
  `
  const bindParams = [...whereParams]
  if (pageSize !== 'semua') {
    const size = Math.max(1, pageSize)
    query += ' LIMIT ? OFFSET ?'
    bindParams.push(size, (page - 1) * size)
  }

  const result = await db.prepare(query).bind(...bindParams).all<any>()
  return {
    data: result.results ?? [],
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    error: null,
  }
}

export async function upsertSiswaBaruDsptTarget(siswaId: string, nominalTarget: number) {
  const { db, userId } = await requireAuth()
  const siswa = await db.prepare(`
    SELECT id
    FROM siswa
    WHERE id = ? AND kelas_id IS NULL AND status = 'aktif'
  `).bind(siswaId).first<{ id: string }>()
  if (!siswa) return { error: 'Siswa baru tidak ditemukan atau sudah memiliki kelas', data: null }

  const nominal = Math.max(0, nominalTarget || 0)
  const existing = await db.prepare(`
    SELECT id, nominal_target, total_dibayar, total_diskon
    FROM fin_dspt
    WHERE siswa_id = ?
  `).bind(siswaId).first<any>()

  let dsptId = existing?.id as string | undefined
  const oldNominal = existing ? Number(existing.nominal_target ?? 0) : null
  const status = recalcStatusVal(existing?.total_dibayar ?? 0, existing?.total_diskon ?? 0, nominal)
  if (dsptId) {
    await db.prepare(`
      UPDATE fin_dspt
      SET nominal_target = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(nominal, status, dsptId).run()
  } else {
    dsptId = generateId()
    await db.prepare(`
      INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, total_diskon, status)
      VALUES (?, ?, ?, 0, 0, ?)
    `).bind(dsptId, siswaId, nominal, status).run()
  }

  await logDsptNominalAudit(db, {
    dsptId,
    siswaId,
    oldValue: oldNominal,
    newValue: nominal,
    action: oldNominal === null ? 'create' : 'update',
    userId,
  })

  const row = await db.prepare(`
    SELECT
      s.id AS siswa_id, s.nama_lengkap, s.nisn, s.jenis_kelamin,
      s.asal_sekolah, s.tahun_masuk,
      d.id AS dspt_id, d.nominal_target, d.total_dibayar, d.total_diskon,
      d.status
    FROM siswa s
    JOIN fin_dspt d ON d.siswa_id = s.id
    WHERE s.id = ?
  `).bind(siswaId).first<any>()

  revalidateDsptViews(siswaId)
  return { error: null, data: row }
}

export async function getDaftarUlangTransaksiPage(params: DaftarUlangTransaksiPageParams = {}) {
  const { db } = await requireAuth()
  const page = Math.max(1, params.page ?? 1)
  const pageSize = params.pageSize ?? 25
  const status = params.status ?? 'aktif'
  const whereParts = ["t.kategori = 'dspt'"]
  const bindParams: any[] = []

  if (status === 'aktif') whereParts.push('t.is_void = 0')
  if (status === 'void') whereParts.push('t.is_void = 1')
  if (params.q?.trim()) {
    whereParts.push('(s.nama_lengkap LIKE ? OR s.nisn LIKE ? OR t.nomor_kuitansi LIKE ?)')
    const term = `%${params.q.trim()}%`
    bindParams.push(term, term, term)
  }
  const where = `WHERE ${whereParts.join(' AND ')}`

  const totalRow = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM fin_transaksi t
    JOIN siswa s ON s.id = t.siswa_id
    ${where}
  `).bind(...bindParams).first<{ total: number }>()

  let query = `
    SELECT
      t.id, t.nomor_kuitansi, t.siswa_id, t.kategori, t.metode_bayar,
      t.jumlah_total, t.is_void, t.void_at, t.void_alasan, t.created_at,
      s.nama_lengkap, s.nisn,
      input_user.nama_lengkap AS nama_input,
      void_user.nama_lengkap AS nama_void
    FROM fin_transaksi t
    JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN "user" input_user ON input_user.id = t.input_oleh
    LEFT JOIN "user" void_user ON void_user.id = t.void_oleh
    ${where}
    ORDER BY t.created_at DESC
  `
  const queryParams = [...bindParams]
  if (pageSize !== 'semua') {
    const size = Math.max(1, pageSize)
    query += ' LIMIT ? OFFSET ?'
    queryParams.push(size, (page - 1) * size)
  }

  const result = await db.prepare(query).bind(...queryParams).all<any>()
  return {
    data: result.results ?? [],
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    error: null,
  }
}

export async function voidDaftarUlangTransaksi(transaksiId: string, alasan: string) {
  const { db, userId } = await requireAuth()
  const cleanAlasan = alasan.trim()
  if (cleanAlasan.length < 5) return { error: 'Alasan void wajib diisi minimal 5 karakter', success: null }

  const trx = await db.prepare(`
    SELECT *
    FROM fin_transaksi
    WHERE id = ? AND kategori = 'dspt'
  `).bind(transaksiId).first<any>()
  if (!trx) return { error: 'Transaksi daftar ulang tidak ditemukan', success: null }
  if (trx.is_void) return { error: 'Transaksi sudah di-void sebelumnya', success: null }

  const details = await db.prepare(`
    SELECT *
    FROM fin_transaksi_detail
    WHERE transaksi_id = ? AND ref_type = 'dspt'
  `).bind(transaksiId).all<any>()
  const detailRows = details.results ?? []
  if (!detailRows.length) return { error: 'Detail transaksi DSPT tidak ditemukan', success: null }

  const stmts: D1PreparedStatement[] = [
    db.prepare(`
      UPDATE fin_transaksi
      SET is_void = 1, void_at = datetime('now'), void_oleh = ?, void_alasan = ?
      WHERE id = ?
    `).bind(userId, cleanAlasan, transaksiId),
  ]

  for (const detail of detailRows) {
    stmts.push(db.prepare(`
      UPDATE fin_dspt
      SET total_dibayar = MAX(0, COALESCE(total_dibayar, 0) - ?), updated_at = datetime('now')
      WHERE id = ?
    `).bind(detail.jumlah, detail.ref_id))
  }

  await db.batch(stmts)
  for (const detail of detailRows) await recalcItem(db, detail.ref_id)

  revalidateDsptViews(trx.siswa_id)
  return { error: null, success: 'Transaksi berhasil di-void' }
}

export async function getDaftarUlangSiswaData(siswaId: string, tahunAjaranId: string) {
  const { db } = await requireAuth()
  void tahunAjaranId

  const [siswa, dspt] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, s.tahun_masuk,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
        AND s.kelas_id IS NULL
        AND s.status = 'aktif'
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>(),
  ])

  return { siswa, dspt, error: null }
}

export async function getDaftarUlangKuitansi(transaksiId: string): Promise<{ error: string | null; data: KuitansiData | null }> {
  const { db } = await requireAuth()

  const trx = await db.prepare(`
    SELECT
      t.id, t.nomor_kuitansi, t.metode_bayar, t.jumlah_total, t.created_at, t.is_void,
      s.nama_lengkap, s.nisn,
      k.tingkat, k.nomor_kelas, k.kelompok,
      input_user.nama_lengkap AS nama_input
    FROM fin_transaksi t
    JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN "user" input_user ON input_user.id = t.input_oleh
    WHERE t.id = ? AND t.kategori = 'dspt'
    LIMIT 1
  `).bind(transaksiId).first<any>()

  if (!trx) return { error: 'Transaksi daftar ulang tidak ditemukan', data: null }
  if (trx.is_void) return { error: 'Transaksi void tidak bisa dicetak ulang', data: null }

  const detail = await db.prepare(`
    SELECT d.jumlah, dspt.nominal_target, dspt.total_dibayar, dspt.total_diskon, dspt.status
    FROM fin_transaksi_detail d
    JOIN fin_dspt dspt ON dspt.id = d.ref_id
    WHERE d.transaksi_id = ? AND d.ref_type = 'dspt'
    LIMIT 1
  `).bind(transaksiId).first<any>()

  const kelas = trx.tingkat
    ? `${trx.tingkat}-${trx.nomor_kelas}${trx.kelompok ? ' ' + trx.kelompok : ''}`
    : '-'
  const sisa = Math.max(
    0,
    Number(detail?.nominal_target ?? 0) - Number(detail?.total_dibayar ?? 0) - Number(detail?.total_diskon ?? 0),
  )
  const jumlah = Number(detail?.jumlah ?? trx.jumlah_total ?? 0)
  const tahunAjaranAktif = await getTahunAjaranNama(db)
  const tahunAjaran = getKuitansiTahunAjaran(tahunAjaranAktif, Boolean(trx.tingkat))

  return {
    error: null,
    data: {
      nomorKuitansi: trx.nomor_kuitansi,
      tanggal: dateInputWIB(trx.created_at),
      kategori: 'DSPT',
      tahunAjaran,
      namaSiswa: trx.nama_lengkap,
      nisn: trx.nisn ?? '-',
      kelas,
      namaPerugas: trx.nama_input?.trim() || 'Petugas',
      jabatanPenerima: 'Petugas',
      metodeBayar: trx.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan: jumlah,
      jumlahTagihan: jumlah,
      targetTagihan: Number(detail?.nominal_target ?? 0),
      sisaTagihan: sisa,
      rincianBayar: [{ label: 'DSPT - Dana Sumbangan Pendidikan Tahunan', nominal: jumlah }],
      sisaTunggakan: sisa > 0 ? [{ label: 'Sisa DSPT', sisa }] : [],
      isLunas: detail?.status === 'lunas',
    },
  }
}

export async function processDaftarUlang(
  params: DaftarUlangParams,
): Promise<DaftarUlangResult> {
  const { db, userId } = await requireAuth()

  try {
    const tanggal = todayWIB()
    const year = Number(tanggal.slice(0, 4))
    const tahunAjaranAktif = await getTahunAjaranNama(db, params.tahunAjaranId)

    const siswa = await db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, s.tahun_masuk,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
        AND s.kelas_id IS NULL
        AND s.status = 'aktif'
    `).bind(params.siswaId).first<any>()
    if (!siswa) return { error: 'Siswa baru tidak ditemukan atau sudah memiliki kelas', kuitansiDspt: null }

    const kelas = siswa.tingkat
      ? `${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'
    const petugas = await db.prepare('SELECT nama_lengkap FROM "user" WHERE id = ?').bind(userId).first<{ nama_lengkap: string | null }>()
    const namaPetugas = petugas?.nama_lengkap?.trim() || 'Petugas'

    let nomorDspt: string | null = null
    if (params.dspt.bayarSekarang > 0) {
      const seq = await db.prepare(
        "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
      ).first<{ counter: number }>()
      nomorDspt = `KWT-DSPT-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
    }

    const stmts: D1PreparedStatement[] = []

    let dsptId = params.dspt.existingDsptId
    let oldNominal: number | null = null
    if (!dsptId) {
      dsptId = generateId()
      stmts.push(db.prepare(
        'INSERT INTO fin_dspt (id, siswa_id, nominal_target) VALUES (?, ?, ?)'
      ).bind(dsptId, params.siswaId, params.dspt.nominalTarget))
    } else {
      const existingDspt = await db.prepare(`
        SELECT nominal_target, total_dibayar, total_diskon
        FROM fin_dspt
        WHERE id = ?
      `).bind(dsptId).first<any>()
      oldNominal = existingDspt ? Number(existingDspt.nominal_target ?? 0) : null
      const sisaSetelahTarget = Math.max(
        0,
        Number(params.dspt.nominalTarget || 0) -
          Number(existingDspt?.total_dibayar || 0) -
          Number(existingDspt?.total_diskon || 0),
      )
      if (sisaSetelahTarget <= 0 && params.dspt.bayarSekarang <= 0) {
        return { error: 'DSPT sudah lunas. Kasir tidak bisa mencetak kuitansi baru tanpa pembayaran baru.', kuitansiDspt: null }
      }
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET nominal_target = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.nominalTarget, dsptId))
    }

    if (params.dspt.diskon > 0) {
      stmts.push(db.prepare(
        "INSERT INTO fin_diskon (id, siswa_id, target_type, target_id, jumlah, alasan, dibuat_oleh) VALUES (?, ?, 'dspt', ?, ?, ?, ?)"
      ).bind(
        generateId(),
        params.siswaId,
        dsptId,
        params.dspt.diskon,
        params.dspt.alasanDiskon || 'Keringanan daftar ulang',
        userId,
      ))
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET total_diskon = COALESCE(total_diskon, 0) + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.diskon, dsptId))
    }

    if (params.dspt.bayarSekarang > 0 && nomorDspt) {
      const transaksiDsptId = generateId()
      stmts.push(db.prepare(
        'INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        transaksiDsptId,
        params.siswaId,
        'dspt',
        params.dspt.metode,
        params.dspt.bayarSekarang,
        userId,
        nomorDspt,
      ))
      stmts.push(db.prepare(
        "INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah) VALUES (?, ?, 'dspt', ?, ?)"
      ).bind(generateId(), transaksiDsptId, dsptId, params.dspt.bayarSekarang))
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET total_dibayar = COALESCE(total_dibayar, 0) + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.bayarSekarang, dsptId))
    }

    if (stmts.length > 0) await db.batch(stmts)
    await logDsptNominalAudit(db, {
      dsptId,
      siswaId: params.siswaId,
      oldValue: oldNominal,
      newValue: params.dspt.nominalTarget,
      action: oldNominal === null ? 'create' : 'update',
      userId,
    })
    if (dsptId) await recalcItem(db, dsptId)

    if (!params.dspt.existingDsptId && params.dspt.bayarSekarang === 0 && dsptId) {
      await db.prepare("UPDATE fin_dspt SET status='belum_bayar' WHERE id = ?").bind(dsptId).run()
    }

    revalidateDsptViews(params.siswaId)

    let kuitansiDspt: KuitansiData | null = null
    if (nomorDspt && dsptId) {
      const dsptRow = await db.prepare('SELECT * FROM fin_dspt WHERE id = ?').bind(dsptId).first<any>()
      const sisa = (dsptRow?.nominal_target ?? 0) - (dsptRow?.total_dibayar ?? 0) - (dsptRow?.total_diskon ?? 0)
      kuitansiDspt = {
        nomorKuitansi: nomorDspt,
        tanggal,
        kategori: 'DSPT',
        tahunAjaran: getKuitansiTahunAjaran(tahunAjaranAktif, Boolean(siswa.tingkat)),
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: namaPetugas,
        jabatanPenerima: 'Petugas',
        metodeBayar: params.dspt.metode === 'tunai' ? 'Tunai' : 'Transfer Bank',
        jumlahDiserahkan: params.dspt.bayarSekarang,
        jumlahTagihan: params.dspt.bayarSekarang,
        targetTagihan: Number(dsptRow?.nominal_target ?? 0),
        sisaTagihan: Math.max(0, sisa),
        rincianBayar: [{ label: 'DSPT - Dana Sumbangan Pendidikan Tahunan', nominal: params.dspt.bayarSekarang }],
        sisaTunggakan: sisa > 0 ? [{ label: 'Sisa DSPT', sisa }] : [],
        isLunas: dsptRow?.status === 'lunas',
      }
    }

    return { error: null, kuitansiDspt }
  } catch (e: any) {
    console.error('[processDaftarUlang]', e)
    return { error: e.message ?? 'Terjadi kesalahan sistem', kuitansiDspt: null }
  }
}
