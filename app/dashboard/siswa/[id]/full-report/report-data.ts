import { formatNamaKelas } from '@/lib/utils'

export const FULL_REPORT_ROLES = ['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk'] as const

export type FullReportSectionId =
  | 'identitas'
  | 'akademik'
  | 'kehadiran'
  | 'kedisiplinan'
  | 'bk_catatan'
  | 'program'
  | 'keuangan'
  | 'komunikasi'

export type ReportMetric = { label: string; value: string; detail?: string }
export type ReportTable = { title: string; headers: string[]; rows: string[][] }
export type ReportSection = {
  id: FullReportSectionId
  title: string
  description: string
  metrics: ReportMetric[]
  tables: ReportTable[]
}

export type ReportPeriod = {
  id: string
  label: string
  nama: string
  semester: number
  semesterIds?: string[]
  startDate: string | null
  endDate: string | null
}

export type FullReportData = {
  student: Record<string, any>
  className: string
  period: ReportPeriod | null
  periods: ReportPeriod[]
  generatedAt: string
  principal: { nama: string; nip: string | null; signature_url: string | null } | null
  homeroom: { nama: string; nip: string | null; signature_url: string | null } | null
  sections: ReportSection[]
}

async function safeAll<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T[]> {
  try {
    const result = await db.prepare(sql).bind(...binds).all<T>()
    return (result.results || []) as T[]
  } catch {
    return []
  }
}

async function safeFirst<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T | null> {
  try {
    return await db.prepare(sql).bind(...binds).first<T>()
  } catch {
    return null
  }
}

function text(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function number(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function integer(value: unknown): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(number(value))
}

function decimal(value: unknown): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(number(value))
}

function rupiah(value: unknown): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(number(value))
}

