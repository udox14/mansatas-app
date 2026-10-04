import { describe, expect, it } from 'vitest'
import { sanitizeParentAgenda, parentSessionAttendance } from './parent-schedule'
import type { FinalAttendanceDetail } from './wali-kelas-attendance'

describe('parent session attendance', () => {
  const day = { wali_status:'HADIR',block_statuses:[{penugasan_id:'math',jam_ke_mulai:1,jam_ke_selesai:2,status:'ALFA',submitted:true}],detail_guru:[] } as unknown as FinalAttendanceDetail
  const input = {day,assignment:'math',jam:1,raw:{status:'ALFA',catatan:'Catatan asli'},submitted:true,permissions:[] as Array<{alasan:string;note:string}>}
  it('keeps the teacher session even when the wali corrects the daily status to Hadir', () => {
    expect(parentSessionAttendance(input)).toMatchObject({status:'ALFA',catatan:'Catatan asli',official:false})
  })
  it('applies ordinary permission only to its supplied covered slot and retains the original teacher note', () => {
    expect(parentSessionAttendance({...input,permissions:[{alasan:'Kegiatan',note:'Izin jam 1'}]})).toMatchObject({status:'HADIR',official:true,teacherStatus:'ALFA',teacherNote:'Catatan asli',catatan:'Izin jam 1'})
    expect(parentSessionAttendance({...input,jam:2})).toMatchObject({status:'ALFA',official:false})
  })
  it('keeps illness from official permission as Sakit', () => {
    expect(parentSessionAttendance({...input,permissions:[{alasan:'SAKIT (DI UKS)',note:'Di UKS'}]}).status).toBe('SAKIT')
  })
  it('does not treat pending input as Hadir; excludes inactive slots', () => {
    expect(parentSessionAttendance({...input,raw:undefined,submitted:false}).status).toBe('BELUM_ADA_DATA')
    expect(parentSessionAttendance({...input,jam:3}).status).toBe('KBM_EXCEPTION')
    expect(parentSessionAttendance({...input,raw:undefined}).status).toBe('HADIR')
  })
  it('uses an exit permission only on the covered hours', () => {
    const exitDay = {...day,detail_guru:[{sumber:'perizinan_siswa',status:'IZIN',nama_mapel:'',guru_nama:null,jam_ke_mulai:1,jam_ke_selesai:1,catatan:'Perizinan keluar komplek: jam 1'}]} as FinalAttendanceDetail
    expect(parentSessionAttendance({...input,day:exitDay}).status).toBe('HADIR')
    expect(parentSessionAttendance({...input,day:exitDay,jam:2}).status).toBe('ALFA')
  })
})

describe('sanitizeParentAgenda', () => {
  it('keeps the activity photo only for the current day', () => {
    const agenda = { materi: 'Aljabar', foto_url: '/api/media/foto.webp' }
    expect(sanitizeParentAgenda(agenda, '2026-08-26', '2026-08-26')).toEqual(agenda)
  })

  it('removes the photo URL from other days without mutating the source', () => {
    const agenda = { materi: 'Aljabar', foto_url: '/api/media/foto-lama.webp' }
    expect(sanitizeParentAgenda(agenda, '2026-08-25', '2026-08-26')).toEqual({ materi: 'Aljabar' })
    expect(agenda.foto_url).toBe('/api/media/foto-lama.webp')
  })
})

