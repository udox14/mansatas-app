import { createZip } from '@/lib/zip'
import type {
  AgendaKelasPageData,
  AgendaKelasSignatureSettings,
} from '@/app/dashboard/agenda-kelas/actions'
import type {
  AgendaKelasExportAssets,
  AgendaKelasImageAsset,
} from '@/lib/agenda-kelas-export-assets'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const EMU_PER_MM = 36000
const XML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const REL_CORE_PROPERTIES = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
const REL_WORKSHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'

const PAGE_ROWS = 33
const COLUMN_COUNT = 19
const TEMPLATE_COLUMN_WIDTHS = [
  7, 21.5546875, 19, 18.109375, 9.109375, 2.6640625, 5.109375, 19.6640625, 3.6640625, 3.6640625,
  3.6640625, 7.6640625, 2.33203125, 5.109375, 19.6640625, 3.6640625, 3.6640625, 3.6640625, 7.6640625,
] as const

type CellValue = string | number | null
type Cell = { value: CellValue; style: number; type: 's' | 'n' }
type Merge = { startRow: number; startCol: number; endRow: number; endCol: number }
type Drawing = {
  asset: AgendaKelasImageAsset
  target: string
  col: number
  row: number
  xMm: number
  yMm: number
  widthMm: number
  name: string
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

function columnName(index: number) {
  let value = ''
  let current = index + 1
  while (current > 0) {
    const remainder = (current - 1) % 26
    value = String.fromCharCode(65 + remainder) + value
    current = Math.floor((current - 1) / 26)
  }
  return value
}

function cellRef(row: number, col: number) {
  return `${columnName(col)}${row}`
}

function mmToEmu(value: number) {
  return Math.round(value * EMU_PER_MM)
}

function imageDimensions(asset: AgendaKelasImageAsset, requestedWidthMm: number) {
  const widthMm = Math.max(1, Number.isFinite(Number(requestedWidthMm)) ? Number(requestedWidthMm) : 38)
  const aspect = asset.widthPx > 0 && asset.heightPx > 0 ? asset.heightPx / asset.widthPx : 0.28
  const naturalHeightMm = Math.max(1, widthMm * aspect)
  return { widthMm, heightMm: naturalHeightMm }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date + 'T00:00:00'))
}

class SheetBuilder {
  readonly cells = new Map<string, Cell>()
  readonly merges: Merge[] = []
  readonly rowHeights = new Map<number, number>()
  readonly drawings: Drawing[] = []
  maxRow = 1
  maxCol = COLUMN_COUNT - 1

  set(row: number, col: number, value: CellValue, style = 0) {
    const type: Cell['type'] = typeof value === 'number' ? 'n' : 's'
    this.cells.set(cellRef(row, col), { value, style, type })
    this.maxRow = Math.max(this.maxRow, row)
    this.maxCol = Math.max(this.maxCol, col)
  }

  merge(startRow: number, startCol: number, endRow: number, endCol: number) {
    this.merges.push({ startRow, startCol, endRow, endCol })
    this.maxRow = Math.max(this.maxRow, endRow)
    this.maxCol = Math.max(this.maxCol, endCol)
  }

  setMerged(startRow: number, startCol: number, endRow: number, endCol: number, value: CellValue, style = 0) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        this.set(row, col, row === startRow && col === startCol ? value : null, style)
      }
    }
    this.merge(startRow, startCol, endRow, endCol)
  }

  setRowHeight(row: number, heightPt: number) {
    this.rowHeights.set(row, heightPt)
    this.maxRow = Math.max(this.maxRow, row)
  }

  addDrawing(drawing: Drawing) {
    this.drawings.push(drawing)
  }
}

function setPageRowHeights(sheet: SheetBuilder, start: number) {
  sheet.setRowHeight(start + 5, 9.9)
  sheet.setRowHeight(start + 7, 9.9)
  sheet.setRowHeight(start + 9, 9.9)
  for (let offset = 0; offset < 10; offset++) sheet.setRowHeight(start + 11 + offset, 29.1)
  sheet.setRowHeight(start + 21, 9.9)
  for (let offset = 0; offset < 4; offset++) sheet.setRowHeight(start + 22 + offset, 15.9)
  for (let offset = 0; offset < 7; offset++) sheet.setRowHeight(start + 26 + offset, 14.1)
}

