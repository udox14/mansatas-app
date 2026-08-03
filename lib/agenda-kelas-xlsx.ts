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
const FONT = 'Book Antiqua'
const EMU_PER_MM = 36000
const XML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const REL_CORE_PROPERTIES = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
const REL_WORKSHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles'
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing'
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'

const PAGE_WIDTH_MM = 330
const PAGE_PADDING_MM = 10
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_PADDING_MM * 2
const PAGE_ROWS = 31
const COLUMN_COUNT = 18

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

function pointsFromMm(value: number) {
  return Math.round(value * 2.83465 * 100) / 100
}

function excelWidthFromMm(value: number) {
  return Math.round((value / 2.25) * 100) / 100
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date + 'T00:00:00'))
}

function wrapText(value: string | null | undefined, maxPerLine: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text || text.length <= maxPerLine) return text
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
  if (current) lines.push(current)
  const result = lines.slice(0, 2)
  if (result.join(' ').length < text.length) result[result.length - 1] = `${result[result.length - 1].slice(0, Math.max(1, maxPerLine - 1))}…`
  return result.join('\n')
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

  styleRange(startRow: number, startCol: number, endRow: number, endCol: number, style: number) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const current = this.cells.get(cellRef(row, col))
        this.set(row, col, current?.value ?? null, style)
      }
    }
  }

  merge(startRow: number, startCol: number, endRow: number, endCol: number) {
    this.merges.push({ startRow, startCol, endRow, endCol })
    this.maxRow = Math.max(this.maxRow, endRow)
    this.maxCol = Math.max(this.maxCol, endCol)
  }

  setMerged(startRow: number, startCol: number, endRow: number, endCol: number, value: CellValue, style = 0) {
    this.styleRange(startRow, startCol, endRow, endCol, style)
    this.set(startRow, startCol, value, style)
    this.merge(startRow, startCol, endRow, endCol)
  }

  setRowHeight(row: number, heightMm: number) {
    this.rowHeights.set(row, pointsFromMm(heightMm))
    this.maxRow = Math.max(this.maxRow, row)
  }

  addDrawing(drawing: Drawing) {
    this.drawings.push(drawing)
  }
}

function setPageRowHeights(sheet: SheetBuilder, start: number) {
  const heights: Record<number, number> = {
    0: 5, 1: 5, 2: 5, 3: 6, 4: 1,
    5: 6, 6: 6, 7: 9,
    18: 3, 19: 5, 20: 5, 21: 5, 22: 5, 23: 5, 24: 15, 25: 7, 26: 7, 27: 5, 28: 5,
  }
  for (let offset = 0; offset < PAGE_ROWS; offset++) sheet.setRowHeight(start + offset, heights[offset] || 8.1)
}

