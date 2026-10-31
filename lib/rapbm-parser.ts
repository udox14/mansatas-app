import * as XLSX from 'xlsx'
import { RAPBM_MAX_BYTES, RapbmValidationError, type RapbmAmounts, type RapbmDocument, type RapbmGroup, type RapbmNote } from './rapbm'

// Inspect ZIP metadata before decompression. The source is an XLSX, not a generic
// SheetJS-supported file renamed to .xlsx. No workbook code is ever executed.
export function validateRapbmContainer(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > RAPBM_MAX_BYTES) throw new RapbmValidationError('Ukuran Excel harus antara 1 byte dan 6 MB.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new RapbmValidationError('File bukan XLSX yang valid atau masih terenkripsi.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  let expanded = 0
  const names = new Set<string>()
  if (!count || count > 1000 || offset >= end) throw new RapbmValidationError('Struktur Excel terlalu besar atau tidak didukung.')
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new RapbmValidationError('Struktur XLSX rusak.')
    expanded += view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    if (next > end || expanded > 32 * 1024 * 1024 || (view.getUint16(offset + 8, true) & 1)) throw new RapbmValidationError('Excel terlalu besar setelah dibuka atau terenkripsi.')
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (/vbaproject\.bin$/i.test(name)) throw new RapbmValidationError('Gunakan XLSX tanpa makro.')
    names.add(name)
    offset = next
  }
  if (!names.has('xl/workbook.xml') || !names.has('[Content_Types].xml')) throw new RapbmValidationError('File harus berupa workbook XLSX.')
}

