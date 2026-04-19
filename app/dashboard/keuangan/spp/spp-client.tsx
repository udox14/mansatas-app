'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, CheckCircle2, XCircle, Settings2, Upload, Check, Pencil, CalendarDays } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { updateSppSetting, getSppTagihanList, tandaiSppLunas, updateSppTagihanNominal, importSppBulk, getSiswaTemplate, getSppMulaiList, setSppMulaiAngkatan } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface SppSetting { id: string; tingkat: number; nominal: number; aktif: number }
interface SppRow {
  id: string | null
  siswa_id: string; nama_lengkap: string; nisn: string
  bulan: number; tahun: number; nominal: number
  total_dibayar: number; total_diskon: number; status: string
  tingkat: number; nomor_kelas: number; kelompok: string; tahun_masuk: number
}

const BULAN_LABEL = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

async function downloadSppTemplate(bulan: number, tahun: number, angkatan?: number) {
  const XLSX = await import('xlsx')
  const { data } = await getSiswaTemplate(angkatan)
  const rows = data.map((s: any) => ({
    'NISN': s.nisn ?? '',
    'Nama Siswa': s.nama_lengkap,
    'Angkatan': s.tahun_masuk ?? '',
    'Kelas': s.tingkat ? `${s.tingkat}-${s.nomor_kelas}${s.kelompok ? ' ' + s.kelompok : ''}` : '',
    'Bulan': bulan,
    'Tahun': tahun,
    'Nominal': '',
    'Total Dibayar': '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'SPP')
  const suffix = angkatan ? `_angkatan_${angkatan}` : '_semua'
  XLSX.writeFile(wb, `template_spp_${bulan}_${tahun}${suffix}.xlsx`)
}

interface SppMulai { id: string; tahun_masuk: number | null; siswa_id: string | null; bulan_mulai: number; tahun_mulai: number }

interface SaldoAwalStats { total: number; total_jumlah: number; total_dibayar: number; belum_lunas: number }
interface SaldoAwalRow { siswa_id: string; status: string; jumlah: number; total_dibayar: number }

export function SppClient({ initialSettings, initialTagihan, defaultTahun, defaultBulan, angkatanList, initialMulai, saldoAwalStats, saldoAwalList }: {
  initialSettings: SppSetting[]
  initialTagihan: SppRow[]
  defaultTahun: number
  defaultBulan: number
  angkatanList: number[]
  initialMulai: SppMulai[]
  saldoAwalStats: SaldoAwalStats | null
  saldoAwalList: SaldoAwalRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [settings, setSettings] = useState<SppSetting[]>(initialSettings)
  const [tagihan, setTagihan] = useState<SppRow[]>(initialTagihan)
  const [mulaiList, setMulaiList] = useState<SppMulai[]>(initialMulai)

  // Map siswa_id → saldo awal (untuk lookup O(1) di tabel)
  const saldoAwalMap = useMemo(() => {
    const m = new Map<string, SaldoAwalRow>()
    for (const s of saldoAwalList) m.set(s.siswa_id, s)
    return m
  }, [saldoAwalList])

  // Period selector
  const [bulan, setBulan] = useState(defaultBulan)
  const [tahun, setTahun] = useState(defaultTahun)

  // Filter & search
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')
  const [filterKelas, setFilterKelas] = useState('semua')

  // Mulai SPP edit state
  const [mulaiEditAngkatan, setMulaiEditAngkatan] = useState<number | null>(null)
  const [mulaiFormBulan, setMulaiFormBulan] = useState('1')
  const [mulaiFormTahun, setMulaiFormTahun] = useState(String(defaultTahun))
  const [mulaiMsg, setMulaiMsg] = useState('')

  const [msg, setMsg] = useState('')

  // Apakah siswa sudah melewati tanggal mulai SPP untuk periode yang dipilih?
  // Prioritas: override per-siswa → level angkatan
  function isSudahMulai(row: SppRow): boolean {
    const mulai =
      mulaiList.find(m => m.siswa_id === row.siswa_id) ??          // per-student override
      mulaiList.find(m => m.tahun_masuk === row.tahun_masuk && !m.siswa_id)  // level angkatan
    if (!mulai) return false
    if (mulai.tahun_mulai < tahun) return true
    if (mulai.tahun_mulai === tahun && mulai.bulan_mulai <= bulan) return true
    return false
  }
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)


  // Modal edit tagihan (nominal + dibayar)
  const [editModal, setEditModal] = useState<SppRow | null>(null)
  const [editNominal, setEditNominal] = useState('')
  const [editDibayar, setEditDibayar] = useState('')
  const [editMsg, setEditMsg] = useState('')

  // Modal import Excel
  const [importModal, setImportModal] = useState(false)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importMsg, setImportMsg] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateAngkatan, setTemplateAngkatan] = useState('semua')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load data saat periode berubah ────────────────────────────────────────
  async function loadData(b: number, t: number) {
    startTransition(async () => {
      const res = await getSppTagihanList({ bulan: b, tahun: t })
      setTagihan(res.data as SppRow[])
      reset()
    })
  }

  function handleBulanChange(val: string) {
    const b = parseInt(val)
    setBulan(b)
    loadData(b, tahun)
  }

  function handleTahunChange(val: string) {
    const t = parseInt(val)
    setTahun(t)
    loadData(bulan, t)
  }

  // ── Filter lists ──────────────────────────────────────────────────────────
  const kelasList = useMemo(() => {
    const set = new Set<string>()
    tagihan.forEach(d => {
      if (d.tingkat && d.nomor_kelas) set.add(`${d.tingkat}-${d.nomor_kelas}${d.kelompok ? ' ' + d.kelompok : ''}`)
    })
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [tagihan])

  const filtered = useMemo(() => {
    reset()
    return tagihan.filter(r => {
      const matchS = !search || r.nama_lengkap.toLowerCase().includes(search.toLowerCase())
      const matchSt = filterStatus === 'semua'
        ? true
        : filterStatus === 'ada_tunggakan_awal'
          ? saldoAwalMap.has(r.siswa_id)
          : r.status === filterStatus
      const matchAngkatan = filterAngkatan === 'semua' || String(r.tahun_masuk) === filterAngkatan
      const matchKelas = filterKelas === 'semua' || `${r.tingkat}-${r.nomor_kelas}${r.kelompok ? ' ' + r.kelompok : ''}` === filterKelas
      return matchS && matchSt && matchAngkatan && matchKelas
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagihan, search, filterStatus, filterAngkatan, filterKelas])

  const paginated = paginate(filtered)

  // ── Summary (hanya siswa yang sudah ada tagihan) ──────────────────────────
  const withTagihan = filtered.filter(r => r.status !== 'tidak_ada')
  const tidakAda    = filtered.filter(r => r.status === 'tidak_ada').length

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleSaveSetting(tingkat: number) {
    const s = settings.find(x => x.tingkat === tingkat)
    if (!s) return
    startTransition(async () => {
      const res = await updateSppSetting(s.tingkat, s.nominal, s.aktif)
      setMsg(res.error ?? res.success ?? '')
    })
  }

  function openMulaiEdit(tahunMasuk: number) {
    const existing = mulaiList.find(m => m.tahun_masuk === tahunMasuk)
    setMulaiEditAngkatan(tahunMasuk)
    setMulaiFormBulan(String(existing?.bulan_mulai ?? 1))
    setMulaiFormTahun(String(existing?.tahun_mulai ?? defaultTahun))
    setMulaiMsg('')
  }

  async function handleSaveMulai(e: React.FormEvent) {
    e.preventDefault()
    if (!mulaiEditAngkatan) return
    startTransition(async () => {
      const res = await setSppMulaiAngkatan(mulaiEditAngkatan, parseInt(mulaiFormBulan), parseInt(mulaiFormTahun))
      setMulaiMsg(res.error ?? res.success ?? '')
      if (!res.error) {
        const fresh = await getSppMulaiList()
        setMulaiList(fresh.data as SppMulai[])
        setMulaiEditAngkatan(null)
        setMsg(res.success ?? '')
      }
    })
  }

  async function handleLunasSpp(row: SppRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (!row.id) return
    startTransition(async () => {
      const res = await tandaiSppLunas(row.id!)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) {
        const fresh = await getSppTagihanList({ bulan, tahun })
        setTagihan(fresh.data as SppRow[])
      }
    })
  }

  function openEditModal(row: SppRow) {
    setEditModal(row)
    setEditNominal(String(row.nominal))
    setEditDibayar(String(row.total_dibayar))
    setEditMsg('')
  }

  async function handleEditSave() {
    if (!editModal?.id) return
    startTransition(async () => {
      const res = await updateSppTagihanNominal(editModal.id!, parseInt(editNominal) || 0, parseInt(editDibayar) || 0)
      setEditMsg(res.error ?? '')
      if (!res.error) {
        setEditModal(null)
        setMsg(res.success ?? '')
        const fresh = await getSppTagihanList({ bulan, tahun })
        setTagihan(fresh.data as SppRow[])
      }
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true); setImportMsg('')
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      setImportRows(XLSX.utils.sheet_to_json(ws, { defval: '' }))
    } catch {
      setImportMsg('Gagal membaca file. Pastikan format .xlsx/.xls')
    } finally {
      setImportLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleImportSubmit() {
    if (!importRows.length) return
    setImportLoading(true); setImportMsg('')
    const mapped = importRows.map(r => ({
      nisn: String(r['NISN'] ?? r['nisn'] ?? '').trim() || undefined,
      nama: String(r['Nama'] ?? r['NAMA'] ?? r['Nama Siswa'] ?? r['nama_lengkap'] ?? '').trim() || undefined,
      bulan: parseInt(String(r['Bulan'] ?? r['bulan'] ?? bulan)) || bulan,
      tahun: parseInt(String(r['Tahun'] ?? r['tahun'] ?? tahun)) || tahun,
      nominal: parseInt(String(r['Nominal'] ?? r['nominal'] ?? 0)) || 0,
      total_dibayar: parseInt(String(r['Total Dibayar'] ?? r['Dibayar'] ?? r['total_dibayar'] ?? 0)) || 0,
    })).filter(r => r.nisn || r.nama)
    const res = await importSppBulk(mapped)
    setImportMsg((res.error ? res.error + ' — ' : '') + res.success)
    if (!res.error || res.sukses > 0) {
      const fresh = await getSppTagihanList({ bulan, tahun })
      setTagihan(fresh.data as SppRow[])
      setImportRows([])
    }
    setImportLoading(false)
  }

  // ── Tahun options: 3 tahun ke belakang sampai 2 tahun ke depan ────────────
  const tahunOptions = Array.from({ length: 6 }, (_, i) => defaultTahun - 3 + i)

  return (
    <>
    <Tabs defaultValue="tagihan" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="tagihan" className="text-xs h-7 px-3">Daftar Tagihan</TabsTrigger>
          <TabsTrigger value="setting" className="text-xs h-7 px-3 gap-1.5">
            <Settings2 className="h-3 w-3" />Nominal SPP
          </TabsTrigger>
          <TabsTrigger value="mulai" className="text-xs h-7 px-3 gap-1.5">
            <CalendarDays className="h-3 w-3" />Mulai SPP
          </TabsTrigger>
        </TabsList>
        {msg && (
          <p className={`text-xs px-3 py-1 rounded-md ${msg.startsWith('Error') || msg.includes('tidak') ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-900/20'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* ── Tab: Daftar Tagihan ─────────────────────────────────────────── */}
      <TabsContent value="tagihan" className="space-y-3 mt-0">

        {/* Baris 1: Period + Buat Semua */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2 items-center">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Periode:</p>
          <Select value={String(bulan)} onValueChange={handleBulanChange} disabled={isPending}>
            <SelectTrigger className="h-8 w-32 text-xs rounded-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BULAN_LABEL.slice(1).map((b, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(tahun)} onValueChange={handleTahunChange} disabled={isPending}>
            <SelectTrigger className="h-8 w-24 text-xs rounded-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tahunOptions.map(t => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
              onClick={() => { setImportModal(true); setImportRows([]); setImportMsg('') }}>
              <Upload className="h-3.5 w-3.5" /> Import Excel
            </Button>
          </div>
        </div>

        {/* Baris 2: Filter & Search */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Cari nama siswa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-44 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
              <SelectItem value="tidak_ada">Belum Ada Tagihan</SelectItem>
              {saldoAwalList.length > 0 && (
                <SelectItem value="ada_tunggakan_awal">Ada Tunggakan Awal</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
            <SelectTrigger className="h-8 w-32 text-xs rounded-md"><SelectValue placeholder="Angkatan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Angkatan</SelectItem>
              {angkatanList.map(y => (
                <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="h-8 w-28 text-xs rounded-md"><SelectValue placeholder="Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas</SelectItem>
              {kelasList.map(k => (
                <SelectItem key={k} value={k}>Kelas {k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total Tagihan', value: formatRupiah(withTagihan.reduce((s, r) => s + r.nominal, 0)), color: 'text-slate-900 dark:text-slate-50' },
            { label: 'Terkumpul', value: formatRupiah(withTagihan.reduce((s, r) => s + r.total_dibayar, 0)), color: 'text-emerald-600' },
            { label: 'Belum Bayar', value: withTagihan.filter(r => r.status === 'belum_bayar').length + ' siswa', color: 'text-rose-600' },
            { label: 'Belum Ada Tagihan', value: tidakAda + ' siswa', color: tidakAda > 0 ? 'text-amber-600' : 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {/* Saldo Awal (Migrasi) — tampil hanya jika ada data */}
        {saldoAwalStats && saldoAwalStats.total > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 flex flex-wrap gap-4 items-center">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 shrink-0">Tunggakan Awal (Migrasi)</p>
            <div className="flex gap-4 text-xs">
              <span className="text-slate-600 dark:text-slate-400 dark:text-slate-300">Total: <strong>{formatRupiah(saldoAwalStats.total_jumlah ?? 0)}</strong></span>
              <span className="text-emerald-600">Terbayar: <strong>{formatRupiah(saldoAwalStats.total_dibayar ?? 0)}</strong></span>
              <span className="text-rose-600">Sisa: <strong>{formatRupiah((saldoAwalStats.total_jumlah ?? 0) - (saldoAwalStats.total_dibayar ?? 0))}</strong></span>
              {saldoAwalStats.belum_lunas > 0 && (
                <span className="text-amber-700 dark:text-amber-400">{saldoAwalStats.belum_lunas} siswa belum lunas</span>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                <TableHead className="text-xs font-semibold">Kelas</TableHead>
                <TableHead className="text-xs font-semibold text-right">Nominal</TableHead>
                <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="w-32 text-xs font-semibold text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-slate-300 dark:border-slate-700 border-t-slate-600 rounded-full animate-spin" />
                      Memuat data...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isPending && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              )}
              {!isPending && paginated.map((row, idx) => {
                const noTagihan = row.status === 'tidak_ada'
                const sudahMulai = isSudahMulai(row)
                const saldoAwal = saldoAwalMap.get(row.siswa_id)
                return (
                  <TableRow
                    key={row.id ?? `${row.siswa_id}-${idx}`}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=spp`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                        {saldoAwal && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            saldoAwal.status === 'lunas'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {saldoAwal.status === 'lunas' ? 'T.Awal ✓' : `T.Awal ${formatRupiah(saldoAwal.jumlah - saldoAwal.total_dibayar)}`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{row.nisn}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-300">
                      {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {noTagihan ? <span className="text-slate-300 dark:text-slate-600">—</span> : formatRupiah(row.nominal)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-emerald-600">
                      {noTagihan ? <span className="text-slate-300 dark:text-slate-600">—</span> : formatRupiah(row.total_dibayar)}
                    </TableCell>
                    <TableCell>
                      {noTagihan ? (
                        <span className="text-[11px] text-slate-400 italic">
                          {sudahMulai ? 'Buka buku besar' : 'Belum mulai'}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          row.status === 'lunas'
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {row.status === 'lunas' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {row.status === 'lunas' ? 'Lunas' : 'Belum Bayar'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {!noTagihan && (
                          <>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                              onClick={e => { e.stopPropagation(); openEditModal(row) }} title="Edit">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {row.status !== 'lunas' && (
                              <Button size="sm" variant="ghost"
                                className="h-6 text-[11px] px-2 gap-1 text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                onClick={e => handleLunasSpp(row, e)} disabled={isPending}>
                                <Check className="h-3 w-3" /> Lunas
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <DataPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entityLabel="siswa"
          />
        </div>
      </TabsContent>

      {/* ── Tab: Pengaturan ─────────────────────────────────────────────── */}
      <TabsContent value="setting" className="mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Pengaturan SPP per Tingkat</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nominal SPP per bulan untuk masing-masing tingkat kelas. Dipakai saat tagihan dibuat otomatis maupun massal. Jika diubah, semua tagihan yang belum lunas akan otomatis ikut diperbarui.</p>
          </div>
          {settings.map(s => (
            <div key={s.tingkat} className="px-4 py-4 flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kelas {s.tingkat}</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings(prev => prev.map(x => x.tingkat === s.tingkat ? { ...x, aktif: x.aktif ? 0 : 1 } : x))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.aktif ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 shadow-sm transform transition-transform ${s.aktif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className={`text-xs font-medium ${s.aktif ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {s.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs font-medium">Nominal per Bulan</Label>
                <Input
                  type="number" min={0}
                  value={s.nominal}
                  onChange={e => setSettings(prev => prev.map(x => x.tingkat === s.tingkat ? { ...x, nominal: parseInt(e.target.value) || 0 } : x))}
                  className="h-9 text-sm"
                />
              </div>
              <Button size="sm" className="h-9 text-xs" onClick={() => handleSaveSetting(s.tingkat)} disabled={isPending}>
                Simpan Kelas {s.tingkat}
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* ── Tab: Mulai SPP per Angkatan ──────────────────────────────────── */}
      <TabsContent value="mulai" className="mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Mulai SPP per Angkatan</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tentukan sejak kapan tagihan SPP berlaku untuk tiap angkatan. Bulan sebelum tanggal ini tidak akan ditampilkan di buku besar siswa.
              Override per siswa bisa diatur langsung di buku besar siswa (ikon pensil di tab SPP).
            </p>
          </div>
          {angkatanList.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Tidak ada data angkatan</div>
          )}
          {angkatanList.map(angkatan => {
            const existing = mulaiList.find(m => m.tahun_masuk === angkatan)
            return (
              <div key={angkatan} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Angkatan {angkatan}</p>
                  <p className="text-[11px] text-slate-400">
                    {existing
                      ? `Mulai: ${BULAN_LABEL[existing.bulan_mulai]} ${existing.tahun_mulai}`
                      : <span className="text-amber-500">Belum diatur</span>
                    }
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => openMulaiEdit(angkatan)}>
                  <Pencil className="h-3 w-3" />{existing ? 'Ubah' : 'Atur'}
                </Button>
              </div>
            )
          })}
        </div>
      </TabsContent>
    </Tabs>

    {/* ── Modal Atur Mulai SPP per Angkatan ─────────────────────────────── */}
    <Dialog open={mulaiEditAngkatan !== null} onOpenChange={v => { if (!v) setMulaiEditAngkatan(null) }}>
      <DialogContent className="sm:max-w-xs rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
          <DialogTitle className="text-sm font-semibold">Mulai SPP — Angkatan {mulaiEditAngkatan}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSaveMulai} className="p-5 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tagihan SPP akan dimulai dari bulan dan tahun yang dipilih. Bulan sebelumnya tidak akan ditagih.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bulan Mulai</Label>
              <Select value={mulaiFormBulan} onValueChange={setMulaiFormBulan}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BULAN_LABEL.slice(1).map((b, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tahun Mulai</Label>
              <Input type="number" value={mulaiFormTahun}
                onChange={e => setMulaiFormTahun(e.target.value)}
                className="h-9 text-sm" min={2020} max={2040} />
            </div>
          </div>
          {mulaiMsg && <p className={`text-xs px-3 py-2 rounded-md ${mulaiMsg.includes('disimpan') ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' : 'text-rose-600 bg-rose-50'}`}>{mulaiMsg}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setMulaiEditAngkatan(null)}>Batal</Button>
            <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* ── Modal Edit Tagihan SPP ──────────────────────────────────────────── */}
    <Dialog open={!!editModal} onOpenChange={v => { if (!v) setEditModal(null) }}>
      <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
          <DialogTitle className="text-sm font-semibold">Edit Tagihan SPP</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
            <p className="font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">{editModal?.nama_lengkap}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {BULAN_LABEL[bulan]} {tahun}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nominal (Rp)</Label>
              <Input type="number" min={0} value={editNominal} onChange={e => setEditNominal(e.target.value)} className="h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Total Dibayar (Rp)</Label>
              <Input type="number" min={0} value={editDibayar} onChange={e => setEditDibayar(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {editModal && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
              Sisa: {formatRupiah(Math.max(0, (parseInt(editNominal) || 0) - (parseInt(editDibayar) || 0) - (editModal.total_diskon ?? 0)))}
            </div>
          )}
          {editMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{editMsg}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setEditModal(null)}>Batal</Button>
            <Button size="sm" className="flex-1 h-9 text-sm" disabled={isPending} onClick={handleEditSave}>
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Modal Import Excel SPP ──────────────────────────────────────────── */}
    <Dialog open={importModal} onOpenChange={v => { if (!v) { setImportModal(false); setImportRows([]) } }}>
      <DialogContent className="sm:max-w-2xl rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
          <DialogTitle className="text-sm font-semibold">Import Data SPP dari Excel</DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Download Template */}
          <div className="bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-2.5">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 dark:text-emerald-300">Download Template Excel</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Template sudah terisi nama & NISN semua siswa, plus kolom Bulan ({bulan}) dan Tahun ({tahun}). Tinggal isi Nominal & Total Dibayar.
            </p>
            <div className="flex gap-2 items-center">
              <Select value={templateAngkatan} onValueChange={setTemplateAngkatan}>
                <SelectTrigger className="h-8 text-xs flex-1 bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Angkatan</SelectItem>
                  {angkatanList.map(y => <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 whitespace-nowrap"
                disabled={templateLoading}
                onClick={async () => {
                  setTemplateLoading(true)
                  await downloadSppTemplate(bulan, tahun, templateAngkatan !== 'semua' ? parseInt(templateAngkatan) : undefined)
                  setTemplateLoading(false)
                }}>
                <Upload className="h-3.5 w-3.5 rotate-180" />
                {templateLoading ? 'Menyiapkan...' : 'Download Template'}
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 mb-2">Upload File yang Sudah Diisi</p>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
              Kolom: <strong>NISN</strong>, <strong>Nama Siswa</strong>, <strong>Bulan</strong>, <strong>Tahun</strong>, <strong>Nominal</strong>, <strong>Total Dibayar</strong>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Pilih File (.xlsx / .xls)</Label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:text-xs file:font-medium file:border-0 file:bg-slate-100 dark:file:bg-slate-800/80 file:px-3 file:py-1.5 file:rounded-md hover:file:bg-slate-200 cursor-pointer" />
          </div>
          {importLoading && <p className="text-xs text-slate-400 animate-pulse">Membaca file...</p>}
          {importRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{importRows.length} baris terdeteksi — preview 5 baris pertama:</p>
              <div className="border border-slate-200 dark:border-slate-800 dark:border-slate-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="text-[11px] w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {Object.keys(importRows[0]).map(k => (
                        <th key={k} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap border-b border-slate-200 dark:border-slate-800 dark:border-slate-700">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        {Object.values(r).map((v: any, j) => (
                          <td key={j} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {importMsg && (
            <p className={`text-xs px-3 py-2 rounded-md ${importMsg.includes('berhasil') && !importMsg.startsWith('0') ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' : 'text-rose-600 bg-rose-50'}`}>
              {importMsg}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => { setImportModal(false); setImportRows([]) }}>Tutup</Button>
            <Button size="sm" className="flex-1 h-9 text-sm gap-1.5" disabled={!importRows.length || importLoading || isPending} onClick={handleImportSubmit}>
              <Upload className="h-3.5 w-3.5" />
              {importLoading ? 'Mengimport...' : `Import ${importRows.length} Baris`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
