// BUAT FILE BARU
// Lokasi: app/dashboard/siswa/validation.ts
import { z } from 'zod'

export const SiswaSchema = z.object({
  nisn: z.string().min(5, "NISN minimal 5 karakter"),
  nis_lokal: z.string().optional(),
  nama_lengkap: z.string().min(3, "Nama lengkap wajib diisi"),
  jenis_kelamin: z.enum(['L', 'P']),
  tempat_tinggal: z.enum([
    'Non-Pesantren', 
    'Pesantren Sukahideng', 
    'Pesantren Sukamanah', 
    'Pesantren Sukaguru', 
    'Pesantren Al-Ma\'mur'
  ]),
  kelas_id: z.string().uuid("ID Kelas tidak valid").nullable().optional(),
})

export type SiswaType = z.infer<typeof SiswaSchema>