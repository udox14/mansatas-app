import { z } from 'zod'

export const pmbSlotSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal slot tidak valid'),
  sesi: z.string().trim().min(2).max(100),
  ruang: z.string().trim().min(1).max(100),
  kapasitas: z.coerce.number().int().min(1).max(500),
  jalur: z.enum(['REGULER', 'PRESTASI']).nullable().optional(),
})

export const dsptEntryModeSchema = z.enum(['manual', 'default', 'package'])
export type DsptEntryMode = z.infer<typeof dsptEntryModeSchema>

export type DsptPackage = { id: string; label: string; amount: number; isActive: boolean; sortOrder: number }
export const dsptPackageSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(2).max(100),
  amount: z.coerce.number().int().min(1),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
})

export function calculateDsptStatus(nominal: number, dibayar: number, diskon: number): 'belum_bayar' | 'nyicil' | 'lunas' {
  if (nominal - dibayar - diskon <= 0) return 'lunas'
  return dibayar > 0 ? 'nyicil' : 'belum_bayar'
}

export function resolveDsptNominal(input: {
  mode: DsptEntryMode; requested: number; defaultAmount: number; packages: DsptPackage[];
  packageId?: string | null; allowOverride: boolean; overrideReason?: string
}): { nominal: number; packageId: string | null; overrideReason: string | null; error: string | null } {
  const requested = Number(input.requested)
  if (!Number.isSafeInteger(requested) || requested <= 0) return { nominal: 0, packageId: null, overrideReason: null, error: 'Nominal target harus berupa bilangan bulat positif.' }
  const selected = input.mode === 'package' ? input.packages.find(item => item.id === input.packageId && item.isActive) : undefined
  if (input.mode === 'package' && !selected) return { nominal: 0, packageId: null, overrideReason: null, error: 'Paket DSPT aktif wajib dipilih.' }
  const configured = input.mode === 'default' ? input.defaultAmount : input.mode === 'package' ? Number(selected?.amount || 0) : requested
  const isOverride = input.mode !== 'manual' && requested !== configured
  const reason = String(input.overrideReason || '').trim()
  if (isOverride && !input.allowOverride) return { nominal: 0, packageId: selected?.id || null, overrideReason: null, error: 'Override nominal DSPT dinonaktifkan.' }
  if (isOverride && reason.length < 10) return { nominal: 0, packageId: selected?.id || null, overrideReason: null, error: 'Alasan override nominal minimal 10 karakter.' }
  return { nominal: requested, packageId: selected?.id || null, overrideReason: isOverride ? reason : null, error: null }
}

export function normalizeGender(value: unknown): 'L' | 'P' | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/[ -]/g, '_')
  if (['L', 'LAKI_LAKI', 'LAKILAKI'].includes(normalized)) return 'L'
  if (['P', 'PEREMPUAN'].includes(normalized)) return 'P'
  return null
}

export function normalizeResidence(value: unknown): string {
  const raw = String(value || '').trim()
  const lower = raw.toLocaleLowerCase('id-ID')
  if (!raw || lower.includes('tidak mondok') || lower.includes('komuter') || lower.includes('penduduk')) return 'Non-Pesantren'
  if (lower.includes('sukahideng')) return 'Pesantren Sukahideng'
  if (lower.includes('sukamanah')) return 'Pesantren Sukamanah'
  if (lower.includes('sukaguru')) return 'Pesantren Sukaguru'
  if (lower.includes("al-ma'mur") || lower.includes('al-mamur')) return "Pesantren Al-Ma'mur"
  return 'Pesantren'
}

export function pmbRegistrationStage(row: {
  konfirmasi_daftar_ulang?: unknown; siswa_id?: unknown; dspt_id?: unknown; daftar_ulang_status?: unknown
}): 'BELUM_KONFIRMASI' | 'MENUNGGU_KONVERSI' | 'MENUNGGU_KASIR' | 'SELESAI' {
  // fin_dspt adalah sumber kebenaran; nilai milestone lama tanpa DSPT tidak dianggap selesai.
  if (row.dspt_id) return 'SELESAI'
  if (row.konfirmasi_daftar_ulang !== 'BERSEDIA') return 'BELUM_KONFIRMASI'
  if (!row.siswa_id) return 'MENUNGGU_KONVERSI'
  return 'MENUNGGU_KASIR'
}

export function isConvertiblePmb(row: Record<string, unknown>): string | null {
  if (row.siswa_id) return 'Pendaftar sudah ditautkan ke siswa.'
  if (row.status_verifikasi !== 1) return 'Berkas pendaftar belum terverifikasi.'
  if (row.status_kelulusan !== 'DITERIMA') return 'Pendaftar belum berstatus DITERIMA.'
  if (row.konfirmasi_daftar_ulang !== 'BERSEDIA') return 'Pendaftar belum mengonfirmasi bersedia daftar ulang.'
  if (!normalizeGender(row.jenis_kelamin)) return 'Jenis kelamin pendaftar tidak valid.'
  return null
}

export function buildStudentFromPmb(p: Record<string, any>, id: string) {
  const tahunMasuk = Number.parseInt(String(p.tahun_ajaran || '').split('/')[0], 10) || new Date().getFullYear()
  return {
    id, nisn: p.nisn, nama_lengkap: p.nama_lengkap, jenis_kelamin: normalizeGender(p.jenis_kelamin),
    tempat_tinggal: normalizeResidence(p.pilihan_pesantren), status: 'aktif', tahun_masuk: tahunMasuk,
    foto_url: p.foto_url, nik: p.nik, tempat_lahir: p.tempat_lahir, tanggal_lahir: p.tanggal_lahir,
    agama: p.agama || 'Islam', jumlah_saudara: p.jumlah_saudara, anak_ke: p.anak_ke, status_anak: p.status_anak,
    alamat_lengkap: p.alamat_lengkap, rt: p.rt, rw: p.rw, desa_kelurahan: p.desa_kelurahan,
    kecamatan: p.kecamatan, kabupaten_kota: p.kabupaten_kota, provinsi: p.provinsi, kode_pos: p.kode_pos,
    nomor_whatsapp: p.no_telepon_ortu, nomor_kk: p.no_kk,
    nama_ayah: p.nama_ayah, nik_ayah: p.nik_ayah, tempat_lahir_ayah: p.tempat_lahir_ayah,
    tanggal_lahir_ayah: p.tanggal_lahir_ayah, status_ayah: p.status_ayah,
    pendidikan_ayah: p.pendidikan_ayah, pekerjaan_ayah: p.pekerjaan_ayah, penghasilan_ayah: p.penghasilan_ayah,
    nama_ibu: p.nama_ibu, nik_ibu: p.nik_ibu, tempat_lahir_ibu: p.tempat_lahir_ibu,
    tanggal_lahir_ibu: p.tanggal_lahir_ibu, status_ibu: p.status_ibu,
    pendidikan_ibu: p.pendidikan_ibu, pekerjaan_ibu: p.pekerjaan_ibu, penghasilan_ibu: p.penghasilan_ibu,
  }
}

export function samePmbIdentity(p: Record<string, any>, s: Record<string, any>): boolean {
  const clean = (value: unknown) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ')
  return clean(p.nik) === clean(s.nik) && clean(p.nama_lengkap) === clean(s.nama_lengkap)
}
