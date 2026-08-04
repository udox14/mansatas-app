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
const TEMPLATE_COLUMN_DEFINITIONS = [
  [1, 1, 7], [2, 2, 21.5546875], [3, 3, 19], [4, 4, 18.109375], [5, 5, 9.109375], [6, 6, 2.6640625],
  [7, 7, 5.109375], [8, 8, 19.6640625], [9, 11, 3.6640625], [12, 12, 7.6640625], [13, 13, 2.33203125],
  [14, 14, 5.109375], [15, 15, 19.6640625], [16, 18, 3.6640625], [19, 19, 7.6640625], [20, 20, 4.88671875],
  [21, 16384, 9.109375],
] as const
const TEMPLATE_DEFAULT_COLUMN_WIDTH = 9.109375
const TEMPLATE_DEFAULT_ROW_HEIGHT = 14.4

const TEMPLATE_STYLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XML_NS}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac x16r2 xr" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:x16r2="http://schemas.microsoft.com/office/spreadsheetml/2015/02/main" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"><fonts count="8" x14ac:knownFonts="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><charset val="1"/><scheme val="minor"/></font><font><sz val="11"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><b/><u/><sz val="11"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><sz val="12"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><b/><sz val="16"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><b/><sz val="12"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font><font><b/><sz val="10"/><color theme="1"/><name val="Book Antiqua"/><family val="1"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="17"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="medium"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="double"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="double"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="medium"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="double"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top/><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="medium"><color indexed="64"/></right><top/><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="medium"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="medium"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left style="medium"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top/><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="medium"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border><border><left style="medium"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left style="medium"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="medium"><color indexed="64"/></right><top style="medium"><color indexed="64"/></top><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color indexed="64"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="28"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="4" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="5" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="6" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="7" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="8" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="9" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="10" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="11" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="12" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="0" borderId="13" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="0" borderId="14" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="0" borderId="15" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="7" fillId="0" borderId="16" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`

type CellValue = string | number | null
type Cell = { value: CellValue; style: number; type: 's' | 'n' }
type Merge = { startRow: number; startCol: number; endRow: number; endCol: number }
type RowFlags = { thickTop?: boolean; thickBot?: boolean }
type Drawing = {
  asset: AgendaKelasImageAsset
  target: string
  col: number
  row: number
  xMm: number
  yMm: number
  widthMm: number
  name: string
  heightMm?: number
  sourceRectBottom?: number
  toCol?: number
  toRow?: number
  toXMm?: number
  toYMm?: number
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
  readonly rowFlags = new Map<number, RowFlags>()
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

  setMergedWithStyles(startRow: number, startCol: number, endRow: number, endCol: number, value: CellValue, styles: number[]) {
    const width = endCol - startCol + 1
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const style = styles[(row - startRow) * width + (col - startCol)] ?? 0
        this.set(row, col, row === startRow && col === startCol ? value : null, style)
      }
    }
    this.merge(startRow, startCol, endRow, endCol)
  }

  setRowHeight(row: number, heightPt: number) {
    this.rowHeights.set(row, heightPt)
    this.maxRow = Math.max(this.maxRow, row)
  }

  setRowFlags(row: number, flags: RowFlags) {
    this.rowFlags.set(row, flags)
    this.maxRow = Math.max(this.maxRow, row)
  }

  addDrawing(drawing: Drawing) {
    this.drawings.push(drawing)
  }
}

