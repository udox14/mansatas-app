import { createZip } from '@/lib/zip'
import type {
  AgendaKelasPageData,
  AgendaKelasRow,
  AgendaKelasSignatureSettings,
} from '@/app/dashboard/agenda-kelas/actions'
import type {
  AgendaKelasExportAssets,
  AgendaKelasImageAsset,
} from '@/lib/agenda-kelas-export-assets'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const FONT = 'Book Antiqua'
const TWIPS_PER_MM = 1440 / 25.4
const EMU_PER_MM = 36000
const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
const REL_OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const REL_CORE_PROPERTIES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/metadata/core-properties'
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
const REL_SETTINGS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings'

const PAGE_WIDTH_MM = 330
const PAGE_HEIGHT_MM = 215
const PAGE_PADDING_MM = 10
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_PADDING_MM * 2

type Relationship = {
  id: string
  target: string
  asset: AgendaKelasImageAsset
}

type ParagraphOptions = {
  align?: 'left' | 'center' | 'right'
  before?: number
  after?: number
  line?: number
  lineRule?: 'auto' | 'exact' | 'atLeast'
  indentLeft?: number
  keepNext?: boolean
}

type RunOptions = {
  size?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
}

type CellOptions = {
  align?: 'left' | 'center' | 'right'
  vertical?: 'top' | 'center' | 'bottom'
  margins?: { top: number; right: number; bottom: number; left: number }
  shading?: string
  borders?: string
}

type TableOptions = {
  bordered?: boolean
  indent?: number
  cellMargins?: { top: number; right: number; bottom: number; left: number }
  borderXml?: string
}

function mmToTwips(value: number) {
  return Math.round(value * TWIPS_PER_MM)
}

function mmToEmu(value: number) {
  return Math.round(value * EMU_PER_MM)
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

function runXml(value: unknown, options: RunOptions = {}) {
  const size = options.size || 8.5
  const rPr = [
    `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>`,
    `<w:sz w:val="${Math.round(size * 2)}"/><w:szCs w:val="${Math.round(size * 2)}"/>`,
    options.bold ? '<w:b/><w:bCs/>' : '',
    options.italic ? '<w:i/><w:iCs/>' : '',
    options.underline ? '<w:u w:val="single"/>' : '',
    options.color ? `<w:color w:val="${xmlEscape(options.color.replace(/^#/, ''))}"/>` : '',
  ].join('')
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`
}

function textRuns(value: unknown, options: RunOptions = {}) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line, index) => `${index ? '<w:br/>' : ''}${runXml(line, options)}`)
    .join('')
}

function paragraph(content = '', options: ParagraphOptions = {}) {
  const pPr = [
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.indentLeft !== undefined ? `<w:ind w:left="${options.indentLeft}"/>` : '',
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

function defaultBorders(enabled: boolean) {
  const value = enabled ? 'single' : 'nil'
  const size = enabled ? 6 : 0
  return `<w:tblBorders><w:top w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:left w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:bottom w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:right w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:insideH w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/><w:insideV w:val="${value}" w:sz="${size}" w:space="0" w:color="000000"/></w:tblBorders>`
}

function cellXml(content: string, width: number, options: CellOptions = {}) {
  const margins = options.margins || { top: 55, right: 45, bottom: 55, left: 45 }
  const tcPr = [
    `<w:tcW w:w="${width}" w:type="dxa"/>`,
    `<w:vAlign w:val="${options.vertical || 'center'}"/>`,
    cellMarginsXml(margins),
    options.shading ? `<w:shd w:fill="${options.shading}"/>` : '',
    options.borders || '',
  ].join('')
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content || emptyParagraph()}</w:tc>`
}

function rowXml(cells: string[], heightMm?: number) {
  const height = heightMm ? `<w:trHeight w:val="${mmToTwips(heightMm)}" w:hRule="exact"/>` : ''
  return `<w:tr><w:trPr><w:cantSplit/>${height}</w:trPr>${cells.join('')}</w:tr>`
}

function tableXml(widths: number[], rows: string[], options: TableOptions = {}) {
  const width = widths.reduce((sum, item) => sum + item, 0)
  const margins = options.cellMargins || { top: 55, right: 45, bottom: 55, left: 45 }
  const tblPr = [
    `<w:tblW w:w="${width}" w:type="dxa"/>`,
    `<w:tblInd w:w="${options.indent || 0}" w:type="dxa"/>`,
    '<w:tblLayout w:type="fixed"/>',
    options.borderXml || defaultBorders(options.bordered !== false),
    `<w:tblCellMar>${cellMarginsXml(margins).replace(/^<w:tcMar>|<\/w:tcMar>$/g, '')}</w:tblCellMar>`,
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/>',
  ].join('')
  const grid = `<w:tblGrid>${widths.map(item => `<w:gridCol w:w="${item}"/>`).join('')}</w:tblGrid>`
  return `<w:tbl><w:tblPr>${tblPr}</w:tblPr>${grid}${rows.join('')}</w:tbl>`
}

function formatTanggal(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date + 'T00:00:00'))
}

