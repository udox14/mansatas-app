'use server'

import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
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
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
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
    `).bind(siswaId).first<any>(),
    db.prepare('SELECT * FROM fin_dspt WHERE siswa_id = ?').bind(siswaId).first<any>(),
  ])

  return { siswa, dspt, error: null }
}

export async function processDaftarUlang(
  params: DaftarUlangParams,
  namaKomite: string,
): Promise<DaftarUlangResult> {
  const { db, userId } = await requireAuth()

  try {
    const year = new Date().getFullYear()
    const tanggal = new Date().toISOString().slice(0, 10)

    const siswa = await db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, s.tahun_masuk,
             k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ?
    `).bind(params.siswaId).first<any>()
    if (!siswa) return { error: 'Siswa tidak ditemukan', kuitansiDspt: null }

    const kelas = siswa.tingkat
      ? `${siswa.tingkat}-${siswa.nomor_kelas}${siswa.kelompok ? ' ' + siswa.kelompok : ''}`
      : '-'

    let nomorDspt: string | null = null
    if (params.dspt.bayarSekarang > 0) {
      const seq = await db.prepare(
        "UPDATE fin_nomor_kuitansi_seq SET counter = counter + 1 WHERE id = 'singleton' RETURNING counter"
      ).first<{ counter: number }>()
      nomorDspt = `KWT-DSPT-${year}-${String(seq?.counter ?? 0).padStart(5, '0')}`
    }

    const stmts: D1PreparedStatement[] = []

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
        "UPDATE fin_dspt SET total_diskon = total_diskon + ?, updated_at = datetime('now') WHERE id = ?"
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
        "UPDATE fin_dspt SET total_dibayar = total_dibayar + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(params.dspt.bayarSekarang, dsptId))
    }

    if (stmts.length > 0) await db.batch(stmts)
    if (dsptId) await recalcItem(db, dsptId)

    if (!params.dspt.existingDsptId && params.dspt.bayarSekarang === 0 && dsptId) {
      await db.prepare("UPDATE fin_dspt SET status='belum_bayar' WHERE id = ?").bind(dsptId).run()
    }

    revalidatePath('/dashboard/keuangan')
    revalidatePath('/dashboard/keuangan/daftar-ulang')
    revalidatePath(`/dashboard/keuangan/siswa/${params.siswaId}`)

    let kuitansiDspt: KuitansiData | null = null
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
