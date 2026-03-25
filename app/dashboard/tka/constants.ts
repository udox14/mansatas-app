// Lokasi: app/dashboard/tka/constants.ts
// File ini BUKAN 'use server' — aman untuk export konstanta

export const MAPEL_PILIHAN_OPTIONS = [
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

export type MapelPilihanOption = typeof MAPEL_PILIHAN_OPTIONS[number]
