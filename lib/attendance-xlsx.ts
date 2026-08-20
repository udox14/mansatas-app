import { attendanceSourceLabel, attendanceStatusLabel } from './attendance-status'

export type AttendanceExportKind = 'monitoring' | 'kelas' | 'siswa' | 'tidak-hadir' | 'catatan-guru'
type PrintStatusCode = 'H' | 'S' | 'I' | 'A' | 'B' | 'K' | 'BI' | 'BL'
const ALL_STATUS_CODES: PrintStatusCode[] = ['H', 'S', 'I', 'A', 'B', 'K', 'BI', 'BL']

function selectedCodes(codes?: PrintStatusCode[]) {
  return codes?.length ? codes : ALL_STATUS_CODES
}

function statusCode(status: string | null | undefined) {
  const label = attendanceStatusLabel(status || '').toUpperCase()
  if (label === 'HADIR') return 'H'
  if (label === 'SAKIT') return 'S'
  if (label === 'IZIN') return 'I'
  if (label === 'ALFA') return 'A'
  if (label.includes('BOLOS')) return 'B'
  if (label.includes('KEPUTUSAN')) return 'K'
  if (label.includes('BELUM ADA INPUT')) return 'BI'
  return 'BL'
}

function safeSheetName(value: string) {
  return value.replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Rekap'
}

function monitoringRows(section: any, codes: PrintStatusCode[]) {
  if (section.mode === 'bulanan') {
    return (section.rows || []).map((row: any) => {
      const result: Record<string, unknown> = {
        No: row.urut,
        NIS: row.nis,
        Nama: row.nama_lengkap,
        JK: row.jenis_kelamin,
      }
      for (const cell of row.cells || []) result[cell.tanggal] = codes.includes(cell.mark) ? cell.mark : ''
      for (const code of ALL_STATUS_CODES) result[`Total ${code}`] = codes.includes(code) ? row.totals?.[code] || 0 : ''
      return result
    })
  }
  return (section.rows || []).map((row: any) => {
    const result: Record<string, unknown> = {
      No: row.urut,
      NIS: row.nis,
      Nama: row.nama_lengkap,
      JK: row.jenis_kelamin,
    }
    for (const month of row.monthTotals || []) {
      for (const code of ALL_STATUS_CODES) result[`${month.label} ${code}`] = codes.includes(code) ? month[code] || 0 : ''
    }
    for (const code of ALL_STATUS_CODES) result[`Total ${code}`] = codes.includes(code) ? row.semesterTotal?.[code] || 0 : ''
    return result
  })
}

function classRows(section: any, mode: 'hari' | 'rentang', codes: PrintStatusCode[]) {
  if (mode === 'rentang') {
    return (section.rows || []).map((row: any, index: number) => ({
      No: index + 1,
      Nama: row.nama_lengkap,
      NISN: row.nisn || '',
      'Hari Efektif': row.total_hari_efektif,
      H: codes.includes('H') ? row.hadir : '',
      S: codes.includes('S') ? row.sakit : '',
      I: codes.includes('I') ? row.izin : '',
      A: codes.includes('A') ? row.alfa : '',
      B: codes.includes('B') ? row.bolos : '',
      K: codes.includes('K') ? row.perlu_konfirmasi_wali : '',
      BI: codes.includes('BI') ? row.belum_ada_input || 0 : '',
      BL: codes.includes('BL') ? row.belum_ada_data : '',
      'Kehadiran (%)': row.persentase_hadir,
    }))
  }
  return (section.rows || []).map((row: any, index: number) => {
    const result: Record<string, unknown> = { No: index + 1, Nama: row.nama_lengkap, NISN: row.nisn || '' }
    for (const cell of row.cells || []) result[`Jam ${cell.jam_ke}`] = codes.includes(statusCode(cell.status)) ? attendanceStatusLabel(cell.status) : ''
    const visible = codes.includes(statusCode(row.status_harian))
    result['Status Harian'] = visible ? attendanceStatusLabel(row.status_harian) : ''
    result.Sumber = visible ? attendanceSourceLabel(row.sumber_status) : ''
    result['Blok Disubmit'] = visible ? `${row.submitted_blok || 0}/${row.total_blok || 0}` : ''
    result.Alasan = visible ? row.status_reason || '' : ''
    result.Keterangan = visible ? row.keterangan || '' : ''
    return result
  })
}

function studentRows(data: any, codes: PrintStatusCode[]) {
  const rekap = data.rekap || {}
  return (rekap.days || []).map((day: any, index: number) => ({
    No: index + 1,
    Tanggal: day.tanggal,
    Hari: day.hariNama,
    'Status Harian': codes.includes(statusCode(day.statusHari)) ? attendanceStatusLabel(day.statusHari) : '',
    Sumber: codes.includes(statusCode(day.statusHari)) ? attendanceSourceLabel(day.sumberStatus) : '',
    'Blok Disubmit': codes.includes(statusCode(day.statusHari)) ? `${day.submittedBlok || 0}/${day.totalBlok || 0}` : '',
    'Blok Hadir': codes.includes(statusCode(day.statusHari)) ? day.blokHadir : '',
    Alasan: codes.includes(statusCode(day.statusHari)) ? day.statusReason || '' : '',
    Keterangan: codes.includes(statusCode(day.statusHari)) ? day.keterangan || '' : '',
  }))
}

