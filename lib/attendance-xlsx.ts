import { attendanceSourceLabel, attendanceStatusLabel } from './attendance-status'

export type AttendanceExportKind = 'monitoring' | 'kelas' | 'siswa'

function safeSheetName(value: string) {
  return value.replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Rekap'
}

function monitoringRows(section: any) {
  if (section.mode === 'bulanan') {
    return (section.rows || []).map((row: any) => {
      const result: Record<string, unknown> = {
        No: row.urut,
        NIS: row.nis,
        Nama: row.nama_lengkap,
        JK: row.jenis_kelamin,
      }
      for (const cell of row.cells || []) result[cell.tanggal] = cell.mark
      for (const code of ['H', 'S', 'I', 'A', 'B', 'K', 'BI', 'BL']) result[`Total ${code}`] = row.totals?.[code] || 0
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
      for (const code of ['H', 'S', 'I', 'A', 'B', 'K', 'BI', 'BL']) result[`${month.label} ${code}`] = month[code] || 0
    }
    for (const code of ['H', 'S', 'I', 'A', 'B', 'K', 'BI', 'BL']) result[`Total ${code}`] = row.semesterTotal?.[code] || 0
    return result
  })
}

function classRows(section: any, mode: 'hari' | 'rentang') {
  if (mode === 'rentang') {
    return (section.rows || []).map((row: any, index: number) => ({
      No: index + 1,
      Nama: row.nama_lengkap,
      NISN: row.nisn || '',
      'Hari Efektif': row.total_hari_efektif,
      H: row.hadir,
      S: row.sakit,
      I: row.izin,
      A: row.alfa,
      B: row.bolos,
      K: row.perlu_konfirmasi_wali,
      BI: row.belum_ada_input || 0,
      BL: row.belum_ada_data,
      'Kehadiran (%)': row.persentase_hadir,
    }))
  }
  return (section.rows || []).map((row: any, index: number) => {
    const result: Record<string, unknown> = { No: index + 1, Nama: row.nama_lengkap, NISN: row.nisn || '' }
    for (const cell of row.cells || []) result[`Jam ${cell.jam_ke}`] = attendanceStatusLabel(cell.status)
    result['Status Harian'] = attendanceStatusLabel(row.status_harian)
    result.Sumber = attendanceSourceLabel(row.sumber_status)
    result['Blok Disubmit'] = `${row.submitted_blok || 0}/${row.total_blok || 0}`
    result.Alasan = row.status_reason || ''
    result.Keterangan = row.keterangan || ''
    return result
  })
}

function studentRows(data: any) {
  const rekap = data.rekap || {}
  return (rekap.days || []).map((day: any, index: number) => ({
    No: index + 1,
    Tanggal: day.tanggal,
    Hari: day.hariNama,
    'Status Harian': attendanceStatusLabel(day.statusHari),
    Sumber: attendanceSourceLabel(day.sumberStatus),
    'Blok Disubmit': `${day.submittedBlok || 0}/${day.totalBlok || 0}`,
    'Blok Hadir': day.blokHadir,
    Alasan: day.statusReason || '',
    Keterangan: day.keterangan || '',
  }))
}

export async function buildAttendanceWorkbook(input: {
  kind: AttendanceExportKind
  mode?: 'hari' | 'rentang'
  data: any
  filename: string
  periodLabel?: string
}) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const legend = 'Legenda: H=Hadir; S=Sakit; I=Izin; A=Alfa; B=Bolos sebagian jam; K=Perlu keputusan wali; BI=Belum ada input; BL=Belum lengkap'

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
        monitoringRows(section),
      )
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(section.kelas?.label || 'Monitoring'))
    }
  } else if (input.kind === 'kelas') {
    for (const section of input.data.sections || []) {
      const sheet = createSheet(
        `Rekap Absensi Kelas ${section.kelas?.label || ''}`,
        input.periodLabel || section.tanggal || `${section.tglMulai || ''} s.d. ${section.tglSelesai || ''}`,
        classRows(section, input.mode || 'hari'),
      )
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(section.kelas?.label || 'Kelas'))
    }
  } else {
    const rekap = input.data.rekap || {}
    const sheet = createSheet(
      `Rekap Absensi ${rekap.siswa?.nama || 'Siswa'} - ${rekap.siswa?.kelas || ''}`,
      input.periodLabel || `${rekap.tglMulai || ''} s.d. ${rekap.tglSelesai || ''}`,
      studentRows(input.data),
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