export function parseRapbm(bytes: Uint8Array): RapbmDocument {
  validateRapbmContainer(bytes)
  let workbook: { SheetNames: string[]; Sheets: Record<string, any> }
  try {
    workbook = XLSX.read(new Uint8Array(bytes), { type: 'array', cellFormula: true, cellText: false, cellHTML: false, bookVBA: false, sheetRows: 2001 })
  } catch { throw new RapbmValidationError('Excel tidak dapat dibaca. Simpan ulang sebagai XLSX lalu coba kembali.') }
  // Exactly one RAPBM sheet; cover sheets can be present but are never guessed.
  const sheets = workbook.SheetNames.filter(name => /RAPBM/i.test(String(workbook.Sheets[name]?.B1?.v || '')))
  if (sheets.length !== 1) throw new RapbmValidationError('Harus ada tepat satu lembar RAPBM dengan judul RAPBM di B1, sesuai format contoh.')
  const sheet = sheets[0]
  const ws = workbook.Sheets[sheet]
  const range = XLSX.utils.decode_range(ws['!fullref'] || ws['!ref'] || 'A1')
  if (range.e.r >= 2000 || range.e.c > 30) throw new RapbmValidationError('RAPBM maksimal 2.000 baris dan 31 kolom.')
  const text = (col: string, row: number) => String(ws[`${col}${row}`]?.v ?? '').trim()
  const reference = (cell: string) => `${sheet}!${cell}`
  const notes: RapbmNote[] = []
  const amount = (col: string, row: number) => {
    const cell = ws[`${col}${row}`]
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return null
    if (cell.t !== 'n' || !Number.isSafeInteger(cell.v) || Number(cell.v) < 0) throw new RapbmValidationError(`${reference(`${col}${row}`)}: nominal harus angka rupiah utuh, tidak negatif, dan dapat dibaca.`)
    return Number(cell.v)
  }
  const check = (cell: string, label: string, source: number | null, values: (number | null)[]) => {
    let sum = 0
    for (const value of values) {
      sum += value ?? 0
      if (!Number.isSafeInteger(sum)) throw new RapbmValidationError(`${reference(cell)}: jumlah melebihi batas nominal yang didukung.`)
    }
    if (source === null || source !== sum) notes.push({ reference: reference(cell), message: label, source, calculated: sum })
  }
  const knownTotal = (values: (number | null)[]) => {
    if (!values.length || values.some(value=>value===null)) return null
    const total=values.reduce<number>((sum,value)=>sum+(value??0),0)
    if (!Number.isSafeInteger(total)) throw new RapbmValidationError('Jumlah pendapatan melebihi batas nominal yang didukung.')
    return total
  }
  const amounts = (row: number, expense: boolean, incomeSource?: 'apbn' | 'komite'): RapbmAmounts => expense
    ? { apbn: amount('H', row), komite: amount('I', row), total: amount('J', row) }
    : { apbn: incomeSource === 'apbn' ? amount('H', row) : null, komite: incomeSource === 'komite' ? amount('H', row) : null, total: amount('H', row) }
  const yearMatch = text('B', 3).match(/^TAHUN\s+(\d{4})$/i)
  if (!yearMatch || Number(yearMatch[1]) < 2000 || Number(yearMatch[1]) > 2199) throw new RapbmValidationError('Tahun anggaran di B3 tidak dikenali. Gunakan TAHUN 2026 atau tahun anggaran yang sesuai.')
  if (!/RENCANA\s+PENDAPATAN/i.test(text('C', 5)) || !/AKUN/i.test(text('C', 6)) || !/JUMLAH/i.test(text('H', 6))) throw new RapbmValidationError('Kolom pendapatan tidak sesuai format RAPBM contoh.')
  const income: RapbmGroup[] = [], expenses: RapbmGroup[] = []
  let section: 'income' | 'expense' = 'income'
  let expenseDetailsStart = 0
  let group: RapbmGroup | null = null
  let source: 'apbn' | 'komite' = 'apbn'
  let incomeTotal: RapbmAmounts | null = null, expenseTotal: RapbmAmounts | null = null
  const completeGroup = () => {
    if (group && (!group.subtotalReference || !group.items.length)) throw new RapbmValidationError(`${group.reference}: kelompok harus memiliki rincian dan baris JUMLAH SUB.`)
  }
  for (let row = 9; row <= range.e.r + 1; row++) {
    const b = text('B', row), c = text('C', row), d = text('D', row), e = text('E', row)
    if (/RENCANA\s+BELANJA/i.test(c)) {
      completeGroup()
      if (!incomeTotal || text('H', row + 2).toUpperCase() !== 'APBN' || text('I', row + 2).toUpperCase() !== 'KOMITE' || !/JUMLAH/i.test(text('J', row + 1))) throw new RapbmValidationError('Kolom belanja APBN/Komite/Jumlah tidak sesuai format contoh.')
      section = 'expense'; expenseDetailsStart = row + 4; group = null; continue
    }
    if (section === 'expense' && row < expenseDetailsStart) continue
    if (section === 'income' && /^Total\s+Pendapatan$/i.test(b)) {
      completeGroup()
      const apbn = income.filter(g => /APBN/i.test(g.label)).map(g => g.amounts.total)
      const komite = income.filter(g => /KOMITE/i.test(g.label)).map(g => g.amounts.total)
      incomeTotal = { apbn: knownTotal(apbn), komite: knownTotal(komite), total: amount('H',row) }
      check(`H${row}`, 'Total pendapatan berbeda dari penjumlahan subtotal sumber dana.', incomeTotal.total, income.map(g => g.amounts.total))
      continue
    }
    if (section === 'expense' && /^jumlah$/i.test(b)) {
      completeGroup()
      expenseTotal = amounts(row,true)
      for (const [key,col] of [['apbn','H'],['komite','I'],['total','J']] as const) {
        check(`${col}${row}`, `Total belanja ${key === 'total' ? 'keseluruhan' : key.toUpperCase()} berbeda dari penjumlahan rincian.`, expenseTotal[key], expenses.flatMap(g => g.items.map(i => i.amounts[key])))
      }
      break
    }
    // Accounts such as 522111 can occupy B on detail rows; only a numbered row
    // without an item description starts a group. Account codes are not IDs.
    if (/^\d+$/.test(b) && Number(b) < 1000 && !e && (section === 'income' ? c : d)) {
      completeGroup()
      const label = section === 'income' ? c : d
      if (section === 'income') {
        if (/APBN/i.test(label)) source = 'apbn'
        else if (/KOMITE/i.test(label)) source = 'komite'
        else throw new RapbmValidationError(`${reference(`C${row}`)}: sumber pendapatan harus APBN atau KOMITE.`)
      }
      group = { order: Number(b), label, account: section === 'expense' ? c || null : null, reference: reference(`B${row}:J${row}`), subtotalReference: null, amounts: {apbn:null,komite:null,total:null}, items: [] }
      ;(section === 'income' ? income : expenses).push(group)
      continue
    }
    if (/^JUMLAH\s+SUB$/i.test(section === 'income' ? b : d)) {
      if (!group || group.subtotalReference) throw new RapbmValidationError(`${reference(`B${row}`)}: subtotal tanpa kelompok yang sesuai.`)
      group.subtotalReference = reference(`H${row}:${section === 'income' ? 'H' : 'J'}${row}`)
      group.amounts = amounts(row,section === 'expense',source)
      const cols = section === 'expense' ? [['apbn','H'],['komite','I'],['total','J']] as const : [['total','H']] as const
      for (const [key,col] of cols) check(`${col}${row}`, `Subtotal ${group.label} (${key === 'total' ? 'Jumlah' : key.toUpperCase()}) berbeda dari rincian.`,group.amounts[key],group.items.map(i => i.amounts[key]))
      continue
    }
    const description = section === 'income' ? d : e
    if (description) {
      if (!group || group.subtotalReference) {
        throw new RapbmValidationError(`${reference(`E${row}`)}: rincian berada di luar kelompok anggaran.`)
      }
      const values = amounts(row,section === 'expense',source)
      if (section === 'expense') check(`J${row}`, `${description}: jumlah berbeda atau kosong dibanding APBN + Komite.`, values.total,[values.apbn,values.komite])
      else if (values.total===null) notes.push({reference:reference(`H${row}`),message:`${description}: nominal pendapatan pada dokumen kosong.`,source:null,calculated:null})
      group.items.push({ order: group.items.length+1, description, account: section === 'expense' ? (/^\d{6}$/.test(b) ? b : group.account) : null, volume: text('F',row) || null, unit: text('G',row) || null, reference: reference(`${section === 'income' ? 'D' : 'E'}${row}:J${row}`), amounts: values })
    } else if ((section === 'income' ? ['H'] : ['H','I','J']).some(col=>text(col,row)!=='')) {
      throw new RapbmValidationError(`${reference(`E${row}`)}: ada nominal tanpa uraian atau subtotal yang dikenali.`)
    }
  }
  if (!income.length || !expenses.length || !incomeTotal || !expenseTotal) throw new RapbmValidationError('Pendapatan, belanja, atau total RAPBM tidak lengkap.')
  return { year:Number(yearMatch[1]),title:text('B',1),institution:text('B',2),sheet,income,expenses,incomeTotal,expenseTotal,notes }
}