function absentRows(data: any, codes: PrintStatusCode[]) {
  return (data.data || []).filter((row: any) => codes.includes(statusCode(row.status))).map((row: any, index: number) => ({
    No: index + 1,
    Tanggal: row.tanggal,
    Hari: row.hariNama,
    Nama: row.nama_lengkap,
    Kelas: row.kelas_label,
    NISN: row.nisn || '',
    Status: attendanceStatusLabel(row.status),
    Keterangan: row.keterangan || '',
  }))
}

function teacherNoteRows(data: any, codes: PrintStatusCode[]) {
  return (data.data || []).filter((row: any) => codes.includes(statusCode(row.status))).map((row: any, index: number) => ({
    No: index + 1,
    Tanggal: row.tanggal,
    Hari: row.hariNama,
    Nama: row.nama_lengkap,
    Kelas: row.kelas_label,
    NISN: row.nisn || '',
    Status: attendanceStatusLabel(row.status),
    'Mata Pelajaran': row.nama_mapel || '',
    'Jam Pelajaran': row.jam_ke_mulai === row.jam_ke_selesai
      ? row.jam_ke_mulai
      : `${row.jam_ke_mulai}-${row.jam_ke_selesai}`,
    'Guru Penginput': row.guru_nama || '',
    Catatan: row.catatan || '',
  }))
}

export async function buildAttendanceWorkbook(input: {
  kind: AttendanceExportKind
  mode?: 'hari' | 'rentang'
  data: any
  filename: string
  periodLabel?: string
  selectedStatusCodes?: PrintStatusCode[]
}) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const codes = selectedCodes(input.selectedStatusCodes)
  const statusLabels: Record<PrintStatusCode, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alfa', B: 'Bolos', K: 'Perlu keputusan wali', BI: 'Belum ada input', BL: 'Belum lengkap' }
  const legend = `Legenda: ${codes.map(code => `${code}=${statusLabels[code]}`).join('; ')}`

  const createSheet = (title: string, period: string, rows: Record<string, unknown>[]) => {
    const sheet = XLSX.utils.aoa_to_sheet([
      [title],
      ['Periode', period],
      [legend],
      [],
    ])
    XLSX.utils.sheet_add_json(sheet, rows, { origin: 'A5' })
    return sheet
  }

  if (input.kind === 'monitoring') {
    for (const section of input.data.sections || []) {
      const sheet = createSheet(
        `Monitoring Absensi ${section.kelas?.label || ''}`,
        section.labelPeriode || input.periodLabel || `${section.tglMulai || ''} s.d. ${section.tglSelesai || ''}`,
        monitoringRows(section, codes),
      )
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(section.kelas?.label || 'Monitoring'))
    }
  } else if (input.kind === 'kelas') {
    for (const section of input.data.sections || []) {
      const sheet = createSheet(
        `Rekap Absensi Kelas ${section.kelas?.label || ''}`,
        input.periodLabel || section.tanggal || `${section.tglMulai || ''} s.d. ${section.tglSelesai || ''}`,
        classRows(section, input.mode || 'hari', codes),
      )
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(section.kelas?.label || 'Kelas'))
    }
  } else if (input.kind === 'tidak-hadir') {
    const sheet = createSheet(
      'Daftar Siswa Tidak Hadir',
      input.periodLabel || '',
      absentRows(input.data, codes),
    )
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tidak Hadir')
  } else if (input.kind === 'catatan-guru') {
    const scope = input.data?.scope
    const scopeLabel = scope?.mode === 'siswa'
      ? `Per Siswa: ${scope.siswa?.nama_lengkap || '-'} - Kelas ${scope.kelas_label || '-'}`
      : `Per Kelas: ${scope?.kelas_label || '-'}`
    const sheet = createSheet(
      `Catatan Absen oleh Guru - ${scopeLabel}`,
      input.periodLabel || '',
      teacherNoteRows(input.data, codes),
    )
    XLSX.utils.book_append_sheet(workbook, sheet, 'Catatan Absen oleh Guru')
  } else {
    const rekap = input.data.rekap || {}
    const sheet = createSheet(
      `Rekap Absensi ${rekap.siswa?.nama || 'Siswa'} - ${rekap.siswa?.kelas || ''}`,
      input.periodLabel || `${rekap.tglMulai || ''} s.d. ${rekap.tglSelesai || ''}`,
      studentRows(input.data, codes),
    )
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rekap Siswa')
  }

  if (workbook.SheetNames.length === 0) throw new Error('Tidak ada data untuk diekspor.')
  return workbook
}

export async function downloadAttendanceWorkbook(input: Parameters<typeof buildAttendanceWorkbook>[0]) {
  const XLSX = await import('xlsx')
  const workbook = await buildAttendanceWorkbook(input)
  XLSX.writeFile(workbook, input.filename.endsWith('.xlsx') ? input.filename : `${input.filename}.xlsx`)
}
