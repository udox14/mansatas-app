'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  FileText,
  Printer,
  ReceiptText,
  Search,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatRupiah } from '@/lib/utils'
import { dateInputWIB, formatDateTimeWIB, formatDateWIB, todayWIB } from '@/lib/time'

interface RekapAngkatan {
  tahun_masuk: number
  total_siswa: number
  dspt_lunas: number
  dspt_nyicil: number
  dspt_belum: number
  dspt_target: number
  dspt_dibayar: number
  dspt_diskon: number
}

interface TransaksiRow {
  id: string
  nomor_kuitansi: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  kelas: string | null
  kategori: string
  metode_bayar: string
  jumlah_total: number
  is_void: number
  void_alasan: string | null
  created_at: string
  nama_input: string | null
  rincian: string | null
}

interface KasKeluarRow {
  id: string
  tanggal: string
  created_at: string
  jumlah: number
  keterangan: string
  kategori: string | null
  metode: string
  nama_input: string | null
}

interface TunggakanRow {
  jenis: string
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  kelas: string | null
  nominal: number
  dibayar: number
  diskon: number
  sisa: number
  status: string
  updated_at: string
}

type MateriKey = 'ringkasan' | 'arusKas' | 'angkatan'

interface LaporanClientProps {
  rekapAngkatan: RekapAngkatan[]
  transaksi: TransaksiRow[]
  kasKeluar: KasKeluarRow[]
  tunggakan: TunggakanRow[]
}

const KATEGORI_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp: 'SPP Tunggakan',
}

const TUNGGAKAN_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp_tunggakan_awal: 'SPP Tunggakan Terdahulu',
}

function todayInput() {
  return todayWIB()
}

function firstDayOfMonthInput() {
  return `${todayWIB().slice(0, 8)}01`
}

function dateOnly(value: string) {
  return dateInputWIB(value)
}