function addPage(sheet: SheetBuilder, page: AgendaKelasPageData, index: number, settings: AgendaKelasSignatureSettings, assets: AgendaKelasExportAssets) {
  const start = index * PAGE_ROWS + 1
  setPageRowHeights(sheet, start)
  const leftCols = [9, 31, 45, 34, 20]
  const scale = (CONTENT_WIDTH_MM * 0.52 - 2) / leftCols.reduce((sum, item) => sum + item, 0)
  const agendaCols = leftCols.map(item => item * scale)
  const rightCols = [8, 31, 5, 5, 5, 13]
  const rightScale = (CONTENT_WIDTH_MM * 0.48 - 2) / (rightCols.reduce((sum, item) => sum + item, 0) * 2)
  const attendanceCols = rightCols.map(item => item * rightScale)
  const widths = [...agendaCols, 4, ...attendanceCols, ...attendanceCols]
  const cumulative = widths.reduce((sum, value) => sum + value, 0)
  widths[widths.length - 1] += CONTENT_WIDTH_MM - cumulative

  sheet.setMerged(start, 2, start + 3, 17, [
    'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
    'KANTOR KEMENTERIAN AGAMA KABUPATEN TASIKMALAYA',
    'MADRASAH ALIYAH NEGERI 1 TASIKMALAYA',
    'Jl. Pahlawan KHZ. Musthafa Sukamanah Desa Sukarapih Kec. Sukarame Kode Pos 46461',
    'website : www.man1tasikmalaya.sch.id email : manegerisukamanah@gmail.com',
  ].join('\n'), 1)
  sheet.styleRange(start + 4, 0, start + 4, 17, 11)
  sheet.setMerged(start + 4, 0, start + 4, 17, null, 11)
  sheet.setMerged(start + 5, 0, start + 5, 4, `HARI : ${page.hariNama}`, 12)
  sheet.setMerged(start + 5, 6, start + 5, 17, `TANGGAL : ${formatDate(page.tanggal)}`, 12)

  sheet.setMerged(start + 6, 0, start + 6, 4, 'AGENDA KELAS', 1)
  sheet.setMerged(start + 6, 6, start + 6, 17, 'ABSENSI SISWA', 1)

  const agendaHeaders = ['JAM\nKE', 'MATA PELAJARAN', 'POKOK\nBAHASAN', 'TUGAS', 'KEHADIRAN\nGURU']
  for (let col = 0; col < 5; col++) sheet.set(start + 7, col, agendaHeaders[col], 2)
  const attendanceHeaders = ['NO', 'NAMA', 'S', 'I', 'A', 'KET']
  for (let col = 0; col < 6; col++) {
    sheet.set(start + 7, 6 + col, attendanceHeaders[col], 2)
    sheet.set(start + 7, 12 + col, attendanceHeaders[col], 2)
  }

  for (let indexRow = 0; indexRow < 10; indexRow++) {
    const row = page.agendaRows[indexRow]
    const excelRow = start + 8 + indexRow
    const values: CellValue[] = [
      indexRow + 1,
      row?.mapel_nama ? row.mapel_nama.toUpperCase() : '',
      wrapText(row?.pokok_bahasan, 27),
      wrapText(row?.tugas, 20),
      row?.guru_status || '',
    ]
    for (let col = 0; col < 5; col++) sheet.set(excelRow, col, values[col], col === 0 || col === 4 ? 4 : 3)
    const attendanceRows = [page.absensiRows[indexRow], page.absensiRows[indexRow + 10]]
    for (let side = 0; side < 2; side++) {
      const attendance = attendanceRows[side]
      const baseCol = side === 0 ? 6 : 12
      const values: CellValue[] = [
        indexRow + 1 + side * 10,
        wrapText(attendance?.nama, 22),
        attendance?.sakit ? '✓' : '',
        attendance?.izin ? '✓' : '',
        attendance?.alfa ? '✓' : '',
        wrapText(String(attendance?.ket || '').replace(/Keterangan dari wali kelas/gi, 'Ket. Wali Kelas'), 13),
      ]
      for (let col = 0; col < 6; col++) sheet.set(excelRow, baseCol + col, values[col], col === 0 || (col >= 2 && col <= 4) ? 4 : col === 5 ? 6 : 5)
    }
  }

  const footerStart = start + 19
  sheet.setMerged(footerStart, 0, footerStart, 6, 'REKAPITULASI KEGIATAN', 7)
  sheet.setMerged(footerStart, 14, footerStart, 17, `Tasikmalaya, ${formatDate(page.tanggal)}`, 8)
  const recap = [['1. Terisi :', page.rekap.terisi], ['2. Tugas :', page.rekap.tugas], ['3. Kosong :', page.rekap.kosong]]
  for (let indexRow = 0; indexRow < recap.length; indexRow++) {
    sheet.setMerged(footerStart + 1 + indexRow, 0, footerStart + 1 + indexRow, 6, `${recap[indexRow][0]} ${recap[indexRow][1]} Jam`, 8)
  }
  sheet.setMerged(footerStart + 1, 14, footerStart + 1, 17, `KM Kelas ${page.kelas.label},`, 8)
  sheet.setMerged(footerStart + 4, 7, footerStart + 4, 13, 'Mengetahui :', 8)
  sheet.setMerged(footerStart + 4, 14, footerStart + 4, 17, page.kelas.km_nama || '...........................................................', 7)
  sheet.setMerged(footerStart + 5, 0, footerStart + 5, 6, 'Kepala MAN 1 Tasikmalaya,', 8)
  sheet.setMerged(footerStart + 5, 7, footerStart + 5, 13, 'Wali Kelas,', 8)
  sheet.setMerged(footerStart + 5, 14, footerStart + 5, 17, 'NIS', 8)
  sheet.setMerged(footerStart + 7, 0, footerStart + 7, 6, page.kepala.nama, 7)
  sheet.setMerged(footerStart + 7, 7, footerStart + 7, 13, page.kelas.wali_kelas_nama || '...........................................................', 7)
  sheet.setMerged(footerStart + 8, 0, footerStart + 8, 6, `NIP. ${page.kepala.nip || '...........................................................'}`, 8)
  sheet.setMerged(footerStart + 8, 7, footerStart + 8, 13, `NIP. ${page.kelas.wali_kelas_nip || '...........................................................'}`, 8)

  sheet.addDrawing({ asset: assets.logo, target: `media/logo.${assets.logo.extension}`, col: 0, row: start - 1, xMm: 2, yMm: 1, widthMm: 19, name: 'Logo Madrasah' })
  if (settings.kepala.enabled && assets.kepalaSignature && page.kepala.signature_url) {
    sheet.addDrawing({ asset: assets.kepalaSignature, target: `media/signature-kepala.${assets.kepalaSignature.extension}`, col: 0, row: footerStart + 5 - 1, xMm: settings.kepala.x_mm, yMm: settings.kepala.y_mm, widthMm: settings.kepala.width_mm, name: 'Tanda tangan Kepala Madrasah' })
  }
  const wali = settings.wali.enabled ? assets.waliSignatures.get(page.kelas.id) : null
  if (wali && page.kelas.wali_kelas_signature_url) {
    sheet.addDrawing({ asset: wali, target: `media/signature-wali-${page.kelas.id}.${wali.extension}`, col: 7, row: footerStart + 5 - 1, xMm: settings.wali.x_mm, yMm: settings.wali.y_mm, widthMm: settings.wali.width_mm, name: 'Tanda tangan Wali Kelas' })
  }

  return widths
}

