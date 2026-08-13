import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildAttendanceWorkbook } from './attendance-xlsx'

describe('buildAttendanceWorkbook', () => {
  it('membuat monitoring bulanan dengan semua kode status dan legenda', async () => {
    const workbook = await buildAttendanceWorkbook({
      kind: 'monitoring',
      filename: 'monitoring',
      periodLabel: 'Januari 2026',
      data: { sections: [{
        mode: 'bulanan',
        labelPeriode: 'Januari 2026',
        kelas: { label: 'X-A-1' },
        rows: [{
          urut: 1, nis: '001', nama_lengkap: 'Siswa Uji', jenis_kelamin: 'L',
          cells: [{ tanggal: '2026-01-01', mark: 'K' }],
          totals: { H: 0, S: 0, I: 0, A: 0, B: 0, K: 1, BI: 0, BL: 0 },
        }],
      }] },
    })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as unknown[][]
    expect(String(rows[2][0])).toContain('K=Perlu keputusan wali')
    expect(rows[4]).toEqual(expect.arrayContaining(['Total H', 'Total K', 'Total BI', 'Total BL']))
    expect(rows[5]).toEqual(expect.arrayContaining(['K', 1]))
  })

  it('membuat satu sheet untuk setiap kelas', async () => {
    const section = (label: string) => ({ kelas: { label }, rows: [] })
    const workbook = await buildAttendanceWorkbook({
      kind: 'kelas', mode: 'rentang', filename: 'kelas', data: { sections: [section('X-1'), section('X-2')] },
    })
    expect(workbook.SheetNames).toEqual(['X-1', 'X-2'])
  })

  it('memuat status final, sumber, kelengkapan, dan alasan pada laporan siswa', async () => {
    const workbook = await buildAttendanceWorkbook({
      kind: 'siswa', filename: 'siswa', data: { rekap: { siswa: { nama: 'Siswa Uji', kelas: 'X-1' }, days: [{
        tanggal: '2026-01-01', hariNama: 'Kamis', statusHari: 'PERLU_KONFIRMASI_WALI',
        sumberStatus: 'perlu_konfirmasi_wali', submittedBlok: 2, totalBlok: 2, blokHadir: 1,
        statusReason: 'Terdapat perbedaan status Hadir dan Sakit.', keterangan: '',
      }] } },
    })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Rekap Siswa'], { header: 1 }) as unknown[][]
    expect(rows[5]).toEqual(expect.arrayContaining(['Perlu keputusan wali', 'Perlu Keputusan Wali', '2/2', 'Terdapat perbedaan status Hadir dan Sakit.']))
  })
})
