// Lokasi: app/dashboard/surat/constants.ts
// Shared types & constants - NO 'use server' directive

export type JenisSurat =
  | 'penerimaan'
  | 'sppd'
  | 'izin_pesantren'
  | 'ket_aktif'
  | 'permohonan'
  | 'surat_tugas'
  | 'undangan_rapat'
  | 'pindah'
  | 'mutasi_keluar'
  | 'mutasi_masuk'
  | 'pernyataan'
  | 'kelakuan_baik'
  | 'penelitian'
  | 'panggilan_ortu'

export const JENIS_SURAT_LABEL: Record<JenisSurat, string> = {
  penerimaan: 'Surat Keterangan Penerimaan',
  sppd: 'SPPD',
  izin_pesantren: 'Surat Izin ke Pesantren',
  ket_aktif: 'Surat Keterangan Siswa Aktif',
  permohonan: 'Surat Permohonan',
  surat_tugas: 'Surat Tugas',
  undangan_rapat: 'Surat Undangan Rapat',
  pindah: 'Surat Keterangan Pindah',
  mutasi_keluar: 'Surat Mutasi Siswa Keluar',
  mutasi_masuk: 'Surat Mutasi Siswa Masuk',
  pernyataan: 'Surat Pernyataan',
  kelakuan_baik: 'Surat Kelakuan Baik',
  penelitian: 'Surat Keterangan Penelitian',
  panggilan_ortu: 'Surat Pemanggilan Orang Tua',
}

export const KODE_KLASIFIKASI_SURAT: Record<JenisSurat, string> = {
  penerimaan: 'PP.00.6',
  sppd: 'KP.02.2',
  izin_pesantren: 'PP.00.7',
  ket_aktif: 'PP.00.6',
  permohonan: 'PP.00.7',
  surat_tugas: 'KP.02.2',
  undangan_rapat: 'PP.00.7',
  pindah: 'PP.00.6',
  mutasi_keluar: 'PP.00.6',
  mutasi_masuk: 'PP.00.6',
  pernyataan: 'PP.00.6',
  kelakuan_baik: 'PP.00.6',
  penelitian: 'HM.01',
  panggilan_ortu: 'PP.00.7',
}
