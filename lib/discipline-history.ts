import type { DisciplinePublicationStatus } from './parent-discipline'

export function getActiveDisciplineYear(db: D1Database) {
  return db.prepare('SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; nama: string }>()
}

export async function loadPublishedDisciplineTotals(db: D1Database, studentId?: string) {
  const query = db.prepare(`
    SELECT sp.siswa_id, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) AS total_poin
    FROM siswa_pelanggaran sp
    LEFT JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
    WHERE sp.publication_status = 'published'${studentId === undefined ? '' : ' AND sp.siswa_id = ?'}
    GROUP BY sp.siswa_id
  `)
  const result = await (studentId === undefined ? query : query.bind(studentId))
    .all<{ siswa_id: string; total_poin: number }>()
  return Object.fromEntries(result.results.map(row => [row.siswa_id, row.total_poin]))
}

type DisciplineHistoryRow = {
  id: string
  tanggal: string
  jam_input: string | null
  keterangan: string | null
  foto_url: string | null
  siswa_id: string
  master_pelanggaran_id: string
  diinput_oleh: string | null
  publication_status: DisciplinePublicationStatus
  review_note: string | null
  reviewed_at: string | null
  siswa_nama: string
  siswa_foto: string | null
  tingkat: string | number | null
  nomor_kelas: number | null
  kelompok: string | null
  nama_pelanggaran: string
  kategori: string
  poin: number
  pelapor_nama: string | null
}

export async function loadDisciplineHistory(db: D1Database, yearId: string, studentId?: string) {
  const query = db.prepare(`
    SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
      sp.publication_status, sp.review_note, sp.reviewed_at,
      s.nama_lengkap AS siswa_nama, s.foto_url AS siswa_foto, k.tingkat, k.nomor_kelas, k.kelompok,
      COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
      COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
      COALESCE(sp.poin_snapshot, mp.poin) AS poin, u.nama_lengkap AS pelapor_nama
    FROM siswa_pelanggaran sp
    JOIN siswa s ON sp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
    LEFT JOIN "user" u ON sp.diinput_oleh = u.id
    WHERE sp.tahun_ajaran_id = ?${studentId === undefined ? '' : ' AND sp.siswa_id = ?'}
    ORDER BY sp.tanggal DESC, sp.created_at DESC, sp.id DESC
  `)
  const result = await (studentId === undefined ? query.bind(yearId) : query.bind(yearId, studentId))
    .all<DisciplineHistoryRow>()
  return result.results
}
