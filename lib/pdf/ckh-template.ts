// Lokasi: lib/pdf/ckh-template.ts
// HTML builder untuk PDF Catatan Kinerja Harian (CKH). Mirror CkhPrintDocument lama.
import {
  CKH_DEFAULT_VOL,
  CKH_DEFAULT_SATUAN,
  buildCkhDateRowSpans,
  formatCkhDate,
  formatCkhMonth,
  shouldUseKepalaTu,
} from '@/lib/ckh'

type CkhRow = {
  id: string
  tanggal: string
  kegiatan_bulanan: string
  catatan_harian: string
  vol?: number | null
  satuan?: string | null
}

type Signer = { nama_lengkap?: string | null; nip?: string | null } | null

type SignatureSettings = {
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
}

export type CkhPdfData = {
  rows: CkhRow[]
  user: any
  kepsek: Signer
  kepalaTu: Signer
  userRoles: string[]
  signatureSettings: SignatureSettings
  year: number
  month: number
  paperCss: string // "210mm 297mm" | "215mm 330mm"
  baseUrl: string // origin untuk @font-face
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;' :
    ch === '>' ? '&gt;' :
    ch === '"' ? '&quot;' : '&#39;'
  ))
}

const MISSING = `<span style="font-style:italic">Silakan isi dulu di Profil</span>`
const TH = 'border:1px solid #000;padding:4px 3px;text-align:center;vertical-align:middle;font-weight:700'
const TD_CENTER = 'border:1px solid #000;padding:4px 4px;text-align:center;vertical-align:middle;white-space:pre-wrap;word-break:break-word'
const TD_LEFT = 'border:1px solid #000;padding:4px 4px;text-align:left;vertical-align:middle;white-space:pre-wrap;word-break:break-word'
const SIG_COL = 'width:46%;text-align:left;padding-left:14mm'
const SIG_ROLE = 'font-weight:700;text-transform:uppercase;margin-bottom:20mm'

export function buildCkhHtml(data: CkhPdfData): string {
  const { rows, user, kepsek, kepalaTu, userRoles, signatureSettings, year, month, paperCss, baseUrl } = data
  const fontBase = baseUrl.replace(/\/$/, '')
  const useTu = shouldUseKepalaTu(user, userRoles)
  const signer = useTu ? kepalaTu : kepsek
  const signerLabel = useTu ? 'KEPALA TU' : 'KEPALA MAN 1 TASIKMALAYA'
  const missingSignerLabel = useTu ? 'KEPALA TU BELUM DIATUR' : 'KEPALA MADRASAH BELUM DIATUR'
  const monthLabel = formatCkhMonth(year, month)
  const dateSpans = buildCkhDateRowSpans(rows)
  const lastRow = rows[rows.length - 1]
  const tanggalCetak = lastRow?.tanggal
    ? new Date(lastRow.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  const bodyRows = rows.map(row => {
    const span = dateSpans.get(row)
    const dateCells = span?.isFirstOfDate
      ? `<td rowspan="${span.dateRowSpan}" style="${TD_CENTER}">${span.dateIndex}</td>
         <td rowspan="${span.dateRowSpan}" style="${TD_CENTER}">${esc(formatCkhDate(row.tanggal))}</td>`
      : ''
    return `<tr>
      ${dateCells}
      <td style="${TD_LEFT}">${esc(row.kegiatan_bulanan)}</td>
      <td style="${TD_LEFT}">${esc(row.catatan_harian)}</td>
      <td style="${TD_CENTER}">${esc(row.vol || CKH_DEFAULT_VOL)}</td>
      <td style="${TD_CENTER}">${esc(row.satuan || CKH_DEFAULT_SATUAN)}</td>
    </tr>`
  }).join('')

  const sigImg = signatureSettings.signature_enabled && user.signature_url
    ? `<img src="${esc(user.signature_url)}" alt="" style="position:absolute;left:${signatureSettings.signature_x_mm}mm;top:${signatureSettings.signature_y_mm}mm;width:${signatureSettings.signature_width_mm}mm;height:auto;max-height:40mm;object-fit:contain;z-index:10;pointer-events:none">`
    : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Tahoma'; src: url('${fontBase}/fonts/tahoma.ttf') format('truetype'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'Tahoma'; src: url('${fontBase}/fonts/tahomabd.ttf') format('truetype'); font-weight: 700; font-style: normal; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Tahoma, sans-serif; color: #000; background: #fff; font-size: 10.5pt; }
  thead { display: table-header-group; }
  .ckh-print-table tr { break-inside: avoid; page-break-inside: avoid; }
  @page { size: ${paperCss}; }
</style>
</head>
<body>
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-size:13pt;font-weight:700">CATATAN KINERJA HARIAN</div>
    <div style="font-size:13pt;font-weight:700">ASN MAN 1 TASIKMALAYA</div>
    <div style="font-size:10pt;font-weight:700;margin-top:2px">BULAN : ${esc(monthLabel)}</div>
  </div>

  <table style="margin-bottom:8px;border-collapse:collapse;font-size:10pt">
    <tbody>
      <tr><td style="width:112px;white-space:nowrap">NAMA</td><td style="width:10px">:</td><td>${esc(user.nama_lengkap)}</td></tr>
      <tr><td style="width:112px;white-space:nowrap">NIP</td><td>:</td><td>${user.nip ? esc(user.nip) : MISSING}</td></tr>
      <tr><td style="width:112px;white-space:nowrap">PANGKAT / GOL.</td><td>:</td><td>${user.pangkat_golongan ? esc(user.pangkat_golongan) : MISSING}</td></tr>
      <tr><td style="width:112px;white-space:nowrap">JABATAN</td><td>:</td><td>${user.jabatan_cetak ? esc(user.jabatan_cetak) : MISSING}</td></tr>
    </tbody>
  </table>

  <table class="ckh-print-table" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt">
    <thead>
      <tr>
        <th style="${TH};width:7mm">NO</th>
        <th style="${TH};width:22mm">TANGGAL</th>
        <th style="${TH};width:44mm">KEGIATAN BULANAN</th>
        <th style="${TH}">CATATAN KINERJA HARIAN</th>
        <th style="${TH};width:12mm">VOL</th>
        <th style="${TH};width:20mm">SATUAN</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <div style="display:flex;justify-content:space-between;margin-top:18mm;font-size:10pt">
    <div style="${SIG_COL}">
      <div>Mengetahui :</div>
      <div style="${SIG_ROLE}">${esc(signerLabel)}</div>
      <div style="font-weight:700;text-decoration:underline">${signer?.nama_lengkap ? esc(signer.nama_lengkap) : esc(missingSignerLabel)}</div>
      <div>NIP. ${signer?.nip ? esc(signer.nip) : MISSING}</div>
    </div>
    <div style="${SIG_COL};position:relative">
      ${sigImg}
      <div>Tasikmalaya, ${esc(tanggalCetak)}</div>
      <div style="${SIG_ROLE}">${esc(user.jabatan_cetak || user.role || 'Pegawai')}</div>
      <div style="font-weight:700;text-decoration:underline">${esc(user.nama_lengkap)}</div>
      <div>NIP. ${user.nip ? esc(user.nip) : MISSING}</div>
    </div>
  </div>
</body>
</html>`
}
