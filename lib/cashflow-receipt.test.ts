import { describe, expect, it } from 'vitest'
import {
  buildCashflowReceiptHtml,
  parseReceiptOptionsFromUrl,
  type CashflowReceiptData,
} from '@/lib/cashflow-receipt'
import { terbilang } from '@/lib/terbilang'

const sampleData: CashflowReceiptData = {
  sourceKind: 'cashflow',
  referenceId: 'cf-001',
  tahunAnggaran: '2026',
  nomorBukti: 'KK-202611-0014',
  sumberDanaText: 'Angkatan 2026',
  akunPosText: '522111 · Belanja Langganan Listrik',
  metodeBayar: 'Tunai',
  nomorSpb: null,
  kategoriKas: 'Pengembangan Standar Pembiayaan',
  kepada: 'PT PLN PERSERO',
  jumlah: 659000,
  uraian: 'Pembayaran Token Listrik Bulan November 2026',
  tanggalIso: '2026-11-12',
  isRealized: true,
  ketuaKomiteName: 'H. Ahmad Suryana, S.Ag.',
  bendaharaKomiteName: 'Hj. Siti Rahmawati, S.Pd.',
  allocations: [{ source: '2026', account: '522111', label: 'Belanja Langganan Listrik', amount: 659000 }],
  items: [{ urutan: 1, uraian: 'Pembayaran Token Listrik Bulan November 2026', penerimaPenyedia: 'PT PLN PERSERO', jumlah: 659000 }],
}

describe('terbilang Indonesian spacing', () => {
  it('formats hundreds and tens with standard spaces while keeping seratus/sepuluh/seribu', () => {
    expect(terbilang(659000)).toBe('Enam ratus lima puluh sembilan ribu')
    expect(terbilang(111000)).toBe('Seratus sebelas ribu')
    expect(terbilang(1010500)).toBe('Satu juta sepuluh ribu lima ratus')
    expect(terbilang(1000)).toBe('Seribu')
  })
})

describe('parseReceiptOptionsFromUrl', () => {
  it('uses defaults when query parameters are omitted and respects explicit overrides', () => {
    expect(parseReceiptOptionsFromUrl('https://example.test/api/x', false)).toEqual({
      includeGoodsReceipt: true,
      includeAttachment: false,
    })
    expect(parseReceiptOptionsFromUrl('https://example.test/api/x', true)).toEqual({
      includeGoodsReceipt: true,
      includeAttachment: true,
    })
    expect(parseReceiptOptionsFromUrl('https://example.test/api/x?goodsReceipt=0&attachment=1', false)).toEqual({
      includeGoodsReceipt: false,
      includeAttachment: true,
    })
  })
})

describe('buildCashflowReceiptHtml', () => {
  it('renders a 1-page SPB-styled receipt without cents and with goods receipt block when enabled', () => {
    const html = buildCashflowReceiptHtml(sampleData, 'data:image/png;base64,AAA', {
      includeGoodsReceipt: true,
      includeAttachment: false,
    })
    expect(html.match(/<section class="page">/g)).toHaveLength(1)
    expect(html).toContain('Kuitansi / Bukti Pembayaran')
    expect(html).toContain('KK-202611-0014')
    expect(html).toContain('659.000')
    expect(html).not.toContain('659.000,00')
    expect(html).toContain('Enam Ratus Lima Puluh Sembilan Ribu Rupiah')
    expect(html).toContain('Bendahara Komite MAN 1 Tasikmalaya')
    expect(html).toContain('12 November 2026')
    expect(html).toContain('H. Ahmad Suryana, S.Ag.')
    expect(html).toContain('Hj. Siti Rahmawati, S.Pd.')
    expect(html).toContain('Barang/pekerjaan tersebut telah diterima/diselesaikan dengan lengkap dan baik')
    expect(html).not.toContain('Lampiran Kuitansi')
  })

  it('omits goods receipt block when unchecked and renders page 2 Lampiran Kuitansi when enabled', () => {
    const spbData: CashflowReceiptData = {
      ...sampleData,
      sourceKind: 'pengajuan',
      nomorSpb: '042/SPB-KMT/XI/2026',
      jumlah: 1800000,
      items: [
        { urutan: 1, uraian: 'Konsumsi panitia', penerimaPenyedia: 'Catering A', jumlah: 1000000 },
        { urutan: 2, uraian: 'Piala & piagam', penerimaPenyedia: 'Toko B', jumlah: 800000 },
      ],
    }
    const html = buildCashflowReceiptHtml(spbData, 'data:image/png;base64,AAA', {
      includeGoodsReceipt: false,
      includeAttachment: true,
    })
    expect(html.match(/<section class="page">/g)).toHaveLength(2)
    expect(html).not.toContain('Barang/pekerjaan tersebut telah diterima')
    expect(html).toContain('Lampiran Kuitansi')
    expect(html).toContain('042/SPB-KMT/XI/2026')
    expect(html).toContain('Konsumsi panitia')
    expect(html).toContain('Piala &amp; piagam')
    expect(html).toContain('Halaman 1 dari 2')
    expect(html).toContain('Halaman 2 dari 2')
  })

  it('escapes HTML special characters and renders blank lines when optional names/date are missing', () => {
    const html = buildCashflowReceiptHtml({
      ...sampleData,
      kepada: '',
      ketuaKomiteName: '',
      bendaharaKomiteName: '',
      tanggalIso: null,
      uraian: 'Belanja <script>alert(1)</script> & "ATK"',
    }, 'data:image/png;base64,AAA', {
      includeGoodsReceipt: false,
      includeAttachment: false,
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;ATK&quot;')
    expect(html).toContain('( ............................................ )')
    expect(html).toContain('Tasikmalaya, ................................')
  })
})
