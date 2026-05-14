// Lokasi: app/dashboard/surat/constants.ts
// Shared types & constants - NO 'use server' directive

export type JenisSurat =
  | 'sppd'
  | 'ket_aktif'
  | 'pindah'
  | 'mutasi_keluar'
  | 'mutasi_masuk'
  | 'kelakuan_baik'
  | 'penelitian'
  | 'panggilan_ortu'

export const JENIS_SURAT_LABEL: Record<JenisSurat, string> = {
  sppd: 'SPPD',
  ket_aktif: 'Surat Keterangan Siswa Aktif',
  pindah: 'Surat Keterangan Pindah',
  mutasi_keluar: 'Surat Mutasi Siswa Keluar',
  mutasi_masuk: 'Surat Mutasi Siswa Masuk',
  kelakuan_baik: 'Surat Kelakuan Baik',
  penelitian: 'Surat Keterangan Penelitian',
  panggilan_ortu: 'Surat Pemanggilan Orang Tua',
}

export const KODE_KLASIFIKASI_SURAT: Record<JenisSurat, string> = {
  sppd: 'KP.02.2',
  ket_aktif: 'PP.00.6',
  pindah: 'PP.00.6',
  mutasi_keluar: 'PP.00.6',
  mutasi_masuk: 'PP.00.6',
  kelakuan_baik: 'PP.00.6',
  penelitian: 'HM.01',
  panggilan_ortu: 'PP.00.7',
}
