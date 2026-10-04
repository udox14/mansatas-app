import type { FinalAttendanceDetail } from './wali-kelas-attendance'
import { todayWIB } from './time'

export const PARENT_ATTENDANCE_HELP = {
  title: 'Bagaimana kehadiran harian dihitung?',
  intro: 'Setelah pelajaran selesai, sistem merangkum catatan kehadiran anak:',
  rules: ['Jika ada catatan Alfa, hasil hariannya Alfa.', 'Jika tidak ada Alfa tetapi ada Sakit, hasilnya Sakit.', 'Jika tidak ada Alfa atau Sakit tetapi ada Izin dari guru, hasilnya Izin.', 'Jika semua catatan menunjukkan Hadir, hasilnya Hadir.'],
  example: 'Contoh: anak hadir pada beberapa pelajaran, tetapi tercatat Alfa pada satu pelajaran. Hasil hariannya tetap Alfa. Ini bukan berarti anak tidak hadir sepanjang hari.',
  permissionTitle: 'Bagaimana dengan izin resmi?',
  permission: 'Izin resmi yang tercatat di sekolah dihitung Hadir dalam rekap harian.',
  correction: 'Alasan izin dan jam pelajarannya tetap bisa dilihat. Jika ada catatan yang keliru, wali kelas dapat mengoreksinya.',
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
