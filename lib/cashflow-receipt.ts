import { komiteFundLabel } from '@/lib/komite-funds'
import { komiteChairman } from '@/lib/komite-pengajuan'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { terbilang } from '@/lib/terbilang'

export interface CashflowReceiptItem {
  urutan: number
  uraian: string
  penerimaPenyedia: string
  jumlah: number
}

export interface CashflowReceiptAllocation {
  source: string
  account: string | null
  label: string | null
  amount: number
}

export interface CashflowReceiptData {
  sourceKind: 'cashflow' | 'pengajuan'
  referenceId: string
  tahunAnggaran: string
  nomorBukti: string
  sumberDanaText: string
  akunPosText: string
  metodeBayar: string
  nomorSpb: string | null
  kategoriKas: string
  kepada: string
  jumlah: number
  uraian: string
  tanggalIso: string | null
  isRealized: boolean
  ketuaKomiteName: string
  bendaharaKomiteName: string
  allocations: CashflowReceiptAllocation[]
  items: CashflowReceiptItem[]
}

export interface CashflowReceiptOptions {
  includeGoodsReceipt: boolean
  includeAttachment: boolean
}

export type ReceiptLookupResult =
  | { ok: true; data: CashflowReceiptData; safeFilenamePart: string }
  | { ok: false; status: number; message: string }

const METHOD_LABELS: Record<string, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char] || char))
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatTanggalIndonesia(value?: string | null) {
  if (!value) return null
  const normalized = value.includes(' ')
    ? `${value.replace(' ', 'T')}Z`
    : value.length === 10
      ? `${value}T00:00:00Z`
      : value
  const parsed = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(parsed)
}

function formatTerbilangTitleCase(amount: number) {
  const words = `${terbilang(amount)} Rupiah`.trim()
  return words.replace(/\b\w/g, char => char.toUpperCase())
}

function normalizeMethodLabel(method?: string | null) {
  if (!method) return '-'
  const key = method.trim().toLowerCase()
  return METHOD_LABELS[key] || method.trim()
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)
  return cleaned || 'Kuitansi'
}

function buildFundingSummaries(
  allocations: CashflowReceiptAllocation[],
  fallbackCategory: string,
) {
  if (!allocations.length) {
    return {
      sumberDanaText: 'Belum Dipetakan',
      akunPosText: fallbackCategory || '-',
    }
  }
  const uniqueSources = [...new Set(allocations.map(row => komiteFundLabel(row.source)))]
  const akunLabels = [...new Set(
    allocations
      .map(row => [row.account, row.label].filter(Boolean).join(' · '))
      .filter(Boolean),
  )]
  return {
    sumberDanaText: uniqueSources.join(', '),
    akunPosText: akunLabels.length ? akunLabels.join('; ') : (fallbackCategory || '-'),
  }
}

export function parseReceiptOptionsFromUrl(requestUrl: string, hasMultipleItems: boolean): CashflowReceiptOptions {
  const { searchParams } = new URL(requestUrl)
  const goodsParam = searchParams.get('goodsReceipt')
  const attachmentParam = searchParams.get('attachment')
  return {
    includeGoodsReceipt: goodsParam === null ? true : goodsParam === '1' || goodsParam === 'true',
    includeAttachment: attachmentParam === null
      ? hasMultipleItems
      : attachmentParam === '1' || attachmentParam === 'true',
  }
}

