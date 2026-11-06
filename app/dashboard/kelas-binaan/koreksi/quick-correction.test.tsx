import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../attendance-actions', () => ({ simpanKoreksiAbsensiCepat: vi.fn() }))
import { QuickAttendanceCorrection } from './quick-correction'
import type { QuickAttendanceContext } from '../attendance-actions'
const base: QuickAttendanceContext = { userId:'wali',siswaId:'s',kelasId:'k',nama:'Alya',kelas:'X A',tanggal:'2026-10-02',penugasanId:'math',
  mapel:'Matematika',jam:'1–2',catatanGuru:'Belum terlihat',statusGuru:'ALFA',teacherUpdatedAt:'',waliStatus:null,waliNote:'',revision:'r',
  pendingBlocks:3,isFinal:false,dailyStatus:'BELUM_ADA_DATA',parentDueAt:'2026-10-02T04:05:00Z',parentSent:false }
beforeEach(() => vi.stubGlobal('React', React))
describe('quick attendance correction presentation', () => {
  it('shows the source session, all correction choices, parent deadline, and pending input immediately', () => {
    const html = renderToStaticMarkup(<QuickAttendanceCorrection data={base} />)
    for (const text of ['Alya','Matematika','Belum terlihat','Hadir','Sakit','Izin','Alfa','11.05 WIB','3 blok pelajaran belum diinput','disimpan otomatis setelah 2 detik','Alasan koreksi']) expect(html).toContain(text)
    expect(html).not.toContain('Simpan Koreksi')
    expect(html).toContain('Koreksi dapat disimpan sekarang')
    expect(html).toContain('Laporan orang tua menunggu pemeriksaan sampai pukul')
  })
  it('shows the saved correction selected while retaining the teacher record and explaining an already sent report', () => {
    const html = renderToStaticMarkup(<QuickAttendanceCorrection data={{...base,waliStatus:'SAKIT',waliNote:'Konfirmasi',parentSent:true}} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Sakit/)
    expect(html).toContain('Kembalikan ke status otomatis')
    expect(html).toContain('Laporan awal sudah terkirim')
    expect(html).toContain('Alfa')
    expect(html).toContain('Konfirmasi')
  })
})
