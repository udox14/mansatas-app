import { createZip } from '@/lib/zip'
import type { EkskulAnggotaReport } from '@/lib/ekskul-anggota-report'

const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PAGE_WIDTH_MM = 215
const PAGE_HEIGHT_MM = 330
const MARGIN_TOP_BOTTOM_MM = 10
const MARGIN_LEFT_RIGHT_MM = 14
const CONTINUATION_TOP_SPACE_MM = 7
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_LEFT_RIGHT_MM * 2
const FONT = 'Times New Roman'

type EkskulAnggotaDocxData = EkskulAnggotaReport & {
  letterheadPng: Uint8Array
  printedAt?: Date
}

function mmToTwips(value: number) {
  return Math.round(value * 1440 / 25.4)
}

function mmToEmu(value: number) {
  return Math.round(value * 36000)
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

function runXml(value: unknown, options: { bold?: boolean; size?: number; color?: string } = {}) {
  const size = Math.round((options.size || 10) * 2)
  return `<w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${options.bold ? '<w:b/><w:bCs/>' : ''}${options.color ? `<w:color w:val="${options.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`
}

function paragraph(
  content = '',
  options: { align?: 'left' | 'center' | 'right'; before?: number; after?: number; keepNext?: boolean; style?: string } = {},
) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    `<w:spacing w:before="${options.before || 0}" w:after="${options.after || 0}" w:line="240" w:lineRule="auto"/>`,
    options.keepNext ? '<w:keepNext/>' : '',
  ].join('')
  return `<w:p><w:pPr>${properties}</w:pPr>${content}</w:p>`
}

function imageParagraph() {
  const width = mmToEmu(CONTENT_WIDTH_MM)
  const height = mmToEmu(29)
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="180"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="1" name="Kop Surat" descr="Kop surat MAN 1 Tasikmalaya"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Kop Surat" descr="Kop surat MAN 1 Tasikmalaya"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdLetterhead"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

function bordersXml() {
  const side = (name: string) => `<w:${name} w:val="single" w:sz="6" w:space="0" w:color="D9D9D9"/>`
  return `<w:tblBorders>${side('top')}${side('left')}${side('bottom')}${side('right')}${side('insideH')}${side('insideV')}</w:tblBorders>`
}

function cellXml(content: string, width: number, options: { align?: 'left' | 'center'; fill?: string } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar>${options.fill ? `<w:shd w:val="clear" w:fill="${options.fill}"/>` : ''}</w:tcPr>${paragraph(content, { align: options.align || 'left' })}</w:tc>`
}

function rowXml(cells: string[], options: { header?: boolean; minimumHeightMm?: number } = {}) {
  const rowProperties = `${options.header ? '<w:tblHeader/>' : ''}<w:cantSplit/>${options.minimumHeightMm ? `<w:trHeight w:val="${mmToTwips(options.minimumHeightMm)}" w:hRule="atLeast"/>` : ''}`
  return `<w:tr><w:trPr>${rowProperties}</w:trPr>${cells.join('')}</w:tr>`
}

function continuationTopSpacerRow(totalWidth: number) {
  const nilBorders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(side => `<w:${side} w:val="nil"/>`)
    .join('')
  const cell = `<w:tc><w:tcPr><w:tcW w:w="${totalWidth}" w:type="dxa"/><w:gridSpan w:val="4"/><w:tcBorders>${nilBorders}</w:tcBorders><w:shd w:val="clear" w:fill="FFFFFF"/></w:tcPr>${paragraph()}</w:tc>`
  return `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/><w:trHeight w:val="${mmToTwips(CONTINUATION_TOP_SPACE_MM)}" w:hRule="exact"/></w:trPr>${cell}</w:tr>`
}

function metadataTable(filterLabel: string, count: number) {
  const widths = [mmToTwips(CONTENT_WIDTH_MM * 0.68), mmToTwips(CONTENT_WIDTH_MM * 0.32)]
  const cell = (content: string, width: number, align: 'left' | 'right') => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(runXml(content, { size: 9 }), { align })}</w:tc>`
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths[0] + widths[1]}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${widths[0]}"/><w:gridCol w:w="${widths[1]}"/></w:tblGrid>${rowXml([cell(`Filter: ${filterLabel}`, widths[0], 'left'), cell(`Jumlah siswa: ${count}`, widths[1], 'right')])}</w:tbl>`
}

