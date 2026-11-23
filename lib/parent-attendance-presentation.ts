import type { FinalAttendanceDetail } from './wali-kelas-attendance'
import { todayWIB } from './time'

export const PARENT_ATTENDANCE_HELP = {
  title: 'Bagaimana kehadiran harian dihitung?',
  intro: 'Setelah pelajaran selesai, sistem merangkum catatan kehadiran anak:',
  rules: ['Jika ada catatan Alfa, hasil hariannya Alfa.', 'Jika tidak ada Alfa tetapi ada Sakit, hasilnya Sakit.', 'Jika tidak ada Alfa atau Sakit tetapi ada Izin dari guru, hasilnya Izin.', 'Jika semua catatan menunjukkan Hadir, hasilnya Hadir.'],
  example: 'Contoh: anak hadir pada beberapa pelajaran, tetapi tercatat Alfa pada satu pelajaran. Hasil hariannya tetap Alfa. Ini bukan berarti anak tidak hadir sepanjang hari.',
  permissionTitle: 'Bagaimana dengan izin resmi?',
  permission: 'Izin resmi yang tercatat di sekolah dihitung Hadir dalam rekap harian.',
  correction: 'Alasan izin dan jam pelajarannya tetap bisa dilihat. Wali kelas dapat mengajukan koreksi hasil harian Alfa untuk ditinjau oleh madrasah.',
}

export const PARENT_DAILY_LABELS: Record<string, string> = {
  HADIR: 'Hadir', SAKIT: 'Sakit', IZIN: 'Izin', ALFA: 'Alfa',
  PARSIAL: 'Data perlu ditinjau', PERLU_KONFIRMASI_WALI: 'Data perlu ditinjau',
  BELUM_ADA_INPUT: 'Belum ada catatan kehadiran', BELUM_ADA_DATA: 'Belum lengkap',
}
export function parentSessionLabel(status: string, official = false) {
  if (official && status !== 'SAKIT') return 'Izin resmi—dihitung Hadir'
  return ({HADIR:'Hadir pada sesi ini',SAKIT:'Sakit pada sesi ini',IZIN:'Izin pada sesi ini',ALFA:'Belum hadir pada sesi ini',
    BELUM_ADA_INPUT:'Sesi belum diinput',BELUM_ADA_DATA:'Sesi belum diinput',LIBUR:'Hari libur',KBM_EXCEPTION:'Sesi pelajaran dikecualikan'})[status] || 'Data perlu ditinjau'
}
export function parentDailyLabel(day: FinalAttendanceDetail) {
  if (['PARSIAL', 'PERLU_KONFIRMASI_WALI'].includes(day.status_akhir)) return 'Data perlu ditinjau'
  if (!day.is_daily_final) return day.submitted_blok === 0 ? 'Belum ada catatan kehadiran' : 'Belum lengkap'
  return PARENT_DAILY_LABELS[day.status_akhir] || 'Data perlu ditinjau'
}
export function parentDailyReason(day: FinalAttendanceDetail) {
  if (['PARSIAL', 'PERLU_KONFIRMASI_WALI'].includes(day.status_akhir)) return 'Data kehadiran perlu ditinjau oleh sekolah.'
  if (!day.is_daily_final) {
    if (day.total_blok === 0) return 'Tidak ada sesi pelajaran aktif pada tanggal ini.'
    if (day.submitted_blok === 0) return 'Sekolah belum mencatat kehadiran anak pada tanggal ini.'
    return 'Catatan setiap sesi sudah dapat dilihat. Status harian belum ditetapkan.'
  }
  if (day.approved_correction) return 'Hasil harian mengikuti koreksi yang disetujui madrasah.'
  if (day.sumber_status === 'koreksi_wali_kelas' || day.sumber_status === 'wali_kelas') return 'Hasil harian mengikuti koreksi wali kelas.'
  if (day.sumber_status === 'perizinan_sekolah') return 'Izin kegiatan sekolah dihitung Hadir dalam rekap harian.'
  if (day.sumber_status === 'perizinan_siswa') return day.status_akhir === 'SAKIT' ? 'Hasil harian mengikuti catatan sakit dari sekolah.' : 'Izin resmi dihitung Hadir dalam rekap harian.'
  if (day.status_akhir === 'HADIR') return 'Semua sesi yang sudah berdata dihitung Hadir.'
  if (['ALFA','SAKIT','IZIN'].includes(day.status_akhir)) return `Ada catatan ${PARENT_DAILY_LABELS[day.status_akhir]}${day.status_akhir === 'IZIN' ? ' dari guru' : ''} pada sesi pelajaran.${day.status_akhir === 'ALFA' ? ' Ini bukan berarti anak tidak hadir sepanjang hari.' : ''}`
  return 'Data kehadiran perlu ditinjau oleh sekolah.'
}
export function parentDailyPhase(day: FinalAttendanceDetail) {
  if (day.total_blok === 0 && !day.is_daily_final) return 'Tidak ada sesi pelajaran aktif pada tanggal ini.'
  if (day.is_daily_final) return 'Rekap setelah pembelajaran selesai, berdasarkan catatan yang tersedia.'
  if (day.tanggal < todayWIB() || (day.kbm_end_at && Date.parse(day.kbm_end_at) <= Date.now())) return day.submitted_blok === 0
    ? 'Pembelajaran selesai; belum ada catatan kehadiran.'
    : 'Pembelajaran selesai; rekap harian belum tersedia.'
  if (!day.kbm_end_at && day.total_blok > 0) return 'Rekap sementara—sekolah belum melengkapi waktu akhir pelajaran.'
  return day.kbm_end_at ? `Rekap sementara—pembelajaran belum selesai. Pelajaran berakhir pukul ${new Date(day.kbm_end_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})} WIB.` : 'Tidak ada sesi pelajaran aktif pada tanggal ini.'
}