function styleXml() {
  const fonts = [
    `<font><sz val="8.5"/><name val="${FONT}"/></font>`,
    `<font><b/><sz val="10.5"/><name val="${FONT}"/></font>`,
    `<font><b/><sz val="8.5"/><name val="${FONT}"/></font>`,
    `<font><sz val="8"/><name val="${FONT}"/></font>`,
    `<font><b/><sz val="8"/><name val="${FONT}"/></font>`,
    `<font><sz val="7.8"/><name val="${FONT}"/></font>`,
    `<font><sz val="7.2"/><name val="${FONT}"/></font>`,
    `<font><b/><sz val="9"/><name val="${FONT}"/></font>`,
  ].join('')
  const borders = [
    '<borders><border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="double"><color rgb="FF000000"/></bottom><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="dotted"><color rgb="FF000000"/></bottom><diagonal/></border>',
  ].join('') + '</borders>'
  const alignments = [
    '',
    '<alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="0"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
    '<alignment horizontal="left" vertical="center" wrapText="1"/>',
  ]
  const xfs = [
    [0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 1, 1], [3, 0, 1, 3], [4, 0, 1, 4], [5, 0, 1, 5], [6, 0, 1, 6], [7, 0, 0, 7], [0, 0, 0, 8], [2, 0, 2, 1], [2, 0, 1, 10], [0, 0, 2, 0], [2, 0, 0, 12],
  ].map(([fontId, fillId, borderId, alignmentId]) => `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" applyFont="1" applyBorder="1" applyAlignment="1">${alignments[alignmentId]}</xf>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XML_NS}"><fonts count="8">${fonts}</fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills>${borders}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/></styleSheet>`
}

function cellXml(ref: string, cell: Cell) {
  if (cell.type === 'n') return `<c r="${ref}" s="${cell.style}" t="n"><v>${cell.value ?? 0}</v></c>`
  return `<c r="${ref}" s="${cell.style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value ?? '')}</t></is></c>`
}

function worksheetXml(sheet: SheetBuilder, drawingRelId: string, widths: number[], printName: string, hasDrawing: boolean) {
  const rows = new Map<number, string[]>()
  for (const [ref, cell] of sheet.cells) {
    const match = ref.match(/^(\D+)(\d+)$/)
    if (!match) continue
    const row = Number(match[2])
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push(cellXml(ref, cell))
  }
  const rowXmls = Array.from(rows.keys()).sort((a, b) => a - b).map(row => {
    const cells = rows.get(row)!.sort((a, b) => a.localeCompare(b)).join('')
    const height = sheet.rowHeights.get(row)
    return `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`
  }).join('')
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${excelWidthFromMm(width)}" customWidth="1"/>`).join('')
  const merges = sheet.merges.map(merge => `<mergeCell ref="${cellRef(merge.startRow, merge.startCol)}:${cellRef(merge.endRow, merge.endCol)}"/>`).join('')
  const breakCount = Math.max(0, Math.ceil(sheet.maxRow / PAGE_ROWS) - 1)
  const breaks = Array.from({ length: breakCount }).map((_, index) => `<brk id="${(index + 1) * PAGE_ROWS}" max="16383" man="1"/>`).join('')
  const drawing = hasDrawing ? `<drawing r:id="${drawingRelId}"/>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${cellRef(sheet.maxRow, sheet.maxCol)}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rowXmls}</sheetData><mergeCells count="${sheet.merges.length}">${merges}</mergeCells><printOptions horizontalCentered="1" verticalCentered="0"/><pageMargins left="0.39" right="0.39" top="0.39" bottom="0.39" header="0" footer="0"/><pageSetup orientation="landscape" paperSize="256" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/><rowBreaks count="${breakCount}" manualBreakCount="${breakCount}">${breaks}</rowBreaks>${drawing}</worksheet>`
}

function drawingXml(sheet: SheetBuilder, drawingId: number) {
  const anchors = sheet.drawings.map((drawing, index) => {
    const aspect = drawing.asset.widthPx > 0 && drawing.asset.heightPx > 0 ? drawing.asset.heightPx / drawing.asset.widthPx : 0.28
    const heightMm = Math.min(30, Math.max(1, drawing.widthMm * aspect))
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${drawing.col}</xdr:col><xdr:colOff>${mmToEmu(drawing.xMm)}</xdr:colOff><xdr:row>${drawing.row}</xdr:row><xdr:rowOff>${mmToEmu(drawing.yMm)}</xdr:rowOff></xdr:from><xdr:ext cx="${mmToEmu(drawing.widthMm)}" cy="${mmToEmu(heightMm)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="${xmlEscape(drawing.name)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdImage${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
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
  const definedNames = sheetNames.map((name, index) => `<definedName name="_xlnm.Print_Area" localSheetId="${index}">'${xmlEscape(name)}'!$A$1:$R$${maxRows[index]}</definedName>`).join('')
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
  const sheets: Array<{ name: string; builder: SheetBuilder; widths: number[] }> = []
  for (const classPages of byClass.values()) {
    const builder = new SheetBuilder()
    const widths = addPage(builder, classPages[0], 0, signatureSettings, assets)
    for (let index = 1; index < classPages.length; index++) addPage(builder, classPages[index], index, signatureSettings, assets)
    sheets.push({ name: safeSheetName(classPages[0].kelas.label, usedNames), builder, widths })
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
      bytes: encoder.encode(worksheetXml(sheet.builder, 'rIdDrawing', sheet.widths, sheet.name, sheet.builder.drawings.length > 0)),
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
  return new Blob([bytes], { type: XLSX_MIME })
}

export function agendaKelasXlsxFilename(pages: AgendaKelasPageData[]) {
  const label = pages.length === 1 ? pages[0].kelas.label : 'Multi_Kelas'
  return `Agenda_Kelas_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
}
