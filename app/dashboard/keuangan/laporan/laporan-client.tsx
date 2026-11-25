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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { formatRupiah } from '@/lib/utils'
import { dateInputWIB, formatDateTimeWIB, formatDateWIB, todayWIB } from '@/lib/time'
import type { KomiteReportSettings } from '@/lib/komite-report-settings'
import { useRouter } from 'next/navigation'
import { komiteFundLabel } from '@/lib/komite-funds'
import { CohortCards } from '@/components/dashboard/cohort-cards'
import { cashCohortMetric } from '@/lib/komite-cohorts'
import { OfficialReportDialog } from './official-report-dialog'
import {
  SiswaStatusFilter,
  matchSiswaStatusFilter,
  type SiswaStatusFilterValue,
} from '../components/siswa-status-filter'

interface DsptRow {
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  siswa_status: string
  tahun_masuk: number
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: string | null
}

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
  siswa_status: string
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
  siswa_status: string
  tahun_masuk: number | null
  kelas: string | null
  nominal: number
  dibayar: number
  diskon: number
  sisa: number
  status: string
  updated_at: string
}

type MateriKey = 'ringkasan' | 'arusKas' | 'angkatan' | 'tunggakan'

interface LaporanClientProps {
  activeYears: number[]
  cashParts: { id: string; source: string; amount: number }[]
  fund?: string
  dsptRows: DsptRow[]
  transaksi: TransaksiRow[]
  kasKeluar: KasKeluarRow[]
  tunggakan: TunggakanRow[]
  reportSettings: KomiteReportSettings
}

const KATEGORI_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp: 'SPP Tunggakan',
  manual: 'Pemasukan Manual',
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