function date(value: unknown): string {
  if (!value) return '-'
  const source = String(value).slice(0, 10)
  const parsed = new Date(`${source}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return text(value)
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function academicPeriodDates(nama: string, semester: number): { startDate: string | null; endDate: string | null } {
  const match = nama.match(/(\d{4})\s*\/\s*(\d{4})/)
  if (!match) return { startDate: null, endDate: null }
  return semester === 1
    ? { startDate: `${match[1]}-07-01`, endDate: `${match[1]}-12-31` }
    : { startDate: `${match[2]}-01-01`, endDate: `${match[2]}-06-30` }
}

function dateClause(column: string, period: ReportPeriod | null) {
  if (!period) return { sql: '', binds: [] as unknown[] }
  if (!period.startDate || !period.endDate) return { sql: ' AND 1 = 0', binds: [] as unknown[] }
  return { sql: ` AND substr(${column}, 1, 10) BETWEEN ? AND ?`, binds: [period.startDate, period.endDate] }
}

function academicYearClause(column: string, period: ReportPeriod | null) {
  if (!period) return { sql: '', binds: [] as string[] }
  const ids = period.semesterIds?.length ? period.semesterIds : [period.id]
  return { sql: ` AND ${column} IN (${ids.map(() => '?').join(',')})`, binds: ids }
}

function periodLabel(period: ReportPeriod | null) {
  return period?.label || 'Seluruh Riwayat'
}

function section(
  id: FullReportSectionId,
  title: string,
  description: string,
  metrics: ReportMetric[],
  tables: ReportTable[],
): ReportSection {
  return { id, title, description, metrics, tables }
}

function groupRows(rows: any[], key: string, value = 'jumlah'): string[][] {
  return rows.map(row => [text(row[key], 'Tidak ditentukan'), integer(row[value])])
}

function semesterKey(tingkat: number, semester: number) {
  const index = (tingkat - 10) * 2 + semester
  return index >= 1 && index <= 6 ? `nilai_smt${index}` : null
}

export async function canAccessFullStudentReport(
  db: D1Database,
  userId: string,
  roles: string[],
  kelasId: string | null,
) {
  if (!roles.some(role => (FULL_REPORT_ROLES as readonly string[]).includes(role))) return false
  if (roles.some(role => ['super_admin', 'kepsek', 'wakamad', 'admin_tu'].includes(role))) return true
  if (!roles.includes('guru_bk') || !kelasId) return false
  const assigned = await safeFirst<{ id: string }>(db,
    'SELECT id FROM kelas_binaan_bk WHERE guru_bk_id = ? AND kelas_id = ? LIMIT 1',
    [userId, kelasId],
  )
  return Boolean(assigned)
}

export async function loadFullStudentReport(
  db: D1Database,
  studentId: string,
  selectedPeriodId?: string,
): Promise<FullReportData | null> {
  let student = await safeFirst<Record<string, any>>(db, `
    SELECT s.*,
      k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id,
      COALESCE(wali.nama_lengkap, wali.name) AS wali_kelas_nama,
      wali.nip AS wali_kelas_nip, wali.signature_url AS wali_kelas_signature
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN "user" wali ON wali.id = k.wali_kelas_id
    WHERE s.id = ?
  `, [studentId])
  if (!student) {
    student = await safeFirst<Record<string, any>>(db, `
      SELECT s.*, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id,
        COALESCE(wali.nama_lengkap, wali.name) AS wali_kelas_nama,
        wali.nip AS wali_kelas_nip, NULL AS wali_kelas_signature
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN "user" wali ON wali.id = k.wali_kelas_id
      WHERE s.id = ?
    `, [studentId])
  }
  if (!student) return null

  const rawPeriods = await safeAll<{ id: string; nama: string; semester: number }>(db, `
    SELECT id, nama, semester FROM tahun_ajaran
    ORDER BY nama DESC, semester DESC
  `)
  const semesterPeriods = rawPeriods.map(row => ({
    ...row,
    label: `${row.nama} · Semester ${row.semester}`,
    ...academicPeriodDates(row.nama, row.semester),
  }))
  const grouped = new Map<string, typeof rawPeriods>()
  for (const row of rawPeriods) grouped.set(row.nama, [...(grouped.get(row.nama) || []), row])
  const yearPeriods: ReportPeriod[] = Array.from(grouped.entries()).map(([nama, rows]) => {
    const first = academicPeriodDates(nama, 1)
    const second = academicPeriodDates(nama, 2)
    return {
      id: `year:${nama}`,
      label: `${nama} · Gabungan Semester 1–2`,
      nama,
      semester: 0,
      semesterIds: rows.map(row => row.id),
      startDate: first.startDate,
      endDate: second.endDate,
    }
  })
  const periods = [...yearPeriods, ...semesterPeriods]
  const period = selectedPeriodId ? periods.find(item => item.id === selectedPeriodId) || null : null
  const dateFilter = (column: string) => dateClause(column, period)
  const taFilter = (column: string) => academicYearClause(column, period)
  const defaultTa = taFilter('tahun_ajaran_id')
  const taSql = defaultTa.sql
  const taBinds = defaultTa.binds
  const periodClass = period ? await safeFirst<{ kelas_id: string }>(db,
    `SELECT rk.kelas_id FROM riwayat_kelas rk WHERE rk.siswa_id = ?${taFilter('rk.tahun_ajaran_id').sql} ORDER BY rk.created_at DESC LIMIT 1`,
    [studentId, ...taBinds]) : null
  const reportClassId = periodClass?.kelas_id || student.kelas_id || null

  const [
    classHistory, admission, admissionAchievements, academicRecord, dailyGrades, programTests,
    tkaRows, psychology, plotting, futurePlans, universityResults,
    attendanceSessions, attendance, monthlyAttendance, attendanceCorrections, classPermits, exitPermits,
    violations, warningLetters, warningFollowups, warningDecision, sanctionConfigs,
    bkRows, notesRows, tahfidzProgress, tahfidzLogs, tahfidzScores,
    extracurricularRows, extracurricularAttendance,
    dspt, sppRows, sppOpening, cooperativeRows, transactions, discounts, promises, paymentSubmissions,
    parentNotifications, parentSummons, parentNotes, parentSuggestions, outgoingLetters,
    principal, latestHomeroom,
  ] = await Promise.all([
    safeAll<any>(db, `
      SELECT COALESCE(rk.kelas_nama,
        ('Kelas ' || COALESCE(rk.kelas_tingkat, k.tingkat) || ' ' || COALESCE(rk.kelas_kelompok, k.kelompok) || '-' || COALESCE(rk.kelas_nomor, k.nomor_kelas))) AS kelas_nama,
        COALESCE(rk.kelas_tingkat, k.tingkat) AS tingkat, ta.nama, ta.semester, rk.created_at
      FROM riwayat_kelas rk
      LEFT JOIN kelas k ON k.id = rk.kelas_id
      LEFT JOIN tahun_ajaran ta ON ta.id = rk.tahun_ajaran_id
      WHERE rk.siswa_id = ?${taFilter('rk.tahun_ajaran_id').sql}
      ORDER BY ta.nama, ta.semester
    `, [studentId, ...taBinds]),
    safeFirst<any>(db, `SELECT id, no_pendaftaran, tahun_ajaran, jalur, status_verifikasi,
      status_kelulusan, daftar_ulang_status, tanggal_tes, sesi_tes, ruang_tes, nilai_rapor
      FROM pmb_pendaftar WHERE siswa_id = ? LIMIT 1`, [studentId]),
    safeAll<any>(db, `SELECT pp.kategori, pp.tingkat, COUNT(*) AS jumlah
      FROM pmb_prestasi pp JOIN pmb_pendaftar p ON p.id = pp.pendaftar_id
      WHERE p.siswa_id = ? GROUP BY pp.kategori, pp.tingkat ORDER BY pp.kategori`, [studentId]),
    safeFirst<any>(db, `SELECT nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6
      FROM rekap_nilai_akademik WHERE siswa_id = ?`, [studentId]),
    safeAll<any>(db, `SELECT mp.nama_mapel, COUNT(*) AS jumlah_penilaian,
      AVG(nd.nilai) AS rata_rata, MIN(nd.nilai) AS minimum, MAX(nd.nilai) AS maksimum,
      SUM(CASE WHEN nd.nilai >= nh.kkm THEN 1 ELSE 0 END) AS tuntas
      FROM nilai_harian_detail nd
      JOIN nilai_harian_header nh ON nh.id = nd.header_id
      JOIN penugasan_mengajar pm ON pm.id = nh.penugasan_id
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      WHERE nd.siswa_id = ?${taFilter('nh.tahun_ajaran_id').sql}
      GROUP BY mp.id, mp.nama_mapel ORDER BY mp.nama_mapel`, [studentId, ...taBinds]),
    (() => { const f = dateFilter('pht.tanggal'); return safeAll<any>(db, `SELECT pht.status, pht.nilai, COUNT(*) AS jumlah
      FROM pu_hasil_tes pht WHERE pht.siswa_id = ?${f.sql}
      GROUP BY pht.status, pht.nilai ORDER BY pht.status, pht.nilai`, [studentId, ...f.binds]) })(),
    safeAll<any>(db, `SELECT ta.nama, ta.semester, p.mapel_pilihan1, p.mapel_pilihan2,
      h.nomor_peserta, h.nilai_bind, h.nilai_mat, h.nilai_bing,
      h.nilai_pilihan1, h.nilai_pilihan2
      FROM tka_mapel_pilihan p
      LEFT JOIN tka_hasil h ON h.siswa_id = p.siswa_id AND h.tahun_ajaran_id = p.tahun_ajaran_id
      LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
      WHERE p.siswa_id = ?${taFilter('p.tahun_ajaran_id').sql}
      ORDER BY ta.nama, ta.semester`, [studentId, ...taBinds]),
    safeFirst<any>(db, `SELECT iq_score, iq_klasifikasi, riasec, rekom_jurusan, mbti, gaya_belajar,
      mapel_pilihan, usia_thn, usia_bln FROM siswa_psikotes WHERE siswa_id = ?`, [studentId]),
    safeAll<any>(db, `SELECT ta.nama, ta.semester, p.minat_jurusan, p.status
      FROM plotting_penjurusan_draft p LEFT JOIN tahun_ajaran ta ON ta.id = p.target_tahun_ajaran_id
      WHERE p.siswa_id = ?${period ? ` AND (p.source_tahun_ajaran_id IN (${taBinds.map(() => '?').join(',')}) OR p.target_tahun_ajaran_id IN (${taBinds.map(() => '?').join(',')}))` : ''}
      ORDER BY p.updated_at DESC`, period ? [studentId, ...taBinds, ...taBinds] : [studentId]),
    safeAll<any>(db, `SELECT ta.nama, ta.semester, r.kategori
      FROM rencana_pasca_lulus r LEFT JOIN tahun_ajaran ta ON ta.id = r.tahun_ajaran_id
      WHERE r.siswa_id = ?${taFilter('r.tahun_ajaran_id').sql}`, [studentId, ...taBinds]),
    safeAll<any>(db, `SELECT ta.nama, ta.semester, p.jenis_data, p.kampus_nama, p.program_studi,
      p.jalur, p.status, p.pilihan_ke
      FROM penerimaan_pt p LEFT JOIN tahun_ajaran ta ON ta.id = p.tahun_ajaran_id
      WHERE p.siswa_id = ?${taFilter('p.tahun_ajaran_id').sql}
      ORDER BY ta.nama, p.pilihan_ke`, [studentId, ...taBinds]),
    safeFirst<any>(db, `SELECT COUNT(*) AS total FROM absensi_sesi_guru sg JOIN penugasan_mengajar pm ON pm.id=sg.penugasan_id
      WHERE pm.kelas_id = ?${taFilter('pm.tahun_ajaran_id').sql}`, [reportClassId, ...taBinds]),
    (() => { const f = dateFilter('tanggal'); return safeAll<any>(db, `SELECT status, COUNT(*) AS jumlah FROM (
      SELECT UPPER(status) AS status,penugasan_id,tanggal FROM absensi_sesi_siswa WHERE siswa_id=? AND UPPER(status)<>'HADIR'${f.sql}
      UNION SELECT UPPER(status) AS status,penugasan_id,tanggal FROM absensi_siswa WHERE siswa_id=? AND UPPER(status)<>'HADIR'${f.sql}
      ) GROUP BY status`, [studentId, ...f.binds, studentId, ...f.binds]) })(),
    safeAll<any>(db, `SELECT r.bulan, SUM(r.sakit) AS sakit, SUM(r.izin) AS izin, SUM(r.alpa) AS alpa,
      ta.nama, ta.semester FROM rekap_kehadiran_bulanan r
      LEFT JOIN tahun_ajaran ta ON ta.id = r.tahun_ajaran_id
      WHERE r.siswa_id = ?${taFilter('r.tahun_ajaran_id').sql}
      GROUP BY r.tahun_ajaran_id, r.bulan ORDER BY ta.nama, ta.semester, r.bulan`, [studentId, ...taBinds]),
    (() => { const f = dateFilter('tanggal'); return safeAll<any>(db, `SELECT UPPER(status) AS status, COUNT(*) AS jumlah
      FROM keterangan_absensi_wali_kelas WHERE siswa_id = ?${f.sql} GROUP BY UPPER(status)`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('tanggal'); return safeAll<any>(db, `SELECT alasan, COUNT(*) AS jumlah
      FROM izin_tidak_masuk_kelas WHERE siswa_id = ?${f.sql} GROUP BY alasan ORDER BY jumlah DESC`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('waktu_keluar'); return safeAll<any>(db, `SELECT status, COUNT(*) AS jumlah
      FROM izin_keluar_komplek WHERE siswa_id = ?${f.sql} GROUP BY status`, [studentId, ...f.binds]) })(),
    safeAll<any>(db, `SELECT mp.kategori, COUNT(*) AS jumlah, SUM(mp.poin) AS poin
      FROM siswa_pelanggaran sp JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE sp.siswa_id = ?${taFilter('sp.tahun_ajaran_id').sql}
      GROUP BY mp.kategori ORDER BY poin DESC`, [studentId, ...taBinds]),
    (() => { const f = dateFilter('tanggal_sp'); return safeAll<any>(db, `SELECT level, COUNT(*) AS jumlah, MAX(total_poin) AS poin_tertinggi
      FROM surat_peringatan WHERE siswa_id = ?${f.sql} GROUP BY level ORDER BY level`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('tanggal'); return safeAll<any>(db, `SELECT jenis, COUNT(*) AS jumlah
      FROM sp_tindak_lanjut WHERE siswa_id = ?${f.sql} GROUP BY jenis ORDER BY jumlah DESC`, [studentId, ...f.binds]) })(),
    safeFirst<any>(db, `SELECT keputusan, tanggal FROM sp_keputusan WHERE siswa_id = ?`, [studentId]),
    safeAll<any>(db, `SELECT nama, poin_minimal, urutan FROM sanksi_config ORDER BY poin_minimal ASC`),
    safeAll<any>(db, `SELECT bidang, tindak_lanjut, COUNT(*) AS jumlah, MIN(created_at) AS pertama, MAX(created_at) AS terakhir
      FROM bk_rekaman WHERE siswa_id = ?${taSql} GROUP BY bidang, tindak_lanjut ORDER BY bidang`, [studentId, ...taBinds]),
    safeAll<any>(db, `SELECT mapel_nama_snapshot, COUNT(*) AS jumlah, MIN(created_at) AS pertama, MAX(created_at) AS terakhir
      FROM catatan_siswa WHERE siswa_id = ?${taSql}
      GROUP BY mapel_nama_snapshot ORDER BY jumlah DESC`, [studentId, ...taBinds]),
    safeAll<any>(db, `SELECT juz, COUNT(*) AS surah, SUM(json_array_length(ayat_hafal)) AS ayat
      FROM tahfidz_progress WHERE siswa_id = ? GROUP BY juz ORDER BY juz`, [studentId]),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT juz, COUNT(*) AS setoran
      FROM tahfidz_setoran_log WHERE siswa_id = ?${f.sql} GROUP BY juz ORDER BY juz`, [studentId, ...f.binds]) })(),
    safeAll<any>(db, `SELECT juz, nilai FROM tahfidz_nilai WHERE siswa_id = ? ORDER BY juz`, [studentId]),
    safeAll<any>(db, `SELECT e.nama, ea.status, en.nilai, ta.nama AS tahun_ajaran, ta.semester
      FROM ekstrakurikuler_anggota ea JOIN ekstrakurikuler e ON e.id = ea.ekstrakurikuler_id
      LEFT JOIN ekstrakurikuler_nilai en ON en.ekstrakurikuler_id = e.id AND en.siswa_id = ea.siswa_id${taFilter('en.tahun_ajaran_id').sql}
      LEFT JOIN tahun_ajaran ta ON ta.id = en.tahun_ajaran_id
      WHERE ea.siswa_id = ? ORDER BY e.nama`, period ? [...taBinds, studentId] : [studentId]),
    safeAll<any>(db, `SELECT e.nama, UPPER(a.status) AS status, COUNT(*) AS jumlah
      FROM ekstrakurikuler_absensi a
      JOIN ekstrakurikuler_pertemuan p ON p.id = a.pertemuan_id
      JOIN ekstrakurikuler e ON e.id = p.ekstrakurikuler_id
      WHERE a.siswa_id = ?${taFilter('p.tahun_ajaran_id').sql}
      GROUP BY e.nama, UPPER(a.status) ORDER BY e.nama`, [studentId, ...taBinds]),
    safeFirst<any>(db, `SELECT nominal_target, total_dibayar, total_diskon, status FROM fin_dspt WHERE siswa_id = ?`, [studentId]),
    (() => { const f = !period ? '' : period.startDate && period.endDate ? ' AND printf(\'%04d-%02d-01\', tahun, bulan) BETWEEN ? AND ?' : ' AND 1 = 0'; return safeAll<any>(db, `SELECT COUNT(*) AS bulan,
      SUM(nominal) AS nominal, SUM(total_dibayar) AS dibayar, SUM(total_diskon) AS diskon
      FROM fin_spp_tagihan WHERE siswa_id = ?${f}`, period?.startDate && period.endDate ? [studentId, period.startDate, period.endDate] : [studentId]) })(),
    safeFirst<any>(db, `SELECT jumlah, total_dibayar, status FROM fin_spp_saldo_awal WHERE siswa_id = ?`, [studentId]),
    safeAll<any>(db, `SELECT COUNT(*) AS tagihan, SUM(total_nominal) AS nominal,
      SUM(total_dibayar) AS dibayar, SUM(total_diskon) AS diskon
      FROM fin_koperasi_tagihan WHERE siswa_id = ?${taSql}`, [studentId, ...taBinds]),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT kategori, COUNT(*) AS jumlah,
      SUM(CASE WHEN is_void = 0 THEN jumlah_total ELSE 0 END) AS total,
      SUM(CASE WHEN is_void = 1 THEN 1 ELSE 0 END) AS void
      FROM fin_transaksi WHERE siswa_id = ?${f.sql} GROUP BY kategori`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT alasan, COUNT(*) AS jumlah, SUM(jumlah) AS total
      FROM fin_diskon WHERE siswa_id = ?${f.sql} GROUP BY alasan`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('tanggal_janji'); return safeAll<any>(db, `SELECT target_type, COUNT(*) AS jumlah
      FROM fin_janji_bayar WHERE siswa_id = ?${f.sql} GROUP BY target_type`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT status, COUNT(*) AS jumlah, SUM(jumlah) AS total
      FROM fin_payment_submissions WHERE siswa_id = ?${f.sql} GROUP BY status`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT type, level, COUNT(*) AS jumlah,
      SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS dibaca FROM parent_notifications
      WHERE siswa_id = ?${f.sql} GROUP BY type, level`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT status, COUNT(*) AS jumlah,
      SUM(CASE WHEN parent_responded_at IS NOT NULL THEN 1 ELSE 0 END) AS direspons
      FROM parent_summons WHERE siswa_id = ?${f.sql} GROUP BY status`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT actor_type, note_type, COUNT(*) AS jumlah
      FROM parent_thread_notes WHERE siswa_id = ?${f.sql} GROUP BY actor_type, note_type`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT category, status, COUNT(*) AS jumlah
      FROM parent_suggestions WHERE siswa_id = ?${f.sql} GROUP BY category, status`, [studentId, ...f.binds]) })(),
    (() => { const f = dateFilter('created_at'); return safeAll<any>(db, `SELECT jenis_surat, COUNT(*) AS jumlah,
      MIN(created_at) AS pertama, MAX(created_at) AS terakhir FROM surat_keluar
      WHERE json_valid(data_surat) = 1 AND (
        json_extract(data_surat, '$.siswa_id') = ? OR
        json_extract(data_surat, '$.siswa.id') = ? OR
        json_extract(data_surat, '$.nisn') = ? OR
        json_extract(data_surat, '$.siswa.nisn') = ?
      )${f.sql} GROUP BY jenis_surat`, [studentId, studentId, student.nisn, student.nisn, ...f.binds]) })(),
    safeFirst<any>(db, `SELECT COALESCE(u.nama_lengkap, u.name) AS nama, u.nip, u.signature_url
      FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role = 'kepsek' OR ur.role = 'kepsek'
      ORDER BY CASE WHEN u.role = 'kepsek' THEN 0 ELSE 1 END LIMIT 1`),
    safeFirst<any>(db, `SELECT COALESCE(u.nama_lengkap, u.name) AS nama, u.nip, u.signature_url
      FROM riwayat_kelas rk JOIN kelas k ON k.id = rk.kelas_id
      JOIN "user" u ON u.id = k.wali_kelas_id
      WHERE rk.siswa_id = ? ORDER BY rk.created_at DESC LIMIT 1`, [studentId]),
  ])

  const resolvedPrincipal = principal || await safeFirst<any>(db, `SELECT COALESCE(u.nama_lengkap, u.name) AS nama,
    u.nip, NULL AS signature_url FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.role = 'kepsek' OR ur.role = 'kepsek'
    ORDER BY CASE WHEN u.role = 'kepsek' THEN 0 ELSE 1 END LIMIT 1`)
  const resolvedLatestHomeroom = latestHomeroom || await safeFirst<any>(db, `SELECT COALESCE(u.nama_lengkap, u.name) AS nama,
    u.nip, NULL AS signature_url FROM riwayat_kelas rk JOIN kelas k ON k.id = rk.kelas_id
    JOIN "user" u ON u.id = k.wali_kelas_id WHERE rk.siswa_id = ?
    ORDER BY rk.created_at DESC LIMIT 1`, [studentId])

  const className = student.tingkat
    ? formatNamaKelas(number(student.tingkat), text(student.nomor_kelas), text(student.kelompok))
    : 'Belum Ada Kelas'
  const homeroom = student.wali_kelas_nama ? {
    nama: text(student.wali_kelas_nama),
    nip: student.wali_kelas_nip || null,
    signature_url: student.wali_kelas_signature || null,
  } : resolvedLatestHomeroom

  const academicTables: ReportTable[] = []
  const academicValues: number[] = []
  if (academicRecord) {
    const records = period && classHistory[0]?.tingkat
      ? (() => {
          const semesters = period.semester === 0 ? [1, 2] : [period.semester]
          return semesters.flatMap(semester => {
            const key = semesterKey(number(classHistory[0].tingkat), semester)
            return key ? [{ label: `${period.nama} · Semester ${semester}`, values: parseObject(academicRecord[key]) }] : []
          })
        })()
      : [1, 2, 3, 4, 5, 6].map(index => ({ label: `Semester ${index}`, values: parseObject(academicRecord[`nilai_smt${index}`]) }))
    const subjects = Array.from(new Set(records.flatMap(item => Object.keys(item.values)))).sort()
    if (subjects.length) {
      const rows = subjects.map(subject => {
        const values = records.map(item => item.values[subject])
        values.forEach(value => { const n = Number(value); if (Number.isFinite(n)) academicValues.push(n) })
        return [subject, ...values.map(value => text(value))]
      })
      academicTables.push({ title: 'Nilai Rapor per Mata Pelajaran', headers: ['Mata Pelajaran', ...records.map(item => item.label)], rows })
    }
  }

  const totalAttendance = number(attendanceSessions?.total)
  const totalAbsent = attendance.reduce((sum, row) => sum + number(row.jumlah), 0)
  const present = Math.max(0, totalAttendance - totalAbsent)
  const attendanceWithPresent = [{ status: 'HADIR', jumlah: present }, ...attendance]
  const violationPoints = violations.reduce((sum, row) => sum + number(row.poin), 0)
  const activeSanction = [...sanctionConfigs]
    .sort((a, b) => number(b.poin_minimal) - number(a.poin_minimal))
    .find(item => violationPoints >= number(item.poin_minimal))
  const transactionTotal = transactions.reduce((sum, row) => sum + number(row.total), 0)
  const dsptOutstanding = Math.max(0, number(dspt?.nominal_target) - number(dspt?.total_dibayar) - number(dspt?.total_diskon))
  const spp = sppRows[0] || {}
  const sppOutstanding = Math.max(0, number(spp.nominal) - number(spp.dibayar) - number(spp.diskon)) +
    Math.max(0, number(sppOpening?.jumlah) - number(sppOpening?.total_dibayar))
  const coop = cooperativeRows[0] || {}
  const coopOutstanding = Math.max(0, number(coop.nominal) - number(coop.dibayar) - number(coop.diskon))

  const sections: ReportSection[] = [
    section('identitas', 'Identitas dan Riwayat Pendidikan', `Profil administrasi dan perjalanan kelas pada ${periodLabel(period)}.`, [
      { label: 'Status Siswa', value: text(student.status).toUpperCase() },
      { label: 'Kelas Saat Ini', value: className },
      { label: 'Asal Sekolah', value: text(student.asal_sekolah) },
      { label: 'Tempat Tinggal', value: text(student.tempat_tinggal) },
      { label: 'Riwayat Kelas', value: integer(classHistory.length), detail: 'entri semester' },
      { label: 'Jalur PMB', value: text(admission?.jalur) },
    ], [
      { title: 'Biodata Administratif', headers: ['Data', 'Keterangan'], rows: [
        ['NIK', text(student.nik)], ['Nomor Kartu Keluarga', text(student.nomor_kk)],
        ['Tempat, Tanggal Lahir', `${text(student.tempat_lahir)}, ${date(student.tanggal_lahir)}`],
        ['Jenis Kelamin', student.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'],
        ['Agama', text(student.agama)], ['Anak Ke / Jumlah Saudara', `${text(student.anak_ke)} / ${text(student.jumlah_saudara)}`],
        ['Status Anak', text(student.status_anak)], ['Nomor WhatsApp', text(student.nomor_whatsapp)],
        ['Alamat Lengkap', [student.alamat_lengkap, student.rt ? `RT ${student.rt}` : null, student.rw ? `RW ${student.rw}` : null, student.desa_kelurahan, student.kecamatan, student.kabupaten_kota, student.provinsi, student.kode_pos].filter(Boolean).join(', ') || '-'],
      ] },
      { title: 'Data Orang Tua', headers: ['Data', 'Ayah', 'Ibu'], rows: [
        ['Nama', text(student.nama_ayah), text(student.nama_ibu)],
        ['NIK', text(student.nik_ayah), text(student.nik_ibu)],
        ['Tempat, Tanggal Lahir', `${text(student.tempat_lahir_ayah)}, ${date(student.tanggal_lahir_ayah)}`, `${text(student.tempat_lahir_ibu)}, ${date(student.tanggal_lahir_ibu)}`],
        ['Status', text(student.status_ayah), text(student.status_ibu)],
        ['Pendidikan', text(student.pendidikan_ayah), text(student.pendidikan_ibu)],
        ['Pekerjaan', text(student.pekerjaan_ayah), text(student.pekerjaan_ibu)],
        ['Penghasilan', text(student.penghasilan_ayah), text(student.penghasilan_ibu)],
      ] },
      { title: 'Riwayat Kelas', headers: ['Tahun Ajaran', 'Semester', 'Kelas'], rows: classHistory.map(row => [text(row.nama), text(row.semester), text(row.kelas_nama)]) },
      { title: 'Riwayat Penerimaan', headers: ['No. Pendaftaran', 'Tahun', 'Status', 'Daftar Ulang', 'Nilai Rapor'], rows: admission ? [[text(admission.no_pendaftaran), text(admission.tahun_ajaran), text(admission.status_kelulusan), text(admission.daftar_ulang_status), text(admission.nilai_rapor)]] : [] },
      { title: 'Prestasi Saat Penerimaan', headers: ['Kategori', 'Tingkat', 'Jumlah'], rows: admissionAchievements.map(row => [text(row.kategori), text(row.tingkat), integer(row.jumlah)]) },
    ]),
    section('akademik', 'Akademik, Minat, dan Rencana Lanjutan', `Ringkasan capaian akademik dan pemetaan potensi pada ${periodLabel(period)}.`, [
      { label: 'Rata-rata Nilai Rapor', value: academicValues.length ? decimal(academicValues.reduce((a, b) => a + b, 0) / academicValues.length) : '-' },
      { label: 'Mapel Nilai Harian', value: integer(dailyGrades.length) },
      { label: 'IQ / Klasifikasi', value: psychology ? `${text(psychology.iq_score)} / ${text(psychology.iq_klasifikasi)}` : '-' },
      { label: 'Rekomendasi Jurusan', value: text(psychology?.rekom_jurusan || student.minat_jurusan) },
      { label: 'Gaya Belajar', value: text(psychology?.gaya_belajar) },
      { label: 'Rencana Pascalulus', value: text(futurePlans[0]?.kategori).replaceAll('_', ' ') },
    ], [
      ...academicTables,
      { title: 'Profil Psikotes dan Minat', headers: ['Aspek', 'Hasil'], rows: psychology ? [
        ['IQ / Klasifikasi', `${text(psychology.iq_score)} / ${text(psychology.iq_klasifikasi)}`],
        ['RIASEC', text(psychology.riasec)], ['MBTI', text(psychology.mbti)],
        ['Gaya Belajar', text(psychology.gaya_belajar)], ['Mapel Pilihan', text(psychology.mapel_pilihan)],
        ['Rekomendasi Jurusan', text(psychology.rekom_jurusan)],
      ] : [] },
      { title: 'Ringkasan Nilai Harian', headers: ['Mata Pelajaran', 'Penilaian', 'Rata-rata', 'Minimum', 'Maksimum', 'Tuntas'], rows: dailyGrades.map(row => [text(row.nama_mapel), integer(row.jumlah_penilaian), decimal(row.rata_rata), decimal(row.minimum), decimal(row.maksimum), `${integer(row.tuntas)}/${integer(row.jumlah_penilaian)}`]) },
      { title: 'Program Unggulan', headers: ['Status', 'Capaian', 'Jumlah'], rows: programTests.map(row => [text(row.status), text(row.nilai), integer(row.jumlah)]) },
      { title: 'TKA', headers: ['Tahun/Semester', 'Pilihan 1', 'Pilihan 2', 'B. Indonesia', 'Matematika', 'B. Inggris'], rows: tkaRows.map(row => [`${text(row.nama)} / ${text(row.semester)}`, text(row.mapel_pilihan1), text(row.mapel_pilihan2), text(row.nilai_bind), text(row.nilai_mat), text(row.nilai_bing)]) },
      { title: 'Penjurusan', headers: ['Tahun/Semester', 'Minat', 'Status'], rows: plotting.map(row => [`${text(row.nama)} / ${text(row.semester)}`, text(row.minat_jurusan), text(row.status)]) },
      { title: 'Pendidikan Lanjutan', headers: ['Tahun/Semester', 'Jenis', 'Perguruan Tinggi', 'Program Studi', 'Jalur/Status'], rows: universityResults.map(row => [`${text(row.nama)} / ${text(row.semester)}`, text(row.jenis_data), text(row.kampus_nama), text(row.program_studi), `${text(row.jalur)} / ${text(row.status)}`]) },
    ]),
    section('kehadiran', 'Kehadiran dan Perizinan', `Rekap kehadiran tanpa menampilkan baris absensi per jam pada ${periodLabel(period)}.`, [
      { label: 'Rekaman Absensi', value: integer(totalAttendance) },
      { label: 'Tingkat Kehadiran', value: totalAttendance ? `${decimal((present / totalAttendance) * 100)}%` : '-' },
      { label: 'Koreksi Wali Kelas', value: integer(attendanceCorrections.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Izin Kelas', value: integer(classPermits.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Izin Keluar Kompleks', value: integer(exitPermits.reduce((s, r) => s + number(r.jumlah), 0)) },
    ], [
      { title: 'Status Kehadiran', headers: ['Status', 'Jumlah'], rows: groupRows(attendanceWithPresent, 'status') },
      { title: 'Rekap Bulanan', headers: ['Tahun/Semester', 'Bulan', 'Sakit', 'Izin', 'Alfa'], rows: monthlyAttendance.map(row => [`${text(row.nama)} / ${text(row.semester)}`, text(row.bulan), integer(row.sakit), integer(row.izin), integer(row.alpa)]) },
      { title: 'Koreksi Wali Kelas', headers: ['Status Akhir', 'Jumlah'], rows: groupRows(attendanceCorrections, 'status') },
      { title: 'Alasan Izin Kelas', headers: ['Alasan', 'Jumlah'], rows: groupRows(classPermits, 'alasan') },
      { title: 'Izin Keluar Kompleks', headers: ['Status', 'Jumlah'], rows: groupRows(exitPermits, 'status') },
    ]),
    section('kedisiplinan', 'Kedisiplinan dan Tindak Lanjut', `Ringkasan pelanggaran serta penanganan resmi pada ${periodLabel(period)}.`, [
      { label: 'Total Pelanggaran', value: integer(violations.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Akumulasi Poin', value: integer(violationPoints) },
      { label: 'Tingkat Sanksi', value: text(activeSanction?.nama) },
      { label: 'Surat Peringatan', value: integer(warningLetters.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Tindak Lanjut', value: integer(warningFollowups.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Keputusan Terakhir', value: warningDecision ? text(warningDecision.keputusan).toUpperCase() : '-' },
    ], [
      { title: 'Pelanggaran per Kategori', headers: ['Kategori', 'Kejadian', 'Poin'], rows: violations.map(row => [text(row.kategori), integer(row.jumlah), integer(row.poin)]) },
      { title: 'Surat Peringatan', headers: ['Tingkat', 'Jumlah', 'Poin Tertinggi Saat Terbit'], rows: warningLetters.map(row => [text(row.level).toUpperCase(), integer(row.jumlah), integer(row.poin_tertinggi)]) },
      { title: 'Jenis Tindak Lanjut', headers: ['Jenis', 'Jumlah'], rows: groupRows(warningFollowups, 'jenis') },
    ]),
    section('bk_catatan', 'Bimbingan Konseling dan Catatan Internal', 'Hanya statistik, kategori, serta status penanganan; narasi mentah tidak dicetak.', [
      { label: 'Layanan BK', value: integer(bkRows.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Bidang BK', value: integer(new Set(bkRows.map(row => row.bidang)).size) },
      { label: 'Catatan Guru', value: integer(notesRows.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Mapel Pencatat', value: integer(notesRows.length) },
    ], [
      { title: 'Layanan BK', headers: ['Bidang', 'Status Tindak Lanjut', 'Jumlah', 'Rentang'], rows: bkRows.map(row => [text(row.bidang), text(row.tindak_lanjut).replaceAll('_', ' '), integer(row.jumlah), `${date(row.pertama)} – ${date(row.terakhir)}`]) },
      { title: 'Catatan Internal Guru', headers: ['Mata Pelajaran', 'Jumlah', 'Rentang'], rows: notesRows.map(row => [text(row.mapel_nama_snapshot), integer(row.jumlah), `${date(row.pertama)} – ${date(row.terakhir)}`]) },
    ]),
    section('program', 'Tahfidz dan Ekstrakurikuler', `Capaian program pengembangan siswa pada ${periodLabel(period)}.`, [
      { label: 'Juz Dipantau', value: integer(new Set(tahfidzProgress.map(row => row.juz)).size) },
      { label: 'Ayat Tercatat', value: integer(tahfidzProgress.reduce((s, r) => s + number(r.ayat), 0)) },
      { label: 'Setoran', value: integer(tahfidzLogs.reduce((s, r) => s + number(r.setoran), 0)) },
      { label: 'Ekstrakurikuler', value: integer(extracurricularRows.length) },
    ], [
      { title: 'Capaian Tahfidz', headers: ['Juz', 'Surah', 'Ayat', 'Setoran', 'Nilai'], rows: Array.from(new Set([...tahfidzProgress, ...tahfidzLogs, ...tahfidzScores].map(row => number(row.juz)))).sort((a, b) => a - b).map(juz => {
        const progress = tahfidzProgress.find(row => number(row.juz) === juz)
        const log = tahfidzLogs.find(row => number(row.juz) === juz)
        const score = tahfidzScores.find(row => number(row.juz) === juz)
        return [text(juz), integer(progress?.surah), integer(progress?.ayat), integer(log?.setoran), text(score?.nilai)]
      }) },
      { title: 'Ekstrakurikuler', headers: ['Kegiatan', 'Status', 'Nilai', 'Tahun/Semester'], rows: extracurricularRows.map(row => [text(row.nama), text(row.status), text(row.nilai), row.tahun_ajaran ? `${row.tahun_ajaran} / ${text(row.semester)}` : '-']) },
      { title: 'Ketidakhadiran Ekstrakurikuler', headers: ['Kegiatan', 'Status', 'Jumlah'], rows: extracurricularAttendance.map(row => [text(row.nama), text(row.status), integer(row.jumlah)]) },
    ]),
    section('keuangan', 'Keuangan Siswa', `Ringkasan kewajiban dan pembayaran pada ${periodLabel(period)}.`, [
      { label: 'Sisa DSPT', value: rupiah(dsptOutstanding) },
      { label: 'Sisa SPP', value: rupiah(sppOutstanding) },
      { label: 'Sisa Koperasi', value: rupiah(coopOutstanding) },
      { label: 'Total Transaksi', value: rupiah(transactionTotal) },
      { label: 'Janji Bayar', value: integer(promises.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Pengajuan Pembayaran', value: integer(paymentSubmissions.reduce((s, r) => s + number(r.jumlah), 0)) },
    ], [
      { title: 'Ringkasan Tagihan', headers: ['Jenis', 'Nominal', 'Dibayar', 'Diskon', 'Sisa'], rows: [
        ['DSPT', rupiah(dspt?.nominal_target), rupiah(dspt?.total_dibayar), rupiah(dspt?.total_diskon), rupiah(dsptOutstanding)],
        ['SPP', rupiah(number(spp.nominal) + number(sppOpening?.jumlah)), rupiah(number(spp.dibayar) + number(sppOpening?.total_dibayar)), rupiah(spp.diskon), rupiah(sppOutstanding)],
        ['Koperasi', rupiah(coop.nominal), rupiah(coop.dibayar), rupiah(coop.diskon), rupiah(coopOutstanding)],
      ] },
      { title: 'Transaksi per Kategori', headers: ['Kategori', 'Transaksi', 'Total Sah', 'Dibatalkan'], rows: transactions.map(row => [text(row.kategori), integer(row.jumlah), rupiah(row.total), integer(row.void)]) },
      { title: 'Keringanan', headers: ['Alasan', 'Jumlah', 'Total'], rows: discounts.map(row => [text(row.alasan), integer(row.jumlah), rupiah(row.total)]) },
      { title: 'Janji Bayar', headers: ['Jenis', 'Jumlah'], rows: groupRows(promises, 'target_type') },
      { title: 'Pengajuan Pembayaran', headers: ['Status', 'Jumlah', 'Nominal'], rows: paymentSubmissions.map(row => [text(row.status), integer(row.jumlah), rupiah(row.total)]) },
    ]),
    section('komunikasi', 'Komunikasi Orang Tua dan Administrasi', `Ringkasan komunikasi langsung dan dokumen siswa pada ${periodLabel(period)}.`, [
      { label: 'Notifikasi Langsung', value: integer(parentNotifications.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Panggilan Orang Tua', value: integer(parentSummons.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Catatan Komunikasi', value: integer(parentNotes.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Saran Orang Tua', value: integer(parentSuggestions.reduce((s, r) => s + number(r.jumlah), 0)) },
      { label: 'Surat Keluar', value: integer(outgoingLetters.reduce((s, r) => s + number(r.jumlah), 0)) },
    ], [
      { title: 'Notifikasi Orang Tua', headers: ['Jenis', 'Tingkat', 'Jumlah', 'Dibaca'], rows: parentNotifications.map(row => [text(row.type), text(row.level), integer(row.jumlah), integer(row.dibaca)]) },
      { title: 'Panggilan Orang Tua', headers: ['Status', 'Jumlah', 'Direspons'], rows: parentSummons.map(row => [text(row.status), integer(row.jumlah), integer(row.direspons)]) },
      { title: 'Catatan Komunikasi', headers: ['Pelaku', 'Jenis', 'Jumlah'], rows: parentNotes.map(row => [text(row.actor_type), text(row.note_type), integer(row.jumlah)]) },
      { title: 'Saran Orang Tua', headers: ['Kategori', 'Status', 'Jumlah'], rows: parentSuggestions.map(row => [text(row.category), text(row.status), integer(row.jumlah)]) },
      { title: 'Surat Keluar', headers: ['Jenis Surat', 'Jumlah', 'Rentang'], rows: outgoingLetters.map(row => [text(row.jenis_surat), integer(row.jumlah), `${date(row.pertama)} – ${date(row.terakhir)}`]) },
    ]),
  ]

  return {
    student,
    className,
    period,
    periods,
    generatedAt: new Date().toISOString(),
    principal: resolvedPrincipal,
    homeroom,
    sections,
  }
}
