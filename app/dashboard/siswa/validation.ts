// app/dashboard/siswa/validation.ts
// Validasi manual — pengganti Zod (hemat ~4.5MB bundle)

const TEMPAT_TINGGAL_VALUES = [
  'Non-Pesantren',
  'Pesantren Sukahideng',
  'Pesantren Sukamanah',
  'Pesantren Sukaguru',
  "Pesantren Al-Ma'mur",
] as const

export type SiswaType = {
  nisn: string
  nis_lokal?: string
  nama_lengkap: string
  jenis_kelamin: 'L' | 'P'
  tempat_tinggal: typeof TEMPAT_TINGGAL_VALUES[number]
  kelas_id?: string | null
}

export function validateSiswa(data: any): { success: true; data: SiswaType } | { success: false; error: string } {
  if (!data.nisn || typeof data.nisn !== 'string' || data.nisn.length < 5) {
    return { success: false, error: 'NISN minimal 5 karakter' }
  }
  if (!data.nama_lengkap || typeof data.nama_lengkap !== 'string' || data.nama_lengkap.length < 3) {
    return { success: false, error: 'Nama lengkap wajib diisi' }
  }
  if (data.jenis_kelamin !== 'L' && data.jenis_kelamin !== 'P') {
    return { success: false, error: 'Jenis kelamin tidak valid' }
  }
  if (!TEMPAT_TINGGAL_VALUES.includes(data.tempat_tinggal)) {
    return { success: false, error: 'Tempat tinggal tidak valid' }
  }
  if (data.kelas_id !== undefined && data.kelas_id !== null && typeof data.kelas_id !== 'string') {
    return { success: false, error: 'ID Kelas tidak valid' }
  }

  return {
    success: true,
    data: {
      nisn: data.nisn,
      nis_lokal: data.nis_lokal || undefined,
      nama_lengkap: data.nama_lengkap,
      jenis_kelamin: data.jenis_kelamin,
      tempat_tinggal: data.tempat_tinggal,
      kelas_id: data.kelas_id ?? null,
    },
  }
}

// Backward compat: export SiswaSchema-like object for existing code that might call .parse()
export const SiswaSchema = {
  parse(data: any) {
    const result = validateSiswa(data)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
  safeParse(data: any) {
    const result = validateSiswa(data)
    if (result.success) return { success: true as const, data: result.data }
    return { success: false as const, error: { message: result.error, issues: [{ message: result.error }] } }
  },
}
