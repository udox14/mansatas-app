// Lokasi: app/dashboard/sp/constants.ts
// Shared types & constants untuk fitur SP (Surat Peringatan) - NO 'use server'

export type SpLevel = 'sp1' | 'sp2' | 'sp3'

export const SP_LEVEL_LABEL: Record<SpLevel, string> = {
  sp1: 'Surat Peringatan 1',
  sp2: 'Surat Peringatan 2',
  sp3: 'Surat Peringatan 3',
}

// Label ringkas (badge / judul surat)
export const SP_LEVEL_SHORT: Record<SpLevel, string> = {
  sp1: 'SP-1',
  sp2: 'SP-2',
  sp3: 'SP-3',
}

// Kode klasifikasi surat untuk SP (kesiswaan), ikut format nomor surat yang ada
export const KODE_KLASIFIKASI_SP = 'PP.00.7'

export type KeputusanSp = 'naik' | 'pindah' | 'dikeluarkan'

export const KEPUTUSAN_LABEL: Record<KeputusanSp, string> = {
  naik: 'Naik / Lanjut (Dibina, SP dicabut)',
  pindah: 'Pindah Sekolah',
  dikeluarkan: 'Dikeluarkan',
}

export const JENIS_TINDAK_LANJUT: { value: string; label: string }[] = [
  { value: 'pembinaan', label: 'Pembinaan' },
  { value: 'panggilan_ortu', label: 'Panggilan Orang Tua' },
  { value: 'home_visit', label: 'Home Visit' },
  { value: 'lainnya', label: 'Lainnya' },
]