function setPageRowHeights(sheet: SheetBuilder, start: number) {
  for (const [offset, height] of [
    [0, 15.6], [1, 15.6], [2, 15.6], [4, 15], [5, 9.9], [7, 9.9], [8, 21.6], [9, 9.9], [10, 29.4],
    [21, 9.9], [22, 15.9], [23, 15.9], [24, 15.9], [25, 15.9], [26, 14.1], [27, 14.1], [28, 14.1],
    [29, 14.1], [30, 14.1], [31, 14.1], [32, 14.1],
  ] as const) sheet.setRowHeight(start + offset, height)
  for (let offset = 11; offset <= 20; offset++) sheet.setRowHeight(start + offset, 29.1)

  for (const offset of [4, 7, 8, 9, 10, 20] as const) sheet.setRowFlags(start + offset, { thickBot: true })
  sheet.setRowFlags(start + 11, { thickTop: true })
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
  const headerStyles = [25, 25, 25, 26, 27]
  for (let row = 0; row < headerRows.length; row++) sheet.setMerged(start + row, 0, start + row, 18, headerRows[row], headerStyles[row])
  for (let col = 0; col < COLUMN_COUNT; col++) sheet.set(start + 5, col, null, 2)

  sheet.set(start + 6, 0, 'HARI', 3)
  sheet.set(start + 6, 1, `: ${page.hariNama || '....................................................'}`, 3)
  sheet.set(start + 6, 6, `TANGGAL : ${page.tanggal ? formatDate(page.tanggal) : '.........................................'}`, 3)

  sheet.setMergedWithStyles(start + 8, 0, start + 8, 4, 'AGENDA KELAS', [21, 22, 22, 22, 23])
  sheet.setMergedWithStyles(start + 8, 6, start + 8, 18, 'ABSENSI SISWA', [21, ...Array.from({ length: 11 }, () => 22), 23])

  const agendaHeaders = ['JAM KE', 'MATA PELAJARAN', 'POKOK BAHASAN', 'TUGAS', 'PARAF GURU']
  const agendaHeaderStyles = [4, 5, 5, 6, 7]
  for (let col = 0; col < agendaHeaders.length; col++) sheet.set(start + 10, col, agendaHeaders[col], agendaHeaderStyles[col])
  sheet.set(start + 10, 5, null, 3)
  const attendanceHeaders = ['NO', 'NAMA ', 'S', 'I', 'A', 'KET']
  const attendanceHeaderStyles = [8, 6, 6, 6, 6, 9]
  for (let col = 0; col < attendanceHeaders.length; col++) {
    sheet.set(start + 10, 6 + col, attendanceHeaders[col], attendanceHeaderStyles[col])
    sheet.set(start + 10, 13 + col, attendanceHeaders[col], attendanceHeaderStyles[col])
  }
  sheet.set(start + 10, 12, null, 3)

  for (let indexRow = 0; indexRow < 10; indexRow++) {
    const row = page.agendaRows[indexRow]
    const excelRow = start + 11 + indexRow
    const bodyStyles = indexRow === 0 ? [18, 10, 10, 10, 11] : indexRow === 9 ? [20, 14, 14, 14, 15] : [19, 12, 12, 12, 13]
    const values: CellValue[] = [
      indexRow + 1,
      row?.mapel_nama ? row.mapel_nama.toUpperCase() : null,
      row?.pokok_bahasan || null,
      row?.tugas || null,
      row?.guru_status || row?.paraf || null,
    ]
    for (let col = 0; col < values.length; col++) sheet.set(excelRow, col, values[col], bodyStyles[col])

    const attendanceRows = [page.absensiRows[indexRow], page.absensiRows[indexRow + 10]]
    for (let side = 0; side < 2; side++) {
      const attendance = attendanceRows[side]
      const baseCol = side === 0 ? 6 : 13
      const attendanceStyles = indexRow === 0 ? [18, 10, 10, 10, 10, 11] : indexRow === 9 ? [20, 14, 14, 14, 14, 15] : [19, 12, 12, 12, 12, 13]
      const attendanceValues: CellValue[] = [
        indexRow + 1 + side * 10,
        attendance?.nama || null,
        attendance?.sakit ? '\u2713' : null,
        attendance?.izin ? '\u2713' : null,
        attendance?.alfa ? '\u2713' : null,
        null,
      ]
      for (let col = 0; col < attendanceValues.length; col++) sheet.set(excelRow, baseCol + col, attendanceValues[col], attendanceStyles[col])
    }
  }

  sheet.set(start + 22, 1, 'REKAPITULASI KEGIATAN ', 3)
  sheet.set(start + 22, 13, `Tasikmalaya, ${formatDate(page.tanggal)}`, 1)
  const recap = [
    ['1.', 'Terisi ', page.rekap.terisi],
    ['2.', 'Tugas', page.rekap.tugas],
    ['3.', 'Kosong ', page.rekap.kosong],
  ] as const
  for (let row = 0; row < recap.length; row++) {
    sheet.set(start + 23 + row, 0, recap[row][0], 16)
    sheet.set(start + 23 + row, 1, recap[row][1], 1)
    sheet.set(start + 23 + row, 2, `: ${recap[row][2]} Jam`, 1)
  }
  sheet.set(start + 23, 13, `KM Kelas ${page.kelas.label || '.................'},`, 1)

  sheet.setMerged(start + 26, 1, start + 26, 7, 'Mengetahui :', 24)
  sheet.set(start + 26, 13, '................................................', 17)
  sheet.set(start + 27, 1, 'Kepala MAN 1 Tasikmalaya,', 1)
  sheet.set(start + 27, 5, 'Wali Kelas, ', 1)
  sheet.set(start + 27, 13, 'NIS', 1)
  sheet.set(start + 31, 1, page.kepala.nama || '..................................................', 3)
  sheet.set(start + 31, 5, page.kelas.wali_kelas_nama || '..................................................', 17)
  sheet.set(start + 32, 1, `NIP. ${page.kepala.nip || '..................................................'}`, 1)
  sheet.set(start + 32, 5, `NIP. ${page.kelas.wali_kelas_nip || ''}`, 1)

  sheet.addDrawing({
    asset: assets.logo,
    target: `media/logo.${assets.logo.extension}`,
    col: 2,
    row: start - 1,
    xMm: 15240 / EMU_PER_MM,
    yMm: 0,
    widthMm: 952500 / EMU_PER_MM,
    heightMm: 906780 / EMU_PER_MM,
    sourceRectBottom: 17879,
    toCol: 2,
    toRow: start + 4 - 1,
    toXMm: 967740 / EMU_PER_MM,
    toYMm: 129540 / EMU_PER_MM,
    name: 'Logo Madrasah',
  })
  if (settings.kepala.enabled && assets.kepalaSignature && page.kepala.signature_url) {
    sheet.addDrawing({ asset: assets.kepalaSignature, target: `media/signature-kepala.${assets.kepalaSignature.extension}`, col: 1, row: start + 27 - 1, xMm: settings.kepala.x_mm, yMm: settings.kepala.y_mm, widthMm: settings.kepala.width_mm, name: 'Tanda tangan Kepala Madrasah' })
  }
  const wali = settings.wali.enabled ? assets.waliSignatures.get(page.kelas.id) : null
  if (wali && page.kelas.wali_kelas_signature_url) {
    sheet.addDrawing({ asset: wali, target: `media/signature-wali-${page.kelas.id}.${wali.extension}`, col: 5, row: start + 27 - 1, xMm: settings.wali.x_mm, yMm: settings.wali.y_mm, widthMm: settings.wali.width_mm, name: 'Tanda tangan Wali Kelas' })
  }
}

