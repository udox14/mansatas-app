import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/dashboard/kelas-binaan', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/app/dashboard/kelas-binaan/attendance-actions', () => ({ getKeputusanAbsensiHistory: vi.fn(), simpanKeputusanAbsensiWaliBatch: vi.fn() }))
import { KeputusanAbsensiHariIni, type KeputusanAbsensiRow } from './KeputusanAbsensiHariIni'

const base: KeputusanAbsensiRow = {
  siswa_id: 's1', nama_lengkap: 'Ananda', nisn: '123', total_blok: 4, submitted_blok: 1, pending_blok: 3,
  is_daily_final: true, kbm_end_at: '2026-10-02T07:00:00.000Z',
  guru_status: 'ALFA', guru_status_reason: 'Ada catatan Alfa pada satu blok pelajaran.', wali_status: null,
  status_akhir: 'ALFA', sumber_status: 'guru', status_reason: 'Ada catatan Alfa pada satu blok pelajaran.', requires_wali_decision: false,
  keterangan_wali_kelas: null, detail_guru: [{ status: 'ALFA', nama_mapel: 'Matematika', guru_nama: 'Guru', sumber: 'guru', jam_ke_mulai: 1, jam_ke_selesai: 2, catatan: '' }],
}
function render(overrides: Partial<KeputusanAbsensiRow> = {}, isEffective = true) {
  return renderToStaticMarkup(<KeputusanAbsensiHariIni userId="wali" kelasId="k1" tanggal="2026-10-02" today="2026-10-02" minDate="2026-07-01" rows={[{ ...base, ...overrides }]} isEffective={isEffective} />)
}
beforeEach(() => vi.stubGlobal('React', React))

describe('Kehadiran Harian presentation', () => {
  it('shows the final result with pending input without requiring a wali decision', () => {
    const html = render()
    expect(html).toContain('Rekap setelah KBM')
    expect(html).toContain('3 blok belum diinput')
    expect(html).toContain('Koreksi hanya diperlukan')
    expect(html).not.toContain('sudah diputuskan')
    expect(html).not.toContain('Matematika') // session details start collapsed
    expect(html).not.toContain('Alasan koreksi wali kelas') // editor starts closed
    expect(html).not.toMatch(/<button[^>]*>[^<]*Hadir/)
  })

  it('does not expose a saved wali correction as a final daily status before KBM ends', () => {
    const html = render({ is_daily_final: false, status_akhir: 'BELUM_ADA_DATA', wali_status: 'HADIR' })
    expect(html).toContain('Rekap sementara')
    expect(html).toContain('14.00 WIB')
    expect(html).toContain('Belum lengkap')
    expect(html).not.toContain('Rekap setelah KBM')
    expect(html).toContain('1 dikoreksi wali kelas')
  })

  it('explains when the end of KBM is unavailable', () => {
    expect(render({ is_daily_final: false, status_akhir: 'BELUM_ADA_DATA', kbm_end_at: null })).toContain('jam pelajaran perlu dilengkapi')
  })

  it('keeps saved notes visible without opening a correction form', () => {
    const html = render({ wali_status: 'SAKIT', keterangan_wali_kelas: 'Konfirmasi orang tua', status_akhir: 'SAKIT' })
    expect(html).toContain('Catatan wali kelas: Konfirmasi orang tua')
    expect(html).not.toContain('Alasan koreksi wali kelas')
  })

  it('does not offer correction actions on a non-effective date', () => {
    const html = render({}, false)
    expect(html).toContain('Absensi harian tidak dihitung')
    expect(html).not.toContain('Simpan Koreksi')
  })
})
