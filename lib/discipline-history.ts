import type { DisciplinePublicationStatus } from './parent-discipline'

export function getActiveDisciplineYear(db: D1Database) {
  return db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; nama: string; semester: number }>()
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
  tahun_ajaran_id: string
  tahun_ajaran_nama: string | null
  semester: number | null
  master_pelanggaran_id: string
  diinput_oleh: string | null
  publication_status: DisciplinePublicationStatus
  review_note: string | null
  reviewed_at: string | null
  siswa_nama: string
  siswa_foto: string | null
  tingkat: string | number | null
  nomor_kelas: string | number | null
  kelompok: string | null
  nama_pelanggaran: string
  kategori: string | null
  poin: number
  pelapor_nama: string | null
}

export async function loadDisciplineHistory(db: D1Database, { yearId, studentId }: { yearId?: string; studentId?: string } = {}) {
  const filters: string[] = []
  const bindings: string[] = []
  if (yearId !== undefined) {
    filters.push('sp.tahun_ajaran_id = ?')
    bindings.push(yearId)
  }
  if (studentId !== undefined) {
    filters.push('sp.siswa_id = ?')
    bindings.push(studentId)
  }
  const query = db.prepare(`
    SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
      sp.tahun_ajaran_id, ta.nama AS tahun_ajaran_nama, ta.semester,
      sp.publication_status, sp.review_note, sp.reviewed_at,
      s.nama_lengkap AS siswa_nama, s.foto_url AS siswa_foto, k.tingkat, k.nomor_kelas, k.kelompok,
      COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran, 'Pelanggaran tidak tersedia') AS nama_pelanggaran,
      COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
      COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin, u.nama_lengkap AS pelapor_nama
    FROM siswa_pelanggaran sp
    JOIN siswa s ON sp.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
    LEFT JOIN tahun_ajaran ta ON sp.tahun_ajaran_id = ta.id
    LEFT JOIN "user" u ON sp.diinput_oleh = u.id
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY sp.tanggal DESC, sp.created_at DESC, sp.id DESC
  `)
  const result = await (bindings.length ? query.bind(...bindings) : query)
    .all<DisciplineHistoryRow>()
  return result.results
}

export function formatDisciplinePeriod(nama: string | null, semester: number | null) {
  if (!nama) return 'Periode tidak diketahui'
  return semester === 1 || semester === 2 ? `TA ${nama} · Semester ${semester}` : `TA ${nama}`
}

export function formatDisciplineHistoryRow(p: DisciplineHistoryRow) {
  return {
    id: p.id, tanggal: p.tanggal, jam_input: p.jam_input ?? '', keterangan: p.keterangan, foto_url: p.foto_url,
    publication_status: p.publication_status, review_note: p.review_note, reviewed_at: p.reviewed_at,
    siswa_id: p.siswa_id, master_pelanggaran_id: p.master_pelanggaran_id, diinput_oleh: p.diinput_oleh,
    tahun_ajaran_id: p.tahun_ajaran_id, periode: formatDisciplinePeriod(p.tahun_ajaran_nama, p.semester),
    siswa: { nama_lengkap: p.siswa_nama, foto_url: p.siswa_foto, kelas: p.tingkat ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok } : null },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, kategori: p.kategori, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama },
  }
}

export type DisciplineHistoryRecord = ReturnType<typeof formatDisciplineHistoryRow>

export function summarizeDisciplinePoints(records: DisciplineHistoryRecord[]) {
  const totals: Record<string, number> = {}
  for (const record of records) {
    if (record.publication_status === 'published') {
      totals[record.siswa_id] = (totals[record.siswa_id] ?? 0) + record.master_pelanggaran.poin
    }
  }
  return totals
}
