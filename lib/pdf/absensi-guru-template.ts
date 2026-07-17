import type { TeacherAttendanceReport } from '@/app/dashboard/kehadiran/report-actions'

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    char === '&' ? '&amp;' :
    char === '<' ? '&lt;' :
    char === '>' ? '&gt;' :
    char === '"' ? '&quot;' : '&#39;'
  ))
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })
}

export function buildTeacherAttendanceHtml(data: {
  report: TeacherAttendanceReport
  kopUrl: string
  baseUrl: string
}) {
  const { report, kopUrl, baseUrl } = data
  const fontBase = baseUrl.replace(/\/$/, '')
  const printedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
  const selected = report.assignments.find(item => item.id === report.selected_penugasan_id)
  const scopeLabel = selected
    ? `${selected.mapel_nama} - ${selected.kelas_label}`
    : 'Semua sesi mengajar guru'

  const sessionRows = [...report.sessions].reverse().map((session, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${esc(formatDate(session.tanggal))}</td>
      <td>${esc(session.mapel_nama)}</td>
      <td>${esc(session.kelas_label)}</td>
      <td class="center">${session.jam_ke_mulai == null ? '-' : session.jam_ke_mulai === session.jam_ke_selesai ? session.jam_ke_mulai : `${session.jam_ke_mulai}-${session.jam_ke_selesai}`}</td>
      <td class="center">${session.hadir}</td>
      <td class="center">${session.sakit}</td>
      <td class="center">${session.izin}</td>
      <td class="center">${session.alfa}</td>
      <td>${esc(session.submitted_by)}</td>
    </tr>
  `).join('')

  const groupedRows = new Map<string, typeof report.rows>()
  for (const row of report.rows) {
    const group = `${row.penugasan_id}__${row.mapel_nama}__${row.kelas_label}`
    if (!groupedRows.has(group)) groupedRows.set(group, [])
    groupedRows.get(group)!.push(row)
  }
  const studentSections = Array.from(groupedRows.entries()).map(([group, rows]) => {
    const [, mapel, kelas] = group.split('__')
    return `
      <section>
        <h3>${esc(mapel)} - ${esc(kelas)}</h3>
        <table>
          <thead><tr><th>No</th><th>Nama Siswa</th><th>NISN</th><th>Total Sesi</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alfa</th><th>Kehadiran</th></tr></thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr>
                <td class="center">${index + 1}</td><td>${esc(row.nama_lengkap)}</td><td>${esc(row.nisn)}</td>
                <td class="center">${row.total_sesi}</td><td class="center">${row.hadir}</td><td class="center">${row.sakit}</td>
                <td class="center">${row.izin}</td><td class="center">${row.alfa}</td><td class="center strong">${row.kehadiran_persen}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `
  }).join('')

  const absenceDetails = report.rows.flatMap(row => row.sessions
    .filter(item => item.status !== 'HADIR')
    .map(item => ({ ...item, row })))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.row.nama_lengkap.localeCompare(b.row.nama_lengkap))
  const absenceRows = absenceDetails.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td><td>${esc(formatDate(item.tanggal))}</td><td>${esc(item.row.mapel_nama)}</td>
      <td>${esc(item.row.kelas_label)}</td><td>${esc(item.row.nama_lengkap)}</td><td class="center strong">${esc(item.status)}</td><td>${esc(item.catatan || '-')}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/times.ttf') format('truetype'); font-weight:400; }
  @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/timesbd.ttf') format('truetype'); font-weight:700; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:330mm 215mm; margin:0; }
  html,body { margin:0; padding:0; }
  body { padding:12mm; color:#111; font-family:'Times New Roman',serif; font-size:9px; }
  .kop { display:block; width:calc(100% + 24mm); margin:-12mm -12mm 6mm; }
  h1 { margin:0; text-align:center; font-size:14px; }
  h2 { margin:2px 0 0; text-align:center; font-size:10px; font-weight:400; }
  h3 { margin:12px 0 5px; font-size:10px; }
  .meta { margin:8px 0; display:grid; grid-template-columns:90px 1fr 90px 1fr; gap:2px 8px; }
  .summary { display:flex; gap:6px; margin:8px 0 10px; }
  .card { border:1px solid #aaa; border-radius:4px; padding:5px 9px; min-width:74px; }
  .card b { display:block; margin-top:2px; font-size:12px; }
  table { width:100%; border-collapse:collapse; font-size:8px; }
  th,td { border:1px solid #555; padding:3px 4px; vertical-align:top; }
  th { background:#e8edf3; text-align:center; font-weight:700; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  section { break-inside:auto; }
  .center { text-align:center; }
  .strong { font-weight:700; }
  .note { margin-top:10px; border-left:3px solid #334155; padding:4px 8px; color:#444; }
  .footer { margin-top:14px; display:flex; justify-content:space-between; color:#555; }
</style>
</head>
<body>
  <img class="kop" src="${esc(kopUrl)}" alt="Kop Surat">
  <h1>REKAP ABSENSI SISWA PER SESI MENGAJAR</h1>
  <h2>Data asli yang disimpan guru mata pelajaran</h2>
  <div class="meta">
    <b>Guru</b><span>${esc(report.guru?.nama_lengkap || '-')}</span>
    <b>Periode</b><span>${esc(formatDate(report.start_date))} s.d. ${esc(formatDate(report.end_date))}</span>
    <b>Lingkup</b><span>${esc(scopeLabel)}</span>
    <b>Jumlah sesi</b><span>${report.summary.total_sesi}</span>
  </div>
  <div class="summary">
    <div class="card">Hadir<b>${report.summary.hadir}</b></div><div class="card">Sakit<b>${report.summary.sakit}</b></div>
    <div class="card">Izin<b>${report.summary.izin}</b></div><div class="card">Alfa<b>${report.summary.alfa}</b></div>
  </div>

  <h3>Daftar Sesi Tersimpan</h3>
  <table>
    <thead><tr><th>No</th><th>Tanggal</th><th>Mata Pelajaran</th><th>Kelas</th><th>Jam</th><th>H</th><th>S</th><th>I</th><th>A</th><th>Disubmit Oleh</th></tr></thead>
    <tbody>${sessionRows}</tbody>
  </table>

  ${studentSections}

  <section>
    <h3>Detail Ketidakhadiran per Sesi</h3>
    ${absenceRows ? `<table><thead><tr><th>No</th><th>Tanggal</th><th>Mapel</th><th>Kelas</th><th>Nama Siswa</th><th>Status</th><th>Catatan</th></tr></thead><tbody>${absenceRows}</tbody></table>` : '<p>Tidak ada catatan ketidakhadiran pada periode ini.</p>'}
  </section>

  <p class="note"><b>Catatan:</b> Laporan ini hanya menggunakan data absensi pada sesi mengajar guru. Keputusan atau koreksi harian wali kelas tidak mengubah isi laporan ini.</p>
  <div class="footer"><span>Dicetak: ${esc(printedAt)} WIB</span><span>MANSATAS App</span></div>
</body>
</html>`
}
