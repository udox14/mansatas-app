import { NextResponse } from 'next/server'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { deflateSync, inflateSync } from 'node:zlib'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PT_PER_MM = 72 / 25.4

function mm(value: number) {
  return value * PT_PER_MM
}

function y(topMm: number) {
  return PAGE_HEIGHT - mm(topMm)
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID').format(value || 0)
}

const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
]

function ucap(n: number): string {
  if (n === 0) return ''
  if (n < 20) return SATUAN[n]
  if (n < 100) {
    const puluhan = Math.floor(n / 10)
    const satuan = n % 10
    return (puluhan === 1 ? 'se' : SATUAN[puluhan]) + 'puluh' + (satuan ? ' ' + SATUAN[satuan] : '')
  }
  const ratus = Math.floor(n / 100)
  const sisa = n % 100
  return (ratus === 1 ? 'se' : SATUAN[ratus]) + 'ratus' + (sisa ? ' ' + ucap(sisa) : '')
}

function terbilang(angka: number): string {
  if (angka === 0) return 'Nol'
  const groups = [
    { nilai: 1_000_000_000, label: 'miliar' },
    { nilai: 1_000_000, label: 'juta' },
    { nilai: 1_000, label: 'ribu' },
  ]
  let sisa = Math.round(angka)
  const parts: string[] = []
  for (const group of groups) {
    if (sisa >= group.nilai) {
      const qty = Math.floor(sisa / group.nilai)
      parts.push(group.nilai === 1_000 && qty === 1 ? 'seribu' : `${ucap(qty)} ${group.label}`)
      sisa %= group.nilai
    }
  }
  if (sisa > 0) parts.push(ucap(sisa))
  const result = parts.join(' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function pdfText(value: unknown) {
  return String(value ?? '-')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function safeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'kuitansi'
}

function kelasLabel(row: any) {
  const parts = [row.tingkat, row.nomor_kelas, row.kelompok].filter(Boolean)
  return parts.length ? parts.join(' ') : '-'
}

function tanggalIndonesia(value: string) {
  const date = new Date(String(value || '').replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value || '-').split(' ')[0] || '-'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

type PdfObjectBody = string | Uint8Array

function ascii(value: string) {
  return new TextEncoder().encode(value)
}

function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function buildPdf(objects: PdfObjectBody[]) {
  const chunks: Uint8Array[] = [ascii('%PDF-1.4\n')]
  const offsets: number[] = [0]
  let length = chunks[0].length

  objects.forEach((body, index) => {
    offsets[index + 1] = length
    const objectChunks = [
      ascii(`${index + 1} 0 obj\n`),
      typeof body === 'string' ? ascii(body) : body,
      ascii('\nendobj\n'),
    ]
    const object = concatBytes(objectChunks)
    chunks.push(object)
    length += object.length
  })

  const xrefOffset = length
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join('')

  chunks.push(ascii(xref))
  return concatBytes(chunks)
}

function readUInt32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function parsePngForPdf(bytes: Uint8Array) {
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Uint8Array[] = []

  while (offset < bytes.length) {
    const length = readUInt32(bytes, offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    const data = bytes.slice(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = readUInt32(data, 0)
      height = readUInt32(data, 4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error('Format kopkomite.png harus PNG RGBA 8-bit.')
  }

  const raw = inflateSync(concatBytes(idat))
  const channels = 4
  const stride = width * channels
  const rgba = new Uint8Array(width * height * channels)
  let src = 0

  for (let row = 0; row < height; row++) {
    const filter = raw[src++]
    const rowStart = row * stride
    const prevStart = row === 0 ? -1 : (row - 1) * stride
    for (let col = 0; col < stride; col++) {
      const x = raw[src++]
      const left = col >= channels ? rgba[rowStart + col - channels] : 0
      const up = prevStart >= 0 ? rgba[prevStart + col] : 0
      const upLeft = prevStart >= 0 && col >= channels ? rgba[prevStart + col - channels] : 0
      let value = x
      if (filter === 1) value = (x + left) & 255
      else if (filter === 2) value = (x + up) & 255
      else if (filter === 3) value = (x + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) value = (x + paeth(left, up, upLeft)) & 255
      rgba[rowStart + col] = value
    }
  }

  const rgb = new Uint8Array(width * height * 3)
  const alpha = new Uint8Array(width * height)
  for (let i = 0, p = 0, a = 0; i < rgba.length; i += 4) {
    rgb[p++] = rgba[i]
    rgb[p++] = rgba[i + 1]
    rgb[p++] = rgba[i + 2]
    alpha[a++] = rgba[i + 3]
  }

  return {
    width,
    height,
    rgb: deflateSync(rgb),
    alpha: deflateSync(alpha),
  }
}

function imageStreamObject(dict: string, bytes: Uint8Array) {
  return concatBytes([
    ascii(`<< ${dict} /Length ${bytes.length} >>\nstream\n`),
    bytes,
    ascii('\nendstream'),
  ])
}

function drawReceiptPdf(data: {
  nomorKuitansi: string
  tanggal: string
  kategori: string
  metodeBayar: string
  jumlah: number
  namaSiswa: string
  nisn: string
  kelas: string
  petugas: string
  rincian: Array<{ label: string; jumlah: number }>
  sisaTunggakan: number | null
}, kopPng: Uint8Array) {
  const kop = parsePngForPdf(kopPng)
  const ops: string[] = []
  const text = (value: string, xPt: number, yPt: number, size = 10, font = 'F1', gray = 0) => {
    ops.push(`q ${gray} g BT /${font} ${size} Tf ${xPt.toFixed(2)} ${yPt.toFixed(2)} Td (${pdfText(value)}) Tj ET Q`)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
    ops.push(`q 0 G ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`)
  }
  const rect = (xPt: number, yPt: number, wPt: number, hPt: number, mode: 'S' | 'f' = 'S', gray = 0) => {
    ops.push(`q ${gray} ${mode === 'S' ? 'G' : 'g'} ${xPt.toFixed(2)} ${yPt.toFixed(2)} ${wPt.toFixed(2)} ${hPt.toFixed(2)} re ${mode} Q`)
  }
  const textRight = (value: string, rightPt: number, yPt: number, size = 10, font = 'F1', gray = 0) => {
    const approxWidth = pdfText(value).length * size * 0.5
    text(value, rightPt - approxWidth, yPt, size, font, gray)
  }

  const left = mm(10)
  const right = PAGE_WIDTH - mm(10)
  const center = PAGE_WIDTH / 2
  const kategori = data.kategori.toUpperCase()
  const metode = data.metodeBayar === 'tunai' ? 'Tunai' : 'Transfer Bank'
  const tanggalFmt = tanggalIndonesia(data.tanggal)

  rect(mm(8), y(289), PAGE_WIDTH - mm(16), mm(281), 'S', 0)
  rect(mm(9.2), y(287.8), PAGE_WIDTH - mm(18.4), mm(278.6), 'S', 0.65)
  ops.push(`q ${(right - left).toFixed(2)} 0 0 ${mm(23).toFixed(2)} ${left.toFixed(2)} ${y(30).toFixed(2)} cm /Kop Do Q`)
  line(left, y(32), right, y(32), 2)
  line(left, y(34), right, y(34), 0.6)

  rect(left + mm(2), y(45), mm(34), mm(6.5), 'S', 0.55)
  text('Lembar Pembayar', left + mm(5), y(42.9), 7, 'F1', 0.25)

  text('BUKTI PEMBAYARAN', right - mm(60), y(42), 13, 'F2')
  line(right - mm(60), y(43.8), right - mm(8), y(43.8), 1)
  text(`Pembayaran ${kategori} - Tahun Pelajaran 2024/2025`, right - mm(60), y(48), 7.5, 'F1', 0.35)

  const infoLeftX = left + mm(6)
  const infoRightX = left + mm(105)
  const infoTop = 63
  const rowGap = 6.4
  const info = (label: string, value: string, x: number, top: number, bold = false) => {
    text(label, x, y(top), 7.6, 'F1', 0.3)
    text(':', x + mm(27), y(top), 7.6)
    text(value, x + mm(31), y(top), 7.6, bold ? 'F2' : 'F1')
  }

  info('Nama Siswa', data.namaSiswa, infoLeftX, infoTop, true)
  info('NISN', data.nisn, infoLeftX, infoTop + rowGap)
  info('Kelas', data.kelas, infoLeftX, infoTop + rowGap * 2)
  info('No. Bukti', data.nomorKuitansi, infoRightX, infoTop, true)
  info('Tanggal', tanggalFmt, infoRightX, infoTop + rowGap)
  info('Metode', metode, infoRightX, infoTop + rowGap * 2)
  info('Petugas', data.petugas, infoRightX, infoTop + rowGap * 3)

  const terbilangTop = 95
  rect(left + mm(6), y(terbilangTop + 9), right - left - mm(12), mm(9), 'S', 0.65)
  text('Terbilang:', left + mm(10), y(terbilangTop + 5.2), 7.6, 'F1', 0.3)
  text(`${terbilang(data.jumlah)} Rupiah`, left + mm(31), y(terbilangTop + 5.2), 7.8, 'F2')

  const tableTop = 116
  const rowHeight = 8
  const tableLeft = left + mm(6)
  const tableRight = right - mm(6)
  rect(tableLeft, y(tableTop + rowHeight), tableRight - tableLeft, mm(rowHeight), 'S')
  text('No.', tableLeft + mm(4), y(tableTop + 4.5), 7.5, 'F2')
  text('Uraian Pembayaran', tableLeft + mm(18), y(tableTop + 4.5), 7.5, 'F2')
  text('Jumlah (Rp)', tableRight - mm(34), y(tableTop + 4.5), 7.5, 'F2')

  data.rincian.forEach((item, index) => {
    const top = tableTop + rowHeight * (index + 1)
    rect(tableLeft, y(top + rowHeight), tableRight - tableLeft, mm(rowHeight), 'S', 0.7)
    text(String(index + 1), tableLeft + mm(5), y(top + 4.4), 7.2)
    text(item.label, tableLeft + mm(18), y(top + 4.4), 7.2)
    textRight(rupiah(item.jumlah), tableRight - mm(5), y(top + 4.4), 7.2, 'F2')
  })

  const totalTop = tableTop + rowHeight * (data.rincian.length + 1)
  rect(tableLeft, y(totalTop + rowHeight), tableRight - tableLeft, mm(rowHeight), 'S', 0.82)
  text('TOTAL PEMBAYARAN INI', tableRight - mm(82), y(totalTop + 4.5), 7.5, 'F2')
  textRight(rupiah(data.jumlah), tableRight - mm(5), y(totalTop + 4.5), 7.6, 'F2')

  const jumlahTop = totalTop + 15
  text('JUMLAH', right - mm(76), y(jumlahTop), 7.6)
  text(':', right - mm(42), y(jumlahTop), 7.6)
  textRight(`Rp ${rupiah(data.jumlah)}`, right - mm(8), y(jumlahTop), 8.5, 'F2')
  text('PEMBAYARAN', right - mm(76), y(jumlahTop + 5.5), 7.6)
  text(':', right - mm(42), y(jumlahTop + 5.5), 7.6)
  textRight(`Rp ${rupiah(data.jumlah)}`, right - mm(8), y(jumlahTop + 5.5), 7.6)
  line(right - mm(78), y(jumlahTop + 8), right - mm(8), y(jumlahTop + 8), 0.7)
  text('KEMBALI', right - mm(76), y(jumlahTop + 11), 7.6, 'F2')
  text(':', right - mm(42), y(jumlahTop + 11), 7.6)
  textRight('Rp 0', right - mm(8), y(jumlahTop + 11), 7.6, 'F2')

  if (data.sisaTunggakan !== null && data.sisaTunggakan > 0) {
    rect(left + mm(6), y(jumlahTop + 24), mm(82), mm(7), 'S', 0.85)
    text(`Catatan: sisa tagihan ${kategori} Rp ${rupiah(data.sisaTunggakan)}`, left + mm(9), y(jumlahTop + 20), 7.2, 'F1', 0.25)
  }

  const ttdTop = 220
  text('Penyetor / Siswa', left + mm(36), y(ttdTop), 7.6)
  text(`Tasikmalaya, ${tanggalFmt}`, right - mm(70), y(ttdTop), 7.6)
  text('Bendahara Komite', right - mm(58), y(ttdTop + 5.5), 7.6)
  line(left + mm(24), y(ttdTop + 25), left + mm(87), y(ttdTop + 25), 0.7)
  line(right - mm(80), y(ttdTop + 25), right - mm(16), y(ttdTop + 25), 0.7)
  text(`( ${data.namaSiswa} )`, left + mm(29), y(ttdTop + 30), 7.6, 'F2')
  text(`( ${data.petugas} )`, right - mm(75), y(ttdTop + 30), 7.6, 'F2')

  text('LUNAS', center - mm(35), y(158), 42, 'F2', 0.82)

  line(left, y(282), right, y(282), 0.4)
  text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, left + mm(3), y(286), 6.5, 'F1', 0.45)
  text('Dokumen ini sah tanpa tanda tangan basah jika diunduh dari Portal Orang Tua', center - mm(61), y(286), 6.5, 'F1', 0.45)
  textRight(data.nomorKuitansi, right - mm(3), y(286), 6.5, 'F1', 0.45)

  const stream = ops.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Kop 6 0 R >> >> /Contents 8 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    imageStreamObject(`/Type /XObject /Subtype /Image /Width ${kop.width} /Height ${kop.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 7 0 R`, kop.rgb),
    imageStreamObject(`/Type /XObject /Subtype /Image /Width ${kop.width} /Height ${kop.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, kop.alpha),
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]

  return buildPdf(objects)
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession()
  if (!session || session.kind !== 'parent') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await context.params
  const db = await getDB()
  const transaksi = await db.prepare(`
    SELECT t.id, t.nomor_kuitansi, t.kategori, t.metode_bayar, t.jumlah_total, t.created_at,
           s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok,
           u.nama_lengkap AS nama_petugas
    FROM fin_transaksi t
    JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN "user" u ON u.id = t.input_oleh
    WHERE t.id = ? AND t.siswa_id = ? AND t.is_void = 0
    LIMIT 1
  `).bind(id, session.user.siswa_id).first<any>()

  if (!transaksi) {
    return new NextResponse('Kuitansi tidak ditemukan', { status: 404 })
  }

  const detailRows = await db.prepare(`
    SELECT d.ref_type, d.jumlah, st.bulan, st.tahun
    FROM fin_transaksi_detail d
    LEFT JOIN fin_spp_tagihan st ON st.id = d.ref_id
    WHERE d.transaksi_id = ?
    ORDER BY d.rowid ASC
  `).bind(id).all<any>()

  const kategori = String(transaksi.kategori || '').toLowerCase()
  const rincian = (detailRows.results || []).map((row: any) => {
    if (row.ref_type === 'spp_tagihan') {
      const bulan = row.bulan ? ` bulan ${row.bulan}` : ''
      const tahun = row.tahun ? ` ${row.tahun}` : ''
      return { label: `Pembayaran SPP${bulan}${tahun}`, jumlah: Number(row.jumlah || 0) }
    }
    if (row.ref_type === 'dspt') {
      return { label: 'DSPT - Dana Sumbangan Pendidikan Tahunan', jumlah: Number(row.jumlah || 0) }
    }
    return { label: `Pembayaran ${kategori.toUpperCase()}`, jumlah: Number(row.jumlah || 0) }
  })

  if (rincian.length === 0) {
    rincian.push({ label: `Pembayaran ${kategori.toUpperCase()}`, jumlah: Number(transaksi.jumlah_total || 0) })
  }

  let sisaTunggakan: number | null = null
  if (kategori === 'dspt') {
    const dspt = await db.prepare(`
      SELECT nominal_target, total_dibayar, total_diskon
      FROM fin_dspt
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(session.user.siswa_id).first<any>()
    if (dspt) {
      sisaTunggakan = Math.max(
        0,
        Number(dspt.nominal_target || 0) - Number(dspt.total_dibayar || 0) - Number(dspt.total_diskon || 0)
      )
    }
  }

  const kopResponse = await fetch(new URL('/kopkomite.png', _request.url))
  if (!kopResponse.ok) {
    return new NextResponse('Kop kuitansi tidak ditemukan', { status: 500 })
  }

  const bytes = drawReceiptPdf({
    nomorKuitansi: transaksi.nomor_kuitansi || transaksi.id,
    tanggal: transaksi.created_at,
    kategori,
    metodeBayar: transaksi.metode_bayar,
    jumlah: Number(transaksi.jumlah_total || 0),
    namaSiswa: transaksi.nama_lengkap || '-',
    nisn: transaksi.nisn || '-',
    kelas: kelasLabel(transaksi),
    petugas: transaksi.nama_petugas || 'Bendahara Komite',
    rincian,
    sisaTunggakan,
  }, new Uint8Array(await kopResponse.arrayBuffer()))

  const filename = `${safeFileSegment(transaksi.nomor_kuitansi || transaksi.id)}.pdf`
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
