import { createZip } from '@/lib/zip'
import {
  CKH_DEFAULT_SATUAN,
  CKH_DEFAULT_VOL,
  buildCkhDateRowSpans,
  formatCkhDate,
  formatCkhMonth,
  shouldUseKepalaTu,
} from '@/lib/ckh'
import { formatCkhDocumentVerification } from '@/lib/ckh-document-verification'

export type CkhDocxRow = {
  id: string
  tanggal: string
  kegiatan_bulanan: string
  catatan_harian: string
  vol?: number | null
  satuan?: string | null
}

type Signer = { nama_lengkap?: string | null; nip?: string | null } | null

export type CkhDocxSignatureSettings = {
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
}

export type CkhDocxSignatureImage = {
  data: Uint8Array
  contentType: string
  widthPx: number
  heightPx: number
}

export type CkhDocxData = {
  documentId: string
  rows: CkhDocxRow[]
  user: any
  kepsek: Signer
  kepalaTu: Signer
  userRoles: string[]
  signatureSettings: CkhDocxSignatureSettings
  signatureImage?: CkhDocxSignatureImage | null
  kepalaSignatureSettings?: CkhDocxSignatureSettings
  kepalaSignatureImage?: CkhDocxSignatureImage | null
  year: number
  month: number
  paper?: 'a4' | 'f4'
  margins?: { top: number; right: number; bottom: number; left: number }
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TWIPS_PER_MM = 1440 / 25.4
const EMU_PER_MM = 36000
const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const REL_CORE_PROPERTIES = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
const REL_SETTINGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings'
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
const REL_FOOTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'

const PAPERS = {
  a4: { widthMm: 210, heightMm: 297 },
  f4: { widthMm: 215, heightMm: 330 },
} as const

const DEFAULT_MARGINS = { top: 15, right: 12, bottom: 15, left: 12 }

type ParagraphOptions = {
  align?: 'left' | 'center' | 'right'
  before?: number
  after?: number
  line?: number
  lineRule?: 'auto' | 'exact' | 'atLeast'
  keepNext?: boolean
}

type RunOptions = {
  size?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  allCaps?: boolean
}

type CellOptions = {
  align?: 'left' | 'center' | 'right'
  vMerge?: 'restart' | 'continue'
  vertical?: 'top' | 'center' | 'bottom'
  margins?: { top: number; right: number; bottom: number; left: number }
}

type ImageMeta = {
  extension: 'png' | 'jpeg' | 'gif'
  contentType: string
}

function mmToTwips(value: number) {
  return Math.round(value * TWIPS_PER_MM)
}

function mmToEmu(value: number) {
  return Math.round(value * EMU_PER_MM)
}

function cleanNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function textValue(value: unknown) {
  return String(value ?? '')
}

function runXml(value: unknown, options: RunOptions = {}) {
  const size = options.size || 10
  const rPr = [
    `<w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma" w:eastAsia="Tahoma"/>`,
    `<w:sz w:val="${Math.round(size * 2)}"/>`,
    `<w:szCs w:val="${Math.round(size * 2)}"/>`,
    options.bold ? '<w:b/><w:bCs/>' : '',
    options.italic ? '<w:i/><w:iCs/>' : '',
    options.underline ? '<w:u w:val="single"/>' : '',
    options.allCaps ? '<w:caps/>' : '',
    options.color ? `<w:color w:val="${xmlEscape(options.color.replace(/^#/, ''))}"/>` : '',
  ].join('')
  const text = xmlEscape(value)
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`
}

function textRuns(value: unknown, options: RunOptions = {}) {
  return textValue(value)
    .split(/\r?\n/)
    .map((line, index) => `${index > 0 ? '<w:br/>' : ''}${runXml(line, options)}`)
    .join('')
}

function paragraph(content = '', options: ParagraphOptions = {}) {
  const pPr = [
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    `<w:spacing w:before="${options.before || 0}" w:after="${options.after || 0}"${options.line ? ` w:line="${options.line}" w:lineRule="${options.lineRule || 'auto'}"` : ''}/>`,
    options.keepNext ? '<w:keepNext/>' : '',
  ].join('')
  return `<w:p><w:pPr>${pPr}</w:pPr>${content}</w:p>`
}

function emptyParagraph(options: ParagraphOptions = {}) {
  return paragraph('', options)
}

function cellMarginsXml(margins: { top: number; right: number; bottom: number; left: number }) {
  return `<w:tcMar><w:top w:w="${margins.top}" w:type="dxa"/><w:left w:w="${margins.left}" w:type="dxa"/><w:bottom w:w="${margins.bottom}" w:type="dxa"/><w:right w:w="${margins.right}" w:type="dxa"/></w:tcMar>`
}

function cellXml(content: string, width: number, options: CellOptions = {}) {
  const margins = options.margins || { top: 70, right: 60, bottom: 70, left: 60 }
  const tcPr = [
    `<w:tcW w:w="${width}" w:type="dxa"/>`,
    `<w:vAlign w:val="${options.vertical || 'center'}"/>`,
    cellMarginsXml(margins),
    options.vMerge === 'restart' ? '<w:vMerge w:val="restart"/>' : '',
    options.vMerge === 'continue' ? '<w:vMerge/>' : '',
  ].join('')
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content || emptyParagraph()}</w:tc>`
}

function tableBordersXml(enabled: boolean) {
  const value = enabled ? 'single' : 'nil'
  const size = enabled ? '6' : '0'
  return `<w:tblBorders><w:top w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:left w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:bottom w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:right w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:insideH w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:insideV w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/></w:tblBorders>`
}

function tableXml(widths: number[], rows: string[], options: { bordered?: boolean; cellMargins?: { top: number; right: number; bottom: number; left: number } } = {}) {
  const width = widths.reduce((sum, item) => sum + item, 0)
  const cellMargins = options.cellMargins || { top: 70, right: 60, bottom: 70, left: 60 }
  const tblPr = [
    `<w:tblW w:w="${width}" w:type="dxa"/>`,
    '<w:tblInd w:w="0" w:type="dxa"/>',
    '<w:tblLayout w:type="fixed"/>',
    tableBordersXml(options.bordered !== false),
    `<w:tblCellMar>${cellMarginsXml(cellMargins).replace(/^<w:tcMar>|<\/w:tcMar>$/g, '')}</w:tblCellMar>`,
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>',
  ].join('')
  const grid = `<w:tblGrid>${widths.map(item => `<w:gridCol w:w="${item}"/>`).join('')}</w:tblGrid>`
  return `<w:tbl><w:tblPr>${tblPr}</w:tblPr>${grid}${rows.join('')}</w:tbl>`
}

function rowXml(cells: string[], options: { header?: boolean } = {}) {
  return `<w:tr><w:trPr><w:cantSplit/>${options.header ? '<w:tblHeader/>' : ''}</w:trPr>${cells.join('')}</w:tr>`
}

function profileValueRuns(value: unknown) {
  return value ? textRuns(value) : runXml('Silakan isi dulu di Profil', { italic: true })
}

function imageMeta(contentType: string): ImageMeta | null {
  const normalized = String(contentType || '').toLowerCase().split(';')[0].trim()
  if (normalized === 'image/png') return { extension: 'png', contentType: normalized }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return { extension: 'jpeg', contentType: 'image/jpeg' }
  if (normalized === 'image/gif') return { extension: 'gif', contentType: normalized }
  return null
}

function imageDrawingXml(image: CkhDocxSignatureImage, relId: string, drawingId: number, settings: CkhDocxSignatureSettings, horizontalBaseMm = 0) {
  const requestedWidthMm = Math.max(1, cleanNumber(Number(settings.signature_width_mm), 38))
  const aspect = image.widthPx > 0 && image.heightPx > 0 ? image.heightPx / image.widthPx : 0.28
  const naturalHeightMm = Math.max(1, requestedWidthMm * aspect)
  const scale = naturalHeightMm > 120 ? 120 / naturalHeightMm : 1
  const widthMm = requestedWidthMm * scale
  const heightMm = naturalHeightMm * scale
  const cx = mmToEmu(widthMm)
  const cy = mmToEmu(heightMm)
  const id = String(drawingId)
  const graphic = `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Tanda tangan CKH"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`
  const drawingPr = `<wp:docPr id="${id}" name="Tanda tangan CKH" descr="Tanda tangan pengguna"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
  const horizontalOffsetMm = horizontalBaseMm + cleanNumber(Number(settings.signature_x_mm), 14)
  const anchor = `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${mmToEmu(horizontalOffsetMm)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${mmToEmu(cleanNumber(Number(settings.signature_y_mm), 12))}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>${drawingPr}${graphic}</wp:anchor>`
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>${anchor}</w:drawing></w:r>`
}

function pageGeometry(paperKey: 'a4' | 'f4', inputMargins?: CkhDocxData['margins']) {
  const paper = PAPERS[paperKey] || PAPERS.a4
  const margins = {
    top: Math.max(0, cleanNumber(Number(inputMargins?.top), DEFAULT_MARGINS.top)),
    right: Math.max(0, cleanNumber(Number(inputMargins?.right), DEFAULT_MARGINS.right)),
    bottom: Math.max(0, cleanNumber(Number(inputMargins?.bottom), DEFAULT_MARGINS.bottom)),
    left: Math.max(0, cleanNumber(Number(inputMargins?.left), DEFAULT_MARGINS.left)),
  }
  const availableMm = Math.max(80, paper.widthMm - margins.left - margins.right)
  return {
    paper,
    margins,
    pageWidth: mmToTwips(paper.widthMm),
    pageHeight: mmToTwips(paper.heightMm),
    marginTwips: {
      top: mmToTwips(margins.top),
      right: mmToTwips(margins.right),
      bottom: mmToTwips(margins.bottom),
      left: mmToTwips(margins.left),
    },
    available: mmToTwips(availableMm),
  }
}

function buildProfileTable(user: any, available: number) {
  const tableWidth = Math.min(available, mmToTwips(140))
  const labelWidth = Math.round(112 * 1440 / 96)
  const colonWidth = Math.round(10 * 1440 / 96)
  const valueWidth = Math.max(1200, tableWidth - labelWidth - colonWidth)
  const cellOptions = { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'center' as const }
  const row = (label: string, value: unknown) => rowXml([
    cellXml(paragraph(textRuns(label, { size: 10 })), labelWidth, cellOptions),
    cellXml(paragraph(textRuns(':', { size: 10 })), colonWidth, cellOptions),
    cellXml(paragraph(profileValueRuns(value)), valueWidth, cellOptions),
  ])
  return tableXml([labelWidth, colonWidth, valueWidth], [
    row('NAMA', user?.nama_lengkap),
    row('NIP', user?.nip),
    row('PANGKAT / GOL.', user?.pangkat_golongan),
    row('JABATAN', user?.jabatan_cetak),
  ], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function buildDataTable(rows: CkhDocxRow[], available: number) {
  const widths = [7, 22, 48, 0, 12, 20].map(mmToTwips)
  const fixedWidth = widths.reduce((sum, item, index) => index === 3 ? sum : sum + item, 0)
  widths[3] = Math.max(mmToTwips(35), available - fixedWidth)
  widths[3] += available - widths.reduce((sum, item) => sum + item, 0)
  const headerLabels = ['NO', 'TANGGAL', 'KEGIATAN BULANAN', 'CATATAN KINERJA HARIAN', 'VOL', 'SATUAN']
  const header = rowXml(headerLabels.map((label, index) => cellXml(
    paragraph(textRuns(label, { size: 10, bold: true }), { align: 'center' }),
    widths[index],
    { align: 'center' },
  )), { header: true })
  const spans = buildCkhDateRowSpans(rows)
  const body = rows.map(row => {
    const span = spans.get(row)
    const dateNumberCell = span?.isFirstOfDate
      ? cellXml(paragraph(textRuns(span.dateIndex, { size: 10 }), { align: 'center' }), widths[0], { align: 'center', vMerge: 'restart' })
      : cellXml('', widths[0], { align: 'center', vMerge: 'continue' })
    const dateCell = span?.isFirstOfDate
      ? cellXml(paragraph(textRuns(formatCkhDate(row.tanggal), { size: 10 }), { align: 'center' }), widths[1], { align: 'center', vMerge: 'restart' })
      : cellXml('', widths[1], { align: 'center', vMerge: 'continue' })
    return rowXml([
      dateNumberCell,
      dateCell,
      cellXml(paragraph(textRuns(row.kegiatan_bulanan, { size: 10 }), { align: 'left' }), widths[2], { align: 'left' }),
      cellXml(paragraph(textRuns(row.catatan_harian, { size: 10 }), { align: 'left' }), widths[3], { align: 'left' }),
      cellXml(paragraph(textRuns(row.vol || CKH_DEFAULT_VOL, { size: 10 }), { align: 'center' }), widths[4], { align: 'center' }),
      cellXml(paragraph(textRuns(row.satuan || CKH_DEFAULT_SATUAN, { size: 10 }), { align: 'center' }), widths[5], { align: 'center' }),
    ])
  })
  return tableXml(widths, [header, ...body], { bordered: true, cellMargins: { top: 70, right: 60, bottom: 70, left: 60 } })
}

function buildSignatureTable(data: CkhDocxData, geometry: ReturnType<typeof pageGeometry>, imageRelId?: string, imageRelIdKepala?: string) {
  const { rows, user, kepsek, kepalaTu, userRoles, signatureSettings, signatureImage, kepalaSignatureSettings, kepalaSignatureImage, year, month } = data
  const useTu = shouldUseKepalaTu(user, userRoles)
  const signer = useTu ? kepalaTu : kepsek
  const signerLabel = useTu ? 'KEPALA TU' : 'KEPALA MAN 1 TASIKMALAYA'
  const missingSignerLabel = useTu ? 'KEPALA TU BELUM DIATUR' : 'KEPALA MADRASAH BELUM DIATUR'
  const lastRow = rows[rows.length - 1]
  const tanggalCetak = lastRow?.tanggal
    ? new Date(lastRow.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const columnWidths = [Math.round(geometry.available * 0.46), Math.round(geometry.available * 0.08), 0]
  columnWidths[2] = geometry.available - columnWidths[0] - columnWidths[1]
  const cellMargins = { top: 0, right: 0, bottom: 0, left: mmToTwips(14) }
  const rightColumnStartMm = (columnWidths[0] + columnWidths[1]) / TWIPS_PER_MM
  const imageXml = imageRelId && signatureImage && Number(signatureSettings.signature_enabled) === 1
    ? imageDrawingXml(signatureImage, imageRelId, 1, signatureSettings, rightColumnStartMm)
    : ''
  const kepalaImageXml = imageRelIdKepala && kepalaSignatureImage && kepalaSignatureSettings && Number(kepalaSignatureSettings.signature_enabled) === 1
    ? imageDrawingXml(kepalaSignatureImage, imageRelIdKepala, 2, kepalaSignatureSettings, 0)
    : ''
  const leftContent = [
    paragraph(kepalaImageXml + textRuns('Mengetahui :', { size: 10 })),
    paragraph(textRuns(signerLabel, { size: 10, bold: true, allCaps: true }), { after: mmToTwips(20) }),
    paragraph(signer?.nama_lengkap ? textRuns(signer.nama_lengkap, { size: 10, bold: true, underline: true }) : runXml(missingSignerLabel, { size: 10, bold: true, underline: true })),
    paragraph(textRuns('NIP. ', { size: 10 }) + (signer?.nip ? textRuns(signer.nip, { size: 10 }) : runXml('Silakan isi dulu di Profil', { size: 10, italic: true }))),
  ].join('')
  const rightContent = [
    paragraph(imageXml + textRuns(`Tasikmalaya, ${tanggalCetak}`, { size: 10 })),
    paragraph(textRuns(user?.jabatan_cetak || user?.role || 'Pegawai', { size: 10, bold: true, allCaps: true }), { after: mmToTwips(20) }),
    paragraph(textRuns(user?.nama_lengkap, { size: 10, bold: true, underline: true })),
    paragraph(textRuns('NIP. ', { size: 10 }) + (user?.nip ? textRuns(user.nip, { size: 10 }) : runXml('Silakan isi dulu di Profil', { size: 10, italic: true }))),
  ].join('')
  return tableXml(columnWidths, [rowXml([
    cellXml(leftContent, columnWidths[0], { margins: cellMargins, vertical: 'top' }),
    cellXml('', columnWidths[1], { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
    cellXml(rightContent, columnWidths[2], { margins: cellMargins, vertical: 'top' }),
  ])], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${XML_NS}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma" w:eastAsia="Tahoma"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`
}

function settingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${XML_NS}"><w:zoom w:percent="100"/><w:compat/></w:settings>`
}

function footerXml(documentId: string) {
  const text = formatCkhDocumentVerification(documentId)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${XML_NS}">
  ${paragraph(textRuns(text, { size: 7, color: '666666' }), { align: 'right' })}
</w:ftr>`
}

function corePropertiesXml(year: number, month: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>CKH ${xmlEscape(formatCkhMonth(year, month))}</dc:title>
  <dc:creator>MANSATAS App</dc:creator>
  <cp:lastModifiedBy>MANSATAS App</cp:lastModifiedBy>
</cp:coreProperties>`
}

function documentXml(data: CkhDocxData, geometry: ReturnType<typeof pageGeometry>, imageRelId?: string, imageRelIdKepala?: string) {
  const paperKey = data.paper === 'f4' ? 'f4' : 'a4'
  const monthLabel = formatCkhMonth(data.year, data.month)
  const title = [
    paragraph(textRuns('CATATAN KINERJA HARIAN', { size: 13, bold: true }), { align: 'center', line: 280 }),
    paragraph(textRuns('ASN MAN 1 TASIKMALAYA', { size: 13, bold: true }), { align: 'center', line: 280 }),
    paragraph(textRuns(`BULAN : ${monthLabel}`, { size: 10, bold: true }), { align: 'center', after: 150, line: 240 }),
  ].join('')
  const profile = buildProfileTable(data.user, geometry.available)
  const profileGap = emptyParagraph({ after: 120, line: 1, lineRule: 'exact' })
  const table = buildDataTable(data.rows, geometry.available)
  const signatureGap = emptyParagraph({ before: mmToTwips(18), line: 1, lineRule: 'exact' })
  const signature = buildSignatureTable(data, geometry, imageRelId, imageRelIdKepala)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${title}${profile}${profileGap}${table}${signatureGap}${signature}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter"/>
      <w:pgSz w:w="${geometry.pageWidth}" w:h="${geometry.pageHeight}"/>
      <w:pgMar w:top="${geometry.marginTwips.top}" w:right="${geometry.marginTwips.right}" w:bottom="${Math.max(geometry.marginTwips.bottom, mmToTwips(10))}" w:left="${geometry.marginTwips.left}" w:header="0" w:footer="${mmToTwips(5)}" w:gutter="0"/>
      <w:cols w:space="0"/>
      <w:docGrid w:linePitch="240"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function documentRelationships(relationships: Array<{ relId: string; target: string }> = []) {
  const imageRelationships = relationships
    .map(rel => `<Relationship Id="${rel.relId}" Type="${REL_IMAGE}" Target="${rel.target}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  <Relationship Id="rIdStyles" Type="${REL_STYLES}" Target="styles.xml"/>
  <Relationship Id="rIdSettings" Type="${REL_SETTINGS}" Target="settings.xml"/>
  <Relationship Id="rIdFooter" Type="${REL_FOOTER}" Target="footer1.xml"/>
  ${imageRelationships}
</Relationships>`
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  <Relationship Id="rId1" Type="${REL_OFFICE_DOCUMENT}" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="${REL_CORE_PROPERTIES}" Target="docProps/core.xml"/>
</Relationships>`
}

function contentTypesXml(images: ImageMeta[] = []) {
  const extensions = Array.from(new Set(images.map(img => img.extension)))
  const imageDefaults = extensions.map(ext => {
    const ct = images.find(img => img.extension === ext)?.contentType
    return ct ? `<Default Extension="${ext}" ContentType="${ct}"/>` : ''
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`
}

export async function buildCkhDocxBytes(data: CkhDocxData) {
  const paperKey = data.paper === 'f4' ? 'f4' : 'a4'
  const geometry = pageGeometry(paperKey, data.margins)
  const image = data.signatureImage && Number(data.signatureSettings?.signature_enabled) === 1
    ? imageMeta(data.signatureImage.contentType)
    : null
  const imageRelId = image ? 'rIdSignature' : undefined
  const imageTarget = image ? `media/signature.${image.extension}` : undefined

  const kepalaImage = data.kepalaSignatureImage && Number(data.kepalaSignatureSettings?.signature_enabled) === 1
    ? imageMeta(data.kepalaSignatureImage.contentType)
    : null
  const kepalaImageRelId = kepalaImage ? 'rIdKepalaSignature' : undefined
  const kepalaImageTarget = kepalaImage ? `media/kepala_signature.${kepalaImage.extension}` : undefined

  const imagesMeta = [image, kepalaImage].filter(Boolean) as ImageMeta[]
  const relationships: Array<{ relId: string; target: string }> = []
  if (imageRelId && imageTarget) relationships.push({ relId: imageRelId, target: imageTarget })
  if (kepalaImageRelId && kepalaImageTarget) relationships.push({ relId: kepalaImageRelId, target: kepalaImageTarget })

  const entries: Array<{ name: string; bytes: Uint8Array }> = [
    { name: '[Content_Types].xml', bytes: new TextEncoder().encode(contentTypesXml(imagesMeta)) },
    { name: '_rels/.rels', bytes: new TextEncoder().encode(rootRelationships()) },
    { name: 'word/document.xml', bytes: new TextEncoder().encode(documentXml(data, geometry, imageRelId, kepalaImageRelId)) },
    { name: 'word/_rels/document.xml.rels', bytes: new TextEncoder().encode(documentRelationships(relationships)) },
    { name: 'word/styles.xml', bytes: new TextEncoder().encode(stylesXml()) },
    { name: 'word/settings.xml', bytes: new TextEncoder().encode(settingsXml()) },
    { name: 'word/footer1.xml', bytes: new TextEncoder().encode(footerXml(data.documentId)) },
    { name: 'docProps/core.xml', bytes: new TextEncoder().encode(corePropertiesXml(data.year, data.month)) },
  ]
  if (image && data.signatureImage) {
    entries.push({ name: `word/${imageTarget}`, bytes: data.signatureImage.data })
  }
  if (kepalaImage && data.kepalaSignatureImage) {
    entries.push({ name: `word/${kepalaImageTarget}`, bytes: data.kepalaSignatureImage.data })
  }
  return createZip(entries)
}

export async function buildCkhDocx(data: CkhDocxData) {
  const bytes = await buildCkhDocxBytes(data)
  return new Blob([bytes], { type: DOCX_MIME })
}
