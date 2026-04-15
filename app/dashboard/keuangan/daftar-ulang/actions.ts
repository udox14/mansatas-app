'use server'

import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import type { KuitansiData } from '../components/kuitansi-print'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

async function recalcItem(db: D1Database, refType: string, refId: string) {
  const tabelMap: Record<string, string> = {
    dspt: 'fin_dspt',
    spp_tagihan: 'fin_spp_tagihan',
    koperasi_item: 'fin_koperasi_tagihan_item',
  }
  const tabel = tabelMap[refType]
  if (!tabel) return
  const row = await db.prepare(
    `SELECT total_dibayar, total_diskon, ${refType === 'dspt' ? 'nominal_target AS nominal' : 'nominal'} FROM ${tabel} WHERE id = ?`
  ).bind(refId).first<any>()
  if (!row) return
  const status = recalcStatusVal(row.total_dibayar, row.total_diskon, row.nominal)
  await db.prepare(`UPDATE ${tabel} SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, refId).run()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KopItemParam {
  masterItemId: string
  namaItem: string
  nominal: number
  bayarSekarang: number
  diskon: number
  existingItemId: string | null
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
  koperasi: {
    items: KopItemParam[]
    metode: 'tunai' | 'transfer'
    existingTagihanId: string | null
    buatTagihanBaru: boolean
  }
}

export interface DaftarUlangResult {
  error: string | null
  kuitansiDspt: KuitansiData | null
  kuitansiKoperasi: KuitansiData | null
}

// ─── Query data siswa untuk form daftar ulang ─────────────────────────────────

export async function getDaftarUlangSiswaData(siswaId: string, tahunAjaranId: string) {
  const { db } = await requireAuth()

  const [siswa, dspt, kopTagihan] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, s.tahun_masuk,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>(),
    db.prepare(
      'SELECT * FROM fin_koperasi_tagihan WHERE siswa_id = ? AND tahun_ajaran_id = ?'
    ).bind(siswaId, tahunAjaranId).first<any>(),
  ])

  let kopItems: any[] = []
  if (kopTagihan) {
    const items = await db.prepare(
      'SELECT * FROM fin_koperasi_tagihan_item WHERE tagihan_id = ? ORDER BY nama_item ASC'
    ).bind(kopTagihan.id).all<any>()
    kopItems = items.results ?? []
  }

  return { siswa, dspt, kopTagihan, kopItems, error: null }
}

// ─── Process Daftar Ulang (atomic) ───────────────────────────────────────────

export async function processDaftarUlang(
  params: DaftarUlangParams,
  namaKomite: string,
  namaKoperasiPerugas: string,
): Promise<DaftarUlangResult> {
  const { db, userId } = await requireAuth()

  try {
    const year = new Date().getFullYear()
    const tanggal = new Date().toISOString().slice(0, 10)

    // ── Fetch siswa info ──────────────────────────────────────────────────────
    const siswa = await db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, s.tahun_masuk,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(params.siswaId).first<any>()
    if (!siswa) return { error: 'Siswa tidak ditemukan', kuitansiDspt: null, kuitansiKoperasi: null }

    const kelas = siswa.tingkat
      ? `${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    // ── Generate nomor kuitansi SEBELUM batch (butuh RETURNING) ──────────────
    let nomorDspt: string | null = null
    let nomorKoperasi: string | null = null

    if (params.dspt.bayarSekarang > 0) {
      const seq = await db.prepare(
        "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
      ).first<{ counter: number }>()
      nomorDspt = `KWT-DSPT-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
    }

    const kopItemsWithBayar = params.koperasi.items.filter(i => i.bayarSekarang > 0)
    if (kopItemsWithBayar.length > 0) {
      const seq = await db.prepare(
        "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
      ).first<{ counter: number }>()
      nomorKoperasi = `KWT-KOP-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
    }

    // ── Build batch statements ────────────────────────────────────────────────
    const stmts: D1PreparedStatement[] = []

    // ─ DSPT tagihan ─
    let dsptId = params.dspt.existingDsptId
    if (!dsptId) {
      dsptId = generateId()
      stmts.push(db.prepare(
        'INSERT INTO fin_dspt (id, siswa_id, nominal_target) VALUES (?, ?, ?)'
      ).bind(dsptId, params.siswaId, params.dspt.nominalTarget))
    } else {
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET nominal_target = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.nominalTarget, dsptId))
    }

    // ─ Diskon DSPT ─
    if (params.dspt.diskon > 0) {
      stmts.push(db.prepare(
        "INSERT INTO fin_diskon (id, siswa_id, target_type, target_id, jumlah, alasan, dibuat_oleh) VALUES (?, ?, 'dspt', ?, ?, ?, ?)"
      ).bind(generateId(), params.siswaId, dsptId, params.dspt.diskon,
        params.dspt.alasanDiskon || 'Keringanan daftar ulang', userId))
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET total_diskon = total_diskon + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.diskon, dsptId))
    }

    // ─ Transaksi DSPT ─
    const transaksiDsptId = generateId()
    if (params.dspt.bayarSekarang > 0 && nomorDspt) {
      stmts.push(db.prepare(
        'INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(transaksiDsptId, params.siswaId, 'dspt', params.dspt.metode,
        params.dspt.bayarSekarang, userId, nomorDspt))
      stmts.push(db.prepare(
        "INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah) VALUES (?, ?, 'dspt', ?, ?)"
      ).bind(generateId(), transaksiDsptId, dsptId, params.dspt.bayarSekarang))
      stmts.push(db.prepare(
        "UPDATE fin_dspt SET total_dibayar = total_dibayar + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.bayarSekarang, dsptId))
    }

    // ─ Koperasi tagihan baru ─
    let kopTagihanId = params.koperasi.existingTagihanId
    const itemIdMap: Record<string, string> = {} // masterItemId → itemId di DB

    if (params.koperasi.buatTagihanBaru && !kopTagihanId && params.koperasi.items.length > 0) {
      kopTagihanId = generateId()
      const totalNominal = params.koperasi.items.reduce((s, i) => s + i.nominal, 0)
      stmts.push(db.prepare(
        'INSERT INTO fin_koperasi_tagihan (id, siswa_id, tahun_ajaran_id, total_nominal) VALUES (?, ?, ?, ?)'
      ).bind(kopTagihanId, params.siswaId, params.tahunAjaranId, totalNominal))

      for (const item of params.koperasi.items) {
        const itemId = generateId()
        itemIdMap[item.masterItemId] = itemId
        stmts.push(db.prepare(
          'INSERT INTO fin_koperasi_tagihan_item (id, tagihan_id, master_item_id, nama_item, nominal) VALUES (?, ?, ?, ?, ?)'
        ).bind(itemId, kopTagihanId, item.masterItemId, item.namaItem, item.nominal))
      }
    } else {
      // Map existing item IDs
      for (const item of params.koperasi.items) {
        if (item.existingItemId) itemIdMap[item.masterItemId] = item.existingItemId
      }
    }

    // ─ Diskon per item koperasi ─
    for (const item of params.koperasi.items) {
      const itemId = itemIdMap[item.masterItemId]
      if (!itemId || item.diskon <= 0) continue
      stmts.push(db.prepare(
        "INSERT INTO fin_diskon (id, siswa_id, target_type, target_id, jumlah, alasan, dibuat_oleh) VALUES (?, ?, 'koperasi_item', ?, ?, 'Keringanan daftar ulang', ?)"
      ).bind(generateId(), params.siswaId, itemId, item.diskon, userId))
      stmts.push(db.prepare(
        "UPDATE fin_koperasi_tagihan_item SET total_diskon = total_diskon + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(item.diskon, itemId))
    }

    // ─ Transaksi koperasi ─
    const transaksiKopId = generateId()
    const kopDetailsForRecalc: string[] = []

    if (kopItemsWithBayar.length > 0 && nomorKoperasi && kopTagihanId) {
      const totalKop = kopItemsWithBayar.reduce((s, i) => s + i.bayarSekarang, 0)
      stmts.push(db.prepare(
        'INSERT INTO fin_transaksi (id, siswa_id, kategori, metode_bayar, jumlah_total, input_oleh, nomor_kuitansi) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(transaksiKopId, params.siswaId, 'koperasi', params.koperasi.metode,
        totalKop, userId, nomorKoperasi))

      for (const item of kopItemsWithBayar) {
        const itemId = itemIdMap[item.masterItemId]
        if (!itemId) continue
        stmts.push(db.prepare(
          "INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah) VALUES (?, ?, 'koperasi_item', ?, ?)"
        ).bind(generateId(), transaksiKopId, itemId, item.bayarSekarang))
        stmts.push(db.prepare(
          "UPDATE fin_koperasi_tagihan_item SET total_dibayar = total_dibayar + ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(item.bayarSekarang, itemId))
        kopDetailsForRecalc.push(itemId)
      }
    }

    // ── Execute batch ────────────────────────────────────────────────────────
    if (stmts.length > 0) await db.batch(stmts)

    // ── Recalc status setelah batch ──────────────────────────────────────────
    if (dsptId) await recalcItem(db, 'dspt', dsptId)

    for (const itemId of kopDetailsForRecalc) {
      await recalcItem(db, 'koperasi_item', itemId)
    }

    // Recalc header koperasi
    if (kopTagihanId) {
      const agg = await db.prepare(`
        SELECT SUM(total_dibayar) as td, SUM(total_diskon) as tdk, SUM(nominal) as nom
        FROM fin_koperasi_tagihan_item WHERE tagihan_id = ?
      `).bind(kopTagihanId).first<any>()
      if (agg) {
        const hStatus = recalcStatusVal(agg.td ?? 0, agg.tdk ?? 0, agg.nom ?? 0)
        await db.prepare(`
          UPDATE fin_koperasi_tagihan
          SET total_dibayar=?, total_diskon=?, status=?, updated_at=datetime('now')
          WHERE id=?
        `).bind(agg.td ?? 0, agg.tdk ?? 0, hStatus, kopTagihanId).run()
      }
    }

    // ── Recalc status DSPT untuk yang baru dibuat tanpa bayar ───────────────
    if (!params.dspt.existingDsptId && params.dspt.bayarSekarang === 0 && dsptId) {
      await db.prepare("UPDATE fin_dspt SET status='belum_bayar' WHERE id = ?").bind(dsptId).run()
    }

    revalidatePath('/dashboard/keuangan')
    revalidatePath('/dashboard/keuangan/daftar-ulang')
    revalidatePath(`/dashboard/keuangan/siswa/${params.siswaId}`)

    // ── Build KuitansiData untuk return ──────────────────────────────────────
    let kuitansiDspt: KuitansiData | null = null
    let kuitansiKoperasi: KuitansiData | null = null

    if (nomorDspt && dsptId) {
      const dsptRow = await db.prepare('SELECT * FROM fin_dspt WHERE id = ?').bind(dsptId).first<any>()
      const sisa = (dsptRow?.nominal_target ?? 0) - (dsptRow?.total_dibayar ?? 0) - (dsptRow?.total_diskon ?? 0)
      kuitansiDspt = {
        nomorKuitansi: nomorDspt,
        tanggal,
        kategori: 'DSPT',
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: namaKomite,
        metodeBayar: params.dspt.metode === 'tunai' ? 'Tunai' : 'Transfer Bank',
        jumlahDiserahkan: params.dspt.bayarSekarang,
        jumlahTagihan: params.dspt.bayarSekarang,
        rincianBayar: [{ label: 'DSPT — Dana Sumbangan Pendidikan Tahunan', nominal: params.dspt.bayarSekarang }],
        sisaTunggakan: sisa > 0 ? [{ label: 'Sisa DSPT', sisa }] : [],
        isLunas: dsptRow?.status === 'lunas',
      }
    }

    if (nomorKoperasi && kopTagihanId) {
      const rincian = kopItemsWithBayar.map(i => ({ label: i.namaItem, nominal: i.bayarSekarang }))
      const totalKop = kopItemsWithBayar.reduce((s, i) => s + i.bayarSekarang, 0)
      const kopRow = await db.prepare('SELECT * FROM fin_koperasi_tagihan WHERE id = ?').bind(kopTagihanId).first<any>()
      const sisaKop = (kopRow?.total_nominal ?? 0) - (kopRow?.total_dibayar ?? 0) - (kopRow?.total_diskon ?? 0)
      kuitansiKoperasi = {
        nomorKuitansi: nomorKoperasi,
        tanggal,
        kategori: 'Koperasi',
        namaSiswa: siswa.nama_lengkap,
        nisn: siswa.nisn ?? '-',
        kelas,
        namaPerugas: namaKoperasiPerugas,
        metodeBayar: params.koperasi.metode === 'tunai' ? 'Tunai' : 'Transfer Bank',
        jumlahDiserahkan: totalKop,
        jumlahTagihan: totalKop,
        rincianBayar: rincian,
        sisaTunggakan: sisaKop > 0 ? [{ label: 'Sisa Koperasi', sisa: sisaKop }] : [],
        isLunas: kopRow?.status === 'lunas',
      }
    }

    return { error: null, kuitansiDspt, kuitansiKoperasi }

  } catch (e: any) {
    console.error('[processDaftarUlang]', e)
    return { error: e.message ?? 'Terjadi kesalahan sistem', kuitansiDspt: null, kuitansiKoperasi: null }
  }
}