function formatTanggal(value: string) {
  return formatDateWIB(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTanggalJam(value: string) {
  return formatDateTimeWIB(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sumBy<T>(rows: T[], picker: (row: T) => number) {
  return rows.reduce((sum, row) => sum + picker(row), 0)
}

export function LaporanClient({ rekapAngkatan, transaksi, kasKeluar, tunggakan }: LaporanClientProps) {
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  const printRef = useRef<HTMLElement>(null)
  const [tanggalAwal, setTanggalAwal] = useState(firstDayOfMonthInput())
  const [tanggalAkhir, setTanggalAkhir] = useState(todayInput())
  const [kategori, setKategori] = useState('semua')
  const [metodeBayar, setMetodeBayar] = useState('semua')
  const [search, setSearch] = useState('')
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [judul, setJudul] = useState('Laporan Keuangan Madrasah')
  const [format, setFormat] = useState<'ringkas' | 'detail'>('detail')
  const [orientasi, setOrientasi] = useState<'portrait' | 'landscape'>('portrait')
  const [penandaTangan, setPenandaTangan] = useState('Bendahara Komite')
  const [printAngkatan, setPrintAngkatan] = useState('semua')
  const [materi, setMateri] = useState<Record<MateriKey, boolean>>({
    ringkasan: true,
    arusKas: true,
    angkatan: true,
  })

  const transaksiPeriode = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transaksi.filter(row => {
      const tanggal = dateOnly(row.created_at)
      const matchTanggal = tanggal >= tanggalAwal && tanggal <= tanggalAkhir
      const matchKategori = kategori === 'semua' || row.kategori === kategori
      const matchMetode = metodeBayar === 'semua'
        || (metodeBayar === 'tunai'
          ? row.metode_bayar === 'tunai'
          : row.metode_bayar === 'transfer' || row.metode_bayar === 'qris')
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || (row.nomor_kuitansi ?? '').toLowerCase().includes(term)
      return matchTanggal && matchKategori && matchMetode && matchSearch
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaksi, tanggalAwal, tanggalAkhir, kategori, metodeBayar, search])

  const kasKeluarPeriode = useMemo(() => {
    return kasKeluar.filter(row => {
      const matchTanggal = row.tanggal >= tanggalAwal && row.tanggal <= tanggalAkhir
      const matchMetode = metodeBayar === 'semua'
        || (metodeBayar === 'tunai'
          ? row.metode === 'tunai'
          : row.metode === 'transfer' || row.metode === 'qris')
      return matchTanggal && matchMetode
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kasKeluar, tanggalAwal, tanggalAkhir, metodeBayar])

  const tunggakanFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tunggakan.filter(row => {
      const matchKategori = kategori === 'semua'
        || (kategori === 'spp' ? row.jenis === 'spp_tunggakan_awal' : row.jenis === kategori)
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || String(row.tahun_masuk ?? '').includes(term)
      return matchKategori && matchSearch
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunggakan, kategori, search])

  const transaksiAktif = transaksiPeriode.filter(row => !row.is_void)
  const pemasukan = sumBy(transaksiAktif, row => row.jumlah_total)
  const pengeluaran = sumBy(kasKeluarPeriode, row => row.jumlah)
  const saldo = pemasukan - pengeluaran
  const totalTunggakan = sumBy(tunggakanFiltered, row => row.sisa)

  const angkatanOptions = rekapAngkatan.map(r => r.tahun_masuk).sort((a, b) => b - a)
  const rekapAngkatanPrint = printAngkatan === 'semua'
    ? rekapAngkatan
    : rekapAngkatan.filter(r => r.tahun_masuk === Number(printAngkatan))
  const pemasukanPrint = printAngkatan === 'semua'
    ? pemasukan
    : sumBy(transaksiAktif.filter(r => r.tahun_masuk === Number(printAngkatan)), r => r.jumlah_total)
  const saldoPrint = pemasukanPrint - pengeluaran

  const kategoriSummary = ['dspt', 'spp'].map(key => ({
    key,
    label: KATEGORI_LABEL[key],
    total: sumBy(transaksiAktif.filter(row => row.kategori === key), row => row.jumlah_total),
    count: transaksiAktif.filter(row => row.kategori === key).length,
  }))

  const toggleMateri = (key: MateriKey) => {
    setMateri(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const periodeLabel = `${formatTanggal(tanggalAwal)} - ${formatTanggal(tanggalAkhir)}`
  const isDetail = format === 'detail'
  const materiOptions: Array<readonly [MateriKey, string]> = [
    ['ringkasan', 'Ringkasan'],
    ['arusKas', 'Arus Kas'],
    ['angkatan', 'Rekap Angkatan'],
  ]
  const printPageStyle = `
    @page { size: A4 ${orientasi}; margin: 12mm; }
    @media print {
      html, body {
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-area {
        display: block !important;
        position: static !important;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
        color: #111827 !important;
      }
      .print-page {
        display: block !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: 0 !important;
        padding: 0 !important;
      }
      .print-section {
        break-inside: auto;
        page-break-inside: auto;
      }
      .print-section h2 {
        break-after: avoid;
        page-break-after: avoid;
      }
      .print-table {
        break-inside: auto;
        page-break-inside: auto;
      }
      .print-table thead {
        display: table-header-group;
      }
      .print-table tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${judul}-${periodeLabel}`,
    pageStyle: printPageStyle,
  })

  return (
    <div className="space-y-4 pb-8">
      <style>{`
        @media print {
          @page { size: A4 ${orientasi}; margin: 12mm; }
          html, body { width: auto !important; height: auto !important; overflow: visible !important; background: white !important; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { display: block !important; position: static !important; width: 100% !important; height: auto !important; overflow: visible !important; background: white !important; color: #111827 !important; }
          .no-print { display: none !important; }
          .print-page { display: block !important; height: auto !important; overflow: visible !important; box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          .print-break { break-before: page; }
          .print-section { break-inside: auto; page-break-inside: auto; }
          .print-section h2 { break-after: avoid; page-break-after: avoid; }
          .print-table { break-inside: auto; page-break-inside: auto; }
          .print-table thead { display: table-header-group; }
          .print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <section className="no-print space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryCard label="Pemasukan Periode" value={formatRupiah(pemasukan)} icon={ArrowUpRight} tone="emerald" />
          <SummaryCard label="Pengeluaran Periode" value={formatRupiah(pengeluaran)} icon={ArrowDownRight} tone="rose" />
          <SummaryCard label="Saldo Bersih" value={formatRupiah(saldo)} icon={BarChart3} tone={saldo >= 0 ? 'blue' : 'rose'} />
          <SummaryCard label="Total Tunggakan" value={formatRupiah(totalTunggakan)} icon={AlertTriangle} tone="amber" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-2 xl:grid-cols-[1fr_1fr_170px_150px_auto]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Tanggal Awal</label>
                <Input type="date" value={tanggalAwal} onChange={event => setTanggalAwal(event.target.value)} className="h-9" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Tanggal Akhir</label>
                <Input type="date" value={tanggalAkhir} onChange={event => setTanggalAkhir(event.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Cari Siswa / Kuitansi / Angkatan</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Cari laporan..."
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Sumber</label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Sumber</SelectItem>
                  <SelectItem value="dspt">DSPT</SelectItem>
                  <SelectItem value="spp">SPP Tunggakan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Metode</label>
              <Select value={metodeBayar} onValueChange={setMetodeBayar}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Metode</SelectItem>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogTrigger asChild>
                  <Button className="h-9 w-full gap-2 text-xs xl:w-auto">
                    <Printer className="h-4 w-4" /> {isMobile ? 'Simpan PDF' : 'Cetak Laporan'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto rounded-xl p-0 sm:max-w-lg">
                  <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Settings2 className="h-4 w-4 text-slate-500" /> Atur Cetak Laporan
                    </DialogTitle>
                    <p className="text-xs text-slate-500">Pilih format dan materi yang mau dicetak.</p>
                  </DialogHeader>

                  <div className="space-y-3 p-5">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">Judul Cetak</label>
                      <Input value={judul} onChange={event => setJudul(event.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Format</label>
                        <Select value={format} onValueChange={(value: 'ringkas' | 'detail') => setFormat(value)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ringkas">Ringkas (tanpa tabel detail)</SelectItem>
                            <SelectItem value="detail">Detail (semua data)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Kertas</label>
                        <Select value={orientasi} onValueChange={(value: 'portrait' | 'landscape') => setOrientasi(value)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">A4 Portrait</SelectItem>
                            <SelectItem value="landscape">A4 Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">Metode Bayar</label>
                      <Select value={metodeBayar} onValueChange={setMetodeBayar}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semua">Semua Metode</SelectItem>
                          <SelectItem value="tunai">Tunai</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">Filter Angkatan</label>
                      <Select value={printAngkatan} onValueChange={setPrintAngkatan}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semua">Semua Angkatan</SelectItem>
                          {angkatanOptions.map(tahun => (
                            <SelectItem key={tahun} value={String(tahun)}>Angkatan {tahun}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">Kolom Tanda Tangan</label>
                      <Input value={penandaTangan} onChange={event => setPenandaTangan(event.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-slate-500">Materi Cetak</p>
                      <div className="grid grid-cols-2 gap-2">
                        {materiOptions.map(([key, label]) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800">
                            <input type="checkbox" checked={materi[key]} onChange={() => toggleMateri(key)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
                      Periode: {periodeLabel}. Sumber: {kategori === 'semua' ? 'Semua Sumber' : (KATEGORI_LABEL[kategori] ?? kategori)}. Metode: {metodeBayar === 'semua' ? 'Semua Metode' : metodeBayar === 'tunai' ? 'Tunai' : 'Transfer'}. Angkatan: {printAngkatan === 'semua' ? 'Semua' : printAngkatan}.
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPrintModalOpen(false)}>
                      Batal
                    </Button>
                    <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => handlePrint()}>
                      <Printer className="h-3.5 w-3.5" /> {isMobile ? 'Simpan PDF' : 'Cetak Sekarang'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>

      <section className="no-print grid gap-3 lg:grid-cols-3">
        <Panel title="Breakdown Pemasukan" icon={BarChart3}>
          <div className="space-y-2">
            {kategoriSummary.map(row => (
              <div key={row.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</p>
                  <p className="text-[11px] text-slate-500">{row.count} transaksi aktif</p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatRupiah(row.total)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Transaksi Terbaru Periode" icon={ReceiptText} className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tanggal</TableHead>
                <TableHead className="text-xs">Siswa</TableHead>
                <TableHead className="text-xs">Sumber</TableHead>
                <TableHead className="text-right text-xs">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaksiPeriode.slice(0, 5).map(row => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatTanggalJam(row.created_at)}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/keuangan/siswa/${row.siswa_id}?tab=riwayat`} className="text-sm font-medium hover:underline">
                      {row.nama_lengkap}
                    </Link>
                    <p className="text-[11px] text-slate-400">{row.kelas ?? '-'}</p>
                  </TableCell>
                  <TableCell className="text-xs">{KATEGORI_LABEL[row.kategori] ?? row.kategori}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-600">{formatRupiah(row.jumlah_total)}</TableCell>
                </TableRow>
              ))}
              {transaksiPeriode.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-slate-400">Tidak ada transaksi pada periode ini</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Panel>
      </section>


      <section ref={printRef} className="print-area hidden print:block">
        <div className={`print-page ${isDetail ? 'text-[10px]' : 'text-[11px]'}`}>
          <PrintHeader
            judul={judul}
            periode={periodeLabel}
            angkatan={printAngkatan !== 'semua' ? printAngkatan : undefined}
          />

          {materi.ringkasan ? (
            <PrintSection title="Ringkasan Laporan">
              <div className="grid grid-cols-4 gap-2">
                <PrintMetric label="Pemasukan" value={formatRupiah(pemasukanPrint)} />
                <PrintMetric label="Pengeluaran" value={formatRupiah(pengeluaran)} />
                <PrintMetric label="Saldo Bersih" value={formatRupiah(saldoPrint)} />
                <PrintMetric label="Tunggakan Aktif" value={formatRupiah(totalTunggakan)} />
              </div>
            </PrintSection>
          ) : null}

          {materi.arusKas ? (
            <PrintSection title="Arus Kas per Sumber">
              <PrintTable headers={['Sumber', 'Transaksi Aktif', 'Total Masuk']}>
                {kategoriSummary.map(row => (
                  <tr key={row.key}><td>{row.label}</td><td>{row.count}</td><td className="text-right">{formatRupiah(row.total)}</td></tr>
                ))}
                <tr><td>Kas Keluar</td><td>{kasKeluarPeriode.length}</td><td className="text-right">({formatRupiah(pengeluaran)})</td></tr>
              </PrintTable>
            </PrintSection>
          ) : null}

          {materi.angkatan ? (
            <PrintSection title="Rekap DSPT per Angkatan">
              <PrintTable headers={['Angkatan', 'Siswa', 'Lunas', 'Nyicil', 'Belum', 'Target', 'Terkumpul', 'Sisa']}>
                {rekapAngkatanPrint.map(row => (
                  <tr key={row.tahun_masuk}>
                    <td>{row.tahun_masuk}</td>
                    <td>{row.total_siswa}</td>
                    <td>{row.dspt_lunas}</td>
                    <td>{row.dspt_nyicil}</td>
                    <td>{row.dspt_belum}</td>
                    <td className="text-right">{formatRupiah(row.dspt_target)}</td>
                    <td className="text-right">{formatRupiah(row.dspt_dibayar)}</td>
                    <td className="text-right">{formatRupiah(Math.max(row.dspt_target - row.dspt_dibayar - row.dspt_diskon, 0))}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          ) : null}

          <div className="mt-10 grid grid-cols-[1fr_220px] gap-8">
            <div className="text-[10px] text-slate-500">
              Dicetak dari MANSATAS App pada {formatDateTimeWIB(new Date())} WIB.
            </div>
            <div className="text-center">
              <p>Tasikmalaya, {formatDateWIB(new Date(), { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <p>{penandaTangan}</p>
              <div className="h-16" />
              <p className="border-t border-slate-400 pt-1">................................</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: typeof ArrowUpRight
  tone: 'emerald' | 'rose' | 'blue' | 'amber'
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon: typeof FileText
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
      </div>
      {children}
    </div>
  )
}

function DataTablePanel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count} data
        </span>
      </div>
      {children}
    </div>
  )
}


function PrintHeader({ judul, periode, angkatan }: { judul: string; periode: string; angkatan?: string }) {
  return (
    <header className="mb-5 border-b-2 border-slate-900 pb-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em]">MAN 1 Tasikmalaya</p>
      <h1 className="mt-1 text-xl font-black uppercase">{judul}</h1>
      <p className="mt-1 text-[11px]">Periode: {periode}</p>
      {angkatan ? <p className="text-[11px]">Angkatan: {angkatan}</p> : null}
    </header>
  )
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-section mb-5">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-[12px] font-black uppercase">{title}</h2>
      {children}
    </section>
  )
}

function PrintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-300 p-2">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function PrintTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="print-table w-full border-collapse text-left">
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header} className="border border-slate-400 bg-slate-100 px-1.5 py-1 font-bold">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
      </tbody>
    </table>
  )
}
