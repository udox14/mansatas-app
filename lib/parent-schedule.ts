import { studentPermissionStatusFromReason } from './attendance-status'
import type { FinalAttendanceDetail } from './wali-kelas-attendance'

export function parentSessionAttendance(input: {
  day?: FinalAttendanceDetail; assignment: string; jam: number;
  raw?: {status:string;catatan:string|null}; submitted: boolean;
  permissions: Array<{alasan:string;note:string}>;
}) {
  const block = input.day?.block_statuses.find(b => b.penugasan_id === input.assignment && input.jam >= b.jam_ke_mulai && input.jam <= b.jam_ke_selesai)
  if (!block) return {status:'KBM_EXCEPTION',catatan:'Tidak ada sesi pelajaran aktif pada jam ini.',official:false}
  const exit = input.day!.detail_guru.filter(d => d.sumber === 'perizinan_siswa' && d.jam_ke_mulai <= input.jam && d.jam_ke_selesai >= input.jam && d.catatan.includes('Perizinan keluar komplek'))
  const official = input.permissions.length > 0 || exit.length > 0
  const sick = input.permissions.some(p => studentPermissionStatusFromReason(p.alasan) === 'SAKIT')
  const raw = input.raw || (input.submitted ? {status:'HADIR',catatan:null} : undefined)
  return {
    status: official ? sick ? 'SAKIT' : 'HADIR' : raw?.status || 'BELUM_ADA_DATA', official,
    catatan: official ? [...input.permissions.map(p=>p.note),...exit.map(d=>d.catatan)].join('; ') : raw?.catatan || (!raw ? 'Guru belum mengisi kehadiran untuk sesi ini.' : null),
    teacherStatus: official ? raw?.status : undefined, teacherNote: official ? raw?.catatan : undefined,
  }
}

export function sanitizeParentAgenda<T extends Record<string, unknown>>(
  agenda: T | null | undefined,
  agendaDate: string,
  today: string,
) {
  if (!agenda) return null
  const safeAgenda = { ...agenda }
  if (agendaDate !== today) delete safeAgenda.foto_url
  return safeAgenda
}