function addPage(sheet: SheetBuilder, page: AgendaKelasPageData, index: number, settings: AgendaKelasSignatureSettings, assets: AgendaKelasExportAssets) {
  const start = index * PAGE_ROWS + 1
  setPageRowHeights(sheet, start)
  const headerRows = [
    'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
    'KANTOR KEMENTERIAN AGAMA KABUPATEN TASIKMALAYA ',
    'MADRASAH ALIYAH NEGERI 1 TASIKMALAYA ',
    'Jl. Pahlawan KHZ. Musthafa Sukamanah Desa Sukarapih Kec. Sukarame Kode Pos 46461',
    'website : www.man1tasikmalaya.sch.id email : manegerisukamanah@gmail.com',
  ]
  for (let row = 0; row < headerRows.length; row++) sheet.setMerged(start + row, 0, start + row, 18, headerRows[row])

  sheet.set(start + 6, 0, 'HARI')
  sheet.set(start + 6, 1, `: ${page.hariNama || '....................................................'}`)
  sheet.set(start + 6, 6, `TANGGAL : ${page.tanggal ? formatDate(page.tanggal) : '.........................................'}`)

  sheet.setMerged(start + 8, 0, start + 8, 4, 'AGENDA KELAS')
  sheet.setMerged(start + 8, 6, start + 8, 18, 'ABSENSI SISWA')

  const agendaHeaders = ['JAM KE', 'MATA PELAJARAN', 'POKOK BAHASAN', 'TUGAS', 'PARAF GURU']
  for (let col = 0; col < agendaHeaders.length; col++) sheet.set(start + 10, col, agendaHeaders[col])
  const attendanceHeaders = ['NO', 'NAMA ', 'S', 'I', 'A', 'KET']
  for (let col = 0; col < attendanceHeaders.length; col++) {
    sheet.set(start + 10, 6 + col, attendanceHeaders[col])
    sheet.set(start + 10, 13 + col, attendanceHeaders[col])
  }

  for (let indexRow = 0; indexRow < 10; indexRow++) {
    const row = page.agendaRows[indexRow]
    const excelRow = start + 11 + indexRow
    const values: CellValue[] = [
      indexRow + 1,
      row?.mapel_nama ? row.mapel_nama.toUpperCase() : '',
      row?.pokok_bahasan || '',
      row?.tugas || '',
      row?.guru_status || row?.paraf || '',
    ]
    for (let col = 0; col < values.length; col++) sheet.set(excelRow, col, values[col])

    const attendanceRows = [page.absensiRows[indexRow], page.absensiRows[indexRow + 10]]
    for (let side = 0; side < 2; side++) {
      const attendance = attendanceRows[side]
      const baseCol = side === 0 ? 6 : 13
      const attendanceValues: CellValue[] = [
        indexRow + 1 + side * 10,
        attendance?.nama || '',
        attendance?.sakit ? '✓' : '',
        attendance?.izin ? '✓' : '',
        attendance?.alfa ? '✓' : '',
        '',
      ]
      for (let col = 0; col < attendanceValues.length; col++) sheet.set(excelRow, baseCol + col, attendanceValues[col])
    }
  }

  sheet.set(start + 22, 1, 'REKAPITULASI KEGIATAN ')
  sheet.set(start + 22, 13, `Tasikmalaya, ${formatDate(page.tanggal)}`)
  const recap = [
    ['1.', 'Terisi ', page.rekap.terisi],
    ['2.', 'Tugas', page.rekap.tugas],
    ['3.', 'Kosong ', page.rekap.kosong],
  ] as const
  for (let row = 0; row < recap.length; row++) {
    sheet.set(start + 23 + row, 0, recap[row][0])
    sheet.set(start + 23 + row, 1, recap[row][1])
    sheet.set(start + 23 + row, 2, `: ${recap[row][2]} Jam`)
  }
  sheet.set(start + 23, 13, `KM Kelas ${page.kelas.label || '.................'},`)

  sheet.setMerged(start + 26, 1, start + 26, 7, 'Mengetahui :')
  sheet.set(start + 26, 13, '................................................')
  sheet.set(start + 27, 1, 'Kepala MAN 1 Tasikmalaya,')
  sheet.set(start + 27, 5, 'Wali Kelas, ')
  sheet.set(start + 27, 13, 'NIS')
  sheet.set(start + 31, 1, page.kepala.nama || '..................................................')
  sheet.set(start + 31, 5, page.kelas.wali_kelas_nama || '..................................................')
  sheet.set(start + 32, 1, `NIP. ${page.kepala.nip || '..................................................'}`)
  sheet.set(start + 32, 5, `NIP. ${page.kelas.wali_kelas_nip || ''}`)

  if (settings.kepala.enabled && assets.kepalaSignature && page.kepala.signature_url) {
    sheet.addDrawing({ asset: assets.kepalaSignature, target: `media/signature-kepala.${assets.kepalaSignature.extension}`, col: 1, row: start + 27 - 1, xMm: settings.kepala.x_mm, yMm: settings.kepala.y_mm, widthMm: settings.kepala.width_mm, name: 'Tanda tangan Kepala Madrasah' })
  }
  const wali = settings.wali.enabled ? assets.waliSignatures.get(page.kelas.id) : null
  if (wali && page.kelas.wali_kelas_signature_url) {
    sheet.addDrawing({ asset: wali, target: `media/signature-wali-${page.kelas.id}.${wali.extension}`, col: 5, row: start + 27 - 1, xMm: settings.wali.x_mm, yMm: settings.wali.y_mm, widthMm: settings.wali.width_mm, name: 'Tanda tangan Wali Kelas' })
  }
}

function styleXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XML_NS}"><fonts count="1"><font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/></styleSheet>`
}

function cellXml(ref: string, cell: Cell) {
  if (cell.type === 'n') return `<c r="${ref}" s="${cell.style}" t="n"><v>${cell.value ?? 0}</v></c>`
  return `<c r="${ref}" s="${cell.style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value ?? '')}</t></is></c>`
}

function worksheetXml(sheet: SheetBuilder, drawingRelId: string, hasDrawing: boolean) {
  const rows = new Map<number, string[]>()
  for (const [ref, cell] of sheet.cells) {
    const match = ref.match(/^(\D+)(\d+)$/)
    if (!match) continue
    const row = Number(match[2])
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push(cellXml(ref, cell))
  }
  for (const row of sheet.rowHeights.keys()) {
    if (!rows.has(row)) rows.set(row, [])
  }
  const rowXmls = Array.from(rows.keys()).sort((a, b) => a - b).map(row => {
    const cells = rows.get(row)!.sort((a, b) => a.localeCompare(b)).join('')
    const height = sheet.rowHeights.get(row)
    return `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`
  }).join('')
  const cols = TEMPLATE_COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')
  const merges = sheet.merges.map(merge => `<mergeCell ref="${cellRef(merge.startRow, merge.startCol)}:${cellRef(merge.endRow, merge.endCol)}"/>`).join('')
  const breakCount = Math.max(0, Math.ceil(sheet.maxRow / PAGE_ROWS) - 1)
  const breaks = Array.from({ length: breakCount }).map((_, index) => `<brk id="${(index + 1) * PAGE_ROWS}" max="16383" man="1"/>`).join('')
  const drawing = hasDrawing ? `<drawing r:id="${drawingRelId}"/>` : ''
  const rowBreaks = breakCount ? `<rowBreaks count="${breakCount}" manualBreakCount="${breakCount}">${breaks}</rowBreaks>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${cellRef(sheet.maxRow, sheet.maxCol)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rowXmls}</sheetData><mergeCells count="${sheet.merges.length}">${merges}</mergeCells><pageMargins left="0.69" right="0.2755905511811024" top="0.255" bottom="0.225" header="0.31496062992125984" footer="0.31496062992125984"/><pageSetup orientation="landscape" paperSize="256" fitToWidth="1" fitToHeight="0"/>${rowBreaks}${drawing}</worksheet>`
}

