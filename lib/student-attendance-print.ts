import { attendanceSourceLabel, attendanceStatusLabel } from '@/lib/attendance-status'

export const STUDENT_PRINT_STATUSES = ['HADIR', 'BOLOS', 'SAKIT', 'IZIN', 'ALFA', 'PERLU KONFIRMASI WALI', 'BELUM ADA INPUT', 'BELUM_ADA_DATA'] as const
export type StudentPrintStatus = typeof STUDENT_PRINT_STATUSES[number]

export type StudentAttendancePrintData = {
  siswa?: { nama: string; nisn?: string | null; nis_lokal?: string | null; kelas: string }
  days?: Array<{
    tanggal: string; hariNama: string; statusHari: string; totalBlok: number; submittedBlok?: number
    sumberStatus?: string; statusReason?: string
    detail: Array<{ nama_mapel: string; status: string; jam_ke_mulai: number; jam_ke_selesai: number; catatan?: string | null }>
  }>
  summary?: { hadir: number; parsial: number; sakit: number; izin: number; alfa: number; perlu_konfirmasi_wali?: number; belum_ada_input?: number; belum_ada_data?: number }
  totalHari?: number
}

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function buildStudentAttendancePrintHtml(options: {
  result: StudentAttendancePrintData
  waliKelas?: string | null
  startDate: string
  endDate: string
  statuses: ReadonlySet<StudentPrintStatus>
  paper: 'A4' | 'F4'
  orientation: 'portrait' | 'landscape'
  origin: string
  generatedAt?: Date
}) {
  const { result, waliKelas, startDate: tglMulai, endDate: tglSelesai, statuses: filterStatus, paper: printPaper, orientation: printOrientation } = options
  const generatedAt = options.generatedAt ?? new Date()
  const { days: allDays = [], summary, siswa: siswaMeta, totalHari } = result

  // Filter hari berdasarkan status yang dipilih
  const days = allDays.filter(d => filterStatus.has(d.statusHari as StudentPrintStatus))

  const fmtTgl = (t: string) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtTglShort = (t: string) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const nowStr = generatedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const tglTtd = generatedAt.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })

  const statusLabel: Record<string, string> = {
    HADIR: 'Hadir', BOLOS: 'Bolos', SAKIT: 'Sakit', IZIN: 'Izin', ALFA: 'Alfa', 'PERLU KONFIRMASI WALI': 'Perlu Keputusan Wali', 'BELUM ADA INPUT': 'Belum Ada Input', BELUM_ADA_DATA: 'Belum Lengkap'
  }

  const namaMeta  = siswaMeta?.nama || '-'
  const nisnMeta  = siswaMeta?.nisn || '-'
  const nisMeta   = siswaMeta?.nis_lokal || '-'
  const kelasMeta = result.siswa?.kelas || '-'
  const wkNama    = waliKelas           || 'Belum Ditentukan'

  const TD = 'border:1px solid #555;padding:3px 5px;vertical-align:top;'

  // Baris tabel detail per hari
  const tableRows = days.map((day, i) => {
    const detailStr = day.detail.length > 0
      ? day.detail.map(d =>
          `${escapeHtml(d.nama_mapel)} (Jam ${d.jam_ke_mulai}${d.jam_ke_selesai > d.jam_ke_mulai ? '\u2013' + d.jam_ke_selesai : ''}):` +
          ` ${escapeHtml(statusLabel[d.status] || d.status)}` +
          `${d.catatan ? ' — ' + escapeHtml(d.catatan) : ''}`
        ).join('<br/>')
      : 'Hadir semua jam'

    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f5f5f5'}">
      <td style="${TD}text-align:center;width:24px">${i + 1}</td>
      <td style="${TD}width:24px;text-align:center">${new Date(day.tanggal + 'T00:00:00').getDate()}</td>
      <td style="${TD}width:44px">${escapeHtml(day.hariNama)}</td>
      <td style="${TD}width:70px">${fmtTglShort(day.tanggal)}</td>
      <td style="${TD}width:45px;text-align:center">${day.submittedBlok || 0}/${day.totalBlok}</td>
      <td style="${TD}width:70px">${escapeHtml(attendanceStatusLabel(day.statusHari))}</td>
      <td style="${TD}width:70px">${escapeHtml(attendanceSourceLabel(day.sumberStatus))}</td>
      <td style="${TD}font-size:8.5px">${escapeHtml(day.statusReason || '-')}</td>
      <td style="${TD}font-size:8.5px;line-height:1.5">${detailStr}</td>
    </tr>`
  }).join('')

  // Dapatkan origin untuk URL absolut gambar kopsurat
  const origin = options.origin

  const base = printPaper === 'A4' ? { width: 210, height: 297 } : { width: 215, height: 330 }
  const page = printOrientation === 'portrait' ? base : { width: base.height, height: base.width }
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>Rekap Absensi \u2014 ${escapeHtml(namaMeta)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; }
  @page { size: ${page.width}mm ${page.height}mm; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  .page { width: ${page.width}mm; min-height: ${page.height}mm; padding: 0 12mm 12mm 12mm; }

  /* KOP */
  .kop-img { width: 100%; display: block; margin-bottom: 8pt; }

  /* GARIS BAWAH KOP */
  .kop-line { border-top: 2pt solid #000; margin-bottom: 10pt; }

  /* JUDUL */
  .judul { text-align: center; margin-bottom: 10pt; }
  .judul h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 2pt; }
  .judul .periode { font-size: 11pt; font-weight: normal; }

  /* INFO SISWA */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 10pt; }
  .info-table td { padding: 1.5pt 0; vertical-align: top; }
  .info-table td:first-child { width: 110pt; }
  .info-table td:nth-child(2) { width: 10pt; text-align: center; }

  /* RINGKASAN */
  .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  .summary-table th, .summary-table td { border: 1px solid #555; padding: 4pt 6pt; text-align: center; font-size: 10pt; }
  .summary-table th { font-weight: bold; background: #eee; }

  /* TABEL HARIAN */
  table.main { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.main thead tr { background: #ddd; }
  table.main thead th { border: 1px solid #555; padding: 4pt 4pt; font-weight: bold; text-align: center; }
  table.main tbody td { border: 1px solid #888; padding: 2.5pt 4pt; vertical-align: top; }

  /* FOOTER */
  .footer { margin-top: 14pt; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; }
  .footer .keterangan p { margin-bottom: 1.5pt; }
  .footer .ttd { text-align: center; }
  .footer .ttd-space { height: 44pt; }
  .footer .ttd-nama { font-weight: bold; border-top: 1pt solid #000; padding-top: 2pt; }

  /* Colofon */
  .colofon { font-size: 7.5pt; color: #777; text-align: center; margin-top: 10pt; }
</style>
</head>
<body>
<div class="page">

  <img class="kop-img" src="${escapeHtml(origin)}/kopsurat.png" alt="Kop Surat" />

  <div class="judul">
    <h2>Rekap Kehadiran Siswa</h2>
    <div class="periode">Periode: ${fmtTgl(tglMulai)} &ndash; ${fmtTgl(tglSelesai)}</div>
  </div>

  <table class="info-table">
    <tr><td>Nama Siswa</td><td>:</td><td><strong>${escapeHtml(namaMeta)}</strong></td></tr>
    <tr><td>NISN</td><td>:</td><td>${escapeHtml(nisnMeta)}</td></tr>
    <tr><td>NIS Lokal</td><td>:</td><td>${escapeHtml(nisMeta)}</td></tr>
    <tr><td>Kelas</td><td>:</td><td>${escapeHtml(kelasMeta)}</td></tr>
    <tr><td>Total Hari Efektif</td><td>:</td><td>${totalHari || days.length} hari</td></tr>
  </table>

  <table class="summary-table">
    <thead>
      <tr>
        <th>Hadir</th><th>Bolos</th><th>Sakit</th><th>Izin</th><th>Alfa</th><th>Perlu Keputusan Wali</th><th>Belum Ada Input</th><th>Belum Lengkap</th><th>Total Hari</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${summary?.hadir ?? 0}</td>
        <td>${summary?.parsial ?? 0}</td>
        <td>${summary?.sakit ?? 0}</td>
        <td>${summary?.izin ?? 0}</td>
        <td>${summary?.alfa ?? 0}</td>
        <td>${summary?.perlu_konfirmasi_wali ?? 0}</td>
        <td>${summary?.belum_ada_input ?? 0}</td>
        <td>${summary?.belum_ada_data ?? 0}</td>
        <td>${days.length}</td>
      </tr>
    </tbody>
  </table>

  <table class="main">
    <thead>
      <tr>
        <th style="width:24px">No</th>
        <th style="width:24px">Tgl</th>
        <th style="width:44px">Hari</th>
        <th style="width:70px">Tanggal</th>
        <th style="width:45px">Blok Disubmit</th>
        <th style="width:70px">Status</th>
        <th style="width:70px">Sumber</th>
        <th>Alasan</th>
        <th>Detail Ketidakhadiran</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    <div class="keterangan">
      <p><strong>Keterangan:</strong></p>
      <p>Hadir: Hadir semua blok jam pelajaran</p>
      <p>Bolos: Hadir sebagian jam, lalu alfa di sebagian jam</p>
      <p>Perlu Keputusan Wali: Ada campuran alfa, sakit, dan/atau izin dalam satu hari</p>
      <p>Belum Ada Input: Belum ada satu pun blok jam yang disubmit</p>
      <p>Belum Lengkap: Absensi harian belum selesai diinput semua guru</p>
      <p>Sakit / Izin: Tidak hadir dengan keterangan</p>
      <p>Alfa: Tidak hadir tanpa keterangan</p>
    </div>
    <div class="ttd">
      <p>Tasikmalaya, ${tglTtd}</p>
      <p style="margin-top:2pt">Wali Kelas,</p>
      <div class="ttd-space"></div>
      <div class="ttd-nama">${escapeHtml(wkNama)}</div>
    </div>
  </div>

  <p class="colofon">Dicetak melalui Sistem Informasi Manajemen MAN 1 Tasikmalaya &bull; ${nowStr} WIB</p>
</div>
</body></html>`
}
