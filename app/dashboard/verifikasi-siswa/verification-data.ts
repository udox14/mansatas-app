import { formatNamaKelas } from '@/lib/utils'
import { ensureRiwayatKelasSnapshotColumns } from '@/lib/riwayat-kelas'
import {
  academicIndicator,
  academicYearDates,
  attendanceIndicator,
  counselingIndicator,
  disciplineIndicator,
  parseVerificationThresholds,
  riskLabel,
  summarizeRdmAcademic,
  VERIFICATION_ROLES,
  VERIFICATION_SETTINGS_ID,
  worstRisk,
  type DomainIndicator,
  type RiskLevel,
  type VerificationThresholds,
} from './verification-core'

export type VerificationYear = { name: string; semesterIds: string[]; active: boolean; startDate: string | null; endDate: string | null }
export type VerificationQueueStudent = {
  id: string
  nisn: string
  nis: string | null
  name: string
  photoUrl: string | null
  status: string
  classId: string | null
  className: string
  grade: number
  indicators: DomainIndicator[]
  overall: RiskLevel
}
export type VerificationQueueData = {
  years: VerificationYear[]
  selectedYear: VerificationYear
  settings: VerificationThresholds
  settingsUpdatedAt: string | null
  classes: { id: string; name: string }[]
  students: VerificationQueueStudent[]
}
export type InsightMetric = { label: string; value: string; hint?: string }
export type InsightDetail = { headers: string[]; rows: string[][] }
export type InsightSection = {
  id: string
  title: string
  description: string
  indicator?: DomainIndicator
  metrics: InsightMetric[]
  chart?: { kind: 'bar' | 'line' | 'donut'; data: Array<Record<string, string | number>>; keys: string[] }
  details: InsightDetail
  hasData: boolean
}
export type StudentInsightData = {
  student: VerificationQueueStudent & Record<string, unknown>
  year: VerificationYear
  years: VerificationYear[]
  settings: VerificationThresholds
  sections: InsightSection[]
  completeness: { domain: string; filled: boolean }[]
  generatedAt: string
}

type Row = Record<string, any>

export function canAccessStudentVerification(roles: string[]) {
  return roles.some(role => (VERIFICATION_ROLES as readonly string[]).includes(role))
}

async function safeAll<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T[]> {
  try {
    const result = await db.prepare(sql).bind(...binds).all<T>()
    return (result.results || []) as T[]
  } catch { return [] }
}

async function safeFirst<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T | null> {
  try { return await db.prepare(sql).bind(...binds).first<T>() } catch { return null }
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function display(value: unknown, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value)
}

