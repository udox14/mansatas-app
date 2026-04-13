// Lokasi: app/dashboard/surat/constants.ts
// Shared types & constants — NO 'use server' directive

export type JenisSurat =
  | 'penerimaan'
  | 'sppd'
  | 'izin_pesantren'
  | 'ket_aktif'
  | 'permohonan'
  | 'surat_tugas'
  | 'undangan_rapat'
  | 'pindah'
  | 'pernyataan'
  | 'kelakuan_baik'

export const JENIS_SURAT_LABEL: Record<JenisSurat, string> = {
  penerimaan: 'Surat Keterangan Penerimaan',
  sppd: 'SPPD',
  izin_pesantren: 'Surat Izin ke Pesantren',
  ket_aktif: 'Surat Keterangan Aktif',
  permohonan: 'Surat Permohonan',
  surat_tugas: 'Surat Tugas',
  undangan_rapat: 'Surat Undangan Rapat',
  pindah: 'Surat Keterangan Pindah',
  pernyataan: 'Surat Pernyataan',
  kelakuan_baik: 'Surat Kelakuan Baik',
}
