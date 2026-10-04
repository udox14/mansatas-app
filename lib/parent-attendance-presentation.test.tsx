import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AttendanceHelp } from '@/app/portal-ortu/components/attendance-help'
import { parentDailyLabel, parentDailyPhase, parentDailyReason, parentSessionLabel, summarizeParentAttendanceDays } from './parent-attendance-presentation'
import type { FinalAttendanceDetail } from './wali-kelas-attendance'

function day(overrides: Partial<FinalAttendanceDetail> = {}): FinalAttendanceDetail {
  return { siswa_id:'s',nama_lengkap:'Ananda',nisn:'1',tanggal:'2026-10-02',is_daily_final:true,kbm_end_at:'2026-10-02T12:00:00+07:00',
    total_blok:4,submitted_blok:3,pending_blok:1,guru_status:'ALFA',guru_status_reason:'',wali_status:null,status_akhir:'ALFA',
    sumber_status:'guru',status_reason:'',requires_wali_decision:false,keterangan_wali_kelas:null,block_statuses:[],detail_guru:[],...overrides }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('parent attendance presentation', () => {
  it('renders the agreed help without the removed illness exception', () => {
    vi.stubGlobal('React',React)
    const html = renderToStaticMarkup(<AttendanceHelp />)
    expect(html).toContain('Bagaimana kehadiran harian dihitung?')
    expect(html).toContain('Jika tidak ada Alfa atau Sakit tetapi ada Izin dari guru, hasilnya Izin.')
    expect(html).toContain('Ini bukan berarti anak tidak hadir sepanjang hari.')
    expect(html).toContain('Izin resmi yang tercatat di sekolah dihitung Hadir')
    expect(html).not.toMatch(/Kalau alasan|Bolos|Penjelasan ringkas|Pengecualian/)
  })
  it.each([['ALFA','Belum hadir pada sesi ini'],['SAKIT','Sakit pada sesi ini'],['IZIN','Izin pada sesi ini'],['KBM_EXCEPTION','Sesi pelajaran dikecualikan'],['LIBUR','Hari libur']])('labels session %s without implying full-day absence', (status,label) => {
    expect(parentSessionLabel(status)).toBe(label)
  })
  it('keeps sick permissions distinct from ordinary official permission', () => {
    expect(parentSessionLabel('IZIN',true)).toBe('Izin resmi—dihitung Hadir')
    expect(parentSessionLabel('SAKIT',true)).toBe('Sakit pada sesi ini')
    expect(parentDailyReason(day({status_akhir:'SAKIT',sumber_status:'perizinan_siswa'}))).toContain('catatan sakit dari sekolah')
  })
  it.each(['wali_kelas','koreksi_wali_kelas','perizinan_sekolah'] as const)('explains override %s even with no teacher submissions', source => {
    const value = day({status_akhir:'HADIR',submitted_blok:0,sumber_status:source})
    expect(parentDailyLabel(value)).toBe('Hadir')
    expect(parentDailyReason(value)).toContain(source === 'perizinan_sekolah' ? 'kegiatan sekolah' : 'koreksi wali kelas')
  })
  it('does not include provisional, empty, or legacy review days in attendance percentage', () => {
    const result = summarizeParentAttendanceDays([
      day({status_akhir:'HADIR'}),day({status_akhir:'SAKIT'}),day({status_akhir:'IZIN'}),day(),
      day({is_daily_final:false,status_akhir:'HADIR'}),day({is_daily_final:false,status_akhir:'BELUM_ADA_INPUT',submitted_blok:0}),
      day({status_akhir:'PERLU_KONFIRMASI_WALI'}),
    ])
    expect(result.summary).toMatchObject({hadir:1,sakit:1,izin:1,alfa:1,completedDays:4,attendanceRate:25,belumLengkap:2,perluKonfirmasi:1})
    expect(result.monthly[0]).toMatchObject({hadir:1,sakit:1,izin:1,alfa:1})
    expect(parentDailyLabel(day({status_akhir:'PERLU_KONFIRMASI_WALI'}))).toBe('Data perlu ditinjau')
    expect(parentDailyLabel(day({is_daily_final:false,status_akhir:'PARSIAL'}))).toBe('Data perlu ditinjau')
    expect(summarizeParentAttendanceDays([]).summary.attendanceRate).toBeNull()
  })
  it('separates before, exactly at end, missing end time, past empty days, and inactive sessions', () => {
    vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date('2026-10-02T04:59:59Z'))
    const pending = day({is_daily_final:false,status_akhir:'BELUM_ADA_DATA'})
    expect(parentDailyPhase(pending)).toContain('pembelajaran belum selesai')
    expect(parentDailyPhase({...pending,kbm_end_at:null})).toContain('belum melengkapi waktu akhir')
    expect(parentDailyLabel(pending)).toBe('Belum lengkap')
    vi.setSystemTime(new Date('2026-10-02T05:00:00Z'))
    expect(parentDailyPhase({...pending,submitted_blok:0})).toContain('Pembelajaran selesai; belum ada')
    expect(parentDailyPhase(pending)).toContain('rekap harian belum tersedia')
    expect(parentDailyPhase(day())).toContain('Rekap setelah pembelajaran selesai')
    vi.setSystemTime(new Date('2026-10-03T00:00:00Z'))
    expect(parentDailyPhase({...pending,kbm_end_at:null,submitted_blok:0})).toContain('Pembelajaran selesai; belum ada')
    expect(parentDailyPhase({...pending,total_blok:0})).toContain('Tidak ada sesi pelajaran aktif')
  })
})
