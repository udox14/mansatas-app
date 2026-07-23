export const STUDENT_NOTE_MAX_LENGTH = 5000
export const studentNoteCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' })

export type StudentNote = {
  id: string
  siswa_id: string
  siswa_nama: string
  siswa_foto_url: string | null
  pencatat_id: string | null
  pencatat_nama: string
  penugasan_id: string | null
  kelas_nama: string
  mapel_nama: string
  tahun_ajaran_nama: string
  isi: string
  created_at: string
  updated_at: string
  is_owner: boolean
}

export type StudentNoteClass = {
  id: string
  label: string
  source: 'global' | 'mengajar' | 'wali' | 'bk'
}

export type StudentNoteAssignment = {
  id: string
  kelas_id: string
  kelas_label: string
  mapel_nama: string
  label: string
}

export type StudentNoteStudent = {
  id: string
  nama_lengkap: string
  nisn: string | null
  foto_url: string | null
  kelas_id: string
}