function dateId(value: unknown) {
  if (!value) return '-'
  const source = String(value).slice(0, 10)
  const parsed = new Date(`${source}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? display(value) : parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function yearIn(ids: string[], column: string) {
  return ids.length ? { sql: ` AND ${column} IN (${ids.map(() => '?').join(',')})`, binds: ids } : { sql: ' AND 1 = 0', binds: [] as string[] }
}

function dateBetween(year: VerificationYear, column: string) {
  return year.startDate && year.endDate
    ? { sql: ` AND substr(${column}, 1, 10) BETWEEN ? AND ?`, binds: [year.startDate, year.endDate] }
    : { sql: ' AND 1 = 0', binds: [] as string[] }
}

export async function loadVerificationYears(db: D1Database, selectedName?: string): Promise<{ years: VerificationYear[]; selected: VerificationYear | null }> {
  const rows = await safeAll<{ id: string; nama: string; semester: number; is_active: number }>(db,
    'SELECT id, nama, semester, is_active FROM tahun_ajaran ORDER BY nama DESC, semester ASC')
  const grouped = new Map<string, VerificationYear>()
  for (const row of rows) {
    const current = grouped.get(row.nama) || { name: row.nama, semesterIds: [], active: false, ...academicYearDates(row.nama) }
    current.semesterIds.push(row.id)
    current.active ||= row.is_active === 1
    grouped.set(row.nama, current)
  }
  const years = Array.from(grouped.values())
  const selected = years.find(item => item.name === selectedName) || years.find(item => item.active) || years[0] || null
  return { years, selected }
}

async function loadSettings(db: D1Database) {
  const row = await safeFirst<{ value: string; updated_at: string | null }>(db,
    'SELECT value, updated_at FROM system_settings WHERE key = ?', [VERIFICATION_SETTINGS_ID])
  return { settings: parseVerificationThresholds(row?.value), updatedAt: row?.updated_at || null }
}

export async function loadVerificationQueue(db: D1Database, selectedName?: string): Promise<VerificationQueueData | null> {
  await ensureRiwayatKelasSnapshotColumns(db).catch(() => undefined)
  const [{ years, selected }, settingData] = await Promise.all([loadVerificationYears(db, selectedName), loadSettings(db)])
  if (!selected) return null

  const roster = await safeAll<Row>(db, `
    WITH history AS (
      SELECT rk.siswa_id, rk.kelas_id,
        COALESCE(rk.kelas_tingkat, k.tingkat) AS tingkat,
        COALESCE(rk.kelas_nomor, k.nomor_kelas) AS nomor_kelas,
        COALESCE(rk.kelas_kelompok, k.kelompok) AS kelompok,
        COALESCE(rk.kelas_nama, '') AS kelas_nama,
        ROW_NUMBER() OVER (PARTITION BY rk.siswa_id ORDER BY ta.semester DESC, rk.created_at DESC) AS rn
      FROM riwayat_kelas rk
      JOIN tahun_ajaran ta ON ta.id = rk.tahun_ajaran_id
      LEFT JOIN kelas k ON k.id = rk.kelas_id
      WHERE ta.nama = ?
    )
    SELECT s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.foto_url, s.status,
      COALESCE(h.kelas_id, CASE WHEN ? = 1 THEN s.kelas_id END) AS kelas_id,
      COALESCE(h.tingkat, CASE WHEN ? = 1 THEN ck.tingkat END) AS tingkat,
      COALESCE(h.nomor_kelas, CASE WHEN ? = 1 THEN ck.nomor_kelas END) AS nomor_kelas,
      COALESCE(h.kelompok, CASE WHEN ? = 1 THEN ck.kelompok END) AS kelompok,
      h.kelas_nama
    FROM siswa s
    LEFT JOIN history h ON h.siswa_id = s.id AND h.rn = 1
    LEFT JOIN kelas ck ON ck.id = s.kelas_id
    WHERE h.siswa_id IS NOT NULL OR (? = 1 AND s.kelas_id IS NOT NULL)
    ORDER BY COALESCE(h.tingkat, ck.tingkat), COALESCE(h.nomor_kelas, ck.nomor_kelas), s.nama_lengkap
  `, [selected.name, ...Array(5).fill(selected.active ? 1 : 0)])

  const ta = yearIn(selected.semesterIds, 'tahun_ajaran_id')
  const attendanceDate = dateBetween(selected, 'tanggal')
  const spDate = dateBetween(selected, 'tanggal_sp')
  const [rdmRows, attendanceSessions, absenceRows, disciplineRows, spRows, bkRows, disciplineConfig] = await Promise.all([
    safeAll<Row>(db, 'SELECT siswa_id, nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6 FROM rekap_nilai_akademik'),
    safeAll<Row>(db, `SELECT pm.kelas_id, COUNT(*) AS total FROM absensi_sesi_guru sg
      JOIN penugasan_mengajar pm ON pm.id=sg.penugasan_id
      WHERE 1=1${ta.sql.replaceAll('tahun_ajaran_id','pm.tahun_ajaran_id')} GROUP BY pm.kelas_id`, ta.binds),
    safeAll<Row>(db, `SELECT siswa_id, COUNT(*) AS tidak_hadir FROM (
      SELECT siswa_id,penugasan_id,tanggal FROM absensi_sesi_siswa WHERE UPPER(status)<>'HADIR'${attendanceDate.sql}
      UNION SELECT siswa_id,penugasan_id,tanggal FROM absensi_siswa WHERE UPPER(status)<>'HADIR'${attendanceDate.sql}
    ) GROUP BY siswa_id`, [...attendanceDate.binds,...attendanceDate.binds]),
    safeAll<Row>(db, `SELECT sp.siswa_id, COALESCE(SUM(mp.poin), 0) AS poin
      FROM siswa_pelanggaran sp JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
      WHERE 1=1${ta.sql.replaceAll('tahun_ajaran_id', 'sp.tahun_ajaran_id')} GROUP BY sp.siswa_id`, ta.binds),
    safeAll<Row>(db, `SELECT siswa_id,
      MAX(CASE LOWER(level) WHEN 'sp3' THEN 3 WHEN 'sp2' THEN 2 WHEN 'sp1' THEN 1 ELSE 0 END) AS level
      FROM surat_peringatan WHERE 1=1${spDate.sql} GROUP BY siswa_id`, spDate.binds),
    safeAll<Row>(db, `SELECT siswa_id,
      SUM(CASE WHEN UPPER(tindak_lanjut) IN ('SUDAH','SELESAI') THEN 0 ELSE 1 END) AS terbuka,
      SUM(CASE WHEN LOWER(bidang) IN ('darurat','berat','krisis') THEN 1 ELSE 0 END) AS kritis
      FROM bk_rekaman WHERE 1=1${ta.sql} GROUP BY siswa_id`, ta.binds),
    safeFirst<{ value: string }>(db, "SELECT value FROM kedisiplinan_config WHERE key = 'threshold_kritis'"),
  ])
  const index = <T extends Row>(rows: T[]) => new Map(rows.map(row => [String(row.siswa_id), row]))
  const rdm = index(rdmRows), absences = index(absenceRows), discipline = index(disciplineRows), sp = index(spRows), bk = index(bkRows)
  const sessionsByClass = new Map(attendanceSessions.map(row => [String(row.kelas_id), asNumber(row.total)]))
  const criticalPoints = asNumber(disciplineConfig?.value) || 75

  const students = roster.map(row => {
    const grade = asNumber(row.tingkat)
    const academicSummary = summarizeRdmAcademic(rdm.get(row.id) || null, grade)
    const totalSessions = sessionsByClass.get(String(row.kelas_id)) || 0
    const presentSessions = Math.max(0, totalSessions - asNumber(absences.get(row.id)?.tidak_hadir))
    const spLevel = asNumber(sp.get(row.id)?.level)
    const indicators = [
      academicIndicator(academicSummary.problematic, academicSummary.total, settingData.settings),
      attendanceIndicator(presentSessions, totalSessions, settingData.settings),
      disciplineIndicator(asNumber(discipline.get(row.id)?.poin), spLevel ? `SP${spLevel}` : null, criticalPoints),
      counselingIndicator(asNumber(bk.get(row.id)?.terbuka), asNumber(bk.get(row.id)?.kritis)),
    ]
    const fallbackClass = grade ? formatNamaKelas(grade, display(row.nomor_kelas, ''), display(row.kelompok, '')) : 'Tanpa kelas'
    return {
      id: String(row.id), nisn: display(row.nisn), nis: row.nis_lokal || null, name: display(row.nama_lengkap),
      photoUrl: row.foto_url || null, status: display(row.status), classId: row.kelas_id || null,
      className: row.kelas_nama || fallbackClass, grade, indicators, overall: worstRisk(indicators),
    } satisfies VerificationQueueStudent
  })
  const classes = Array.from(new Map(students.filter(s => s.classId).map(s => [s.classId!, { id: s.classId!, name: s.className }])).values())
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))
  return { years, selectedYear: selected, settings: settingData.settings, settingsUpdatedAt: settingData.updatedAt, classes, students }
}

function metric(label: string, value: unknown, hint?: string): InsightMetric { return { label, value: display(value), hint } }
function detail(headers: string[], rows: string[][]): InsightDetail { return { headers, rows } }

export async function loadStudentInsight(db: D1Database, studentId: string, selectedName?: string): Promise<StudentInsightData | null> {
  const queue = await loadVerificationQueue(db, selectedName)
  if (!queue) return null
  const queueStudent = queue.students.find(student => student.id === studentId)
  if (!queueStudent) return null
  const year = queue.selectedYear
  const ta = yearIn(year.semesterIds, 'tahun_ajaran_id')
  const dates = (column: string) => dateBetween(year, column)

  const student = await safeFirst<Row>(db, `SELECT id, nisn, nis_lokal, nama_lengkap, foto_url, status,
    jenis_kelamin, tempat_lahir, tanggal_lahir, agama, tempat_tinggal, asal_sekolah,
    alamat_lengkap, desa_kelurahan, kecamatan, kabupaten_kota, provinsi,
    nama_ayah, pendidikan_ayah, pekerjaan_ayah, nama_ibu, pendidikan_ibu, pekerjaan_ibu,
    minat_jurusan, nomor_whatsapp FROM siswa WHERE id = ?`, [studentId])
  if (!student) return null

  const attendanceDate = dates('a.tanggal')
  const permitDate = dates('tanggal')
  const exitDate = dates('waktu_keluar')
  const spDate = dates('tanggal_sp')
  const noteDate = dates('created_at')
  const [
    history, rdmRecord, dailyGrades, attendanceSessions, attendanceStatus, attendanceMonthly, permits, exits,
    violations, warningLetters, bkRecords, notes, psychology, tka, futurePlans, university,
    tahfidz, tahfidzLogs, tahfidzScores, extracurricular, extracurricularAttendance,
    admission, parentNotifications, parentSummons, parentNotes, outgoingLetters,
  ] = await Promise.all([
    safeAll<Row>(db, `SELECT COALESCE(rk.kelas_nama, 'Kelas ' || COALESCE(rk.kelas_tingkat,k.tingkat) || ' ' || COALESCE(rk.kelas_kelompok,k.kelompok) || '-' || COALESCE(rk.kelas_nomor,k.nomor_kelas)) AS kelas,
      ta.nama, ta.semester FROM riwayat_kelas rk LEFT JOIN kelas k ON k.id=rk.kelas_id LEFT JOIN tahun_ajaran ta ON ta.id=rk.tahun_ajaran_id
      WHERE rk.siswa_id=? ORDER BY ta.nama DESC, ta.semester DESC`, [studentId]),
    safeFirst<Row>(db, 'SELECT nilai_smt1,nilai_smt2,nilai_smt3,nilai_smt4,nilai_smt5,nilai_smt6 FROM rekap_nilai_akademik WHERE siswa_id=?', [studentId]),
    safeAll<Row>(db, `SELECT mp.nama_mapel, ta.semester, nh.judul, nh.tanggal, nh.kkm, nd.nilai
      FROM nilai_harian_detail nd JOIN nilai_harian_header nh ON nh.id=nd.header_id
      JOIN penugasan_mengajar pm ON pm.id=nh.penugasan_id JOIN mata_pelajaran mp ON mp.id=pm.mapel_id
      JOIN tahun_ajaran ta ON ta.id=nh.tahun_ajaran_id WHERE nd.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','nh.tahun_ajaran_id')}
      ORDER BY nh.tanggal DESC`, [studentId, ...ta.binds]),
    safeFirst<Row>(db, `SELECT COUNT(*) AS total FROM absensi_sesi_guru sg JOIN penugasan_mengajar pm ON pm.id=sg.penugasan_id
      WHERE pm.kelas_id=?${ta.sql.replaceAll('tahun_ajaran_id','pm.tahun_ajaran_id')}`, [queueStudent.classId,...ta.binds]),
    safeAll<Row>(db, `SELECT status,COUNT(*) AS jumlah FROM (
      SELECT UPPER(status) AS status,penugasan_id,tanggal FROM absensi_sesi_siswa WHERE siswa_id=? AND UPPER(status)<>'HADIR'${attendanceDate.sql.replaceAll('a.tanggal','tanggal')}
      UNION SELECT UPPER(status) AS status,penugasan_id,tanggal FROM absensi_siswa WHERE siswa_id=? AND UPPER(status)<>'HADIR'${attendanceDate.sql.replaceAll('a.tanggal','tanggal')}
    ) GROUP BY status`, [studentId,...attendanceDate.binds,studentId,...attendanceDate.binds]),
    safeAll<Row>(db, `SELECT r.bulan, ta.semester, SUM(r.sakit) AS sakit, SUM(r.izin) AS izin, SUM(r.alpa) AS alpa
      FROM rekap_kehadiran_bulanan r JOIN tahun_ajaran ta ON ta.id=r.tahun_ajaran_id WHERE r.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','r.tahun_ajaran_id')}
      GROUP BY ta.semester,r.bulan ORDER BY ta.semester,r.bulan`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT tanggal, alasan, jam_pelajaran FROM izin_tidak_masuk_kelas WHERE siswa_id=?${permitDate.sql} ORDER BY tanggal DESC`, [studentId, ...permitDate.binds]),
    safeAll<Row>(db, `SELECT waktu_keluar, waktu_kembali, status FROM izin_keluar_komplek WHERE siswa_id=?${exitDate.sql} ORDER BY waktu_keluar DESC`, [studentId, ...exitDate.binds]),
    safeAll<Row>(db, `SELECT sp.tanggal, mp.nama_pelanggaran, mp.kategori, mp.poin FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON mp.id=sp.master_pelanggaran_id WHERE sp.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','sp.tahun_ajaran_id')} ORDER BY sp.tanggal DESC`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT tanggal_sp, level, total_poin FROM surat_peringatan WHERE siswa_id=?${spDate.sql} ORDER BY tanggal_sp DESC`, [studentId, ...spDate.binds]),
    safeAll<Row>(db, `SELECT br.created_at, br.bidang, COALESCE(bt.nama,'Tidak ditentukan') AS topik, br.tindak_lanjut
      FROM bk_rekaman br LEFT JOIN bk_topik bt ON bt.id=br.topik_id WHERE br.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','br.tahun_ajaran_id')} ORDER BY br.created_at DESC`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT created_at, mapel_nama_snapshot, pencatat_nama_snapshot FROM catatan_siswa WHERE siswa_id=?${ta.sql} ORDER BY created_at DESC`, [studentId, ...ta.binds]),
    safeFirst<Row>(db, `SELECT iq_score,iq_klasifikasi,riasec,rekom_jurusan,mbti,gaya_belajar,mapel_pilihan FROM siswa_psikotes WHERE siswa_id=?`, [studentId]),
    safeAll<Row>(db, `SELECT ta.semester,p.mapel_pilihan1,p.mapel_pilihan2,h.nilai_bind,h.nilai_mat,h.nilai_bing,h.nilai_pilihan1,h.nilai_pilihan2
      FROM tka_mapel_pilihan p JOIN tahun_ajaran ta ON ta.id=p.tahun_ajaran_id LEFT JOIN tka_hasil h ON h.siswa_id=p.siswa_id AND h.tahun_ajaran_id=p.tahun_ajaran_id
      WHERE p.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','p.tahun_ajaran_id')} ORDER BY ta.semester`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT kategori FROM rencana_pasca_lulus WHERE siswa_id=?${ta.sql} ORDER BY updated_at DESC`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT kampus_nama,program_studi,jalur,status,pilihan_ke FROM penerimaan_pt WHERE siswa_id=?${ta.sql} ORDER BY pilihan_ke`, [studentId, ...ta.binds]),
    safeAll<Row>(db, `SELECT juz,COUNT(*) AS surah,SUM(json_array_length(ayat_hafal)) AS ayat FROM tahfidz_progress WHERE siswa_id=? GROUP BY juz ORDER BY juz`, [studentId]),
    (() => { const f=dates('created_at'); return safeAll<Row>(db, `SELECT juz,COUNT(*) AS setoran FROM tahfidz_setoran_log WHERE siswa_id=?${f.sql} GROUP BY juz ORDER BY juz`, [studentId,...f.binds]) })(),
    safeAll<Row>(db, `SELECT juz,nilai FROM tahfidz_nilai WHERE siswa_id=? ORDER BY juz`, [studentId]),
    safeAll<Row>(db, `SELECT e.nama,ea.status,en.nilai,ta.semester FROM ekstrakurikuler_anggota ea JOIN ekstrakurikuler e ON e.id=ea.ekstrakurikuler_id
      LEFT JOIN ekstrakurikuler_nilai en ON en.ekstrakurikuler_id=e.id AND en.siswa_id=ea.siswa_id${ta.sql.replaceAll('tahun_ajaran_id','en.tahun_ajaran_id')}
      LEFT JOIN tahun_ajaran ta ON ta.id=en.tahun_ajaran_id WHERE ea.siswa_id=? ORDER BY e.nama`, [...ta.binds, studentId]),
    safeAll<Row>(db, `SELECT e.nama,UPPER(a.status) AS status,COUNT(*) AS jumlah FROM ekstrakurikuler_absensi a
      JOIN ekstrakurikuler_pertemuan p ON p.id=a.pertemuan_id JOIN ekstrakurikuler e ON e.id=p.ekstrakurikuler_id
      WHERE a.siswa_id=?${ta.sql.replaceAll('tahun_ajaran_id','p.tahun_ajaran_id')} GROUP BY e.nama,UPPER(a.status)`, [studentId,...ta.binds]),
    safeFirst<Row>(db, `SELECT no_pendaftaran,tahun_ajaran,jalur,status_verifikasi,status_kelulusan,daftar_ulang_status FROM pmb_pendaftar WHERE siswa_id=? LIMIT 1`, [studentId]),
    safeAll<Row>(db, `SELECT created_at,type,level,is_read FROM parent_notifications WHERE siswa_id=?${noteDate.sql} ORDER BY created_at DESC`, [studentId,...noteDate.binds]),
    safeAll<Row>(db, `SELECT created_at,event_date,status,CASE WHEN parent_responded_at IS NULL THEN 'Belum' ELSE 'Sudah' END AS direspons FROM parent_summons WHERE siswa_id=?${noteDate.sql} ORDER BY created_at DESC`, [studentId,...noteDate.binds]),
    safeAll<Row>(db, `SELECT created_at,actor_type,note_type FROM parent_thread_notes WHERE siswa_id=?${noteDate.sql} ORDER BY created_at DESC`, [studentId,...noteDate.binds]),
    safeAll<Row>(db, `SELECT jenis_surat,created_at FROM surat_keluar WHERE json_valid(data_surat)=1 AND (json_extract(data_surat,'$.siswa_id')=? OR json_extract(data_surat,'$.siswa.id')=? OR json_extract(data_surat,'$.nisn')=?)${noteDate.sql} ORDER BY created_at DESC`, [studentId,studentId,student.nisn,...noteDate.binds]),
  ])

  const rdmSummary = summarizeRdmAcademic(rdmRecord, queueStudent.grade)
  const attCounts = new Map(attendanceStatus.map(row => [String(row.status), asNumber(row.jumlah)]))
  const totalAttendance = asNumber(attendanceSessions?.total)
  const totalAbsent = Array.from(attCounts.values()).reduce((sum, value) => sum + value, 0)
  const present = Math.max(0, totalAttendance - totalAbsent)
  const violationPoints = violations.reduce((sum, row) => sum + asNumber(row.poin), 0)
  const highestSp = warningLetters.reduce((highest, row) => Math.max(highest, asNumber(String(row.level).replace(/\D/g,''))), 0)
  const openBk = bkRecords.filter(row => !['SUDAH','SELESAI'].includes(String(row.tindak_lanjut).toUpperCase())).length
  const indicators = [
    academicIndicator(rdmSummary.problematic, rdmSummary.total, queue.settings),
    attendanceIndicator(present, totalAttendance, queue.settings),
    disciplineIndicator(violationPoints, highestSp ? `SP${highestSp}` : null),
    counselingIndicator(openBk),
  ]
  const byDomain = new Map(indicators.map(item => [item.domain, item]))

  const academicChart = rdmSummary.rows.map(row => ({ name: row.subject, 'Semester 1': row.semester1 || 0, 'Semester 2': row.semester2 || 0, KKM: 75 }))
  const attendanceChart = attendanceMonthly.map(row => ({ name: `S${row.semester}-${row.bulan}`, Sakit: asNumber(row.sakit), Izin: asNumber(row.izin), Alpa: asNumber(row.alpa) }))
  const disciplineCategoryMap = new Map<string, number>()
  for (const row of violations) disciplineCategoryMap.set(String(row.kategori), (disciplineCategoryMap.get(String(row.kategori)) || 0) + asNumber(row.poin))
  const disciplineCategories = Array.from(disciplineCategoryMap).map(([name,value]) => ({ name, Poin:value }))
  const bkCategoryMap = new Map<string, number>()
  for (const row of bkRecords) bkCategoryMap.set(String(row.bidang), (bkCategoryMap.get(String(row.bidang)) || 0) + 1)
  const bkCategories = Array.from(bkCategoryMap).map(([name,value]) => ({ name, Jumlah:value }))
  const tahfidzMap = new Map(tahfidz.map(row => [String(row.juz), row]))
  for (const row of tahfidzLogs) tahfidzMap.set(String(row.juz), { ...(tahfidzMap.get(String(row.juz))||{}), ...row })

  const sections: InsightSection[] = [
    {
      id:'profil',title:'Profil & Riwayat',description:'Identitas, keluarga, asal sekolah, PMB, dan perjalanan kelas.',
      metrics:[metric('Status',student.status),metric('Kelas periode',queueStudent.className),metric('Tempat tinggal',student.tempat_tinggal),metric('Asal sekolah',student.asal_sekolah)],
      details:detail(['Informasi','Nilai'],[
        ['Tempat, tanggal lahir',`${display(student.tempat_lahir)}, ${dateId(student.tanggal_lahir)}`],['Orang tua',`${display(student.nama_ayah)} / ${display(student.nama_ibu)}`],
        ['Alamat',[student.alamat_lengkap,student.desa_kelurahan,student.kecamatan,student.kabupaten_kota,student.provinsi].filter(Boolean).join(', ')||'-'],
        ['PMB',admission?`${display(admission.jalur)} · ${display(admission.status_kelulusan)} · daftar ulang ${display(admission.daftar_ulang_status)}`:'Tidak ada data'],
        ...history.map(row=>[`Riwayat ${display(row.nama)} S${display(row.semester)}`,display(row.kelas)]),
      ]),hasData:true,
    },
    {
      id:'akademik',title:'Akademik',description:'Rapor, nilai harian, KKM, TKA, psikotes, dan rencana lanjutan.',indicator:byDomain.get('akademik'),
      metrics:[metric('Rata-rata rapor',rdmSummary.rows.length?(rdmSummary.rows.reduce((s,r)=>s+(r.average||0),0)/rdmSummary.rows.length).toFixed(1):'-'),metric('Mapel bermasalah',`${rdmSummary.problematic}/${rdmSummary.total}`),metric('Penilaian harian',dailyGrades.length),metric('Minat jurusan',student.minat_jurusan)],
      chart:{kind:'bar',data:academicChart,keys:['Semester 1','Semester 2','KKM']},
      details:detail(['Sumber','Periode/Mapel','Nilai/Status','Keterangan'],[
        ...rdmSummary.rows.map(row=>['Rapor',row.subject,row.average?.toFixed(1)||'-',row.reason]),
        ...dailyGrades.map(row=>['Nilai harian',`${row.nama_mapel} · ${dateId(row.tanggal)}`,`${row.nilai} / KKM ${row.kkm}`,asNumber(row.nilai)>=asNumber(row.kkm)?'Tuntas':'Belum tuntas']),
        ...(psychology?[['Psikotes',display(psychology.riasec),display(psychology.iq_klasifikasi),display(psychology.rekom_jurusan)]]:[]),
        ...tka.map(row=>['TKA',`Semester ${row.semester}`,`${display(row.nilai_bind)} · ${display(row.nilai_mat)} · ${display(row.nilai_bing)}`,`${display(row.mapel_pilihan1)} / ${display(row.mapel_pilihan2)}`]),
        ...futurePlans.map(row=>['Rencana pascalulus',display(row.kategori),'-','Tercatat']),
        ...university.map(row=>['Penerimaan PT',`${display(row.kampus_nama)} · ${display(row.program_studi)}`,display(row.status),display(row.jalur)]),
      ]),hasData:rdmSummary.total>0||dailyGrades.length>0||Boolean(psychology)||tka.length>0,
    },
    {
      id:'kehadiran',title:'Kehadiran & Perizinan',description:'Persentase hadir, tren bulanan, izin kelas, dan izin keluar.',indicator:byDomain.get('kehadiran'),
      metrics:[metric('Kehadiran',totalAttendance?`${(present/totalAttendance*100).toFixed(1)}%`:'-'),metric('Hadir',present),metric('Izin kelas',permits.length),metric('Izin keluar',exits.length)],
      chart:{kind:'line',data:attendanceChart,keys:['Sakit','Izin','Alpa']},
      details:detail(['Tanggal/Periode','Jenis','Status','Pokok informasi'],[
        [year.name,'Rekap kehadiran','HADIR',`${present} dari ${totalAttendance} sesi`],
        ...attendanceStatus.map(row=>[year.name,'Rekap kehadiran',display(row.status),`${row.jumlah} kejadian`]),
        ...permits.map(row=>[dateId(row.tanggal),'Izin kelas',display(row.alasan),display(row.jam_pelajaran)]),
        ...exits.map(row=>[dateId(row.waktu_keluar),'Izin keluar',display(row.status),row.waktu_kembali?'Sudah tercatat kembali':'Belum ada waktu kembali']),
      ]),hasData:totalAttendance>0||attendanceMonthly.length>0||permits.length>0||exits.length>0,
    },
    {
      id:'kedisiplinan',title:'Kedisiplinan',description:'Poin, kategori pelanggaran, serta tingkat Surat Peringatan.',indicator:byDomain.get('kedisiplinan'),
      metrics:[metric('Total poin',violationPoints),metric('Kasus',violations.length),metric('SP tertinggi',highestSp?`SP${highestSp}`:'Tidak ada'),metric('Kategori',disciplineCategories.length)],
      chart:{kind:'donut',data:disciplineCategories,keys:['Poin']},
      details:detail(['Tanggal','Kategori','Pokok kejadian','Poin/Status'],[
        ...violations.map(row=>[dateId(row.tanggal),display(row.kategori),display(row.nama_pelanggaran),`${row.poin} poin`]),
        ...warningLetters.map(row=>[dateId(row.tanggal_sp),'Surat Peringatan',display(row.level).toUpperCase(),`${row.total_poin} poin saat ditetapkan`]),
      ]),hasData:violations.length>0||warningLetters.length>0,
    },
    {
      id:'bk',title:'BK & Catatan Internal',description:'Kategori penanganan, status tindak lanjut, dan metadata catatan tanpa narasi mentah.',indicator:byDomain.get('bk'),
      metrics:[metric('Rekaman BK',bkRecords.length),metric('Belum selesai',openBk),metric('Catatan guru',notes.length),metric('Bidang',bkCategories.length)],
      chart:{kind:'donut',data:bkCategories,keys:['Jumlah']},
      details:detail(['Tanggal','Sumber','Kategori/Topik','Status'],[
        ...bkRecords.map(row=>[dateId(row.created_at),'BK',`${display(row.bidang)} · ${display(row.topik)}`,display(row.tindak_lanjut)]),
        ...notes.map(row=>[dateId(row.created_at),'Catatan internal',display(row.mapel_nama_snapshot),`Dicatat oleh ${display(row.pencatat_nama_snapshot)}`]),
      ]),hasData:bkRecords.length>0||notes.length>0,
    },
    {
      id:'program',title:'Tahfidz & Ekstrakurikuler',description:'Capaian program pendukung yang tidak memengaruhi indikator kelayakan.',
      metrics:[metric('Juz tercatat',tahfidzMap.size),metric('Total setoran',tahfidzLogs.reduce((s,r)=>s+asNumber(r.setoran),0)),metric('Ekstrakurikuler',extracurricular.length),metric('Rekap absen ekskul',extracurricularAttendance.reduce((s,r)=>s+asNumber(r.jumlah),0))],
      chart:{kind:'bar',data:Array.from(tahfidzMap.values()).map(row=>({name:`Juz ${row.juz}`,Ayat:asNumber(row.ayat),Setoran:asNumber(row.setoran)})),keys:['Ayat','Setoran']},
      details:detail(['Program','Periode/Bagian','Capaian','Status'],[
        ...Array.from(tahfidzMap.values()).map(row=>['Tahfidz',`Juz ${row.juz}`,`${asNumber(row.ayat)} ayat · ${asNumber(row.setoran)} setoran`,display(tahfidzScores.find(n=>String(n.juz)===String(row.juz))?.nilai)]),
        ...extracurricular.map(row=>['Ekstrakurikuler',display(row.nama),display(row.nilai),display(row.status)]),
        ...extracurricularAttendance.map(row=>['Kehadiran ekskul',display(row.nama),`${row.jumlah} kali`,display(row.status)]),
      ]),hasData:tahfidzMap.size>0||extracurricular.length>0,
    },
    {
      id:'komunikasi',title:'Komunikasi & Administrasi',description:'Status komunikasi orang tua dan surat terkait tanpa isi pesan atau lampiran.',
      metrics:[metric('Notifikasi',parentNotifications.length),metric('Panggilan orang tua',parentSummons.length),metric('Catatan komunikasi',parentNotes.length),metric('Surat terkait',outgoingLetters.length)],
      chart:{kind:'bar',data:[{name:'Notifikasi',Jumlah:parentNotifications.length},{name:'Panggilan',Jumlah:parentSummons.length},{name:'Catatan',Jumlah:parentNotes.length},{name:'Surat',Jumlah:outgoingLetters.length}],keys:['Jumlah']},
      details:detail(['Tanggal','Jenis','Kategori','Status'],[
        ...parentNotifications.map(row=>[dateId(row.created_at),'Notifikasi',display(row.type),row.is_read?'Dibaca':'Belum dibaca']),
        ...parentSummons.map(row=>[dateId(row.event_date||row.created_at),'Panggilan orang tua','Pemanggilan',`${display(row.status)} · respons ${display(row.direspons)}`]),
        ...parentNotes.map(row=>[dateId(row.created_at),'Catatan komunikasi',display(row.note_type),display(row.actor_type)]),
        ...outgoingLetters.map(row=>[dateId(row.created_at),'Surat keluar',display(row.jenis_surat),'Tercatat']),
      ]),hasData:parentNotifications.length>0||parentSummons.length>0||parentNotes.length>0||outgoingLetters.length>0,
    },
  ]

  return {
    student:{...queueStudent,...student,indicators,overall:worstRisk(indicators),overallLabel:riskLabel(worstRisk(indicators))},
    year,years:queue.years,settings:queue.settings,sections,
    completeness:sections.map(section=>({domain:section.title,filled:section.hasData})),generatedAt:new Date().toISOString(),
  }
}
