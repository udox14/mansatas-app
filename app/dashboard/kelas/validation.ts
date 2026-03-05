// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/validation.ts
import { z } from 'zod'

export const KelasSchema = z.object({
  tingkat: z.number().int().min(10).max(12),
  kelompok: z.string().min(1, "Kelompok/Jurusan wajib diisi"), // PERBAIKAN: Diubah dari enum ke string bebas
  nomor_kelas: z.string().min(1, "Nomor kelas wajib diisi"),
  wali_kelas_id: z.string().uuid("Wali kelas tidak valid").optional().nullable(),
  kapasitas: z.number().int().min(1).max(40).default(36)
})