function drawingXml(sheet: SheetBuilder, drawingId: number) {
  const anchors = sheet.drawings.map((drawing, index) => {
    const dimensions = imageDimensions(drawing.asset, drawing.widthMm)
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${drawing.col}</xdr:col><xdr:colOff>${mmToEmu(drawing.xMm)}</xdr:colOff><xdr:row>${drawing.row}</xdr:row><xdr:rowOff>${mmToEmu(drawing.yMm)}</xdr:rowOff></xdr:from><xdr:ext cx="${mmToEmu(dimensions.widthMm)}" cy="${mmToEmu(dimensions.heightMm)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="${xmlEscape(drawing.name)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdImage${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`
}

function drawingRelationships(sheet: SheetBuilder) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${sheet.drawings.map((drawing, index) => `<Relationship Id="rIdImage${index + 1}" Type="${REL_IMAGE}" Target="../${drawing.target}"/>`).join('')}</Relationships>`
}

function worksheetRelationships(drawingId: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rIdDrawing" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingId}.xml"/></Relationships>`
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${REL_OFFICE_DOCUMENT}" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="${REL_CORE_PROPERTIES}" Target="docProps/core.xml"/></Relationships>`
}

function workbookRelationships(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }).map((_, index) => `<Relationship Id="rIdSheet${index + 1}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${sheets}<Relationship Id="rIdStyles" Type="${REL_STYLES}" Target="styles.xml"/></Relationships>`
}

function safeSheetName(raw: string, used: Set<string>) {
  const base = raw.replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 31) || 'Kelas'
  let name = base
  let suffix = 2
  while (used.has(name)) {
    const tail = `-${suffix++}`
    name = `${base.slice(0, 31 - tail.length)}${tail}`
  }
  used.add(name)
  return name
}

function workbookXml(sheetNames: string[], maxRows: number[]) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rIdSheet${index + 1}"/>`).join('')
  const definedNames = sheetNames.map((name, index) => `<definedName name="_xlnm.Print_Area" localSheetId="${index}">'${xmlEscape(name)}'!$A$1:$S$${maxRows[index]}</definedName>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="1"/><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="12000"/></bookViews><sheets>${sheets}</sheets><definedNames>${definedNames}</definedNames><calcPr calcId="191029"/></workbook>`
}

function contentTypesXml(sheetCount: number, drawingCount: number, assets: AgendaKelasImageAsset[]) {
  const imageDefaults = Array.from(new Set(assets.map(asset => `${asset.extension}|${asset.contentType}`))).map(item => {
    const [extension, contentType] = item.split('|')
    return `<Default Extension="${extension}" ContentType="${contentType}"/>`
  }).join('')
  const sheets = Array.from({ length: sheetCount }).map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  const drawings = Array.from({ length: drawingCount }).map((_, index) => `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageDefaults}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets}${drawings}</Types>`
}

function corePropertiesXml(firstPage: AgendaKelasPageData) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Agenda Kelas ${xmlEscape(firstPage.kelas.label)}</dc:title><dc:creator>MANSATAS App</dc:creator><cp:lastModifiedBy>MANSATAS App</cp:lastModifiedBy></cp:coreProperties>`
}

export async function buildAgendaKelasXlsxBytes(
  pages: AgendaKelasPageData[],
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
) {
  if (!pages.length) throw new Error('Tidak ada halaman Agenda Kelas untuk diekspor.')
  const byClass = new Map<string, AgendaKelasPageData[]>()
  for (const page of pages) {
    const current = byClass.get(page.kelas.id)
    if (current) current.push(page)
    else byClass.set(page.kelas.id, [page])
  }

  const usedNames = new Set<string>()
  const sheets: Array<{ name: string; builder: SheetBuilder }> = []
  for (const classPages of byClass.values()) {
    const builder = new SheetBuilder()
    addPage(builder, classPages[0], 0, signatureSettings, assets)
    for (let index = 1; index < classPages.length; index++) addPage(builder, classPages[index], index, signatureSettings, assets)
    sheets.push({ name: safeSheetName(classPages[0].kelas.label, usedNames), builder })
  }

  const encoder = new TextEncoder()
  const entries: Array<{ name: string; bytes: Uint8Array }> = []
  const drawingEntries: Array<{ index: number; sheet: SheetBuilder }> = []
  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index]
    const drawingId = index + 1
    if (sheet.builder.drawings.length) drawingEntries.push({ index: drawingId, sheet: sheet.builder })
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      bytes: encoder.encode(worksheetXml(sheet.builder, 'rIdDrawing', sheet.builder.drawings.length > 0)),
    })
    if (sheet.builder.drawings.length) {
      entries.push({ name: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`, bytes: encoder.encode(worksheetRelationships(drawingId)) })
      entries.push({ name: `xl/drawings/drawing${drawingId}.xml`, bytes: encoder.encode(drawingXml(sheet.builder, drawingId)) })
      entries.push({ name: `xl/drawings/_rels/drawing${drawingId}.xml.rels`, bytes: encoder.encode(drawingRelationships(sheet.builder)) })
    }
  }

  const media = new Map<string, AgendaKelasImageAsset>()
  for (const sheet of sheets) {
    for (const drawing of sheet.builder.drawings) media.set(drawing.target, drawing.asset)
  }
  for (const [target, asset] of media) entries.push({ name: `xl/${target}`, bytes: asset.data })

  const sheetNames = sheets.map(sheet => sheet.name)
  const maxRows = sheets.map(sheet => sheet.builder.maxRow)
  entries.unshift(
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypesXml(sheets.length, drawingEntries.length, Array.from(media.values()))) },
    { name: '_rels/.rels', bytes: encoder.encode(rootRelationships()) },
    { name: 'xl/workbook.xml', bytes: encoder.encode(workbookXml(sheetNames, maxRows)) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRelationships(sheets.length)) },
    { name: 'xl/styles.xml', bytes: encoder.encode(styleXml()) },
    { name: 'docProps/core.xml', bytes: encoder.encode(corePropertiesXml(pages[0])) },
  )
  return createZip(entries)
}

export async function buildAgendaKelasXlsxBlob(
  pages: AgendaKelasPageData[],
  signatureSettings: AgendaKelasSignatureSettings,
  assets: AgendaKelasExportAssets,
) {
  const bytes = await buildAgendaKelasXlsxBytes(pages, signatureSettings, assets)
  return new Blob([bytesToArrayBuffer(bytes)], { type: XLSX_MIME })
}

export function agendaKelasXlsxFilename(pages: AgendaKelasPageData[]) {
  const label = pages.length === 1 ? pages[0].kelas.label : 'Multi_Kelas'
  return `Agenda_Kelas_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
}