export function summarizeParentAttendanceDays(days: FinalAttendanceDetail[]) {
  const summary = {hadir:0,sakit:0,izin:0,alfa:0,perluKonfirmasi:0,belumLengkap:0,totalHari:days.length,completedDays:0,attendanceRate:null as number|null}
  const monthly = new Map<string,{month:string;hadir:number;sakit:number;izin:number;alfa:number;perluKonfirmasi:number}>()
  for (const day of days) {
    const month = day.tanggal.slice(0,7)
    if (!monthly.has(month)) monthly.set(month,{month,hadir:0,sakit:0,izin:0,alfa:0,perluKonfirmasi:0})
    const bucket = monthly.get(month)!
    const key = ({HADIR:'hadir',SAKIT:'sakit',IZIN:'izin',ALFA:'alfa'} as const)[day.status_akhir as 'HADIR'|'SAKIT'|'IZIN'|'ALFA']
    if (day.is_daily_final && key) { summary[key]++; bucket[key]++; summary.completedDays++ }
    else if (['PARSIAL','PERLU_KONFIRMASI_WALI'].includes(day.status_akhir)) { summary.perluKonfirmasi++; bucket.perluKonfirmasi++ }
    else summary.belumLengkap++
  }
  summary.attendanceRate = summary.completedDays ? Math.round(summary.hadir/summary.completedDays*100) : null
  return {summary,monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month))}
}

export interface ParentCalendarDetailSummary {
  phaseBadge: string | null
  sessionProgressLabel: string | null
  pendingLabel: string | null
  summaryText: string
  changeNote: string | null
  emptyDetailsNote: string | null
}