function rosterTable(group: EkskulAnggotaReport['groups'][number]) {
  const widths = [10, 75, 48, 54].map(mmToTwips)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  const headerLabels = ['No', 'Nama Lengkap', 'Tempat Tinggal', 'Asrama/Kamar']
  const header = rowXml(headerLabels.map((label, index) => cellXml(
    runXml(label, { bold: true, size: 10 }),
    widths[index],
    { align: 'center', fill: 'E7E6E6' },
  )), { header: true, minimumHeightMm: 8 })
  const body = group.rows.map((row, index) => rowXml([
    cellXml(runXml(index + 1, { size: 10 }), widths[0], { align: 'center' }),
    cellXml(runXml(row.nama_lengkap, { size: 10 }), widths[1]),
    cellXml(runXml(row.tempat_tinggal, { size: 10 }), widths[2]),
    cellXml('', widths[3]),
  ], { minimumHeightMm: 9 }))
  return `<w:tbl><w:tblPr><w:tblW w:w="${totalWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${bordersXml()}<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${continuationTopSpacerRow(totalWidth)}${header}${body.join('')}</w:tbl>`
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${XML_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}"/><w:b/><w:color w:val="000000"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style></w:styles>`
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
}

export function buildEkskulAnggotaDocxBytes(data: EkskulAnggotaDocxData) {
  if (!data.groups.length) throw new Error('Tidak ada data ekstrakurikuler untuk dibuatkan dokumen Word.')
  const printedAt = (data.printedAt || new Date()).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })
  const pages = data.groups.map((group, index) => [
    index ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '',
    imageParagraph(),
    paragraph('', { style: 'Title', keepNext: true }).replace('</w:p>', `${runXml('DAFTAR SISWA EKSTRAKURIKULER', { bold: true, size: 14 })}</w:p>`),
    paragraph(runXml(group.ekskul_nama, { bold: true, size: 12 }), { align: 'center', after: 160, keepNext: true }),
    metadataTable(data.filterLabel, group.rows.length),
    paragraph('', { after: 80, keepNext: true }),
    rosterTable(group),
    paragraph(runXml(`Dicetak pada ${printedAt}`, { size: 8, color: '555555' }), { align: 'right', before: 120 }),
  ].join('')).join('')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${pages}<w:sectPr><w:pgSz w:w="${mmToTwips(PAGE_WIDTH_MM)}" w:h="${mmToTwips(PAGE_HEIGHT_MM)}"/><w:pgMar w:top="${mmToTwips(MARGIN_TOP_BOTTOM_MM)}" w:right="${mmToTwips(MARGIN_LEFT_RIGHT_MM)}" w:bottom="${mmToTwips(MARGIN_TOP_BOTTOM_MM)}" w:left="${mmToTwips(MARGIN_LEFT_RIGHT_MM)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const encoder = new TextEncoder()
  return createZip([
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypesXml()) },
    { name: '_rels/.rels', bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`) },
    { name: 'word/document.xml', bytes: encoder.encode(documentXml) },
    { name: 'word/styles.xml', bytes: encoder.encode(stylesXml()) },
    { name: 'word/settings.xml', bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${XML_NS}"><w:zoom w:percent="100"/><w:compat/></w:settings>`) },
    { name: 'word/_rels/document.xml.rels', bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdLetterhead" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/kopsurat.png"/></Relationships>`) },
    { name: 'word/media/kopsurat.png', bytes: data.letterheadPng },
    { name: 'docProps/core.xml', bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Daftar Siswa Ekstrakurikuler</dc:title><dc:creator>MANSATAS App</dc:creator><cp:lastModifiedBy>MANSATAS App</cp:lastModifiedBy></cp:coreProperties>`) },
  ])
}

export function buildEkskulAnggotaDocxBlob(data: EkskulAnggotaDocxData) {
  const bytes = buildEkskulAnggotaDocxBytes(data)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: DOCX_MIME })
}
