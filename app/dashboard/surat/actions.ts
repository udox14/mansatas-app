// Lokasi: app/dashboard/surat/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import type { JenisSurat } from './constants'
import { KODE_KLASIFIKASI_SURAT } from './constants'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { ensureJabatanStrukturalSchema } from '../guru/actions'

const BULAN_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const PENANDATANGAN_SETTING_KEY = 'surat_penandatangan'

export type SuratPenandatanganSettings = {
  kepala?: string
  kepala_tu?: string
  waka_kesiswaan?: string
  waka_kurikulum?: string
}

export async function getSuratPenandatanganSettings(): Promise<SuratPenandatanganSettings> {
  const raw = await getSystemSetting(PENANDATANGAN_SETTING_KEY, '{}')
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function simpanSuratPenandatanganSettings(settings: SuratPenandatanganSettings): Promise<{ success?: string; error?: string }> {
  try {
    await setSystemSetting(PENANDATANGAN_SETTING_KEY, JSON.stringify({
      kepala: settings.kepala || '',
      kepala_tu: settings.kepala_tu || '',
      waka_kesiswaan: settings.waka_kesiswaan || '',
      waka_kurikulum: settings.waka_kurikulum || '',
    }))
    revalidatePath('/dashboard/surat')
    return { success: 'Pengaturan penandatangan berhasil disimpan.' }
  } catch (e: any) {
    return { error: 'Gagal menyimpan pengaturan: ' + (e?.message || '') }
  }
}

// ============================================================
// GET DATA FOR SURAT (siswa, guru, kelas, pejabat)
// ============================================================
export async function getDataForSurat() {
  const db = await getDB()
  await ensureJabatanStrukturalSchema(db)

  const [siswaRes, guruRes, kelasRes, pejabatRes] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, s.tempat_lahir, s.tanggal_lahir,
        s.nik, s.alamat_lengkap, s.rt, s.rw, s.desa_kelurahan, s.kecamatan, s.kabupaten_kota, s.provinsi, s.kode_pos,
        s.nama_ayah, s.pekerjaan_ayah, s.nama_ibu, s.pekerjaan_ibu, s.nik_ayah, s.tahun_masuk,
        s.kelas_id, s.status,
        k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE s.status = 'aktif'
      ORDER BY s.nama_lengkap ASC
    `).all<any>(),

    db.prepare(`
      SELECT u.id, COALESCE(u.nama_lengkap, u.name) AS nama_lengkap, u.role,
        u.nip, u.pangkat_golongan, u.jabatan_cetak, u.jabatan_struktural_id,
        mjs.nama AS jabatan_struktural_nama
      FROM "user" u
      LEFT JOIN master_jabatan_struktural mjs ON u.jabatan_struktural_id = mjs.id
      WHERE COALESCE(u.banned, 0) = 0
      ORDER BY COALESCE(u.nama_lengkap, u.name) ASC
    `).all<any>(),

    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, nomor_kelas
    `).all<any>(),

    db.prepare(`
      SELECT u.id AS user_id, COALESCE(u.nama_lengkap, u.name) AS nama_lengkap, u.role,
        u.nip, u.pangkat_golongan, u.jabatan_cetak, u.jabatan_struktural_id,
        mjs.nama AS jabatan_struktural_nama,
        COALESCE(u.jabatan_cetak, mjs.nama,
          CASE
            WHEN u.role = 'kepsek' THEN 'Kepala Madrasah'
            WHEN u.role = 'admin_tu' THEN 'Kepala TU'
            WHEN u.role = 'wakamad' THEN 'Wakil Kepala Madrasah'
            ELSE u.role
          END
        ) AS nama
      FROM "user" u
      LEFT JOIN master_jabatan_struktural mjs ON u.jabatan_struktural_id = mjs.id
      WHERE COALESCE(u.banned, 0) = 0
        AND COALESCE(u.nama_lengkap, u.name) IS NOT NULL
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala madrasah%' OR u.role = 'kepsek' THEN 1
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tu%' THEN 2
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kesiswaan%' THEN 3
          ELSE 9
        END,
        COALESCE(u.nama_lengkap, u.name) ASC
    `).all<any>(),
  ])

  return {
    siswa: siswaRes.results || [],
    guru: guruRes.results || [],
    kelas: kelasRes.results || [],
    pejabat: pejabatRes.results || [],
  }
}

