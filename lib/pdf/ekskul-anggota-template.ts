import type { EkskulAnggotaReport } from '@/lib/ekskul-anggota-report'

export type EkskulAnggotaPdfData = EkskulAnggotaReport & {
  kopUrl: string
  baseUrl: string
  printedAt?: Date
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => (
    character === '&' ? '&amp;' :
    character === '<' ? '&lt;' :
    character === '>' ? '&gt;' :
    character === '"' ? '&quot;' : '&#39;'
  ))
}

export function buildEkskulAnggotaHtml(data: EkskulAnggotaPdfData): string {
  const fontBase = data.baseUrl.replace(/\/$/, '')
  const tanggalCetak = (data.printedAt || new Date()).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })

  const sections = data.groups.map(group => {
    const rows = group.rows.map((row, index) => `
      <tr>
        <td class="number">${index + 1}</td>
        <td>${esc(row.nama_lengkap)}</td>
        <td>${esc(row.tempat_tinggal)}</td>
        <td class="write-cell">&nbsp;</td>
      </tr>
    `).join('')

    return `
      <section class="ekskul-page">
        <img src="${esc(data.kopUrl)}" alt="Kop Surat" class="letterhead">
        <header>
          <h1>DAFTAR SISWA EKSTRAKURIKULER</h1>
          <h2>${esc(group.ekskul_nama)}</h2>
          <div class="metadata">
            <span>Filter: ${esc(data.filterLabel)}</span>
            <span>Jumlah siswa: ${group.rows.length}</span>
          </div>
        </header>
        <table>
          <colgroup>
            <col class="col-number">
            <col class="col-name">
            <col class="col-residence">
            <col class="col-room">
          </colgroup>
          <thead>
            <tr class="continuation-spacer" aria-hidden="true">
              <th colspan="4"></th>
            </tr>
            <tr>
              <th>No</th>
              <th>Nama Lengkap</th>
              <th>Tempat Tinggal</th>
              <th>Asrama/Kamar</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <footer>Dicetak pada ${esc(tanggalCetak)}</footer>
      </section>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/times.ttf') format('truetype'); font-weight:400; }
  @font-face { font-family:'Times New Roman'; src:url('${fontBase}/fonts/timesbd.ttf') format('truetype'); font-weight:700; }
  @page { size:215mm 330mm; margin:0; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { margin:0; padding:0; color:#000; background:#fff; font-family:'Times New Roman',serif; }
  .ekskul-page { min-height:330mm; padding:0 14mm 12mm; break-before:page; page-break-before:always; }
  .ekskul-page:first-child { break-before:auto; page-break-before:auto; }
  .letterhead { display:block; width:calc(100% + 28mm); margin:0 -14mm; }
  header { margin:8mm 0 5mm; text-align:center; }
  h1 { margin:0; font-size:14pt; text-decoration:underline; }
  h2 { margin:2mm 0 0; font-size:12pt; }
  .metadata { display:flex; justify-content:space-between; gap:8mm; margin-top:4mm; font-size:9pt; text-align:left; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10pt; }
  thead { display:table-header-group; }
  .continuation-spacer { height:7mm; }
  .continuation-spacer th { height:7mm; padding:0; border:0; background:#fff; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th, td { border:1px solid #000; padding:2mm 2.5mm; vertical-align:middle; }
  th { text-align:center; font-weight:700; }
  tbody td { min-height:9mm; height:9mm; }
  .col-number { width:9mm; }
  .col-name { width:72mm; }
  .col-residence { width:48mm; }
  .col-room { width:auto; }
  .number { text-align:center; }
  .write-cell { color:transparent; }
  footer { margin-top:4mm; text-align:right; font-size:8pt; color:#444; }
</style>
</head>
<body>${sections}</body>
</html>`
}
