// lib/tka/types.ts

export const MAPEL_TKA = [
  'Matematika Tingkat Lanjut',
  'Bahasa Indonesia Tingkat Lanjut',
  'Bahasa Inggris Tingkat Lanjut',
  'Fisika',
  'Kimia',
  'Biologi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Ekonomi',
  'Geografi',
  'Sosiologi',
  'Sejarah',
  'Antropologi',
  'Bahasa Prancis',
  'Bahasa Jerman',
  'Bahasa Jepang',
  'Bahasa Mandarin',
  'Bahasa Korea',
  'Bahasa Arab',
  'Projek Kreatif dan Kewirausahaan',
] as const

export type MapelTKA = (typeof MAPEL_TKA)[number]

export const ALLOWED_ROLES_TKA = ['super_admin', 'kepsek', 'wakamad', 'guru_bk', 'guru']

export function getKategori(nilai: number | null): string {
  if (nilai === null || nilai === undefined) return '-'
  if (nilai >= 56) return 'Istimewa'
  if (nilai >= 41) return 'Baik'
  if (nilai >= 26) return 'Memadai'
  return 'Kurang'
}

export const KATEGORI_COLOR: Record<string, string> = {
  Istimewa: 'bg-green-100 text-green-800',
  Baik:     'bg-blue-100 text-blue-800',
  Memadai:  'bg-yellow-100 text-yellow-700',
  Kurang:   'bg-red-100 text-red-700',
  '-':      'bg-gray-100 text-gray-500',
}

// Tipe data dari PDF setelah di-parse
export type PdfRowRaw = {
  nomor_peserta: string
  nama: string
  nilai_bind: number | null
  nilai_mat: number | null
  nilai_bing: number | null
  mapel_p1: string
  nilai_p1: number | null
  mapel_p2: string
  nilai_p2: number | null
}
