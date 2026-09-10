import type { KomiteFinancialReport, KomiteLedgerRow } from '@/lib/komite-financial-report'

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function date(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(`${value}T00:00:00+07:00`))
}

function detailTable(title: string, rows: KomiteLedgerRow[], totalLabel: string, openingBalance?: number) {
  const opening = openingBalance === undefined ? '' : `<tr class="opening"><td></td><td>Saldo Awal</td><td class="center">-</td><td class="money">-</td><td class="money">-</td><td class="money">${rupiah(openingBalance)}</td></tr>`
  const body = rows.length
    ? rows.map(row => `<tr><td>${date(row.transactionDate)}</td><td>${esc(row.description)}</td><td class="center">${esc(row.proofNumber || '-')}</td><td class="money">${row.debit ? rupiah(row.debit) : '-'}</td><td class="money">${row.credit ? rupiah(row.credit) : '-'}</td><td class="money">${rupiah(row.balance)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">Tidak ada transaksi pada periode ini.</td></tr>'
  const debit = rows.reduce((sum, row) => sum + row.debit, 0)
  const credit = rows.reduce((sum, row) => sum + row.credit, 0)
  const ending = rows.length ? rows[rows.length - 1].balance : 0
  return `<section><h2>${esc(title)}</h2><table><thead><tr><th>Tanggal</th><th>Uraian</th><th>No. Bukti</th><th>Debet (Rp)</th><th>Kredit (Rp)</th><th>Jumlah / Saldo</th></tr></thead><tbody>${opening}${body}<tr class="total"><td colspan="3">${esc(totalLabel)}</td><td class="money">${rupiah(debit)}</td><td class="money">${rupiah(credit)}</td><td class="money">${rupiah(rows.length ? ending : openingBalance || 0)}</td></tr></tbody></table></section>`
}

export function buildKomiteFinancialReportHtml(report: KomiteFinancialReport) {
  const scope = report.scope === 'all' ? 'Semua transaksi sah' : 'Siswa aktif saja'
  const signatures = report.signatures.enabled ? `<div class="signatures">
    <div><p>Bendahara Komite,</p><div class="sign-space"></div><strong>${esc(report.signatures.treasurerName)}</strong></div>
    <div><p>Ketua Komite,</p><div class="sign-space"></div><strong>${esc(report.signatures.chairmanName)}</strong></div>
    <div><p>Mengetahui,<br>Kepala Madrasah</p><div class="sign-space"></div><strong>${esc(report.signatures.principalName)}</strong></div>
  </div>` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:11mm 10mm 13mm}
    *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#111;font-size:10pt;line-height:1.25;margin:0}
    header{text-align:center;margin-bottom:5mm} h1{font-size:14pt;margin:0 0 1mm;text-transform:uppercase} .school{font-size:12pt;font-weight:700;margin:0}.period{font-size:11pt;font-weight:700;margin:0}.scope{font-size:8.5pt;color:#555;margin-top:1mm}
    section{margin:0 0 7mm;break-before:page;page-break-before:always} section.summary{break-before:auto;page-break-before:auto}
    h2{font-size:12pt;margin:0 0 2mm;text-transform:uppercase} table{border-collapse:collapse;width:100%;table-layout:fixed}
    th,td{border:1px solid #333;padding:1.7mm 1.5mm;vertical-align:top} th{background:#166534;color:#fff;text-align:center;font-size:9.5pt}
    th:nth-child(1),td:nth-child(1){width:25mm} th:nth-child(2),td:nth-child(2){width:auto} th:nth-child(3),td:nth-child(3){width:35mm} th:nth-child(n+4),td:nth-child(n+4){width:34mm}
    .summary-table{width:115mm}.summary-table td:first-child{width:65mm;font-weight:700}.summary-table td:last-child{width:50mm}.money{text-align:right;white-space:nowrap}.center{text-align:center}.total td{font-weight:700;background:#eaf4ec}.empty{text-align:center;color:#666;padding:5mm}
    .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:14mm;margin-top:10mm;break-inside:avoid;text-align:center}.sign-space{height:19mm}.signatures strong{display:block;border-top:1px solid #111;padding-top:1mm}
    footer{position:fixed;bottom:-8mm;left:0;right:0;text-align:right;font-size:8pt;color:#666} footer:after{content:'Halaman ' counter(page)}
  </style></head><body><header><h1>LAPORAN KEUANGAN KOMITE MADRASAH</h1><p class="school">MAN 1 TASIKMALAYA</p><p class="period">PERIODE ${esc(report.periodLabel)}</p><p class="scope">Cakupan: ${esc(scope)}</p></header>
  <section class="summary"><h2>Ringkasan Saldo</h2><table class="summary-table"><thead><tr><th>Uraian</th><th>Jumlah</th></tr></thead><tbody>
    <tr><td>Saldo Awal</td><td class="money">${rupiah(report.openingBalance)}</td></tr><tr><td>Total Penerimaan</td><td class="money">${rupiah(report.totalIncome)}</td></tr><tr><td>Total Pengeluaran</td><td class="money">${rupiah(report.totalExpense)}</td></tr><tr class="total"><td>Saldo Akhir</td><td class="money">${rupiah(report.endingBalance)}</td></tr></tbody></table></section>
  ${detailTable('Rincian Penerimaan', report.incomeRows, 'JUMLAH PENERIMAAN')}
  ${detailTable('Rincian Pengeluaran', report.expenseRows, 'JUMLAH PENGELUARAN')}
  ${detailTable('BKU (Buku Kas Umum) / Rekonsiliasi', report.rows, 'JUMLAH', report.openingBalance)}${signatures}<footer></footer></body></html>`
}
