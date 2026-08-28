import type { TeacherAttendanceReport } from '@/app/dashboard/kehadiran/report-actions'
import { attendanceStatusCode, chunkAttendanceSessions, orderedAttendanceSessions, studentStatusBySession } from '@/lib/teacher-attendance-grid'

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '"' ? '&quot;' : '&#39;')
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jakarta' })
}

export function buildTeacherAttendanceGridHtml(data: { report: TeacherAttendanceReport; kopUrl: string; baseUrl: string }) {
  const { report, kopUrl, baseUrl } = data
  const selected = report.assignments.find(item => item.id === report.selected_penugasan_id)
  const sessions = orderedAttendanceSessions(report.sessions)
  const chunks = chunkAttendanceSessions(sessions, 15)
  const fontBase = baseUrl.replace(/\/$/, '')
  const printedAt = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

  const tables = chunks.map((chunk, chunkIndex) => `
    <section class="grid-section${chunkIndex > 0 ? ' next-page' : ''}">
      <h3>Rekap Per Kelas${chunks.length > 1 ? ` — Bagian ${chunkIndex + 1} dari ${chunks.length}` : ''}</h3>
      <table>
        <thead><tr>
          <th class="no">No</th><th class="name">Nama Siswa</th>
          ${chunk.map(session => `<th class="date">${esc(formatShortDate(session.tanggal))}</th>`).join('')}
          <th class="total">H</th><th class="total">S</th><th class="total">I</th><th class="total">A</th>
        </tr></thead>
        <tbody>${report.rows.map((row, index) => {
          const statuses = studentStatusBySession(row)
          return `<tr><td class="center">${index + 1}</td><td>${esc(row.nama_lengkap)}</td>${chunk.map(session => {
            const status = statuses.get(session.key)
            return `<td class="center status ${status ? status.toLowerCase() : ''}">${status ? attendanceStatusCode(status) : '-'}</td>`
          }).join('')}<td class="center strong">${row.hadir}</td><td class="center strong">${row.sakit}</td><td class="center strong">${row.izin}</td><td class="center strong">${row.alfa}</td></tr>`
        }).join('')}</tbody>
      </table>
    </section>
  `).join('')

  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>
    @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/times.ttf') format('truetype'); font-weight:400; }
    @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/timesbd.ttf') format('truetype'); font-weight:700; }
    * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size:330mm 215mm; margin:0; }
    html,body { margin:0; padding:0; }
    body { padding:12mm; color:#111; font-family:'Times New Roman',serif; font-size:9px; }
    .kop { display:block; width:calc(100% + 24mm); margin:-12mm -12mm 6mm; }
    h1 { margin:0; text-align:center; font-size:14px; }
    h2 { margin:2px 0 0; text-align:center; font-size:10px; font-weight:400; }
    h3 { margin:10px 0 5px; font-size:10px; }
    .meta { margin:8px 0; display:grid; grid-template-columns:85px 1fr 85px 1fr; gap:2px 8px; }
    .summary { display:flex; gap:6px; margin:8px 0; }
    .card { border:1px solid #aaa; border-radius:4px; padding:4px 9px; min-width:70px; }
    .card b { display:block; margin-top:1px; font-size:11px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:8px; }
    th,td { border:1px solid #555; padding:3px 3px; vertical-align:middle; }
    th { background:#e8edf3; text-align:center; font-weight:700; }
    thead { display:table-header-group; }
    tr { break-inside:avoid; page-break-inside:avoid; }
    .no { width:8mm; }.name { width:58mm; text-align:left; }.date { width:11mm; }.total { width:9mm; }
    .center { text-align:center; }.strong { font-weight:700; }.status { font-weight:700; }
    .hadir { background:#ecfdf5; color:#047857; }.sakit { background:#fffbeb; color:#b45309; }.izin { background:#eff6ff; color:#1d4ed8; }.alfa { background:#fff1f2; color:#be123c; }
    .next-page { page-break-before:always; padding-top:2mm; }
    .note { margin-top:9px; border-left:3px solid #334155; padding:4px 8px; color:#444; }
    .footer { margin-top:10px; display:flex; justify-content:space-between; color:#555; }
  </style></head><body>
    <img class="kop" src="${esc(kopUrl)}" alt="Kop Surat">
    <h1>REKAP ABSENSI SISWA PER KELAS</h1>
    <h2>Data asli yang disimpan guru pada setiap sesi mengajar</h2>
    <div class="meta"><b>Guru</b><span>${esc(report.guru?.nama_lengkap || '-')}</span><b>Periode</b><span>${esc(formatDate(report.start_date))} s.d. ${esc(formatDate(report.end_date))}</span><b>Mapel</b><span>${esc(selected?.mapel_nama || '-')}</span><b>Kelas</b><span>${esc(selected?.kelas_label || '-')}</span><b>Jumlah sesi</b><span>${report.summary.total_sesi}</span></div>
    <div class="summary"><div class="card">Hadir<b>${report.summary.hadir}</b></div><div class="card">Sakit<b>${report.summary.sakit}</b></div><div class="card">Izin<b>${report.summary.izin}</b></div><div class="card">Alfa<b>${report.summary.alfa}</b></div></div>
    ${tables}
    <p class="note"><b>Catatan:</b> Laporan ini hanya menggunakan absensi sesi mengajar guru, bukan keputusan akhir harian wali kelas.</p>
    <div class="footer"><span>Dicetak: ${esc(printedAt)} WIB</span><span>MANSATAS App</span></div>
  </body></html>`
}
