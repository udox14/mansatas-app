'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { formatRupiah } from '@/lib/utils'

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

type MateriKey = 'ringkasan' | 'arusKas' | 'transaksi' | 'kasKeluar' | 'tunggakan' | 'angkatan'

interface LaporanClientProps {
  rekapAngkatan: RekapAngkatan[]
  transaksi: TransaksiRow[]
  kasKeluar: KasKeluarRow[]
  tunggakan: TunggakanRow[]
}

const KATEGORI_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp: 'SPP Tunggakan',
  koperasi: 'Koperasi',
}

const TUNGGAKAN_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp_tunggakan_awal: 'SPP Tunggakan Terdahulu',
  koperasi: 'Koperasi',
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthInput() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function dateOnly(value: string) {
  return value.slice(0, 10)
}

function formatTanggal(value: string) {
  return new Date(value.replace(' ', 'T')).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTanggalJam(value: string) {
  return new Date(value.replace(' ', 'T')).toLocaleString('id-ID', {
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
  const [tanggalAwal, setTanggalAwal] = useState(firstDayOfMonthInput())
  const [tanggalAkhir, setTanggalAkhir] = useState(todayInput())
  const [kategori, setKategori] = useState('semua')
  const [search, setSearch] = useState('')
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [judul, setJudul] = useState('Laporan Keuangan Madrasah')
  const [format, setFormat] = useState<'ringkas' | 'detail'>('ringkas')
  const [orientasi, setOrientasi] = useState<'portrait' | 'landscape'>('portrait')
  const [penandaTangan, setPenandaTangan] = useState('Bendahara Komite')
  const [materi, setMateri] = useState<Record<MateriKey, boolean>>({
    ringkasan: true,
    arusKas: true,
    transaksi: true,
    kasKeluar: true,
    tunggakan: true,
    angkatan: true,
  })

  const transaksiPagination = usePagination(12)
  const tunggakanPagination = usePagination(12)
  const kasPagination = usePagination(12)

  const transaksiPeriode = useMemo(() => {
    const term = search.trim().toLowerCase()
    transaksiPagination.reset()
    return transaksi.filter(row => {
      const tanggal = dateOnly(row.created_at)
      const matchTanggal = tanggal >= tanggalAwal && tanggal <= tanggalAkhir
      const matchKategori = kategori === 'semua' || row.kategori === kategori
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || (row.nomor_kuitansi ?? '').toLowerCase().includes(term)
      return matchTanggal && matchKategori && matchSearch
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaksi, tanggalAwal, tanggalAkhir, kategori, search])

  const kasKeluarPeriode = useMemo(() => {
    kasPagination.reset()
    return kasKeluar.filter(row => row.tanggal >= tanggalAwal && row.tanggal <= tanggalAkhir)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kasKeluar, tanggalAwal, tanggalAkhir])

  const tunggakanFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    tunggakanPagination.reset()
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

  const kategoriSummary = ['dspt', 'spp', 'koperasi'].map(key => ({
    key,
    label: KATEGORI_LABEL[key],
    total: sumBy(transaksiAktif.filter(row => row.kategori === key), row => row.jumlah_total),
    count: transaksiAktif.filter(row => row.kategori === key).length,
  }))

  const toggleMateri = (key: MateriKey) => {
    setMateri(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePrint = () => {
    window.print()
  }

  const periodeLabel = `${formatTanggal(tanggalAwal)} - ${formatTanggal(tanggalAkhir)}`
  const transaksiPage = transaksiPagination.paginate(transaksiPeriode)
  const tunggakanPage = tunggakanPagination.paginate(tunggakanFiltered)
  const kasPage = kasPagination.paginate(kasKeluarPeriode)

  return (
    <div className="space-y-4 pb-8">
      <style>{`
        @media print {
          @page { size: A4 ${orientasi}; margin: 12mm; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; inset: 0 !important; width: 100% !important; background: white !important; color: #111827 !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          .print-break { break-before: page; }
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
          <div className="grid gap-2 xl:grid-cols-[1fr_1fr_170px_auto]">
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
                  <SelectItem value="koperasi">Koperasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogTrigger asChild>
                  <Button className="h-9 w-full gap-2 text-xs xl:w-auto">
                    <Printer className="h-4 w-4" /> Cetak Laporan
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
                            <SelectItem value="ringkas">Ringkas</SelectItem>
                            <SelectItem value="detail">Detail</SelectItem>
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
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">Kolom Tanda Tangan</label>
                      <Input value={penandaTangan} onChange={event => setPenandaTangan(event.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-slate-500">Materi Cetak</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['ringkasan', 'Ringkasan'],
                          ['arusKas', 'Arus Kas'],
                          ['transaksi', 'Transaksi Masuk'],
                          ['kasKeluar', 'Kas Keluar'],
                          ['tunggakan', 'Tunggakan'],
                          ['angkatan', 'Rekap Angkatan'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800">
                            <input type="checkbox" checked={materi[key]} onChange={() => toggleMateri(key)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
                      Periode cetak mengikuti filter halaman: {periodeLabel}. Sumber: {kategori === 'semua' ? 'Semua Sumber' : (KATEGORI_LABEL[kategori] ?? kategori)}.
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPrintModalOpen(false)}>
                      Batal
                    </Button>
                    <Button size="sm" className="h-8 gap-2 text-xs" onClick={handlePrint}>
                      <Printer className="h-3.5 w-3.5" /> Cetak Sekarang
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

      <section className="no-print space-y-3">
        <DataTablePanel title="Transaksi Masuk" count={transaksiPeriode.length}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs">Waktu</TableHead>
                <TableHead className="text-xs">Siswa</TableHead>
                <TableHead className="text-xs">Sumber</TableHead>
                <TableHead className="text-xs">Kuitansi</TableHead>
                <TableHead className="text-xs">Metode</TableHead>
                <TableHead className="text-right text-xs">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaksiPage.map(row => (
                <TableRow key={row.id} className={row.is_void ? 'opacity-55' : undefined}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatTanggalJam(row.created_at)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.kelas ?? '-'}{row.nisn ? ` - ${row.nisn}` : ''}</p>
                  </TableCell>
                  <TableCell className="text-xs">{KATEGORI_LABEL[row.kategori] ?? row.kategori}</TableCell>
                  <TableCell className="text-xs">{row.nomor_kuitansi ?? '-'}</TableCell>
                  <TableCell className="text-xs capitalize">{row.metode_bayar}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatRupiah(row.jumlah_total)}</TableCell>
                </TableRow>
              ))}
              {transaksiPage.length === 0 ? <EmptyRow colSpan={6} label="Tidak ada transaksi masuk" /> : null}
            </TableBody>
          </Table>
          <DataPagination
            total={transaksiPeriode.length}
            page={transaksiPagination.page}
            pageSize={transaksiPagination.pageSize}
            onPageChange={transaksiPagination.setPage}
            onPageSizeChange={transaksiPagination.setPageSize}
            entityLabel="transaksi"
          />
        </DataTablePanel>

        <DataTablePanel title="Tunggakan Aktif" count={tunggakanFiltered.length}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs">Siswa</TableHead>
                <TableHead className="text-xs">Jenis</TableHead>
                <TableHead className="text-right text-xs">Nominal</TableHead>
                <TableHead className="text-right text-xs">Dibayar</TableHead>
                <TableHead className="text-right text-xs">Diskon</TableHead>
                <TableHead className="text-right text-xs">Sisa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tunggakanPage.map(row => (
                <TableRow key={`${row.jenis}-${row.id}`}>
                  <TableCell>
                    <p className="text-sm font-medium">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.kelas ?? '-'}{row.tahun_masuk ? ` - ${row.tahun_masuk}` : ''}</p>
                  </TableCell>
                  <TableCell className="text-xs">{TUNGGAKAN_LABEL[row.jenis] ?? row.jenis}</TableCell>
                  <TableCell className="text-right text-sm">{formatRupiah(row.nominal)}</TableCell>
                  <TableCell className="text-right text-sm">{formatRupiah(row.dibayar)}</TableCell>
                  <TableCell className="text-right text-sm">{formatRupiah(row.diskon)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-rose-600">{formatRupiah(row.sisa)}</TableCell>
                </TableRow>
              ))}
              {tunggakanPage.length === 0 ? <EmptyRow colSpan={6} label="Tidak ada tunggakan sesuai filter" /> : null}
            </TableBody>
          </Table>
          <DataPagination
            total={tunggakanFiltered.length}
            page={tunggakanPagination.page}
            pageSize={tunggakanPagination.pageSize}
            onPageChange={tunggakanPagination.setPage}
            onPageSizeChange={tunggakanPagination.setPageSize}
            entityLabel="tunggakan"
          />
        </DataTablePanel>

        <DataTablePanel title="Kas Keluar" count={kasKeluarPeriode.length}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs">Tanggal</TableHead>
                <TableHead className="text-xs">Kategori</TableHead>
                <TableHead className="text-xs">Keterangan</TableHead>
                <TableHead className="text-xs">Metode</TableHead>
                <TableHead className="text-right text-xs">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kasPage.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatTanggal(row.tanggal)}</TableCell>
                  <TableCell className="text-xs">{row.kategori ?? '-'}</TableCell>
                  <TableCell className="text-sm">{row.keterangan}</TableCell>
                  <TableCell className="text-xs capitalize">{row.metode}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-rose-600">{formatRupiah(row.jumlah)}</TableCell>
                </TableRow>
              ))}
              {kasPage.length === 0 ? <EmptyRow colSpan={5} label="Tidak ada kas keluar pada periode ini" /> : null}
            </TableBody>
          </Table>
          <DataPagination
            total={kasKeluarPeriode.length}
            page={kasPagination.page}
            pageSize={kasPagination.pageSize}
            onPageChange={kasPagination.setPage}
            onPageSizeChange={kasPagination.setPageSize}
            entityLabel="kas keluar"
          />
        </DataTablePanel>
      </section>

      <section className="print-area hidden print:block">
        <div className={`print-page ${format === 'detail' ? 'text-[10px]' : 'text-[11px]'}`}>
          <PrintHeader judul={judul} periode={periodeLabel} />

          {materi.ringkasan ? (
            <PrintSection title="Ringkasan Laporan">
              <div className="grid grid-cols-4 gap-2">
                <PrintMetric label="Pemasukan" value={formatRupiah(pemasukan)} />
                <PrintMetric label="Pengeluaran" value={formatRupiah(pengeluaran)} />
                <PrintMetric label="Saldo Bersih" value={formatRupiah(saldo)} />
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

          {materi.transaksi ? (
            <PrintSection title="Transaksi Masuk">
              <PrintTable headers={['Tanggal', 'Siswa', 'Sumber', 'Kuitansi', 'Jumlah']}>
                {(format === 'detail' ? transaksiPeriode : transaksiPeriode.slice(0, 20)).map(row => (
                  <tr key={row.id}>
                    <td>{formatTanggalJam(row.created_at)}</td>
                    <td>{row.nama_lengkap}</td>
                    <td>{KATEGORI_LABEL[row.kategori] ?? row.kategori}</td>
                    <td>{row.nomor_kuitansi ?? '-'}</td>
                    <td className="text-right">{formatRupiah(row.jumlah_total)}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          ) : null}

          {materi.kasKeluar ? (
            <PrintSection title="Kas Keluar">
              <PrintTable headers={['Tanggal', 'Kategori', 'Keterangan', 'Jumlah']}>
                {(format === 'detail' ? kasKeluarPeriode : kasKeluarPeriode.slice(0, 20)).map(row => (
                  <tr key={row.id}>
                    <td>{formatTanggal(row.tanggal)}</td>
                    <td>{row.kategori ?? '-'}</td>
                    <td>{row.keterangan}</td>
                    <td className="text-right">{formatRupiah(row.jumlah)}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          ) : null}

          {materi.tunggakan ? (
            <PrintSection title="Tunggakan Aktif">
              <PrintTable headers={['Siswa', 'Kelas', 'Jenis', 'Nominal', 'Dibayar', 'Sisa']}>
                {(format === 'detail' ? tunggakanFiltered : tunggakanFiltered.slice(0, 25)).map(row => (
                  <tr key={`${row.jenis}-${row.id}`}>
                    <td>{row.nama_lengkap}</td>
                    <td>{row.kelas ?? '-'}</td>
                    <td>{TUNGGAKAN_LABEL[row.jenis] ?? row.jenis}</td>
                    <td className="text-right">{formatRupiah(row.nominal)}</td>
                    <td className="text-right">{formatRupiah(row.dibayar)}</td>
                    <td className="text-right">{formatRupiah(row.sisa)}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          ) : null}

          {materi.angkatan ? (
            <PrintSection title="Rekap DSPT per Angkatan">
              <PrintTable headers={['Angkatan', 'Siswa', 'Lunas', 'Nyicil', 'Belum', 'Target', 'Terkumpul', 'Sisa']}>
                {rekapAngkatan.map(row => (
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
              Dicetak dari MANSATAS App pada {new Date().toLocaleString('id-ID')}.
            </div>
            <div className="text-center">
              <p>Tasikmalaya, {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-slate-400">
        {label}
      </TableCell>
    </TableRow>
  )
}

function PrintHeader({ judul, periode }: { judul: string; periode: string }) {
  return (
    <header className="mb-5 border-b-2 border-slate-900 pb-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em]">MAN 1 Tasikmalaya</p>
      <h1 className="mt-1 text-xl font-black uppercase">{judul}</h1>
      <p className="mt-1 text-[11px]">Periode: {periode}</p>
    </header>
  )
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
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
    <table className="w-full border-collapse text-left">
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
