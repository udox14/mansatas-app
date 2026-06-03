'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DataPagination } from '@/components/ui/data-pagination'
import {
  Search, X, CheckCircle2, AlertCircle, ChevronRight, Printer,
  User, Banknote, Info, RotateCcw, Clock, XCircle, Minus, Ban, ReceiptText,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  getDaftarUlangTransaksiPage,
  getDaftarUlangSiswaData,
  getSiswaBaruDsptPage,
  processDaftarUlang,
  searchSiswaBaruDaftarUlang,
  upsertSiswaBaruDsptTarget,
  voidDaftarUlangTransaksi,
} from './actions'
import { KuitansiModal, useNamaPerugas } from '../components/kuitansi-print'
import type { KuitansiData } from '../components/kuitansi-print'

interface SiswaResult {
  id: string
  nama_lengkap: string
  nisn: string
  tingkat: number | null
  nomor_kelas: number | null
  kelompok: string | null
  tahun_masuk: number | null
}

interface DsptForm {
  nominalTarget: string
  bayarSekarang: string
  metode: 'tunai' | 'transfer'
  diskon: string
  alasanDiskon: string
}

interface SiswaBaruDsptRow {
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  jenis_kelamin: 'L' | 'P' | string | null
  asal_sekolah: string | null
  tahun_masuk: number | null
  dspt_id: string | null
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada' | string
}

interface DaftarUlangTransaksiRow {
  id: string
  nomor_kuitansi: string
  siswa_id: string
  kategori: string
  metode_bayar: string
  jumlah_total: number
  is_void: number
  void_at: string | null
  void_alasan: string | null
  created_at: string
  nama_lengkap: string
  nisn: string | null
  nama_input: string | null
  nama_void: string | null
}

function parseNum(s: string) { return parseInt(s.replace(/\D/g, ''), 10) || 0 }

function fmtKelas(s: SiswaResult) {
  if (!s.tingkat) return '-'
  return `${s.tingkat}-${s.nomor_kelas}${s.kelompok ? ' ' + s.kelompok : ''}`
}

function statusInfo(status: string) {
  switch (status) {
    case 'lunas':
      return { label: 'Lunas', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
    case 'nyicil':
      return { label: 'Nyicil', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    case 'belum_bayar':
      return { label: 'Belum Bayar', icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' }
    default:
      return { label: 'Belum Diinput', icon: Minus, cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
  }
}

function normalizeDsptRow(row: SiswaBaruDsptRow): SiswaBaruDsptRow {
  const target = row.nominal_target ?? 0
  const dibayar = row.total_dibayar ?? 0
  const diskon = row.total_diskon ?? 0
  let status = row.dspt_id ? row.status : 'tidak_ada'
  if (row.dspt_id) {
    const sisa = Math.max(0, target - dibayar - diskon)
    status = sisa <= 0 ? 'lunas' : dibayar > 0 ? 'nyicil' : 'belum_bayar'
  }
  return { ...row, status }
}

function formatTanggal(dateString: string | null) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NumInput({
  label, value, onChange, disabled, placeholder, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  hint?: string
}) {
  const [display, setDisplay] = useState(value)
  useEffect(() => { setDisplay(value) }, [value])

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">{label}</Label>
      <Input
        value={display}
        disabled={disabled}
        placeholder={placeholder ?? '0'}
        className="h-9 text-sm"
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '')
          setDisplay(raw)
          onChange(raw)
        }}
        onFocus={e => setDisplay(e.target.value.replace(/\D/g, ''))}
        onBlur={() => {
          const n = parseNum(display)
          const fmt = n > 0 ? n.toLocaleString('id-ID') : ''
          setDisplay(fmt)
          onChange(String(n))
        }}
      />
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function InlineDsptInput({
  row,
  onSaved,
}: {
  row: SiswaBaruDsptRow
  onSaved: (row: SiswaBaruDsptRow) => void
}) {
  const [value, setValue] = useState(row.nominal_target ? String(row.nominal_target) : '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(row.nominal_target ?? 0)

  useEffect(() => {
    const next = row.nominal_target ?? 0
    lastSavedRef.current = next
    setValue(next > 0 ? String(next) : '')
    setState('idle')
  }, [row.siswa_id, row.nominal_target])

  const save = useCallback(async (raw: string) => {
    const nominal = parseNum(raw)
    if (nominal === lastSavedRef.current) return
    setState('saving')
    const res = await upsertSiswaBaruDsptTarget(row.siswa_id, nominal)
    if (res.error || !res.data) {
      setState('error')
      return
    }
    const fresh = normalizeDsptRow(res.data as SiswaBaruDsptRow)
    lastSavedRef.current = fresh.nominal_target ?? 0
    onSaved(fresh)
    setState('saved')
    window.setTimeout(() => setState('idle'), 1200)
  }, [onSaved, row.siswa_id])

  function scheduleSave(raw: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(raw), 800)
  }

  return (
    <div className="space-y-1">
      <Input
        value={value}
        inputMode="numeric"
        className="h-8 min-w-[140px] text-sm font-mono"
        placeholder="0"
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '')
          setValue(raw)
          setState('idle')
          scheduleSave(raw)
        }}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          save(value)
        }}
      />
      <p className={`text-[10px] ${
        state === 'error' ? 'text-rose-500' : state === 'saved' ? 'text-emerald-600' : 'text-slate-400'
      }`}>
        {state === 'saving' ? 'Menyimpan...' : state === 'saved' ? 'Tersimpan' : state === 'error' ? 'Gagal simpan' : 'Auto-save'}
      </p>
    </div>
  )
}

