// app/dashboard/kelas/validation.ts
// Validasi manual — pengganti Zod

export type KelasType = {
  tingkat: number
  kelompok: string
  nomor_kelas: string
  wali_kelas_id?: string | null
  kapasitas: number
}

export function validateKelas(data: any): { success: true; data: KelasType } | { success: false; error: string } {
  const tingkat = Number(data.tingkat)
  if (!Number.isInteger(tingkat) || tingkat < 10 || tingkat > 12) {
    return { success: false, error: 'Tingkat harus 10, 11, atau 12' }
  }
  if (!data.kelompok || typeof data.kelompok !== 'string' || data.kelompok.length < 1) {
    return { success: false, error: 'Kelompok/Jurusan wajib diisi' }
  }
  if (!data.nomor_kelas || typeof data.nomor_kelas !== 'string' || data.nomor_kelas.length < 1) {
    return { success: false, error: 'Nomor kelas wajib diisi' }
  }
  const kapasitas = Number(data.kapasitas ?? 36)
  if (!Number.isInteger(kapasitas) || kapasitas < 1 || kapasitas > 40) {
    return { success: false, error: 'Kapasitas harus antara 1-40' }
  }

  return {
    success: true,
    data: {
      tingkat,
      kelompok: data.kelompok,
      nomor_kelas: data.nomor_kelas,
      wali_kelas_id: data.wali_kelas_id ?? null,
      kapasitas,
    },
  }
}

export const KelasSchema = {
  parse(data: any) {
    const result = validateKelas(data)
    if (!result.success) throw new Error(result.error)
    return result.data
  },
  safeParse(data: any) {
    const result = validateKelas(data)
    if (result.success) return { success: true as const, data: result.data }
    return { success: false as const, error: { message: result.error, issues: [{ message: result.error }] } }
  },
}
