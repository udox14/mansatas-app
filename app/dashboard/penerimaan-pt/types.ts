// app/dashboard/penerimaan-pt/types.ts
export type JalurPT =
  | 'SNBP' | 'SNBT' | 'SPAN_PTKIN' | 'UM_PTKIN'
  | 'MANDIRI' | 'PMB_PTS' | 'LAINNYA'

export type StatusPenerimaan = 'DITERIMA' | 'TIDAK_DITERIMA' | 'MENGUNDURKAN_DIRI'

export type PenerimaanRow = {
  id: string
  siswa_id: string
  tahun_ajaran_id: string
  jalur: JalurPT
  kampus_id: string
  kampus_nama: string
  program_studi: string | null
  status: StatusPenerimaan
  catatan: string | null
  created_at: string
  updated_at: string
  // joined
  nama_lengkap?: string
  nisn?: string
  tingkat?: number
  nomor_kelas?: string
  kelas_kelompok?: string
}

export const JALUR_LIST: { value: JalurPT; label: string; color: string }[] = [
  { value: 'SNBP',      label: 'SNBP',       color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { value: 'SNBT',      label: 'SNBT',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'SPAN_PTKIN',label: 'SPAN-PTKIN', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'UM_PTKIN',  label: 'UM-PTKIN',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'MANDIRI',   label: 'Mandiri',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'PMB_PTS',   label: 'PMB PTS',   color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'LAINNYA',   label: 'Lainnya',   color: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800' },
]

export const STATUS_LIST: { value: StatusPenerimaan; label: string; color: string }[] = [
  { value: 'DITERIMA',           label: 'Diterima',            color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { value: 'TIDAK_DITERIMA',     label: 'Tidak Diterima',      color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'MENGUNDURKAN_DIRI',  label: 'Mengundurkan Diri',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
]