function SiswaBaruDsptTab() {
  const [rows, setRows] = useState<SiswaBaruDsptRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'semua'>(25)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRows = useCallback(async (nextPage = page, nextPageSize = pageSize, q = search) => {
    setLoading(true)
    setError(null)
    const res = await getSiswaBaruDsptPage({ page: nextPage, pageSize: nextPageSize, q })
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    setRows((res.data as SiswaBaruDsptRow[]).map(normalizeDsptRow))
    setTotal(res.total)
    setLoading(false)
  }, [page, pageSize, search])

  useEffect(() => {
    loadRows(1, pageSize, search)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      loadRows(1, pageSize, val)
    }, 350)
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    loadRows(nextPage, pageSize, search)
  }

  function handlePageSizeChange(nextSize: number | 'semua') {
    setPageSize(nextSize)
    setPage(1)
    loadRows(1, nextSize, search)
  }

  function handleSaved(fresh: SiswaBaruDsptRow) {
    setRows(prev => prev.map(row => row.siswa_id === fresh.siswa_id ? fresh : row))
  }

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari nama, NISN, atau asal sekolah..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="min-w-[220px]">Nama</TableHead>
              <TableHead className="w-16 text-center">L/P</TableHead>
              <TableHead className="min-w-[180px]">Asal Sekolah</TableHead>
              <TableHead className="min-w-[170px]">Nominal DSPT</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="min-w-[130px] text-right">Sisa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-400">
                  Memuat siswa baru...
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-400">
                  Tidak ada siswa baru tanpa kelas.
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map(row => {
              const target = row.nominal_target ?? 0
              const dibayar = row.total_dibayar ?? 0
              const diskon = row.total_diskon ?? 0
              const sisa = Math.max(0, target - dibayar - diskon)
              const info = statusInfo(row.status)
              const StatusIcon = info.icon
              return (
                <TableRow key={row.siswa_id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-400">NISN: {row.nisn ?? '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-slate-100 px-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {row.jenis_kelamin ?? '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {row.asal_sekolah ?? '-'}
                  </TableCell>
                  <TableCell>
                    <InlineDsptInput row={row} onSaved={handleSaved} />
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${info.cls}`}>
                      <StatusIcon className="h-3 w-3" />
                      {info.label}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${sisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatRupiah(sisa)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <DataPagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          entityLabel="siswa baru"
        />
      </div>
    </div>
  )
}

function RiwayatKasirTab() {
  const [rows, setRows] = useState<DaftarUlangTransaksiRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'semua'>(25)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'aktif' | 'void' | 'semua'>('aktif')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRows = useCallback(async (nextPage = page, nextPageSize = pageSize, q = search, nextStatus = status) => {
    setLoading(true)
    const res = await getDaftarUlangTransaksiPage({
      page: nextPage,
      pageSize: nextPageSize,
      q,
      status: nextStatus,
    })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
      setLoading(false)
      return
    }
    setRows(res.data as DaftarUlangTransaksiRow[])
    setTotal(res.total)
    setLoading(false)
  }, [page, pageSize, search, status])

  useEffect(() => {
    loadRows(1, pageSize, search, status)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      loadRows(1, pageSize, val, status)
    }, 350)
  }

  function handleStatus(nextStatus: 'aktif' | 'void' | 'semua') {
    setStatus(nextStatus)
    setPage(1)
    loadRows(1, pageSize, search, nextStatus)
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    loadRows(nextPage, pageSize, search, status)
  }

  function handlePageSizeChange(nextSize: number | 'semua') {
    setPageSize(nextSize)
    setPage(1)
    loadRows(1, nextSize, search, status)
  }

  async function handleVoid(row: DaftarUlangTransaksiRow) {
    const alasan = window.prompt(`Alasan VOID untuk kuitansi ${row.nomor_kuitansi}`)
    if (alasan === null) return
    setMsg(null)
    const res = await voidDaftarUlangTransaksi(row.id, alasan)
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
      return
    }
    setMsg({ type: 'success', text: res.success ?? 'Transaksi berhasil di-void' })
    await loadRows(page, pageSize, search, status)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari siswa, NISN, atau nomor kuitansi..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={status} onValueChange={v => handleStatus(v as 'aktif' | 'void' | 'semua')}>
          <SelectTrigger className="h-8 w-32 rounded-md text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="semua">Semua</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {msg && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          msg.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="min-w-[140px]">Waktu</TableHead>
              <TableHead className="min-w-[220px]">Siswa</TableHead>
              <TableHead className="min-w-[160px]">No. Kuitansi</TableHead>
              <TableHead className="min-w-[120px] text-right">Jumlah</TableHead>
              <TableHead className="min-w-[140px]">Petugas</TableHead>
              <TableHead className="min-w-[180px]">Status</TableHead>
              <TableHead className="w-24">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-400">
                  Memuat riwayat kasir...
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-400">
                  Tidak ada transaksi daftar ulang.
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map(row => (
              <TableRow key={row.id} className={row.is_void ? 'opacity-70' : ''}>
                <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                  {formatTanggal(row.created_at)}
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">NISN: {row.nisn ?? '-'}</p>
                </TableCell>
                <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {row.nomor_kuitansi}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">
                  {formatRupiah(row.jumlah_total)}
                </TableCell>
                <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                  {row.nama_input ?? '-'}
                </TableCell>
                <TableCell>
                  {row.is_void ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                        <Ban className="h-3 w-3" /> VOID
                      </span>
                      <p className="text-[10px] text-rose-500">{row.void_alasan}</p>
                      <p className="text-[10px] text-slate-400">
                        {row.nama_void ?? '-'} · {formatTanggal(row.void_at)}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Aktif
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!row.is_void}
                    className="h-7 gap-1 px-2 text-[11px] text-rose-600 hover:text-rose-700"
                    onClick={() => handleVoid(row)}
                  >
                    <Ban className="h-3 w-3" /> Void
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DataPagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          entityLabel="transaksi"
        />
      </div>
    </div>
  )
}

export function DaftarUlangClient({
  tahunAjaranId,
  tahunAjaranNama,
}: {
  tahunAjaranId: string
  tahunAjaranNama: string
}) {
  const { namaKomite } = useNamaPerugas()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SiswaResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null)
  const [existingDsptId, setExistingDsptId] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dspt, setDspt] = useState<DsptForm>({
    nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '',
  })

  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [kuitansiDspt, setKuitansiDspt] = useState<KuitansiData | null>(null)
  const [showKuitansi, setShowKuitansi] = useState(false)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleSearch = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchSiswaBaruDaftarUlang(val)
      setSearchResults(res.data as SiswaResult[])
      setShowDropdown(true)
      setIsSearching(false)
    }, 300)
  }, [])

  async function handleSelectSiswa(s: SiswaResult) {
    setSelectedSiswa(s)
    setQuery('')
    setSearchResults([])
    setShowDropdown(false)
    setMsg(null)
    setIsLoadingData(true)
    setExistingDsptId(null)

    const data = await getDaftarUlangSiswaData(s.id, tahunAjaranId)
    setIsLoadingData(false)

    if (!data.siswa) {
      setSelectedSiswa(null)
      setMsg({ type: 'error', text: 'Siswa baru tidak ditemukan atau sudah memiliki kelas' })
      return
    }

    if (data.dspt) {
      setExistingDsptId(data.dspt.id)
      setDspt(prev => ({
        ...prev,
        nominalTarget: String(data.dspt.nominal_target),
        bayarSekarang: '',
        diskon: '',
        alasanDiskon: '',
      }))
    } else {
      setDspt({ nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '' })
    }
  }

  function handleReset() {
    setSelectedSiswa(null)
    setExistingDsptId(null)
    setDspt({ nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '' })
    setMsg(null)
    setKuitansiDspt(null)
    setShowKuitansi(false)
  }

  const dsptTarget = parseNum(dspt.nominalTarget)
  const dsptBayar = parseNum(dspt.bayarSekarang)
  const dsptDiskon = parseNum(dspt.diskon)
  const dsptSisa = Math.max(0, dsptTarget - dsptBayar - dsptDiskon)
  const canSubmit = !!selectedSiswa && dsptTarget > 0

  function handleSubmit() {
    if (!selectedSiswa || !canSubmit) return
    setMsg(null)

    startTransition(async () => {
      const result = await processDaftarUlang(
        {
          siswaId: selectedSiswa.id,
          tahunAjaranId,
          dspt: {
            nominalTarget: dsptTarget,
            bayarSekarang: dsptBayar,
            metode: dspt.metode,
            diskon: dsptDiskon,
            alasanDiskon: dspt.alasanDiskon,
            existingDsptId,
          },
        },
        namaKomite,
      )

      if (result.error) {
        setMsg({ type: 'error', text: result.error })
        return
      }

      setMsg({ type: 'success', text: 'Data berhasil disimpan!' })
      if (result.kuitansiDspt) {
        setKuitansiDspt(result.kuitansiDspt)
        setShowKuitansi(true)
      }
    })
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 dark:border-slate-700 rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          Tahun Ajaran Aktif: <span className="font-semibold text-slate-700 dark:text-slate-300">{tahunAjaranNama}</span>
          <span className="ml-auto text-slate-400">Petugas: {namaKomite}</span>
        </div>

        <Tabs defaultValue="kasir" className="space-y-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="kasir" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Kasir
            </TabsTrigger>
            <TabsTrigger value="siswa-baru" className="gap-1.5">
              <User className="h-3.5 w-3.5" /> Siswa Baru
            </TabsTrigger>
            <TabsTrigger value="riwayat" className="gap-1.5">
              <ReceiptText className="h-3.5 w-3.5" /> Riwayat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kasir" className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Pilih Siswa</p>
          </div>

          {selectedSiswa ? (
            <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{selectedSiswa.nama_lengkap}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  NISN: {selectedSiswa.nisn ?? '-'} · Kelas: {fmtKelas(selectedSiswa)} · Angkatan {selectedSiswa.tahun_masuk ?? '-'}
                </p>
              </div>
              {existingDsptId && (
                <span className="text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                  Sudah ada data DSPT
                </span>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleReset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Cari siswa baru tanpa kelas..."
                className="pl-10 h-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      onClick={() => handleSelectSiswa(s)}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{s.nama_lengkap}</p>
                        <p className="text-[11px] text-slate-400">{s.nisn ?? '-'} · {fmtKelas(s)} · Angkatan {s.tahun_masuk ?? '-'}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && !isSearching && query.length >= 2 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
                  Tidak ada siswa ditemukan
                </div>
              )}
            </div>
          )}
        </div>

        {isLoadingData && (
          <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
            <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Memuat data siswa...
          </div>
        )}

        {selectedSiswa && !isLoadingData && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 dark:border-slate-700 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">DSPT</p>
              <span className="text-[11px] text-slate-400 ml-auto">Dana Sumbangan Pendidikan Tahunan</span>
            </div>

            {existingDsptId && (
              <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Siswa sudah memiliki tagihan DSPT — nominal target akan diperbarui
              </div>
            )}

            <div className="p-4 space-y-3">
              <NumInput
                label="Nominal Target DSPT (Rp)"
                value={dspt.nominalTarget}
                onChange={v => setDspt(p => ({ ...p, nominalTarget: v }))}
                placeholder="Contoh: 2.500.000"
                hint="Sesuai kesepakatan dengan orang tua/wali"
              />
              <NumInput
                label="Bayar Sekarang (Rp)"
                value={dspt.bayarSekarang}
                onChange={v => setDspt(p => ({ ...p, bayarSekarang: v }))}
                placeholder="Isi 0 jika hanya mencatat target tanpa bayar"
                hint={parseNum(dspt.bayarSekarang) === 0 ? 'Kosong/0 = tidak ada kuitansi DSPT' : undefined}
              />
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">Metode Pembayaran</Label>
                <Select value={dspt.metode} onValueChange={v => setDspt(p => ({ ...p, metode: v as 'tunai' | 'transfer' }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tunai">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumInput
                  label="Diskon / Keringanan (Rp)"
                  value={dspt.diskon}
                  onChange={v => setDspt(p => ({ ...p, diskon: v }))}
                  placeholder="0"
                />
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">Alasan Diskon</Label>
                  <Input
                    value={dspt.alasanDiskon}
                    onChange={e => setDspt(p => ({ ...p, alasanDiskon: e.target.value }))}
                    placeholder="Anak guru, beasiswa..."
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {dsptTarget > 0 && (
                <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Target DSPT</span>
                    <span className="font-mono">{formatRupiah(dsptTarget)}</span>
                  </div>
                  {dsptBayar > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Bayar sekarang</span>
                      <span className="font-mono">- {formatRupiah(dsptBayar)}</span>
                    </div>
                  )}
                  {dsptDiskon > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Diskon</span>
                      <span className="font-mono">- {formatRupiah(dsptDiskon)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-sm pt-1 border-t border-slate-100 dark:border-slate-700">
                    <span className={dsptSisa === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {dsptSisa === 0 ? 'Lunas' : 'Sisa Tagihan'}
                    </span>
                    <span className={`font-mono ${dsptSisa === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatRupiah(dsptSisa)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700'
              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-700'
          }`}>
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {msg.text}
            {msg.type === 'success' && kuitansiDspt && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs gap-1.5"
                onClick={() => setShowKuitansi(true)}
              >
                <Printer className="h-3 w-3" /> Buka Kuitansi Lagi
              </Button>
            )}
          </div>
        )}

        {selectedSiswa && !isLoadingData && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dsptTarget > 0 && (
                  <span>
                    DSPT: <strong>{formatRupiah(dsptTarget)}</strong>
                    {dsptBayar > 0 ? ` (bayar ${formatRupiah(dsptBayar)})` : ' (target saja)'}
                  </span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs gap-1.5 text-slate-400"
              onClick={handleReset}
              disabled={isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              className="h-9 text-sm gap-2 px-6 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
            >
              {isPending ? (
                <><div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</>
              ) : (
                <><Printer className="h-4 w-4" /> Simpan &amp; Cetak Kuitansi</>
              )}
            </Button>
          </div>
        )}
          </TabsContent>

          <TabsContent value="siswa-baru" className="space-y-4">
            <SiswaBaruDsptTab />
          </TabsContent>

          <TabsContent value="riwayat" className="space-y-4">
            <RiwayatKasirTab />
          </TabsContent>
        </Tabs>
      </div>

      <KuitansiModal
        data={kuitansiDspt}
        open={showKuitansi}
        onClose={() => setShowKuitansi(false)}
      />
    </>
  )
}
