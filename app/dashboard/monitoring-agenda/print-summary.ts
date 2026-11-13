import { teacherPerformance, isSchoolLeave, type TeacherLeaveMetadata } from '@/lib/teacher-leave'

export type PerformancePolicy = 'excused_not_penalized' | 'excused_penalized'
export type TeacherAttendanceSort =
  | 'name_asc'
  | 'performance_asc'
  | 'performance_desc'
  | 'hadir_desc'
  | 'izin_desc'
  | 'sakit_desc'
  | 'alfa_desc'

export type AgendaPrintSession = TeacherLeaveMetadata & {
  pengganti_cuti_nama?: string | null
  penugasan_id: string
  tanggal: string
  guru_id: string
  guru_nama: string
  nama_mapel: string
  kelas_id: string
  tingkat: number
  nomor_kelas: number
  kelompok?: string | null
  jam_ke_mulai: number
  jam_ke_selesai: number
  materi?: string | null
  status: string
  keterangan?: string | null
  ppl_user_id?: string | null
  ppl_nama?: string | null
}

export type AttendanceCounts = {
  totalBlok: number
  hadir: number
  sakit: number
  izin: number
  izinSekolah: number
  alfa: number
  performa: number
}

export type TeacherAttendanceSummary = AttendanceCounts & {
  guruId: string
  guruNama: string
  sessions: AgendaPrintSession[]
}

export const PERFORMANCE_POLICY_LABELS: Record<PerformancePolicy, string> = {
  excused_not_penalized: 'Sakit dan izin biasa tidak mengurangi performa; izin sekolah selalu mendapat kredit',
  excused_penalized: 'Sakit dan izin biasa mengurangi performa; izin sekolah selalu mendapat kredit',
}

export const TEACHER_ATTENDANCE_SORT_LABELS: Record<TeacherAttendanceSort, string> = {
  name_asc: 'Nama Guru A–Z',
  performance_asc: 'Performa Terendah ke Tertinggi',
  performance_desc: 'Performa Tertinggi ke Terendah',
  hadir_desc: 'Hadir Terbanyak ke Tersedikit',
  izin_desc: 'Izin Terbanyak ke Tersedikit',
  sakit_desc: 'Sakit Terbanyak ke Tersedikit',
  alfa_desc: 'Alfa Terbanyak ke Tersedikit',
}

export function calculatePerformance(
  counts: Pick<AttendanceCounts, 'totalBlok' | 'hadir' | 'sakit' | 'izin'> & { izinSekolah?: number },
  policy: PerformancePolicy,
) {
  return teacherPerformance({ ...counts, total: counts.totalBlok }, policy === 'excused_not_penalized')
}

function compareSessions(a: AgendaPrintSession, b: AgendaPrintSession) {
  return a.tanggal.localeCompare(b.tanggal)
    || a.jam_ke_mulai - b.jam_ke_mulai
    || a.nama_mapel.localeCompare(b.nama_mapel, 'id-ID')
    || a.tingkat - b.tingkat
    || a.nomor_kelas - b.nomor_kelas
}

function compareTeacherName(a: TeacherAttendanceSummary, b: TeacherAttendanceSummary) {
  return a.guruNama.localeCompare(b.guruNama, 'id-ID')
}

export function sortTeacherAttendance(
  teachers: TeacherAttendanceSummary[],
  sort: TeacherAttendanceSort,
) {
  const compareBy = (key: 'performa' | 'hadir' | 'izin' | 'sakit' | 'alfa', direction: 1 | -1) =>
    (a: TeacherAttendanceSummary, b: TeacherAttendanceSummary) => direction * (a[key] - b[key]) || compareTeacherName(a, b)

  const comparator = sort === 'performance_asc' ? compareBy('performa', 1)
    : sort === 'performance_desc' ? compareBy('performa', -1)
      : sort === 'hadir_desc' ? compareBy('hadir', -1)
        : sort === 'izin_desc' ? compareBy('izin', -1)
          : sort === 'sakit_desc' ? compareBy('sakit', -1)
            : sort === 'alfa_desc' ? compareBy('alfa', -1)
              : compareTeacherName
  return [...teachers].sort(comparator)
}

export function aggregateTeacherAttendance(
  sessions: AgendaPrintSession[],
  policy: PerformancePolicy,
  sort: TeacherAttendanceSort = 'name_asc',
): TeacherAttendanceSummary[] {
  const grouped = new Map<string, Omit<TeacherAttendanceSummary, 'performa'>>()

  for (const session of sessions) {
    if (!grouped.has(session.guru_id)) {
      grouped.set(session.guru_id, {
        guruId: session.guru_id,
        guruNama: session.guru_nama,
        totalBlok: 0,
        hadir: 0,
        sakit: 0,
        izin: 0,
        izinSekolah: 0,
        alfa: 0,
        sessions: [],
      })
    }

    const row = grouped.get(session.guru_id)!
    row.sessions.push(session)
    if (session.status === 'CUTI') continue
    row.totalBlok += 1
    if (isSchoolLeave(session.status, session)) row.izinSekolah += 1
    if (session.status === 'TEPAT_WAKTU' || session.status === 'TELAT' || session.status === 'HADIR') row.hadir += 1
    else if (session.status === 'SAKIT') row.sakit += 1
    else if (session.status === 'IZIN') row.izin += 1
    else row.alfa += 1
  }

  return sortTeacherAttendance(Array.from(grouped.values())
    .map(row => ({
      ...row,
      sessions: [...row.sessions].sort(compareSessions),
      performa: calculatePerformance(row, policy),
    })), sort)
}

export function aggregateAttendanceTotal(
  teachers: TeacherAttendanceSummary[],
  policy: PerformancePolicy,
): AttendanceCounts {
  const total = teachers.reduce<AttendanceCounts>((result, teacher) => ({
    totalBlok: result.totalBlok + teacher.totalBlok,
    hadir: result.hadir + teacher.hadir,
    sakit: result.sakit + teacher.sakit,
    izin: result.izin + teacher.izin,
    izinSekolah: result.izinSekolah + teacher.izinSekolah,
    alfa: result.alfa + teacher.alfa,
    performa: 0,
  }), { totalBlok: 0, hadir: 0, sakit: 0, izin: 0, izinSekolah: 0, alfa: 0, performa: 0 })

  total.performa = calculatePerformance(total, policy)
  return total
}