function wrapTwoLines(value: string | null | undefined, maxPerLine: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxPerLine) return text
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxPerLine || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
    if (lines.length === 1 && current.length > maxPerLine) break
  }
  if (!lines.length) lines.push(current)
  else if (current) lines.push(current)
  const result = lines.slice(0, 2)
  const sourceLength = result.join(' ').length
  if (sourceLength < text.length) result[result.length - 1] = `${result[result.length - 1].slice(0, Math.max(1, maxPerLine - 1))}…`
  return result.join('\n')
}

function imageMeta(asset: AgendaKelasImageAsset) {
  return { extension: asset.extension, contentType: asset.contentType }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function imageDimensions(asset: AgendaKelasImageAsset, requestedWidthMm: number) {
  const widthMm = Math.max(1, Number.isFinite(Number(requestedWidthMm)) ? Number(requestedWidthMm) : 38)
  const aspect = asset.widthPx > 0 && asset.heightPx > 0 ? asset.heightPx / asset.widthPx : 0.28
  const naturalHeightMm = Math.max(1, widthMm * aspect)
  return { widthMm, heightMm: naturalHeightMm }
}

function imageInlineXml(asset: AgendaKelasImageAsset, relId: string, widthMm: number, drawingId: number) {
  const dimensions = imageDimensions(asset, widthMm)
  const cx = mmToEmu(dimensions.widthMm)
  const cy = mmToEmu(dimensions.heightMm)
  const id = String(drawingId)
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Agenda Kelas ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Agenda Kelas ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
}

function signatureParagraph(asset: AgendaKelasImageAsset | null, relId: string | undefined, widthMm: number, xMm: number, yMm: number, drawingId: number) {
  if (!asset || !relId) return ''
  return paragraph(
    imageInlineXml(asset, relId, widthMm, drawingId),
    {
      before: mmToTwips(Math.max(0, Number(yMm) || 0)),
      after: 0,
      line: 1,
      lineRule: 'exact',
      indentLeft: mmToTwips(Math.max(0, Number(xMm) || 0)),
    },
  )
}

function sectionTitle(text: string, width: number) {
  return tableXml([width], [rowXml([
    cellXml(paragraph(textRuns(text, { size: 10.5, bold: true }), { align: 'center', line: 210, lineRule: 'exact' }), width, { margins: { top: 55, right: 0, bottom: 55, left: 0 } }),
  ], 6)], { bordered: true, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function agendaTable(rows: AgendaKelasRow[], widthMm: number) {
  const fixedColumns = [9, 31, 45, 34, 20]
  const fixedTotal = fixedColumns.reduce((sum, value) => sum + value, 0)
  const scale = Math.max(0.7, widthMm / fixedTotal)
  const widths = fixedColumns.map(value => mmToTwips(value * scale))
  const headers = ['JAM\nKE', 'MATA PELAJARAN', 'POKOK\nBAHASAN', 'TUGAS', 'KEHADIRAN\nGURU']
  const header = rowXml(headers.map((label, index) => cellXml(
    paragraph(textRuns(label, { size: 8.5, bold: true }), { align: 'center', line: 180, lineRule: 'exact' }),
    widths[index],
    { align: 'center', vertical: 'center' },
  )), 9)
  const body = Array.from({ length: 10 }).map((_, index) => {
    const row = rows[index]
    const values = [
      textRuns(index + 1, { size: 8, bold: true }),
      textRuns(row?.mapel_nama ? row.mapel_nama.toUpperCase() : '', { size: 8 }),
      textRuns(wrapTwoLines(row?.pokok_bahasan, 27), { size: 7.8 }),
      textRuns(wrapTwoLines(row?.tugas, 20), { size: 7.8 }),
      textRuns(row?.guru_status || '', { size: 7.5, bold: true }),
    ]
    return rowXml(values.map((value, column) => cellXml(
      paragraph(value, { align: column === 0 || column === 4 ? 'center' : 'left', line: 175, lineRule: 'exact' }),
      widths[column],
      { align: column === 0 || column === 4 ? 'center' : 'left' },
    )), 8.1)
  })
  return tableXml(widths, [header, ...body], { bordered: true, cellMargins: { top: 35, right: 35, bottom: 35, left: 45 } })
}

function attendanceTable(rows: AgendaKelasPageData['absensiRows'], offset: number, widthMm: number) {
  const widths = [8, Math.max(20, widthMm - 36), 5, 5, 5, 13].map(mmToTwips)
  const headerLabels = ['NO', 'NAMA', 'S', 'I', 'A', 'KET']
  const header = rowXml(headerLabels.map((label, index) => cellXml(
    paragraph(textRuns(label, { size: 8.5, bold: true }), { align: 'center', line: 180, lineRule: 'exact' }),
    widths[index],
    { align: 'center' },
  )), 9)
  const body = Array.from({ length: 10 }).map((_, index) => {
    const row = rows[index + offset]
    const values = [
      textRuns(offset + index + 1, { size: 8, bold: true }),
      textRuns(`${wrapTwoLines(row?.nama, 22)}${row ? `\nNIS: ${row.nis || '-'}` : ''}`, { size: 7.8 }),
      textRuns(row?.sakit ? '✓' : '', { size: 9, bold: true }),
      textRuns(row?.izin ? '✓' : '', { size: 9, bold: true }),
      textRuns(row?.alfa ? '✓' : '', { size: 9, bold: true }),
      textRuns('', { size: 7.2 }),
    ]
    return rowXml(values.map((value, column) => cellXml(
      paragraph(value, { align: column === 0 || (column >= 2 && column <= 4) ? 'center' : 'left', line: 170, lineRule: 'exact' }),
      widths[column],
      { align: column === 0 || (column >= 2 && column <= 4) ? 'center' : 'left' },
    )), 8.1)
  })
  return tableXml(widths, [header, ...body], { bordered: true, cellMargins: { top: 35, right: 30, bottom: 35, left: 35 } })
}

function recapLine(number: number, label: string, value: number, width: number) {
  return tableXml([mmToTwips(4), mmToTwips(12), mmToTwips(3), mmToTwips(15), Math.max(400, width - mmToTwips(34))], [rowXml([
    cellXml(paragraph(textRuns(`${number}.`, { size: 8.5 })), mmToTwips(4), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
    cellXml(paragraph(textRuns(label, { size: 8.5 })), mmToTwips(12), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
    cellXml(paragraph(textRuns(':', { size: 8.5 }), { align: 'center' }), mmToTwips(3), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
    cellXml(paragraph(textRuns(value, { size: 8.5, bold: true }), { align: 'center' }), mmToTwips(15), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, borders: '<w:tcBorders><w:bottom w:val="dotted" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders>', vertical: 'top' }),
    cellXml(paragraph(textRuns('Jam', { size: 8.5 })), Math.max(400, width - mmToTwips(34)), { margins: { top: 0, right: 0, bottom: 0, left: mmToTwips(1.5) }, vertical: 'top' }),
  ], 5)], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function footerTable(
  page: AgendaKelasPageData,
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
  relIds: { logo?: string; kepala?: string; wali?: string },
  drawingId: { value: number },
) {
  const widths = [0.38, 0.38, 0.24].map(ratio => mmToTwips(CONTENT_WIDTH_MM * ratio))
  const full = widths.reduce((sum, item) => sum + item, 0)
  widths[2] += mmToTwips(CONTENT_WIDTH_MM) - full
  const cell = (content: string, index: number, options: CellOptions = {}) => cellXml(content, widths[index], {
    margins: { top: 0, right: 0, bottom: 0, left: index === 1 ? mmToTwips(6) : 0 },
    vertical: 'top',
    ...options,
  })
  const kepalaImage = signatureSettings.kepala.enabled ? assets.kepalaSignature : null
  const waliImage = signatureSettings.wali.enabled ? assets.waliSignatures.get(page.kelas.id) || null : null
  const kepalaSignature = signatureParagraph(
    kepalaImage,
    relIds.kepala,
    signatureSettings.kepala.width_mm,
    signatureSettings.kepala.x_mm,
    signatureSettings.kepala.y_mm,
    drawingId.value++,
  )
  const waliSignature = signatureParagraph(
    waliImage,
    relIds.wali,
    signatureSettings.wali.width_mm,
    signatureSettings.wali.x_mm,
    signatureSettings.wali.y_mm,
    drawingId.value++,
  )
  const name = (value: string | null | undefined, fallback: string) => value
    ? textRuns(value, { size: 8.5, bold: true, underline: true })
    : textRuns(fallback, { size: 8.5 })

  const rows = [
    rowXml([cell(paragraph(textRuns('REKAPITULASI KEGIATAN', { size: 9, bold: true })), 0), cell('', 1), cell(paragraph(textRuns(`Tasikmalaya, ${formatTanggal(page.tanggal)}`, { size: 8.5 })), 2)], 5),
    rowXml([cell(recapLine(1, 'Terisi', page.rekap.terisi, widths[0]) + emptyParagraph(), 0), cell('', 1), cell(paragraph(textRuns(`KM Kelas ${page.kelas.label},`, { size: 8.5 })), 2)], 5),
    rowXml([cell(recapLine(2, 'Tugas', page.rekap.tugas, widths[0]) + emptyParagraph(), 0), cell('', 1), cell('', 2)], 5),
    rowXml([cell(recapLine(3, 'Kosong', page.rekap.kosong, widths[0]) + emptyParagraph(), 0), cell('', 1), cell('', 2)], 5),
    rowXml([cell('', 0), cell(paragraph(textRuns('Mengetahui :', { size: 8.5 })), 1), cell(paragraph(name(page.kelas.km_nama, '...........................................................')), 2)], 5),
    rowXml([cell(paragraph(textRuns('Kepala MAN 1 Tasikmalaya,', { size: 8.5 }) + kepalaSignature), 0), cell(paragraph(textRuns('Wali Kelas,', { size: 8.5 }) + waliSignature), 1), cell(paragraph(textRuns('NIS', { size: 8.5 })), 2)], 15),
    rowXml([cell('', 0), cell('', 1), cell('', 2)], 14),
    rowXml([cell(textRuns(page.kepala.nama, { size: 8.5, bold: true }), 0), cell(name(page.kelas.wali_kelas_nama, '...........................................................'), 1), cell('', 2)], 5),
    rowXml([cell(textRuns(`NIP. ${page.kepala.nip || '...........................................................'}`, { size: 8.5 }), 0), cell(textRuns(`NIP. ${page.kelas.wali_kelas_nip || '...........................................................'}`, { size: 8.5 }), 1), cell('', 2)], 5),
  ]
  return tableXml(widths, rows, { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function headerTable(asset: AgendaKelasImageAsset, relId: string, drawingId: { value: number }) {
  const headerWidth = mmToTwips(260)
  const indent = Math.max(0, mmToTwips((CONTENT_WIDTH_MM - 260) / 2))
  const widths = [mmToTwips(25), headerWidth - mmToTwips(25)]
  const text = [
    paragraph(textRuns('KEMENTERIAN AGAMA REPUBLIK INDONESIA', { size: 11.5, bold: true }), { align: 'center', line: 220, lineRule: 'exact' }),
    paragraph(textRuns('KANTOR KEMENTERIAN AGAMA KABUPATEN TASIKMALAYA', { size: 10.5, bold: true }), { align: 'center', line: 220, lineRule: 'exact' }),
    paragraph(textRuns('MADRASAH ALIYAH NEGERI 1 TASIKMALAYA', { size: 13.5, bold: true }), { align: 'center', line: 235, lineRule: 'exact' }),
    paragraph(textRuns('Jl. Pahlawan KHZ. Musthafa Sukamanah Desa Sukarapih Kec. Sukarame Kode Pos 46461', { size: 8.2 }), { align: 'center', line: 190, lineRule: 'exact' }),
    paragraph(textRuns('website : www.man1tasikmalaya.sch.id email : manegerisukamanah@gmail.com', { size: 8.2, bold: true }), { align: 'center', line: 190, lineRule: 'exact' }),
  ].join('')
  const borderXml = '<w:tblBorders><w:top w:val="nil" w:sz="0"/><w:left w:val="nil" w:sz="0"/><w:right w:val="nil" w:sz="0"/><w:insideH w:val="nil" w:sz="0"/><w:insideV w:val="nil" w:sz="0"/><w:bottom w:val="double" w:sz="8" w:space="0" w:color="000000"/></w:tblBorders>'
  return tableXml(widths, [rowXml([
    cellXml(paragraph(imageInlineXml(asset, relId, 19, drawingId.value++), { align: 'center', line: 1, lineRule: 'exact' }), widths[0], { vertical: 'center', margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
    cellXml(text, widths[1], { vertical: 'center', margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
  ], 21)], { bordered: false, indent, borderXml, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })
}

function pageXml(
  page: AgendaKelasPageData,
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
  relIds: { logo: string; kepala?: string; wali?: string },
  drawingId: { value: number },
) {
  const leftWidth = CONTENT_WIDTH_MM * 0.52
  const rightWidth = CONTENT_WIDTH_MM * 0.48
  const gapWidth = 4
  const agendaWidth = leftWidth - gapWidth / 2
  const attendanceWidth = rightWidth - gapWidth / 2
  const mainWidths = [mmToTwips(agendaWidth), mmToTwips(gapWidth), mmToTwips(attendanceWidth)]
  const main = tableXml(mainWidths, [rowXml([
    cellXml(
      sectionTitle('AGENDA KELAS', mainWidths[0]) + agendaTable(page.agendaRows, agendaWidth) + emptyParagraph(),
      mainWidths[0],
      { vertical: 'top', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
    ),
    cellXml('', mainWidths[1], { margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
    cellXml(
      sectionTitle('ABSENSI SISWA', mainWidths[2]) + tableXml([mmToTwips((attendanceWidth - 2) / 2), mmToTwips((attendanceWidth - 2) / 2)], [rowXml([
        cellXml(attendanceTable(page.absensiRows, 0, (attendanceWidth - 2) / 2) + emptyParagraph(), mmToTwips((attendanceWidth - 2) / 2), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
        cellXml(attendanceTable(page.absensiRows, 10, (attendanceWidth - 2) / 2) + emptyParagraph(), mmToTwips((attendanceWidth - 2) / 2), { margins: { top: 0, right: 0, bottom: 0, left: 0 }, vertical: 'top' }),
      ])], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } }) + emptyParagraph(),
      mainWidths[2],
      { vertical: 'top', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
    ),
  ], 92)], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })

  const dateLine = tableXml([mmToTwips(leftWidth), mmToTwips(rightWidth)], [rowXml([
    cellXml(paragraph(textRuns('HARI : ', { size: 9.5, bold: true }) + textRuns(page.hariNama, { size: 9.5 })), mmToTwips(leftWidth), { margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
    cellXml(paragraph(textRuns('TANGGAL : ', { size: 9.5, bold: true }) + textRuns(formatTanggal(page.tanggal), { size: 9.5 })), mmToTwips(rightWidth), { margins: { top: 0, right: 0, bottom: 0, left: 0 } }),
  ], 6)], { bordered: false, cellMargins: { top: 0, right: 0, bottom: 0, left: 0 } })

  return [
    headerTable(assets.logo, relIds.logo, drawingId),
    emptyParagraph({ after: mmToTwips(3.5), line: 1, lineRule: 'exact' }),
    dateLine,
    emptyParagraph({ after: mmToTwips(3), line: 1, lineRule: 'exact' }),
    main,
    emptyParagraph({ before: mmToTwips(3.5), line: 1, lineRule: 'exact' }),
    footerTable(page, signatureSettings, assets, relIds, drawingId),
  ].join('')
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${XML_NS}">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`
}

function settingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${XML_NS}"><w:zoom w:percent="100"/><w:compat/></w:settings>`
}

function corePropertiesXml(page: AgendaKelasPageData) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Agenda Kelas ${xmlEscape(page.kelas.label)}</dc:title><dc:creator>MANSATAS App</dc:creator><cp:lastModifiedBy>MANSATAS App</cp:lastModifiedBy></cp:coreProperties>`
}

function documentRelationships(relationships: Relationship[]) {
  const imageRelationships = relationships.map(rel => `<Relationship Id="${rel.id}" Type="${REL_IMAGE}" Target="${rel.target}"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rIdStyles" Type="${REL_STYLES}" Target="styles.xml"/><Relationship Id="rIdSettings" Type="${REL_SETTINGS}" Target="settings.xml"/>${imageRelationships}</Relationships>`
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${REL_OFFICE_DOCUMENT}" Target="word/document.xml"/><Relationship Id="rId2" Type="${REL_CORE_PROPERTIES}" Target="docProps/core.xml"/></Relationships>`
}

function contentTypesXml(relationships: Relationship[]) {
  const extensions = Array.from(new Map(relationships.map(rel => [rel.asset.extension, imageMeta(rel.asset)])).values())
    .map(meta => `<Default Extension="${meta.extension}" ContentType="${meta.contentType}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${extensions}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'kelas'
}

function relationshipForAsset(
  relationships: Relationship[],
  asset: AgendaKelasImageAsset,
  target: string,
) {
  const existing = relationships.find(item => item.target === target)
  if (existing) return existing.id
  const rel = { id: `rIdImage${relationships.length + 1}`, target, asset }
  relationships.push(rel)
  return rel.id
}

export async function buildAgendaKelasDocxBytes(
  pages: AgendaKelasPageData[],
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
) {
  if (!pages.length) throw new Error('Tidak ada halaman Agenda Kelas untuk diekspor.')
  const relationships: Relationship[] = []
  const logoRelId = relationshipForAsset(relationships, assets.logo, `media/logo.${assets.logo.extension}`)
  const kepalaRelId = assets.kepalaSignature
    ? relationshipForAsset(relationships, assets.kepalaSignature, `media/signature-kepala.${assets.kepalaSignature.extension}`)
    : undefined
  const waliAssets = new Map<string, string>()
  for (const page of pages) {
    const asset = assets.waliSignatures.get(page.kelas.id)
    if (!asset || waliAssets.has(page.kelas.id)) continue
    waliAssets.set(page.kelas.id, relationshipForAsset(relationships, asset, `media/signature-wali-${safeName(page.kelas.id)}.${asset.extension}`))
  }

  const drawingId = { value: 10 }
  const pageBlocks = pages.map((page, index) => {
    const block = pageXml(page, signatureSettings, assets, {
      logo: logoRelId,
      kepala: kepalaRelId,
      wali: waliAssets.get(page.kelas.id),
    }, drawingId)
    return `${index ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : ''}${block}`
  }).join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${pageBlocks}<w:sectPr><w:pgSz w:w="${mmToTwips(PAGE_WIDTH_MM)}" w:h="${mmToTwips(PAGE_HEIGHT_MM)}"/><w:pgMar w:top="${mmToTwips(PAGE_PADDING_MM)}" w:right="${mmToTwips(PAGE_PADDING_MM)}" w:bottom="${mmToTwips(PAGE_PADDING_MM)}" w:left="${mmToTwips(PAGE_PADDING_MM)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/></w:sectPr></w:body></w:document>`

  const encoder = new TextEncoder()
  const entries: Array<{ name: string; bytes: Uint8Array }> = [
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypesXml(relationships)) },
    { name: '_rels/.rels', bytes: encoder.encode(rootRelationships()) },
    { name: 'word/document.xml', bytes: encoder.encode(documentXml) },
    { name: 'word/_rels/document.xml.rels', bytes: encoder.encode(documentRelationships(relationships)) },
    { name: 'word/styles.xml', bytes: encoder.encode(stylesXml()) },
    { name: 'word/settings.xml', bytes: encoder.encode(settingsXml()) },
    { name: 'docProps/core.xml', bytes: encoder.encode(corePropertiesXml(pages[0])) },
  ]
  for (const relationship of relationships) entries.push({ name: `word/${relationship.target}`, bytes: relationship.asset.data })
  return createZip(entries)
}

export async function buildAgendaKelasDocxBlob(
  pages: AgendaKelasPageData[],
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
) {
  const bytes = await buildAgendaKelasDocxBytes(pages, signatureSettings, assets)
  return new Blob([bytesToArrayBuffer(bytes)], { type: DOCX_MIME })
}

export function agendaKelasDocxFilename(page: AgendaKelasPageData) {
  return `Agenda_Kelas_${safeName(page.kelas.label)}.docx`
}
