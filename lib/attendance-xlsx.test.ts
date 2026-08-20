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

  it('membuat laporan Catatan Absen oleh Guru dari entri guru per jam', async () => {
    const workbook = await buildAttendanceWorkbook({
      kind: 'catatan-guru',
      filename: 'catatan-absen-oleh-guru',
      periodLabel: '1 Agustus 2026 s/d 31 Agustus 2026',
      selectedStatusCodes: ['S', 'A'],
      data: { scope: { mode: 'siswa', kelas_label: 'X-A-1', siswa: { nama_lengkap: 'Siswa Satu' } }, data: [
        {
          tanggal: '2026-08-03', hariNama: 'Senin', nama_lengkap: 'Siswa Satu', kelas_label: 'X-A-1',
          nisn: '123', status: 'SAKIT', nama_mapel: 'Matematika', jam_ke_mulai: 1, jam_ke_selesai: 2,
          guru_nama: 'Guru Matematika', catatan: 'Demam saat pelajaran.',
        },
        {
          tanggal: '2026-08-04', hariNama: 'Selasa', nama_lengkap: 'Siswa Dua', kelas_label: 'X-A-1',
          nisn: '456', status: 'IZIN', nama_mapel: 'Bahasa Indonesia', jam_ke_mulai: 3, jam_ke_selesai: 3,
          guru_nama: 'Guru Bahasa', catatan: 'Mengikuti kegiatan sekolah.',
        },
      ] },
    })

    expect(workbook.SheetNames).toEqual(['Catatan Absen oleh Guru'])
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Catatan Absen oleh Guru'], { header: 1 }) as unknown[][]
    expect(rows[0]).toEqual(['Catatan Absen oleh Guru - Per Siswa: Siswa Satu - Kelas X-A-1'])
    expect(rows[4]).toEqual(expect.arrayContaining(['Mata Pelajaran', 'Jam Pelajaran', 'Guru Penginput', 'Catatan']))
    expect(rows[5]).toEqual(expect.arrayContaining(['Sakit', 'Matematika', '1-2', 'Guru Matematika', 'Demam saat pelajaran.']))
    expect(rows).not.toEqual(expect.arrayContaining([expect.arrayContaining(['Izin', 'Mengikuti kegiatan sekolah.'])]))
  })
})
