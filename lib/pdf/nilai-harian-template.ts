// Lokasi: lib/pdf/nilai-harian-template.ts
// HTML builder untuk PDF Rekap Nilai Harian (server-side, Browser Rendering).
// Markup & style mirror persis blok cetak lama di NilaiHarianClient (react-to-print).

type RekapHeader = { id: string; judul: string; tanggal: string }
type RekapRow = {
  siswa_id: string
  nama_lengkap: string
  nilai: Record<string, number | null>
  rata_rata: number | null
}

export type NilaiHarianPdfData = {
  mapelNama: string
  kelasLabel: string
  headers: RekapHeader[]
  rows: RekapRow[]
  kopUrl: string // absolute URL ke /kopsurat.png
  baseUrl: string // origin untuk @font-face (cth https://app.../)
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;' :
    ch === '>' ? '&gt;' :
    ch === '"' ? '&quot;' : '&#39;'
  ))
}

export function buildNilaiHarianHtml(data: NilaiHarianPdfData): string {
  const { mapelNama, kelasLabel, headers, rows, kopUrl, baseUrl } = data
  const fontBase = baseUrl.replace(/\/$/, '')
  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })

  const cellBorder = 'border:1px solid #000;padding:3px 4px'

  const headCols = headers.map(h =>
    `<th style="${cellBorder};text-align:center">${esc(h.judul)}<br><span style="font-weight:normal;font-size:8px">${esc(h.tanggal)}</span></th>`
  ).join('')

  const bodyRows = rows.map((r, i) => {
    const nilaiCols = headers.map(h =>
      `<td style="${cellBorder};text-align:center">${esc(r.nilai[h.id] ?? '-')}</td>`
    ).join('')
    return `<tr>
      <td style="${cellBorder};text-align:center">${i + 1}</td>
      <td style="${cellBorder}">${esc(r.nama_lengkap)}</td>
      ${nilaiCols}
      <td style="${cellBorder};text-align:center;font-weight:bold">${esc(r.rata_rata ?? '-')}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Times New Roman'; src: url('${fontBase}/fonts/times.ttf') format('truetype'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'Times New Roman'; src: url('${fontBase}/fonts/timesbd.ttf') format('truetype'); font-weight: 700; font-style: normal; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 10px; color: #000; padding: 20mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
  <img src="${esc(kopUrl)}" alt="Kop Surat" style="display:block;width:calc(100% + 40mm);margin:-20mm -20mm 0 -20mm">
  <div style="text-align:center;margin:10px 0 12px">
    <h3 style="font-size:11px;font-weight:bold;text-transform:uppercase;margin:0">REKAP NILAI HARIAN</h3>
    <p style="font-size:10px;margin:2px 0 0">${esc(mapelNama)} — ${esc(kelasLabel)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="${cellBorder}">No</th>
        <th style="${cellBorder};text-align:left">Nama Siswa</th>
        ${headCols}
        <th style="${cellBorder}">Rata-rata</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div style="margin-top:20px;text-align:right;font-size:9px">
    <p>Tasikmalaya, ${esc(tanggalCetak)}</p>
    <p style="margin-top:4px">Guru Mata Pelajaran,</p>
    <div style="height:48px"></div>
    <p>(__________________________)</p>
  </div>
</body>
</html>`
}