export function LaporanClient({ dsptRows, transaksi, kasKeluar, tunggakan, reportSettings, fund, activeYears, cashParts }: LaporanClientProps) {
  const printRef = useRef<HTMLElement>(null)
  const [tanggalAwal, setTanggalAwal] = useState(firstDayOfMonthInput())
  const [tanggalAkhir, setTanggalAkhir] = useState(todayInput())
  const [kategori, setKategori] = useState('semua')
  const [metodeBayar, setMetodeBayar] = useState('semua')
  const [filterSiswaStatus, setFilterSiswaStatus] = useState<SiswaStatusFilterValue>('semua')
  const [search, setSearch] = useState('')
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [judul, setJudul] = useState('Laporan Keuangan Madrasah')
  const [format, setFormat] = useState<'ringkas' | 'detail'>('detail')
  const [orientasi, setOrientasi] = useState<'portrait' | 'landscape'>('portrait')
  const [penandaTangan, setPenandaTangan] = useState('Bendahara Komite')
  const router = useRouter()
  const printAngkatan = fund ?? 'semua'
  function setPrintAngkatan(value: string) {
    router.push(value === 'semua' ? '/dashboard/keuangan/laporan' : `/dashboard/keuangan/laporan?fund=${value}`)
  }
  const [materi, setMateri] = useState<Record<MateriKey, boolean>>({
    ringkasan: true,
    arusKas: true,
    angkatan: true,
    tunggakan: true,
  })

  const incomePager = usePagination(15)
  const expensePager = usePagination(15)
  const arrearsPager = usePagination(15)

  const matchingIncome = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transaksi.filter(row => {
      const tanggal = dateOnly(row.created_at)
      const matchTanggal = tanggal >= tanggalAwal && tanggal <= tanggalAkhir
      const matchKategori = kategori === 'semua' || row.kategori === kategori
      const matchSiswaStatus = row.kategori === 'manual' || matchSiswaStatusFilter(row.siswa_status, filterSiswaStatus)
      const matchMetode = metodeBayar === 'semua'
        || (metodeBayar === 'tunai'
          ? row.metode_bayar === 'tunai'
          : row.metode_bayar === 'transfer' || row.metode_bayar === 'qris')
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || (row.nomor_kuitansi ?? '').toLowerCase().includes(term)
      return matchTanggal && matchKategori && matchSiswaStatus && matchMetode && matchSearch
    })
  }, [transaksi, tanggalAwal, tanggalAkhir, kategori, filterSiswaStatus, metodeBayar, search])

  const matchingExpense = useMemo(() => {
    const term = search.trim().toLowerCase()
    return kasKeluar.filter(row => {
      const matchTanggal = row.tanggal >= tanggalAwal && row.tanggal <= tanggalAkhir
      const matchMetode = metodeBayar === 'semua'
        || (metodeBayar === 'tunai'
          ? row.metode === 'tunai'
          : row.metode === 'transfer' || row.metode === 'qris')
      const matchSearch = !term
        || row.keterangan.toLowerCase().includes(term)
        || (row.kategori ?? '').toLowerCase().includes(term)
      return matchTanggal && matchMetode && matchSearch
    })
  }, [kasKeluar, tanggalAwal, tanggalAkhir, metodeBayar, search])

  const tunggakanFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tunggakan.filter(row => {
      const matchKategori = kategori === 'semua'
        || (kategori === 'spp' ? row.jenis === 'spp_tunggakan_awal' : row.jenis === kategori)
      const matchSiswaStatus = matchSiswaStatusFilter(row.siswa_status, filterSiswaStatus)
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || String(row.tahun_masuk ?? '').includes(term)
      return matchKategori && matchSiswaStatus && matchSearch
    })
  }, [tunggakan, kategori, filterSiswaStatus, search])

  const rekapAngkatan = useMemo(() => {
    const groups = new Map<number, RekapAngkatan>()
    for (const row of dsptRows) {
      if (!matchSiswaStatusFilter(row.siswa_status, filterSiswaStatus)) continue
      let group = groups.get(row.tahun_masuk)
      if (!group) {
        group = {
          tahun_masuk: row.tahun_masuk,
          total_siswa: 0,
          dspt_lunas: 0,
          dspt_nyicil: 0,
          dspt_belum: 0,
          dspt_target: 0,
          dspt_dibayar: 0,
          dspt_diskon: 0,
        }
        groups.set(row.tahun_masuk, group)
      }
      group.total_siswa += 1
      if (row.status === 'lunas') group.dspt_lunas += 1
      else if (row.status === 'nyicil') group.dspt_nyicil += 1
      else group.dspt_belum += 1
      group.dspt_target += row.nominal_target ?? 0
      group.dspt_dibayar += row.total_dibayar ?? 0
      group.dspt_diskon += row.total_diskon ?? 0
    }
    return [...groups.values()].sort((a, b) => b.tahun_masuk - a.tahun_masuk)
  }, [dsptRows, filterSiswaStatus])

  const partsById = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const part of cashParts) {
      const scopes = map.get(part.id) ?? new Map<string, number>()
      scopes.set(part.source, part.amount)
      map.set(part.id, scopes)
    }
    return map
  }, [cashParts])

  const scopedAmount = (id: string, amount: number, scope: string) =>
    scope === 'semua' || scope === 'all' ? amount : partsById.get(id)?.get(scope)

  const transaksiPeriode = matchingIncome.flatMap(row => {
    const amount = scopedAmount(row.id, row.jumlah_total, printAngkatan)
    return amount === undefined ? [] : [{ ...row, jumlah_total: amount }]
  })
  const transaksiAktif = transaksiPeriode.filter(row => !row.is_void)
  const kasKeluarPeriode = matchingExpense.flatMap(row => {
    const amount = scopedAmount(row.id, row.jumlah, printAngkatan)
    return amount === undefined ? [] : [{ ...row, jumlah: amount }]
  })
  const pemasukan = sumBy(transaksiAktif, row => row.jumlah_total)
  const pengeluaran = sumBy(kasKeluarPeriode, row => row.jumlah)
  const saldo = pemasukan - pengeluaran

  const cohortMetrics = Object.fromEntries(['all', ...activeYears.map(String)].map(scope => [
    scope,
    cashCohortMetric(
      sumBy(matchingIncome.filter(row => !row.is_void), row => scopedAmount(row.id, row.jumlah_total, scope) ?? 0),
      sumBy(matchingExpense, row => scopedAmount(row.id, row.jumlah, scope) ?? 0),
    ),
  ]))
  const angkatanOptions = [...new Set([...dsptRows.map(row => row.tahun_masuk), ...cashParts.map(row => Number(row.source))])]
    .filter(year => year >= 2000 && year <= 2199)
    .sort((a, b) => b - a)

  const rekapAngkatanPrint = printAngkatan === 'semua' ? rekapAngkatan : rekapAngkatan.filter(r => r.tahun_masuk === Number(printAngkatan))
  const transaksiPrint = transaksiAktif
  const tunggakanPrint = printAngkatan === 'semua' ? tunggakanFiltered : tunggakanFiltered.filter(r => r.tahun_masuk === Number(printAngkatan))
  const totalTunggakan = sumBy(tunggakanPrint, row => row.sisa)
  const pemasukanPrint = sumBy(transaksiPrint, row => row.jumlah_total)
  const totalTunggakanPrint = sumBy(tunggakanPrint, row => row.sisa)
  const saldoPrint = pemasukanPrint - pengeluaran

  const kategoriSummary = ['dspt', 'spp', 'manual'].map(key => ({
    key,
    label: KATEGORI_LABEL[key],
    total: sumBy(transaksiAktif.filter(row => row.kategori === key), row => row.jumlah_total),
    count: transaksiAktif.filter(row => row.kategori === key).length,
  }))
  const kategoriSummaryPrint = ['dspt', 'spp', 'manual'].map(key => ({
    key,
    label: KATEGORI_LABEL[key],
    total: sumBy(transaksiPrint.filter(row => row.kategori === key), row => row.jumlah_total),
    count: transaksiPrint.filter(row => row.kategori === key).length,
  }))
  const tunggakanSummaryPrint = ['dspt', 'spp_tunggakan_awal'].map(key => {
    const rows = tunggakanPrint.filter(row => row.jenis === key)
    return {
      key,
      label: TUNGGAKAN_LABEL[key],
      count: rows.length,
      total: sumBy(rows, row => row.sisa),
    }
  })

  const toggleMateri = (key: MateriKey) => {
    setMateri(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const periodeLabel = `${formatTanggal(tanggalAwal)} - ${formatTanggal(tanggalAkhir)}`
  const isDetail = format === 'detail'
  const materiOptions: Array<readonly [MateriKey, string]> = [
    ['ringkasan', 'Ringkasan'],
    ['arusKas', 'Arus Kas'],
    ['angkatan', 'Rekap Angkatan'],
    ['tunggakan', 'Tunggakan'],
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

  const paginatedIncome = incomePager.paginate(transaksiPeriode)
  const paginatedExpense = expensePager.paginate(kasKeluarPeriode)
  const paginatedArrears = arrearsPager.paginate(tunggakanPrint)

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
        {/* Clear Top Action Group: BKU Resmi vs Cetak Rekap Kustom */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Periode layar: <strong className="text-slate-700 dark:text-slate-200">{periodeLabel}</strong> · {printAngkatan === 'semua' ? 'Semua Sumber Dana' : komiteFundLabel(printAngkatan)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 text-xs">
                  <Printer className="h-4 w-4" /> Cetak Rekap Kustom
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[88vh] overflow-y-auto rounded-xl p-0 sm:max-w-lg">
                <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Settings2 className="h-4 w-4 text-slate-500" /> Cetak Rekap Periode Kustom
                  </DialogTitle>
                  <p className="text-xs text-slate-500">Pilih format kertas dan bagian tabel yang akan dicetak sesuai rentang tanggal filter.</p>
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
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Jabatan Penandatangan</label>
                    <Input value={penandaTangan} onChange={event => setPenandaTangan(event.target.value)} className="h-8 text-xs" />
                  </div>
                  <fieldset>
                    <legend className="mb-2 text-[11px] font-semibold text-slate-500">Materi Cetak</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {materiOptions.map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-800">
                          <input type="checkbox" checked={materi[key]} onChange={() => toggleMateri(key)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
                    Periode: {periodeLabel} · Status siswa: {filterSiswaStatus === 'semua' ? 'Semua' : filterSiswaStatus} · Sumber: {kategori === 'semua' ? 'Semua Sumber' : (KATEGORI_LABEL[kategori] ?? kategori)} · {komiteFundLabel(fund)}.
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPrintModalOpen(false)}>
                    Batal
                  </Button>
                  <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => handlePrint()}>
                    <Printer className="h-3.5 w-3.5" /> Cetak Sekarang
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <OfficialReportDialog
              settings={reportSettings}
              years={angkatanOptions}
              initialFund={printAngkatan === 'semua' ? undefined : printAngkatan}
              key={printAngkatan}
            />
          </div>
        </div>

        <CohortCards
          compact
          activeYears={activeYears}
          years={angkatanOptions}
          metrics={cohortMetrics}
          cashScopes
          value={printAngkatan === 'semua' ? 'all' : printAngkatan}
          onChange={scope => setPrintAngkatan(scope === 'all' ? 'semua' : scope)}
        />

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <SummaryCard label="Pemasukan Periode" value={formatRupiah(pemasukan)} icon={ArrowUpRight} tone="emerald" />
          <SummaryCard label="Pengeluaran Periode" value={formatRupiah(pengeluaran)} icon={ArrowDownRight} tone="rose" />
          <SummaryCard label="Selisih Kas Periode" value={formatRupiah(saldo)} icon={BarChart3} tone={saldo >= 0 ? 'blue' : 'rose'} />
          <SummaryCard label="Total Tunggakan" value={formatRupiah(totalTunggakan)} icon={AlertTriangle} tone="amber" />
        </div>

        <search aria-label="Filter laporan keuangan" className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_170px_170px_150px]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="lap-start" className="mb-1 block text-[11px] font-semibold text-slate-500">Tanggal Awal</label>
                <Input id="lap-start" type="date" value={tanggalAwal} onChange={event => setTanggalAwal(event.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label htmlFor="lap-end" className="mb-1 block text-[11px] font-semibold text-slate-500">Tanggal Akhir</label>
                <Input id="lap-end" type="date" value={tanggalAkhir} onChange={event => setTanggalAkhir(event.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <label htmlFor="lap-search" className="mb-1 block text-[11px] font-semibold text-slate-500">Cari Siswa / Kuitansi / Keterangan</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="lap-search"
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Cari di laporan..."
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Sumber</label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Sumber</SelectItem>
                  <SelectItem value="dspt">DSPT</SelectItem>
                  <SelectItem value="spp">SPP Tunggakan</SelectItem>
                  <SelectItem value="manual">Pemasukan Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Status Siswa</label>
              <SiswaStatusFilter
                value={filterSiswaStatus}
                onValueChange={setFilterSiswaStatus}
                className="h-8 w-full text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Metode</label>
              <Select value={metodeBayar} onValueChange={setMetodeBayar}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Metode</SelectItem>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer / QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </search>

        {/* On-Screen Interactive Report Tabs */}
        <Tabs defaultValue="ringkasan" className="space-y-3">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
            <TabsTrigger value="ringkasan" className="shrink-0 text-xs">
              Pemasukan ({transaksiAktif.length})
            </TabsTrigger>
            <TabsTrigger value="pengeluaran" className="shrink-0 text-xs">
              Pengeluaran ({kasKeluarPeriode.length})
            </TabsTrigger>
            <TabsTrigger value="angkatan" className="shrink-0 text-xs">
              Rekap per Angkatan ({rekapAngkatanPrint.length})
            </TabsTrigger>
            <TabsTrigger value="tunggakan" className="shrink-0 text-xs">
              Daftar Tunggakan ({tunggakanPrint.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ringkasan" className="mt-0 space-y-3">
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel title="Komposisi Pemasukan" icon={BarChart3}>
                <div className="space-y-2">
                  {kategoriSummary.map(row => (
                    <div key={row.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</p>
                        <p className="text-[11px] text-slate-500">{row.count} transaksi sah</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(row.total)}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <DataTablePanel title="Rincian Pemasukan Periode" count={transaksiPeriode.length} className="lg:col-span-2">
                <div role="region" aria-label="Tabel rincian pemasukan" tabIndex={0} className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                        <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold">Siswa / Pembayar</TableHead>
                        <TableHead className="text-xs font-semibold">Sumber</TableHead>
                        <TableHead className="text-xs font-semibold">Metode</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedIncome.map(row => (
                        <TableRow key={row.id} className={row.is_void ? 'opacity-50' : ''}>
                          <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatTanggalJam(row.created_at)}</TableCell>
                          <TableCell>
                            {row.kategori === 'manual' ? (
                              <span className="text-sm font-medium">{row.nama_lengkap}</span>
                            ) : (
                              <Link href={`/dashboard/keuangan/siswa/${row.siswa_id}?tab=riwayat`} className="text-sm font-medium hover:underline">
                                {row.nama_lengkap}
                              </Link>
                            )}
                            <p className="text-[11px] text-slate-400">{row.kelas ?? '-'} {row.nomor_kuitansi ? `· ${row.nomor_kuitansi}` : ''}</p>
                          </TableCell>
                          <TableCell className="text-xs">{KATEGORI_LABEL[row.kategori] ?? row.kategori}</TableCell>
                          <TableCell className="text-xs capitalize">{row.metode_bayar}</TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(row.jumlah_total)}</TableCell>
                        </TableRow>
                      ))}
                      {transaksiPeriode.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-400">Tidak ada pemasukan pada periode ini.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {transaksiPeriode.length > 15 && (
                  <DataPagination
                    total={transaksiPeriode.length}
                    page={incomePager.page}
                    pageSize={incomePager.pageSize}
                    onPageChange={incomePager.setPage}
                    onPageSizeChange={incomePager.setPageSize}
                    entityLabel="pemasukan"
                  />
                )}
              </DataTablePanel>
            </div>
          </TabsContent>

          <TabsContent value="pengeluaran" className="mt-0">
            <DataTablePanel title="Rincian Pengeluaran Periode" count={kasKeluarPeriode.length}>
              <div role="region" aria-label="Tabel rincian pengeluaran" tabIndex={0} className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold">Keterangan</TableHead>
                      <TableHead className="text-xs font-semibold">Metode</TableHead>
                      <TableHead className="text-xs font-semibold">Pencatat</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpense.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatTanggal(row.tanggal)}</TableCell>
                        <TableCell className="text-xs font-medium">{row.kategori ?? '-'}</TableCell>
                        <TableCell className="max-w-md text-sm">{row.keterangan}</TableCell>
                        <TableCell className="text-xs capitalize">{row.metode}</TableCell>
                        <TableCell className="text-xs text-slate-500">{row.nama_input ?? '-'}</TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatRupiah(row.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                    {kasKeluarPeriode.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-slate-400">Tidak ada pengeluaran pada periode ini.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {kasKeluarPeriode.length > 15 && (
                <DataPagination
                  total={kasKeluarPeriode.length}
                  page={expensePager.page}
                  pageSize={expensePager.pageSize}
                  onPageChange={expensePager.setPage}
                  onPageSizeChange={expensePager.setPageSize}
                  entityLabel="pengeluaran"
                />
              )}
            </DataTablePanel>
          </TabsContent>

          <TabsContent value="angkatan" className="mt-0">
            <DataTablePanel title="Rekapitulasi DSPT per Angkatan" count={rekapAngkatanPrint.length}>
              <div role="region" aria-label="Tabel rekap DSPT per angkatan" tabIndex={0} className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold">Angkatan</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Siswa</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Lunas</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Nyicil</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Belum</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Terkumpul</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Keringanan</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapAngkatanPrint.map(row => {
                      const sisa = Math.max(0, row.dspt_target - row.dspt_dibayar - row.dspt_diskon)
                      return (
                        <TableRow key={row.tahun_masuk}>
                          <TableCell className="text-sm font-semibold">Angkatan {row.tahun_masuk}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{row.total_siswa}</TableCell>
                          <TableCell className="text-right text-xs font-medium tabular-nums text-emerald-600">{row.dspt_lunas}</TableCell>
                          <TableCell className="text-right text-xs font-medium tabular-nums text-amber-600">{row.dspt_nyicil}</TableCell>
                          <TableCell className="text-right text-xs font-medium tabular-nums text-rose-600">{row.dspt_belum}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatRupiah(row.dspt_target)}</TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums text-emerald-600">{formatRupiah(row.dspt_dibayar)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-blue-600">{formatRupiah(row.dspt_diskon)}</TableCell>
                          <TableCell className="text-right text-sm font-bold tabular-nums text-rose-600">{formatRupiah(sisa)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {rekapAngkatanPrint.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-slate-400">Belum ada data rekap angkatan.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </DataTablePanel>
          </TabsContent>

          <TabsContent value="tunggakan" className="mt-0">
            <DataTablePanel title="Daftar Tunggakan Siswa" count={tunggakanPrint.length}>
              <div role="region" aria-label="Tabel daftar tunggakan siswa" tabIndex={0} className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                      <TableHead className="text-xs font-semibold">Angkatan / Kelas</TableHead>
                      <TableHead className="text-xs font-semibold">Jenis</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Target</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Dibayar</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Keringanan</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedArrears.map(row => (
                      <TableRow key={`${row.jenis}-${row.id}`}>
                        <TableCell>
                          <Link href={`/dashboard/keuangan/siswa/${row.siswa_id}?tab=${row.jenis === 'spp_tunggakan_awal' ? 'spp' : 'dspt'}`} className="text-sm font-medium hover:underline">
                            {row.nama_lengkap}
                          </Link>
                          <p className="text-[11px] text-slate-400">{row.nisn ?? '-'}</p>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {row.tahun_masuk ?? '-'} · {row.kelas ?? '-'}
                        </TableCell>
                        <TableCell className="text-xs">{TUNGGAKAN_LABEL[row.jenis] ?? row.jenis}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatRupiah(row.nominal)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-emerald-600">{formatRupiah(row.dibayar)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-blue-600">{formatRupiah(row.diskon)}</TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums text-rose-600">{formatRupiah(row.sisa)}</TableCell>
                      </TableRow>
                    ))}
                    {tunggakanPrint.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-400">Tidak ada tunggakan sesuai filter.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {tunggakanPrint.length > 15 && (
                <DataPagination
                  total={tunggakanPrint.length}
                  page={arrearsPager.page}
                  pageSize={arrearsPager.pageSize}
                  onPageChange={arrearsPager.setPage}
                  onPageSizeChange={arrearsPager.setPageSize}
                  entityLabel="tunggakan"
                />
              )}
            </DataTablePanel>
          </TabsContent>
        </Tabs>
      </section>

      <section ref={printRef} className="print-area hidden print:block">
        <div className={`print-page ${isDetail ? 'text-[10px]' : 'text-[11px]'}`}>
          <PrintHeader
            judul={judul}
            periode={periodeLabel}
            angkatan={printAngkatan !== 'semua' ? komiteFundLabel(printAngkatan) : undefined}
          />

          {materi.ringkasan ? (
            <PrintSection title="Ringkasan Laporan">
              <div className="grid grid-cols-4 gap-2">
                <PrintMetric label="Pemasukan" value={formatRupiah(pemasukanPrint)} />
                <PrintMetric label="Pengeluaran" value={formatRupiah(pengeluaran)} />
                <PrintMetric label="Selisih Kas Periode" value={formatRupiah(saldoPrint)} />
                <PrintMetric label="Tunggakan" value={formatRupiah(totalTunggakanPrint)} />
              </div>
            </PrintSection>
          ) : null}

          {materi.arusKas ? (
            <PrintSection title="Arus Kas per Sumber">
              <PrintTable headers={['Sumber', 'Transaksi Sah', 'Total Masuk']}>
                {kategoriSummaryPrint.map(row => (
                  <tr key={row.key}><td>{row.label}</td><td>{row.count}</td><td className="text-right">{formatRupiah(row.total)}</td></tr>
                ))}
                <tr><td>Pengeluaran Arus Kas</td><td>{kasKeluarPeriode.length}</td><td className="text-right">({formatRupiah(pengeluaran)})</td></tr>
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

          {!isDetail && materi.tunggakan ? (
            <PrintSection title="Ringkasan Tunggakan">
              <PrintTable headers={['Jenis Tagihan', 'Jumlah Tagihan', 'Total Sisa']}>
                {tunggakanSummaryPrint.map(row => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.count}</td>
                    <td className="text-right">{formatRupiah(row.total)}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          ) : null}

          {isDetail && materi.arusKas ? (
            <>
              <PrintSection title={`Rincian Pemasukan (${transaksiPrint.length} transaksi)`}>
                <PrintTable headers={['Tanggal', 'Kuitansi', 'Nama', 'Kelas', 'Sumber', 'Metode', 'Rincian', 'Jumlah']}>
                  {transaksiPrint.map(row => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">{formatTanggalJam(row.created_at)}</td>
                      <td>{row.nomor_kuitansi ?? '-'}</td>
                      <td>{row.nama_lengkap}</td>
                      <td>{row.kelas ?? '-'}</td>
                      <td>{KATEGORI_LABEL[row.kategori] ?? row.kategori}</td>
                      <td className="capitalize">{row.metode_bayar}</td>
                      <td>{row.rincian ?? '-'}</td>
                      <td className="whitespace-nowrap text-right">{formatRupiah(row.jumlah_total)}</td>
                    </tr>
                  ))}
                  {transaksiPrint.length === 0 ? <EmptyPrintRow colSpan={8} /> : null}
                </PrintTable>
              </PrintSection>

              <PrintSection title={`Rincian Pengeluaran (${kasKeluarPeriode.length} transaksi)`}>
                <PrintTable headers={['Tanggal', 'Kategori', 'Keterangan', 'Metode', 'Diinput Oleh', 'Jumlah']}>
                  {kasKeluarPeriode.map(row => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">{formatTanggal(row.tanggal)}</td>
                      <td>{row.kategori ?? '-'}</td>
                      <td>{row.keterangan}</td>
                      <td className="capitalize">{row.metode}</td>
                      <td>{row.nama_input ?? '-'}</td>
                      <td className="whitespace-nowrap text-right">{formatRupiah(row.jumlah)}</td>
                    </tr>
                  ))}
                  {kasKeluarPeriode.length === 0 ? <EmptyPrintRow colSpan={6} /> : null}
                </PrintTable>
              </PrintSection>
            </>
          ) : null}

          {isDetail && materi.tunggakan ? (
            <PrintSection title={`Rincian Tunggakan (${tunggakanPrint.length} tagihan)`}>
              <PrintTable headers={['Nama', 'NISN', 'Kelas', 'Jenis', 'Nominal', 'Dibayar', 'Diskon', 'Sisa', 'Status']}>
                {tunggakanPrint.map(row => (
                  <tr key={`${row.jenis}-${row.id}`}>
                    <td>{row.nama_lengkap}</td>
                    <td>{row.nisn ?? '-'}</td>
                    <td>{row.kelas ?? '-'}</td>
                    <td>{TUNGGAKAN_LABEL[row.jenis] ?? row.jenis}</td>
                    <td className="whitespace-nowrap text-right">{formatRupiah(row.nominal)}</td>
                    <td className="whitespace-nowrap text-right">{formatRupiah(row.dibayar)}</td>
                    <td className="whitespace-nowrap text-right">{formatRupiah(row.diskon)}</td>
                    <td className="whitespace-nowrap text-right">{formatRupiah(row.sisa)}</td>
                    <td>{String(row.status || '-').replaceAll('_', ' ')}</td>
                  </tr>
                ))}
                {tunggakanPrint.length === 0 ? <EmptyPrintRow colSpan={9} /> : null}
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
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-lg">{value}</p>
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

function DataTablePanel({ title, count, children, className = '' }: { title: string; count: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
      <tbody>{children}</tbody>
    </table>
  )
}

function EmptyPrintRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="py-3 text-center text-slate-500">Tidak ada data sesuai filter.</td></tr>
}
