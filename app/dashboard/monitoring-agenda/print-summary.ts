export type PerformancePolicy = 'excused_not_penalized' | 'excused_penalized'

export type AgendaPrintSession = {
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
}

export type AttendanceCounts = {
  totalBlok: number
  hadir: number
  sakit: number
  izin: number
  alfa: number
  performa: number
}

export type TeacherAttendanceSummary = AttendanceCounts & {
  guruId: string
  guruNama: string
  sessions: AgendaPrintSession[]
}

export const PERFORMANCE_POLICY_LABELS: Record<PerformancePolicy, string> = {
  excused_not_penalized: 'Sakit dan izin tidak mengurangi performa',
  excused_penalized: 'Sakit dan izin mengurangi performa',
}

export function calculatePerformance(
  counts: Pick<AttendanceCounts, 'totalBlok' | 'hadir' | 'sakit' | 'izin'>,
  policy: PerformancePolicy,
) {
  if (counts.totalBlok <= 0) return 0
  const credited = policy === 'excused_not_penalized'
    ? counts.hadir + counts.sakit + counts.izin
    : counts.hadir
  return Math.min(100, Math.max(0, Math.round((credited / counts.totalBlok) * 100)))
}

function compareSessions(a: AgendaPrintSession, b: AgendaPrintSession) {
  return a.tanggal.localeCompare(b.tanggal)
    || a.jam_ke_mulai - b.jam_ke_mulai
    || a.nama_mapel.localeCompare(b.nama_mapel, 'id-ID')
    || a.tingkat - b.tingkat
    || a.nomor_kelas - b.nomor_kelas
}

export function aggregateTeacherAttendance(
  sessions: AgendaPrintSession[],
  policy: PerformancePolicy,
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
        alfa: 0,
        sessions: [],
      })
    }

    const row = grouped.get(session.guru_id)!
    row.totalBlok += 1
    row.sessions.push(session)
    if (session.status === 'TEPAT_WAKTU' || session.status === 'TELAT' || session.status === 'HADIR') row.hadir += 1
    else if (session.status === 'SAKIT') row.sakit += 1
    else if (session.status === 'IZIN') row.izin += 1
    else row.alfa += 1
  }

  return Array.from(grouped.values())
    .map(row => ({
      ...row,
      sessions: [...row.sessions].sort(compareSessions),
      performa: calculatePerformance(row, policy),
    }))
    .sort((a, b) => a.guruNama.localeCompare(b.guruNama, 'id-ID'))
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
    alfa: result.alfa + teacher.alfa,
    performa: 0,
  }), { totalBlok: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0, performa: 0 })

  total.performa = calculatePerformance(total, policy)
  return total
}