export async function loadKomiteLetterhead(requestUrl: string, assets?: CloudflareEnv['STATIC_ASSETS']) {
  const url = new URL('/kopkomite.png', requestUrl)
  const response = assets
    ? await assets.fetch(new Request(url))
    : await fetch(url)
  if (!response.ok) throw new Error('Kop Komite tidak dapat dimuat.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!pngSignature.every((value, index) => bytes[index] === value)) {
    throw new Error('Kop Komite bukan gambar PNG yang valid.')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:image/png;base64,${btoa(binary)}`
}

async function resolveDefaultSigners(db: D1Database) {
  const [reportSettings, activeChairman] = await Promise.all([
    getKomiteReportSettings().catch(() => ({
      openingBalanceMode: 'cumulative' as const,
      proofNumberMode: 'automatic' as const,
      signaturesEnabled: true,
      treasurerName: '',
      chairmanName: '',
      principalName: '',
    })),
    komiteChairman(db).catch(() => null),
  ])
  return {
    settingsChairman: reportSettings.chairmanName.trim(),
    settingsTreasurer: reportSettings.treasurerName.trim(),
    activeChairmanName: activeChairman?.name?.trim() || '',
  }
}

async function resolveUserNameIfId(db: D1Database, value?: string | null) {
  const clean = value?.trim()
  if (!clean) return ''
  const userRow = await db
    .prepare(`SELECT COALESCE(NULLIF(TRIM(nama_lengkap), ''), TRIM(name), email) AS name FROM "user" WHERE id = ?`)
    .bind(clean)
    .first<{ name: string | null }>()
    .catch(() => null)
  if (userRow?.name?.trim()) return userRow.name.trim()
  // Hindari menampilkan UUID mentah bila user sudah dihapus.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) return ''
  return clean
}

export async function getCashflowExpenseReceiptData(db: D1Database, entryId: string): Promise<ReceiptLookupResult> {
  const entry = await db.prepare(`
    SELECT
      e.id, e.direction, e.category_id, e.transaction_date, e.amount, e.method,
      e.counterparty, e.description, e.proof_number, e.is_void, e.komite_pengajuan_id,
      c.name AS category_name,
      COALESCE(NULLIF(TRIM(u.nama_lengkap), ''), TRIM(u.name), '') AS recorder_name
    FROM fin_cashflow_entries e
    LEFT JOIN fin_cashflow_categories c ON c.id = e.category_id
    LEFT JOIN "user" u ON u.id = e.created_by
    WHERE e.id = ?
  `).bind(entryId).first<any>()

  if (!entry) return { ok: false, status: 404, message: 'Transaksi tidak ditemukan.' }
  if (entry.direction !== 'expense') {
    return { ok: false, status: 409, message: 'Kuitansi pengeluaran hanya tersedia untuk transaksi pengeluaran.' }
  }
  if (Number(entry.is_void) === 1) {
    return { ok: false, status: 409, message: 'Transaksi yang dibatalkan tidak dapat dicetak kuitansinya.' }
  }

  const [allocRows, spbCashParts, spbRow, spbDetails, spbAllocs, signers] = await Promise.all([
    db.prepare(`
      SELECT a.source, a.amount, g.account, g.label
      FROM fin_komite_allocations a
      LEFT JOIN fin_rapbm_groups g ON g.id = a.group_id
      WHERE a.cashflow_id = ? AND a.state = 'realized'
      ORDER BY a.created_at, a.id
    `).bind(entry.id).all<CashflowReceiptAllocation>(),
    db.prepare(`
      SELECT source, amount FROM fin_komite_spb_cash_parts WHERE cashflow_id = ? ORDER BY source
    `).bind(entry.id).all<{ source: string; amount: number }>(),
    entry.komite_pengajuan_id
      ? db.prepare(`
          SELECT id, nomor_spb, tahun_anggaran, judul, uraian, penerima_pembayaran,
                 chairman_name_snapshot, realisasi_petugas
          FROM komite_pengajuan WHERE id = ?
        `).bind(entry.komite_pengajuan_id).first<any>()
      : Promise.resolve(null),
    entry.komite_pengajuan_id
      ? db.prepare(`
          SELECT urutan, uraian, penerima_penyedia, jumlah
          FROM komite_pengajuan_rincian WHERE pengajuan_id = ? ORDER BY urutan
        `).bind(entry.komite_pengajuan_id).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    entry.komite_pengajuan_id
      ? db.prepare(`
          SELECT a.source, a.amount, g.account, g.label
          FROM fin_komite_allocations a
          LEFT JOIN fin_rapbm_groups g ON g.id = a.group_id
          WHERE a.pengajuan_id = ? AND a.state IN ('locked', 'realized')
          ORDER BY a.created_at, a.id
        `).bind(entry.komite_pengajuan_id).all<CashflowReceiptAllocation>()
      : Promise.resolve({ results: [] as CashflowReceiptAllocation[] }),
    resolveDefaultSigners(db),
  ])

  const allocations: CashflowReceiptAllocation[] =
    (allocRows.results?.length ? allocRows.results : null)
    ?? (spbAllocs.results?.length ? spbAllocs.results : null)
    ?? (spbCashParts.results || []).map(part => ({
      source: part.source,
      account: null,
      label: null,
      amount: Number(part.amount || 0),
    }))

  const categoryName = String(entry.category_name || 'Pengeluaran Komite')
  const { sumberDanaText, akunPosText } = buildFundingSummaries(allocations, categoryName)
  const spbPetugasName = spbRow?.realisasi_petugas ? await resolveUserNameIfId(db, spbRow.realisasi_petugas) : ''

  const items: CashflowReceiptItem[] = (spbDetails.results || []).length
    ? (spbDetails.results || []).map((row: any, idx: number) => ({
        urutan: Number(row.urutan || idx + 1),
        uraian: String(row.uraian || '-'),
        penerimaPenyedia: String(row.penerima_penyedia || '-'),
        jumlah: Number(row.jumlah || 0),
      }))
    : [{
        urutan: 1,
        uraian: String(entry.description || '-'),
        penerimaPenyedia: String(entry.counterparty || '-'),
        jumlah: Number(entry.amount || 0),
      }]

  const nomorBukti = String(entry.proof_number || '').trim() || (spbRow?.nomor_spb ? String(spbRow.nomor_spb) : '-')
  const tahunAnggaran = String(spbRow?.tahun_anggaran || '').trim()
    || (String(entry.transaction_date || '').slice(0, 4) || '-')

  const data: CashflowReceiptData = {
    sourceKind: 'cashflow',
    referenceId: String(entry.id),
    tahunAnggaran,
    nomorBukti,
    sumberDanaText,
    akunPosText,
    metodeBayar: normalizeMethodLabel(entry.method),
    nomorSpb: spbRow?.nomor_spb ? String(spbRow.nomor_spb) : null,
    kategoriKas: categoryName,
    kepada: String(entry.counterparty || '').trim(),
    jumlah: Number(entry.amount || 0),
    uraian: String(entry.description || '-'),
    tanggalIso: entry.transaction_date ? String(entry.transaction_date) : null,
    isRealized: true,
    ketuaKomiteName:
      signers.settingsChairman
      || String(spbRow?.chairman_name_snapshot || '').trim()
      || signers.activeChairmanName,
    bendaharaKomiteName:
      signers.settingsTreasurer
      || spbPetugasName
      || String(entry.recorder_name || '').trim(),
    allocations,
    items,
  }

  return {
    ok: true,
    data,
    safeFilenamePart: sanitizeFilenamePart(nomorBukti !== '-' ? nomorBukti : String(entry.id)),
  }
}

export async function getPengajuanReceiptData(db: D1Database, pengajuanRow: any): Promise<ReceiptLookupResult> {
  if (!pengajuanRow) return { ok: false, status: 404, message: 'Pengajuan tidak ditemukan.' }
  if (pengajuanRow.status !== 'disetujui') {
    return { ok: false, status: 409, message: 'Kuitansi hanya tersedia untuk pengajuan yang telah disetujui.' }
  }
  if (pengajuanRow.komite_cancelled_at) {
    return { ok: false, status: 409, message: 'SPB yang dibatalkan tidak dapat dicetak kuitansinya.' }
  }

  const [linkedCash, detailRows, allocRows, reviewRows, signers] = await Promise.all([
    db.prepare(`
      SELECT e.id, e.transaction_date, e.method, e.proof_number, e.counterparty, e.description, e.amount,
             COALESCE(NULLIF(TRIM(u.nama_lengkap), ''), TRIM(u.name), '') AS recorder_name
      FROM fin_cashflow_entries e
      LEFT JOIN "user" u ON u.id = e.created_by
      WHERE e.komite_pengajuan_id = ? AND e.is_void = 0
      LIMIT 1
    `).bind(pengajuanRow.id).first<any>(),
    db.prepare(`
      SELECT urutan, uraian, penerima_penyedia, jumlah
      FROM komite_pengajuan_rincian WHERE pengajuan_id = ? ORDER BY urutan
    `).bind(pengajuanRow.id).all<any>(),
    db.prepare(`
      SELECT a.source, a.amount, g.account, g.label
      FROM fin_komite_allocations a
      LEFT JOIN fin_rapbm_groups g ON g.id = a.group_id
      WHERE a.pengajuan_id = ? AND a.state IN ('locked', 'realized')
      ORDER BY a.created_at, a.id
    `).bind(pengajuanRow.id).all<CashflowReceiptAllocation>(),
    db.prepare(`
      SELECT stage, actor_name, workflow_version
      FROM komite_pengajuan_reviews
      WHERE pengajuan_id = ? AND version_number = ? AND action = 'setujui'
      ORDER BY workflow_version, created_at
    `).bind(pengajuanRow.id, pengajuanRow.current_version).all<any>(),
    resolveDefaultSigners(db),
  ])

  const bendaharaReview = (reviewRows.results || []).find((r: any) => r.stage === 'bendahara')
  const petugasName = pengajuanRow.realisasi_petugas
    ? await resolveUserNameIfId(db, pengajuanRow.realisasi_petugas)
    : ''

  const items: CashflowReceiptItem[] = (detailRows.results || []).length
    ? (detailRows.results || []).map((row: any, idx: number) => ({
        urutan: Number(row.urutan || idx + 1),
        uraian: String(row.uraian || '-'),
        penerimaPenyedia: String(row.penerima_penyedia || '-'),
        jumlah: Number(row.jumlah || 0),
      }))
    : [{
        urutan: 1,
        uraian: String(pengajuanRow.uraian || pengajuanRow.judul || '-'),
        penerimaPenyedia: String(pengajuanRow.penerima_pembayaran || '-'),
        jumlah: Number(pengajuanRow.nominal || 0),
      }]

  const total = items.reduce((sum, item) => sum + Number(item.jumlah || 0), 0) || Number(pengajuanRow.nominal || 0)
  const allocations = allocRows.results || []
  const { sumberDanaText, akunPosText } = buildFundingSummaries(allocations, 'Pencairan SPB Komite')

  const isRealized = pengajuanRow.realisasi_status === 'sudah' || Boolean(linkedCash)
  const nomorSpb = String(pengajuanRow.nomor_spb || '').trim() || null
  const nomorBukti = String(linkedCash?.proof_number || '').trim() || nomorSpb || '-'
  const tanggalIso = linkedCash?.transaction_date
    || (isRealized ? pengajuanRow.realisasi_tanggal : null)
    || null
  const metode = linkedCash?.method
    ? normalizeMethodLabel(linkedCash.method)
    : isRealized && pengajuanRow.realisasi_metode
      ? normalizeMethodLabel(pengajuanRow.realisasi_metode)
      : 'Tunai / Transfer'
  const uraian = linkedCash?.description
    ? String(linkedCash.description)
    : [nomorSpb ? `Pencairan SPB No. ${nomorSpb}` : null, pengajuanRow.judul, pengajuanRow.uraian]
        .filter(Boolean)
        .join(' — ')

  const data: CashflowReceiptData = {
    sourceKind: 'pengajuan',
    referenceId: String(pengajuanRow.id),
    tahunAnggaran: String(pengajuanRow.tahun_anggaran || '').trim()
      || (String(tanggalIso || pengajuanRow.approved_at || '').slice(0, 4) || '-'),
    nomorBukti,
    sumberDanaText,
    akunPosText,
    metodeBayar: metode,
    nomorSpb,
    kategoriKas: 'Pencairan SPB Komite',
    kepada: String(linkedCash?.counterparty || pengajuanRow.penerima_pembayaran || '').trim(),
    jumlah: Number(linkedCash?.amount || total),
    uraian,
    tanggalIso,
    isRealized,
    ketuaKomiteName:
      String(pengajuanRow.chairman_name_snapshot || '').trim()
      || signers.settingsChairman
      || signers.activeChairmanName,
    bendaharaKomiteName:
      signers.settingsTreasurer
      || petugasName
      || String(linkedCash?.recorder_name || '').trim()
      || String(bendaharaReview?.actor_name || '').trim(),
    allocations,
    items,
  }

  return {
    ok: true,
    data,
    safeFilenamePart: sanitizeFilenamePart(nomorSpb || nomorBukti !== '-' ? (nomorSpb || nomorBukti) : String(pengajuanRow.id)),
  }
}

export function buildCashflowReceiptHtml(
  data: CashflowReceiptData,
  letterheadDataUri: string,
  options: CashflowReceiptOptions,
) {
  const formattedDate = formatTanggalIndonesia(data.tanggalIso)
  const dateDisplay = formattedDate || '................................'
  const terbilangText = formatTerbilangTitleCase(data.jumlah)
  const blankLine = '( ............................................ )'
  const receiverSignName = data.kepada || blankLine
  const chairmanSignName = data.ketuaKomiteName || blankLine
  const treasurerSignName = data.bendaharaKomiteName || blankLine
  const totalPages = options.includeAttachment ? 2 : 1

  const goodsBlock = options.includeGoodsReceipt
    ? `<div class="goods-section">
        <div>Barang/pekerjaan tersebut telah diterima/diselesaikan dengan lengkap dan baik</div>
        <div class="goods-sign">
          <div class="sign-title">Yang Menerima Barang / Penanggung Jawab</div>
          <div class="goods-space"></div>
          <strong>${blankLine}</strong>
        </div>
      </div>`
    : ''

  const allocationHeading = [data.sumberDanaText, data.akunPosText].filter(Boolean).join(' · ')
  const attachmentRows = data.items.map((item, idx) => `<tr>
    <td class="center">${idx + 1}</td>
    <td>${esc(item.uraian)}</td>
    <td>${esc(item.penerimaPenyedia || '-')}</td>
    <td class="right">${esc(rupiah(item.jumlah))}</td>
  </tr>`).join('')

  const page2Html = options.includeAttachment
    ? `<section class="page">
        <img class="kop" src="${letterheadDataUri}" alt="Kop Komite"><div class="rule"></div>
        <h1>Lampiran Kuitansi</h1>
        <div class="nomor">
          Nomor Bukti: <strong>${esc(data.nomorBukti)}</strong> · Tanggal: ${esc(dateDisplay)}${data.nomorSpb ? ` · Ref. SPB: ${esc(data.nomorSpb)}` : ''}
        </div>
        <table class="items">
          <thead>
            <tr>
              <th>NO</th>
              <th>URAIAN RINCIAN PEMBAYARAN</th>
              <th>PENERIMA / PENYEDIA</th>
              <th>NILAI (RP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="4" class="group-row">${esc(allocationHeading)}</td>
            </tr>
            ${attachmentRows}
            <tr>
              <td colspan="3" class="total-label">JUMLAH</td>
              <td class="total-value">${esc(rupiah(data.jumlah))}</td>
            </tr>
          </tbody>
        </table>
        <div class="terbilang-box"><strong>Terbilang:</strong> ${esc(terbilangText)}</div>
        <div class="receiver-row attachment-sign">
          <div class="receiver-box">
            <div>Tasikmalaya, ${esc(dateDisplay)}</div>
            <div class="sign-sub">Mengetahui / Menyetujui,</div>
            <div class="sign-title">Ketua Komite</div>
            <div class="signature"></div>
            <strong>${esc(chairmanSignName)}</strong>
          </div>
        </div>
        <div class="footer">
          <span>Lampiran Kuitansi ${esc(data.nomorBukti)} — ID: ${esc(data.referenceId)}</span>
          <span>Halaman 2 dari ${totalPages}</span>
        </div>
      </section>`
    : ''

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:10mm 14mm 12mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111;font-size:10pt;line-height:1.38;margin:0}
    .page{position:relative}
    .page + .page{break-before:page;page-break-before:always}
    .page:last-child{break-after:auto;page-break-after:auto}
    .kop{width:100%;max-height:30mm;object-fit:contain;margin-bottom:2mm;display:block}
    .rule{border-top:2px solid #111;border-bottom:1px solid #111;height:4px;margin-bottom:4.5mm}
    .top-meta-wrap{display:flex;justify-content:flex-end;margin-bottom:4mm}
    .top-meta{border-collapse:collapse;font-size:9pt;min-width:82mm;max-width:105mm}
    .top-meta td{padding:.5mm 0;vertical-align:top}
    .top-meta td:first-child{width:29mm;font-weight:700;white-space:nowrap}
    .top-meta td:nth-child(2){width:4mm;text-align:center}
    h1{text-align:center;font-size:13.5pt;text-decoration:underline;margin:0 0 4.5mm;text-transform:uppercase;letter-spacing:.3px}
    .nomor{text-align:center;font-size:9pt;margin:-2.5mm 0 4.5mm}
    .body-table{width:100%;border-collapse:collapse;margin:0 0 3.5mm}
    .body-table td{padding:1.4mm 0;vertical-align:top}
    .body-table td:first-child{width:38mm;font-weight:700}
    .body-table td:nth-child(2){width:4mm;text-align:center}
    .amount-box{display:inline-block;border:1.5px solid #111;background:#f5f5f5;padding:1.2mm 4mm;font-weight:700;font-size:11pt}
    .terbilang-inline{display:block;border:1px solid #111;background:#fafafa;padding:1.6mm 2.5mm;font-style:italic;font-weight:600}
    .receiver-row{display:flex;justify-content:flex-end;margin:5mm 0 4mm;break-inside:avoid}
    .attachment-sign{margin-top:12mm}
    .receiver-box{width:68mm;text-align:center;font-size:9.5pt}
    .sign-sub{margin-top:.5mm}
    .sign-title{font-weight:700}
    .signature{height:19mm}
    .receiver-box strong,.sign strong,.goods-sign strong{display:block;border-top:1px solid #111;padding-top:1mm}
    .divider{border:0;border-top:1px solid #111;margin:2mm 0 4.5mm}
    .approval{display:grid;grid-template-columns:repeat(2,1fr);gap:14mm;margin:0 0 4mm;break-inside:avoid}
    .sign{text-align:center;font-size:9.5pt}
    .sign-label{min-height:4.5mm}
    .sign strong{max-width:68mm;margin:0 auto}
    .goods-section{border-top:1px solid #111;padding-top:3mm;margin-top:3mm;font-size:9pt;break-inside:avoid}
    .goods-sign{width:70mm;text-align:center;margin-top:1.5mm}
    .goods-space{height:15mm}
    table.items{width:100%;border-collapse:collapse;margin:2mm 0 0}
    .items th,.items td{border:1px solid #111;padding:1.6mm;vertical-align:top}
    .items th{text-align:center;font-size:8.8pt;background:#f2f2f2}
    .items .group-row{font-weight:700;background:#fafafa;font-size:9.2pt}
    .items .center{text-align:center;width:10mm}
    .items .right{text-align:right;white-space:nowrap}
    .items .total-label{text-align:center;font-weight:700}
    .items .total-value{font-weight:700;text-align:right;white-space:nowrap}
    .terbilang-box{border:1px solid #111;border-top:0;padding:1.7mm;font-style:italic;font-size:9.5pt}
    .footer{margin-top:8mm;break-inside:avoid;border-top:1px solid #aaa;padding-top:2mm;color:#666;font-size:7.5pt;display:flex;justify-content:space-between;gap:4mm}
  </style></head><body>
    <section class="page">
      <img class="kop" src="${letterheadDataUri}" alt="Kop Komite"><div class="rule"></div>
      <div class="top-meta-wrap">
        <table class="top-meta">
          <tr><td>Tahun Anggaran</td><td>:</td><td>${esc(data.tahunAnggaran)}</td></tr>
          <tr><td>Nomor Bukti</td><td>:</td><td><strong>${esc(data.nomorBukti)}</strong></td></tr>
          <tr><td>Sumber Dana</td><td>:</td><td>${esc(data.sumberDanaText)}</td></tr>
          <tr><td>Akun / Pos</td><td>:</td><td>${esc(data.akunPosText)}</td></tr>
          <tr><td>Metode Bayar</td><td>:</td><td>${esc(data.metodeBayar)}</td></tr>
          ${data.nomorSpb ? `<tr><td>Referensi SPB</td><td>:</td><td>${esc(data.nomorSpb)}</td></tr>` : ''}
        </table>
      </div>
      <h1>Kuitansi / Bukti Pembayaran</h1>
      <table class="body-table">
        <tr><td>Sudah Terima Dari</td><td>:</td><td><strong>Bendahara Komite MAN 1 Tasikmalaya</strong></td></tr>
        <tr><td>Kepada / Penerima</td><td>:</td><td>${esc(data.kepada || '-')}</td></tr>
        <tr><td>Jumlah Uang</td><td>:</td><td><span class="amount-box">${esc(rupiah(data.jumlah))}</span></td></tr>
        <tr><td>Terbilang</td><td>:</td><td><span class="terbilang-inline">${esc(terbilangText)}</span></td></tr>
        <tr><td>Untuk Pembayaran</td><td>:</td><td>${esc(data.uraian).replace(/\n/g, '<br>')}</td></tr>
        <tr><td>Kategori Kas</td><td>:</td><td>${esc(data.kategoriKas)}</td></tr>
      </table>
      <div class="receiver-row">
        <div class="receiver-box">
          <div>Tasikmalaya, ${esc(dateDisplay)}</div>
          <div class="sign-title sign-sub">Penerima Uang,</div>
          <div class="signature"></div>
          <strong>${esc(receiverSignName)}</strong>
        </div>
      </div>
      <hr class="divider">
      <div class="approval">
        <div class="sign">
          <div class="sign-label">Mengetahui / Menyetujui,</div>
          <div class="sign-title">Ketua Komite</div>
          <div class="signature"></div>
          <strong>${esc(chairmanSignName)}</strong>
        </div>
        <div class="sign">
          <div class="sign-label">Lunas dibayar, ${esc(dateDisplay)}</div>
          <div class="sign-title">Bendahara Komite</div>
          <div class="signature"></div>
          <strong>${esc(treasurerSignName)}</strong>
        </div>
      </div>
      ${goodsBlock}
      <div class="footer">
        <span>Dokumen elektronik MANSATAS App — ID: ${esc(data.referenceId)}</span>
        <span>${options.includeAttachment ? `Halaman 1 dari ${totalPages}` : 'Modul Arus Kas Komite'}</span>
      </div>
    </section>
    ${page2Html}
  </body></html>`
}
