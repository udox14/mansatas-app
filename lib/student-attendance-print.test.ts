import { describe, expect, it } from 'vitest'
import { buildStudentAttendancePrintHtml, STUDENT_PRINT_STATUSES, type StudentAttendancePrintData } from './student-attendance-print'

const data: StudentAttendancePrintData = {
  siswa: { nama: 'Muhammad Abdullah Nama Lengkap Tidak Disingkat', nisn: '001234', nis_lokal: 'L-007', kelas: 'XI 1' },
  totalHari: 2,
  summary: { hadir: 1, parsial: 0, sakit: 1, izin: 0, alfa: 0 },
  days: [
    { tanggal: '2026-10-01', hariNama: 'Kamis', statusHari: 'HADIR', totalBlok: 3, submittedBlok: 3, detail: [] },
    { tanggal: '2026-10-02', hariNama: 'Jumat', statusHari: 'SAKIT', totalBlok: 2, submittedBlok: 2, sumberStatus: 'wali_kelas', statusReason: 'Dikonfirmasi wali', detail: [{ nama_mapel: 'Matematika', status: 'SAKIT', jam_ke_mulai: 1, jam_ke_selesai: 2, catatan: 'Surat dokter' }] },
  ],
}
const options = {
  result: data, waliKelas: 'Nama Wali Kelas', startDate: '2026-10-01', endDate: '2026-10-02',
  statuses: new Set(STUDENT_PRINT_STATUSES), paper: 'F4' as const, orientation: 'portrait' as const,
  origin: 'https://school.example', generatedAt: new Date('2026-10-16T03:00:00Z'),
}

describe('shared student attendance print document', () => {
  it('includes the profile format, complete identity, and homeroom signature', () => {
    const html = buildStudentAttendancePrintHtml(options)
    expect(html).toContain('https://school.example/kopsurat.png')
    expect(html).toContain(data.siswa!.nama)
    expect(html).toContain('L-007')
    expect(html).toContain('001234')
    expect(html).toContain('Nama Wali Kelas')
    expect(html).toContain('ttd-space')
    expect(html).toContain('Surat dokter')
    expect(html).toContain('size: 215mm 330mm')
    expect(html).toContain('background: #fff')
  })

  it('removes entire unselected day rows while preserving the profile summary', () => {
    const html = buildStudentAttendancePrintHtml({ ...options, statuses: new Set(['SAKIT']) })
    const rows = html.split('<tbody>')[2].split('</tbody>')[0]
    expect(rows).toContain('Jumat')
    expect(rows).not.toContain('Kamis')
    expect(rows.match(/<tr /g)).toHaveLength(1)
    expect(html).toContain('<th>Hadir</th><th>Bolos</th><th>Sakit</th>')
  })

  it.each([
    ['A4', 'portrait', '210mm 297mm'], ['A4', 'landscape', '297mm 210mm'],
    ['F4', 'portrait', '215mm 330mm'], ['F4', 'landscape', '330mm 215mm'],
  ] as const)('supports %s %s', (paper, orientation, size) => {
    expect(buildStudentAttendancePrintHtml({ ...options, paper, orientation })).toContain(`size: ${size}`)
  })

  it('escapes student, teacher, reason, subject, and note text', () => {
    const injected = '<img src=x onerror="alert(1)"> & \'text\''
    const html = buildStudentAttendancePrintHtml({
      ...options, waliKelas: injected,
      result: { ...data, siswa: { ...data.siswa!, nama: injected, nisn: injected, nis_lokal: injected }, days: [{ ...data.days![1], statusReason: injected, detail: [{ ...data.days![1].detail[0], nama_mapel: injected, catatan: injected }] }] },
    })
    expect(html).not.toContain(injected)
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;text&#39;')
    expect(html.match(/<img /g)).toHaveLength(1)
  })

  it('handles missing identity fields and an empty period', () => {
    const html = buildStudentAttendancePrintHtml({ ...options, result: { days: [], totalHari: 0 }, waliKelas: null })
    expect(html).toContain('Belum Ditentukan')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
  })
})