// ============================================================
// FORMAT NOMOR SURAT
// ============================================================
function formatNomorSurat(jenisSurat: JenisSurat, nomorUrutLokal: string, bulan: number, tahun: number): string {
  const bulanRomawi = BULAN_ROMAWI[bulan] || String(bulan)
  const kode = KODE_KLASIFIKASI_SURAT[jenisSurat] || 'PP.00.6'
  return `${nomorUrutLokal}/Ma.10.20/${kode}/${bulanRomawi}/${tahun}`
}

// ============================================================
// SIMPAN SURAT KELUAR
// ============================================================
export async function simpanSuratKeluar(data: {
  jenis_surat: JenisSurat
  perihal?: string
  data_surat: any
  dicetak_oleh: string
  nama_pencetak: string
  nomor_urut_manual?: string
}): Promise<{ success?: string; error?: string; nomor_surat?: string; id?: string }> {
  const db = await getDB()

  if (!data.nomor_urut_manual) {
    return { error: 'Nomor Urut Surat harus diisi (wajib)!' }
  }

  const d = data.data_surat?.tanggal_surat_raw ? new Date(data.data_surat.tanggal_surat_raw) : new Date()
  const tahun = d.getFullYear()
  const bulan = d.getMonth() + 1

  const nomorUrut = parseInt(data.nomor_urut_manual.replace(/[^0-9]/g, '')) || 0
  const nomorSurat = formatNomorSurat(data.jenis_surat, data.nomor_urut_manual, bulan, tahun)
  const dataSurat = { ...data.data_surat, nomor_surat: nomorSurat }

  try {
    const result = await db.prepare(`
      INSERT INTO surat_keluar (id, jenis_surat, nomor_urut, nomor_surat, tahun, perihal, data_surat, dicetak_oleh, nama_pencetak)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      data.jenis_surat,
      nomorUrut,
      nomorSurat,
      tahun,
      data.perihal || null,
      JSON.stringify(dataSurat),
      data.dicetak_oleh,
      data.nama_pencetak
    ).first<any>()

    revalidatePath('/dashboard/surat')
    return { success: 'Surat berhasil disimpan!', nomor_surat: nomorSurat, id: result?.id }
  } catch (e: any) {
    return { error: 'Gagal menyimpan surat: ' + (e?.message || '') }
  }
}

// ============================================================
// GET LOG SURAT KELUAR
// ============================================================
export async function getSuratKeluar(filters?: {
  jenis_surat?: JenisSurat
  bulan?: number
  tahun?: number
}): Promise<any[]> {
  const db = await getDB()
  let sql = `SELECT id, jenis_surat, nomor_urut, nomor_surat, tahun, perihal, data_surat, nama_pencetak, created_at FROM surat_keluar WHERE 1=1`
  const params: any[] = []

  if (filters?.jenis_surat) {
    sql += ' AND jenis_surat = ?'
    params.push(filters.jenis_surat)
  }
  if (filters?.tahun) {
    sql += ' AND tahun = ?'
    params.push(filters.tahun)
  }
  if (filters?.bulan) {
    sql += ` AND CAST(strftime('%m', created_at) AS INTEGER) = ?`
    params.push(filters.bulan)
  }

  sql += ' ORDER BY nomor_urut DESC'

  const result = await db.prepare(sql).bind(...params).all<any>()
  return result.results || []
}

// ============================================================
// HAPUS SURAT KELUAR
// ============================================================
export async function hapusSuratKeluar(id: string): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM surat_keluar WHERE id = ?').bind(id).run()
    revalidatePath('/dashboard/surat')
    return { success: 'Surat berhasil dihapus dari log.' }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}

// ============================================================
// HAPUS SURAT KELUAR BATCH
// ============================================================
export async function hapusSuratKeluarBatch(ids: string[]): Promise<{ success?: string; error?: string }> {
  if (!ids || ids.length === 0) return { error: 'Tidak ada data yang dipilih.' }
  const db = await getDB()
  try {
    const placeholders = ids.map(() => '?').join(',')
    await db.prepare(`DELETE FROM surat_keluar WHERE id IN (${placeholders})`).bind(...ids).run()
    revalidatePath('/dashboard/surat')
    return { success: `${ids.length} Surat berhasil dihapus dari log.` }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}
