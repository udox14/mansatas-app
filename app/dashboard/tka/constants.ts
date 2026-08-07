// Lokasi: app/dashboard/tka/constants.ts
// File ini BUKAN 'use server' — aman untuk export konstanta

import { idCollator } from '@/lib/natural-sort'

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

// Versi terurut alfabet (Natural Sort) untuk dropdown & tampilan konsisten.
export const MAPEL_PILIHAN_OPTIONS_SORTED = [...MAPEL_PILIHAN_OPTIONS].sort((a, b) =>
  idCollator.compare(a, b)
)