function styleXml() {
  return TEMPLATE_STYLE_XML
}

function cellXml(ref: string, cell: Cell) {
  if (cell.value === null) return `<c r="${ref}" s="${cell.style}"/>`
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
    const flags = sheet.rowFlags.get(row)
    const thickTop = flags?.thickTop ? ' thickTop="1"' : ''
    const thickBot = flags?.thickBot ? ' thickBot="1"' : ''
    return `<row r="${row}" spans="1:${COLUMN_COUNT}"${height ? ` ht="${height}" customHeight="1"` : ''}${thickTop}${thickBot}>${cells}</row>`
  }).join('')
  const cols = TEMPLATE_COLUMN_DEFINITIONS.map(([min, max, width]) => `<col min="${min}" max="${max}" width="${width}" style="1" customWidth="1"/>`).join('')
  const merges = sheet.merges.map(merge => `<mergeCell ref="${cellRef(merge.startRow, merge.startCol)}:${cellRef(merge.endRow, merge.endCol)}"/>`).join('')
  const breakCount = Math.max(0, Math.ceil(sheet.maxRow / PAGE_ROWS) - 1)
  const breaks = Array.from({ length: breakCount }).map((_, index) => `<brk id="${(index + 1) * PAGE_ROWS}" max="16383" man="1"/>`).join('')
  const drawing = hasDrawing ? `<drawing r:id="${drawingRelId}"/>` : ''
  const rowBreaks = breakCount ? `<rowBreaks count="${breakCount}" manualBreakCount="${breakCount}">${breaks}</rowBreaks>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${cellRef(sheet.maxRow, sheet.maxCol)}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="0"/></sheetViews><sheetFormatPr defaultColWidth="${TEMPLATE_DEFAULT_COLUMN_WIDTH}" defaultRowHeight="${TEMPLATE_DEFAULT_ROW_HEIGHT}"/><cols>${cols}</cols><sheetData>${rowXmls}</sheetData><mergeCells count="${sheet.merges.length}">${merges}</mergeCells><pageMargins left="0.69" right="0.27559055118110237" top="0.255" bottom="0.22500000000000001" header="0.31496062992125984" footer="0.31496062992125984"/><pageSetup orientation="landscape" paperSize="14" scale="90"/>${rowBreaks}${drawing}</worksheet>`
}