/** Formats daily attendance details into plain-language badges and scannable copy for parents. */
export function formatParentCalendarDetail(
  day: FinalAttendanceDetail | null | undefined,
  holiday?: { reason?: string | null } | null,
): ParentCalendarDetailSummary {
  if (holiday) {
    return {
      phaseBadge: 'Hari libur',
      sessionProgressLabel: null,
      pendingLabel: null,
      summaryText: `Hari libur madrasah${holiday.reason ? `: ${holiday.reason}` : ''}. Tidak dihitung sebagai hari masuk maupun absen.`,
      changeNote: null,
      emptyDetailsNote: null,
    }
  }
  if (!day) {
    return {
      phaseBadge: null,
      sessionProgressLabel: null,
      pendingLabel: null,
      summaryText: 'Tidak ada jadwal pelajaran tercatat pada tanggal ini.',
      changeNote: null,
      emptyDetailsNote: null,
    }
  }

  const isPastDayOrEnded =
    day.tanggal < todayWIB() || Boolean(day.kbm_end_at && Date.parse(day.kbm_end_at) <= Date.now())
  const phaseBadge =
    day.total_blok === 0 && !day.is_daily_final
      ? null
      : day.is_daily_final
        ? 'Rekap selesai'
        : isPastDayOrEnded
          ? 'Menunggu rekap harian'
          : day.kbm_end_at
            ? `Sementara · selesai ${new Date(day.kbm_end_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB`
            : 'Rekap sementara'

  const sessionProgressLabel =
    day.total_blok > 0 ? `${day.submitted_blok}/${day.total_blok} jam tercatat` : null
  const pendingLabel =
    day.pending_blok > 0 ? `${day.pending_blok} jam belum diisi guru` : null

  const isWaliCorrected =
    day.sumber_status === 'koreksi_wali_kelas' || day.sumber_status === 'wali_kelas'
  const isOfficialOverride =
    Boolean(day.approved_correction) ||
    isWaliCorrected ||
    day.sumber_status === 'perizinan_sekolah' ||
    day.sumber_status === 'perizinan_siswa'

  let summaryText = 'Status kehadiran hari ini sedang ditinjau oleh sekolah.'
  let changeNote: string | null = null
  let emptyDetailsNote: string | null = 'Belum ada catatan per mata pelajaran.'

  if (['PARSIAL', 'PERLU_KONFIRMASI_WALI'].includes(day.status_akhir)) {
    summaryText = 'Catatan kehadiran hari ini perlu dikonfirmasi oleh wali kelas.'
  } else if (!day.is_daily_final) {
    if (day.total_blok === 0) {
      summaryText = 'Tidak ada jadwal pelajaran aktif pada tanggal ini.'
      emptyDetailsNote = null
    } else if (day.submitted_blok === 0) {
      summaryText = 'Guru belum mengisi daftar hadir pada tanggal ini.'
      emptyDetailsNote = null
    } else {
      summaryText =
        'Catatan jam yang sudah diisi dapat dilihat di bawah. Status harian ditetapkan setelah pelajaran selesai.'
    }
  } else if (day.approved_correction) {
    summaryText = 'Status harian mengikuti penyesuaian yang disetujui madrasah.'
  } else if (isWaliCorrected) {
    summaryText = 'Status harian mengikuti penyesuaian dari wali kelas.'
  } else if (day.sumber_status === 'perizinan_sekolah') {
    summaryText = 'Anak mengikuti kegiatan resmi sekolah dan dihitung Hadir.'
  } else if (day.sumber_status === 'perizinan_siswa') {
    summaryText =
      day.status_akhir === 'SAKIT'
        ? 'Tercatat Sakit sesuai pemberitahuan resmi ke sekolah.'
        : 'Izin resmi ke sekolah tercatat dan dihitung Hadir.'
  } else if (day.status_akhir === 'HADIR') {
    summaryText =
      day.pending_blok > 0
        ? 'Semua jam pelajaran yang sudah diisi guru tercatat Hadir (tanpa catatan sakit, izin, atau alfa).'
        : 'Hadir penuh pada seluruh jam pelajaran tanpa catatan sakit, izin, atau alfa.'
    emptyDetailsNote = null
  } else if (day.status_akhir === 'SAKIT') {
    summaryText = 'Tercatat Sakit pada jam pelajaran hari ini.'
  } else if (day.status_akhir === 'IZIN') {
    summaryText = 'Tercatat Izin pada jam pelajaran hari ini.'
  } else if (day.status_akhir === 'ALFA') {
    summaryText =
      'Terdapat jam pelajaran tanpa keterangan (Alfa). Hal ini belum tentu berarti anak tidak masuk seharian.'
  }

  if (day.pending_blok > 0 && day.is_daily_final && !isOfficialOverride) {
    changeNote = `Rekap masih dapat berubah jika guru mengisi ${day.pending_blok} jam tersisa.`
  }

  return {
    phaseBadge,
    sessionProgressLabel,
    pendingLabel,
    summaryText,
    changeNote,
    emptyDetailsNote,
  }
}
