// Lokasi: lib/pdf/ekskul-kehadiran-template.ts
// HTML builder untuk PDF Laporan Kehadiran Ekstrakurikuler per bulan (Browser Rendering).

import type { LaporanKehadiran } from '@/app/dashboard/ekstrakurikuler/master/actions'

export type EkskulKehadiranPdfData = LaporanKehadiran & {
  kopUrl: string
  baseUrl: string
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;' :
    ch === '>' ? '&gt;' :
    ch === '"' ? '&quot;' : '&#39;'
  ))
}

function namaBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export function buildEkskulKehadiranHtml(data: EkskulKehadiranPdfData): string {
  const { ekskul_nama, bulan, pertemuan, rows, kopUrl, baseUrl } = data
  const fontBase = baseUrl.replace(/\/$/, '')
  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })
  const cellBorder = 'border:1px solid #000;padding:2px 3px'

  // Kolom tanggal pertemuan (tampilkan tanggal hari saja)
  const headCols = pertemuan.map(p => {
    const dd = p.tanggal.slice(8, 10)
    return `<th style="${cellBorder};text-align:center;width:18px">${esc(dd)}</th>`
  }).join('')

  const bodyRows = rows.map((r, i) => {
    const cols = pertemuan.map(p => {
      const v = r.status[p.id] || 'H'
      const color = v === 'A' ? '#b91c1c' : v === 'S' ? '#1d4ed8' : v === 'I' ? '#0369a1' : '#000'
      return `<td style="${cellBorder};text-align:center;color:${color}">${esc(v)}</td>`
    }).join('')
    return `<tr>
      <td style="${cellBorder};text-align:center">${i + 1}</td>
      <td style="${cellBorder}">${esc(r.nama_lengkap)}</td>
      <td style="${cellBorder};text-align:center">${esc(r.kelas_label)}</td>
      ${cols}
      <td style="${cellBorder};text-align:center">${r.rekap.H}</td>
      <td style="${cellBorder};text-align:center">${r.rekap.S}</td>
      <td style="${cellBorder};text-align:center">${r.rekap.I}</td>
      <td style="${cellBorder};text-align:center;font-weight:bold">${r.rekap.A}</td>
    </tr>`
  }).join('')

  const emptyNote = pertemuan.length === 0
    ? `<p style="text-align:center;color:#666;margin:16px 0">Tidak ada pertemuan pada bulan ini.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Times New Roman'; src: url('${fontBase}/fonts/times.ttf') format('truetype'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'Times New Roman'; src: url('${fontBase}/fonts/timesbd.ttf') format('truetype'); font-weight: 700; font-style: normal; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 10px; color: #000; padding: 12mm 14mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
  <img src="${esc(kopUrl)}" alt="Kop Surat" style="display:block;width:calc(100% + 28mm);margin:-12mm -14mm 0 -14mm">
  <div style="text-align:center;margin:10px 0 12px">
    <h3 style="font-size:12px;font-weight:bold;text-transform:uppercase;margin:0">LAPORAN KEHADIRAN EKSTRAKURIKULER</h3>
    <p style="font-size:11px;margin:2px 0 0">${esc(ekskul_nama)} — ${esc(namaBulan(bulan))}</p>
  </div>
  ${emptyNote}
  <table>
    <thead>
      <tr>
        <th style="${cellBorder}">No</th>
        <th style="${cellBorder};text-align:left">Nama Siswa</th>
        <th style="${cellBorder}">Kelas</th>
        ${headCols}
        <th style="${cellBorder}">H</th>
        <th style="${cellBorder}">S</th>
        <th style="${cellBorder}">I</th>
        <th style="${cellBorder}">A</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <p style="font-size:8px;margin-top:6px;color:#444">Keterangan: H=Hadir, S=Sakit, I=Izin, A=Alfa. Angka tanggal = tanggal pertemuan.</p>
  <div style="margin-top:18px;text-align:right;font-size:9px">
    <p>Tasikmalaya, ${esc(tanggalCetak)}</p>
    <p style="margin-top:4px">Pembina Ekstrakurikuler,</p>
    <div style="height:46px"></div>
    <p>(__________________________)</p>
  </div>
</body>
</html>`
}