function drawingXml(sheet: SheetBuilder, drawingId: number) {
  const anchors = sheet.drawings.map((drawing, index) => {
    const dimensions = drawing.heightMm ? { widthMm: drawing.widthMm, heightMm: drawing.heightMm } : imageDimensions(drawing.asset, drawing.widthMm)
    const isTemplateLogo = drawing.toCol !== undefined && drawing.toRow !== undefined && drawing.toXMm !== undefined && drawing.toYMm !== undefined
    const picture = isTemplateLogo
      ? `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1060" name="Picture 12" descr="LOGODEPAG"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{CEF453B6-EE70-7E79-4B17-6E9608891871}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId${index + 1}" cstate="print"><a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext></a:extLst></a:blip><a:srcRect b="${drawing.sourceRectBottom ?? 17879}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr bwMode="auto"><a:xfrm><a:off x="1973580" y="0"/><a:ext cx="${mmToEmu(dimensions.widthMm)}" cy="${mmToEmu(dimensions.heightMm)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln><a:extLst><a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><a14:hiddenFill xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a14:hiddenFill></a:ext><a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><a14:hiddenLine xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:miter lim="800000"/><a:headEnd/><a:tailEnd/></a14:hiddenLine></a:ext></a:extLst></xdr:spPr></xdr:pic>`
      : `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="${xmlEscape(drawing.name)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`
    if (drawing.toCol !== undefined && drawing.toRow !== undefined && drawing.toXMm !== undefined && drawing.toYMm !== undefined) {
      return `<xdr:twoCellAnchor><xdr:from><xdr:col>${drawing.col}</xdr:col><xdr:colOff>${mmToEmu(drawing.xMm)}</xdr:colOff><xdr:row>${drawing.row}</xdr:row><xdr:rowOff>${mmToEmu(drawing.yMm)}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${drawing.toCol}</xdr:col><xdr:colOff>${mmToEmu(drawing.toXMm)}</xdr:colOff><xdr:row>${drawing.toRow}</xdr:row><xdr:rowOff>${mmToEmu(drawing.toYMm)}</xdr:rowOff></xdr:to>${picture}<xdr:clientData/></xdr:twoCellAnchor>`
    }
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${drawing.col}</xdr:col><xdr:colOff>${mmToEmu(drawing.xMm)}</xdr:colOff><xdr:row>${drawing.row}</xdr:row><xdr:rowOff>${mmToEmu(drawing.yMm)}</xdr:rowOff></xdr:from><xdr:ext cx="${mmToEmu(dimensions.widthMm)}" cy="${mmToEmu(dimensions.heightMm)}"/>${picture}<xdr:clientData/></xdr:oneCellAnchor>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`
}

function drawingRelationships(sheet: SheetBuilder) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${sheet.drawings.map((drawing, index) => `<Relationship Id="rId${index + 1}" Type="${REL_IMAGE}" Target="../${drawing.target}"/>`).join('')}</Relationships>`
}

function worksheetRelationships(drawingId: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId2" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingId}.xml"/></Relationships>`
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
      bytes: encoder.encode(worksheetXml(sheet.builder, 'rId2', sheet.builder.drawings.length > 0)),
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
