import { NextResponse } from 'next/server'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'

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

function buildPdf(objects: string[]) {
  const chunks: string[] = ['%PDF-1.4\n']
  const offsets: number[] = [0]
  let length = chunks[0].length

  objects.forEach((body, index) => {
    offsets[index + 1] = length
    const object = `${index + 1} 0 obj\n${body}\nendobj\n`
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

  return new TextEncoder().encode(chunks.join('') + xref)
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
}) {
  const ops: string[] = []
  const text = (value: string, xPt: number, yPt: number, size = 10, font = 'F1') => {
    ops.push(`BT /${font} ${size} Tf ${xPt.toFixed(2)} ${yPt.toFixed(2)} Td (${pdfText(value)}) Tj ET`)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
    ops.push(`${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
  }
  const rect = (xPt: number, yPt: number, wPt: number, hPt: number, mode: 'S' | 'f' = 'S') => {
    ops.push(`${xPt.toFixed(2)} ${yPt.toFixed(2)} ${wPt.toFixed(2)} ${hPt.toFixed(2)} re ${mode}`)
  }

  const left = mm(18)
  const right = PAGE_WIDTH - mm(18)
  const center = PAGE_WIDTH / 2
  const kategori = data.kategori.toUpperCase()
  const metode = data.metodeBayar === 'tunai' ? 'Tunai' : 'Transfer Bank'
  const tanggalFmt = tanggalIndonesia(data.tanggal)

  text('KOMITE MAN 1 TASIKMALAYA', center - mm(40), y(18), 15, 'F2')
  text('Jl. Pendidikan No. 31, Kota Tasikmalaya', center - mm(34), y(25), 9)
  text('BUKTI PEMBAYARAN', center - mm(27), y(37), 16, 'F2')
  text(`Pembayaran ${kategori} - Pegangan Pembayar`, center - mm(33), y(44), 9)
  line(left, y(50), right, y(50), 1.4)
  line(left, y(52), right, y(52), 0.4)

  rect(left, y(66), mm(38), mm(8), 'S')
  text('Lembar Pembayar', left + mm(4), y(63.7), 8)

  const infoLeftX = left
  const infoRightX = left + mm(93)
  const infoTop = 76
  const rowGap = 7
  const info = (label: string, value: string, x: number, top: number, bold = false) => {
    text(label, x, y(top), 8)
    text(':', x + mm(28), y(top), 8)
    text(value, x + mm(32), y(top), 8, bold ? 'F2' : 'F1')
  }

  info('Nama Siswa', data.namaSiswa, infoLeftX, infoTop, true)
  info('NISN', data.nisn, infoLeftX, infoTop + rowGap)
  info('Kelas', data.kelas, infoLeftX, infoTop + rowGap * 2)
  info('No. Bukti', data.nomorKuitansi, infoRightX, infoTop, true)
  info('Tanggal', tanggalFmt, infoRightX, infoTop + rowGap)
  info('Metode', metode, infoRightX, infoTop + rowGap * 2)
  info('Petugas', data.petugas, infoRightX, infoTop + rowGap * 3)

  const terbilangTop = 110
  rect(left, y(terbilangTop + 10), right - left, mm(10), 'S')
  text('Terbilang:', left + mm(4), y(terbilangTop + 6.4), 8)
  text(`${terbilang(data.jumlah)} Rupiah`, left + mm(25), y(terbilangTop + 6.4), 8, 'F2')

  const tableTop = 128
  const rowHeight = 9
  rect(left, y(tableTop + rowHeight), right - left, mm(rowHeight), 'S')
  text('No.', left + mm(4), y(tableTop + 6), 8, 'F2')
  text('Uraian Pembayaran', left + mm(18), y(tableTop + 6), 8, 'F2')
  text('Jumlah (Rp)', right - mm(35), y(tableTop + 6), 8, 'F2')

  data.rincian.forEach((item, index) => {
    const top = tableTop + rowHeight * (index + 1)
    rect(left, y(top + rowHeight), right - left, mm(rowHeight), 'S')
    text(String(index + 1), left + mm(5), y(top + 6), 8)
    text(item.label, left + mm(18), y(top + 6), 8)
    text(rupiah(item.jumlah), right - mm(33), y(top + 6), 8, 'F2')
  })

  const totalTop = tableTop + rowHeight * (data.rincian.length + 1)
  rect(left, y(totalTop + rowHeight), right - left, mm(rowHeight), 'S')
  text('TOTAL PEMBAYARAN INI', right - mm(84), y(totalTop + 6), 8, 'F2')
  text(rupiah(data.jumlah), right - mm(33), y(totalTop + 6), 8, 'F2')

  const jumlahTop = totalTop + 20
  text('JUMLAH', right - mm(70), y(jumlahTop), 8)
  text(':', right - mm(34), y(jumlahTop), 8)
  text(`Rp ${rupiah(data.jumlah)}`, right - mm(28), y(jumlahTop), 9, 'F2')
  text('PEMBAYARAN', right - mm(70), y(jumlahTop + 7), 8)
  text(':', right - mm(34), y(jumlahTop + 7), 8)
  text(`Rp ${rupiah(data.jumlah)}`, right - mm(28), y(jumlahTop + 7), 8)

  if (data.sisaTunggakan !== null && data.sisaTunggakan > 0) {
    text(`Catatan: sisa tagihan ${kategori} Rp ${rupiah(data.sisaTunggakan)}`, left, y(jumlahTop + 18), 8)
  }

  const ttdTop = 205
  text('Penyetor / Siswa', left + mm(28), y(ttdTop), 8)
  text(`Tasikmalaya, ${tanggalFmt}`, right - mm(65), y(ttdTop), 8)
  text('Bendahara Komite', right - mm(55), y(ttdTop + 8), 8)
  line(left + mm(13), y(ttdTop + 35), left + mm(82), y(ttdTop + 35), 0.7)
  line(right - mm(78), y(ttdTop + 35), right - mm(10), y(ttdTop + 35), 0.7)
  text(`( ${data.namaSiswa} )`, left + mm(18), y(ttdTop + 42), 8, 'F2')
  text(`( ${data.petugas} )`, right - mm(73), y(ttdTop + 42), 8, 'F2')

  text('Dokumen ini sah sebagai kuitansi pegangan pembayar jika diunduh dari Portal Orang Tua.', left, y(282), 7)
  text(data.nomorKuitansi, right - mm(38), y(282), 7)

  const stream = ops.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
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
  })

  const filename = `${safeFileSegment(transaksi.nomor_kuitansi || transaksi.id)}.pdf`
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
