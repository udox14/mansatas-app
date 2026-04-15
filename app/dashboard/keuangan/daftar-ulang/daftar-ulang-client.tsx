'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, X, CheckCircle2, AlertCircle, ChevronRight, Printer,
  User, Banknote, ShoppingBag, Info, RotateCcw,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { searchSiswa } from '../actions'
import { getDaftarUlangSiswaData, processDaftarUlang } from './actions'
import { KuitansiGandaModal, useNamaPerugas } from '../components/kuitansi-print'
import type { KuitansiData } from '../components/kuitansi-print'
import type { KopItemParam } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterItem {
  id: string; nama_item: string; nominal_default: number; urutan: number
}

interface SiswaResult {
  id: string; nama_lengkap: string; nisn: string
  tingkat: number | null; nomor_kelas: number | null; kelompok: string | null
  tahun_masuk: number | null
}

interface KopItemRow {
  masterItemId: string
  namaItem: string
  nominal: string
  checked: boolean
  diskon: string
  existingItemId: string | null
}

interface DsptForm {
  nominalTarget: string
  bayarSekarang: string
  metode: 'tunai' | 'transfer'
  diskon: string
  alasanDiskon: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string) { return parseInt(s.replace(/\D/g, ''), 10) || 0 }

function fmtKelas(s: SiswaResult) {
  if (!s.tingkat) return '-'
  return `${s.tingkat}-${s.nomor_kelas}${s.kelompok ? ' ' + s.kelompok : ''}`
}

// ─── Numeric Input (format ribuan saat blur) ──────────────────────────────────

function NumInput({
  label, value, onChange, disabled, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  disabled?: boolean; placeholder?: string; hint?: string
}) {
  const [display, setDisplay] = useState(value)
  useEffect(() => { setDisplay(value) }, [value])
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</Label>
      <Input
        value={display}
        disabled={disabled}
        placeholder={placeholder ?? '0'}
        className="h-9 text-sm"
        onChange={e => { const raw = e.target.value.replace(/\D/g, ''); setDisplay(raw); onChange(raw) }}
        onFocus={e => { const raw = e.target.value.replace(/\D/g, ''); setDisplay(raw) }}
        onBlur={() => {
          const n = parseNum(display)
          const fmt = n > 0 ? n.toLocaleString('id-ID') : ''
          setDisplay(fmt); onChange(String(n))
        }}
      />
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DaftarUlangClient({
  masterItems, tahunAjaranId, tahunAjaranNama,
}: {
  masterItems: MasterItem[]
  tahunAjaranId: string
  tahunAjaranNama: string
}) {
  const { namaKomite, namaKoperasi: namaKoperasiPetugas } = useNamaPerugas()

  // ── Search state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SiswaResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Selected siswa & loaded data ────────────────────────────────────────────
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null)
  const [existingDsptId, setExistingDsptId] = useState<string | null>(null)
  const [existingKopId, setExistingKopId] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // ── DSPT form ───────────────────────────────────────────────────────────────
  const [dspt, setDspt] = useState<DsptForm>({
    nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '',
  })

  // ── Koperasi form ────────────────────────────────────────────────────────────
  const [kopItems, setKopItems] = useState<KopItemRow[]>([])
  const [kopMetode, setKopMetode] = useState<'tunai' | 'transfer'>('tunai')

  // ── Status & kuitansi ────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [kuitansiDspt, setKuitansiDspt] = useState<KuitansiData | null>(null)
  const [kuitansiKop, setKuitansiKop] = useState<KuitansiData | null>(null)
  const [showKuitansi, setShowKuitansi] = useState(false)

  // ── Init kop items dari master ──────────────────────────────────────────────
  useEffect(() => {
    setKopItems(masterItems.map(m => ({
      masterItemId: m.id,
      namaItem: m.nama_item,
      nominal: String(m.nominal_default),
      checked: true,
      diskon: '',
      existingItemId: null,
    })))
  }, [masterItems])

  // ── Close dropdown on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Search debounce ──────────────────────────────────────────────────────────
  const handleSearch = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setSearchResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchSiswa(val)
      setSearchResults(res.data as SiswaResult[])
      setShowDropdown(true)
      setIsSearching(false)
    }, 300)
  }, [])

  // ── Select siswa → load existing data ───────────────────────────────────────
  async function handleSelectSiswa(s: SiswaResult) {
    setSelectedSiswa(s)
    setQuery('')
    setSearchResults([])
    setShowDropdown(false)
    setMsg(null)
    setIsLoadingData(true)
    setExistingDsptId(null)
    setExistingKopId(null)

    const data = await getDaftarUlangSiswaData(s.id, tahunAjaranId)
    setIsLoadingData(false)

    // Pre-fill DSPT
    if (data.dspt) {
      setExistingDsptId(data.dspt.id)
      setDspt(prev => ({
        ...prev,
        nominalTarget: String(data.dspt.nominal_target),
        bayarSekarang: '',
      }))
    } else {
      setDspt({ nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '' })
    }

    // Pre-fill koperasi items
    if (data.kopTagihan) {
      setExistingKopId(data.kopTagihan.id)
      // Map existing items
      const existingMap: Record<string, any> = {}
      for (const item of data.kopItems) existingMap[item.master_item_id ?? ''] = item

      setKopItems(masterItems.map(m => {
        const ex = existingMap[m.id]
        return {
          masterItemId: m.id,
          namaItem: ex?.nama_item ?? m.nama_item,
          nominal: String(ex?.nominal ?? m.nominal_default),
          checked: !!ex && ex.status !== 'lunas',
          diskon: '',
          existingItemId: ex?.id ?? null,
        }
      }))
    } else {
      // Fresh — reset ke default master
      setKopItems(masterItems.map(m => ({
        masterItemId: m.id,
        namaItem: m.nama_item,
        nominal: String(m.nominal_default),
        checked: true,
        diskon: '',
        existingItemId: null,
      })))
    }
  }

  function handleReset() {
    setSelectedSiswa(null)
    setExistingDsptId(null)
    setExistingKopId(null)
    setDspt({ nominalTarget: '', bayarSekarang: '', metode: 'tunai', diskon: '', alasanDiskon: '' })
    setKopItems(masterItems.map(m => ({
      masterItemId: m.id, namaItem: m.nama_item,
      nominal: String(m.nominal_default), checked: true, diskon: '', existingItemId: null,
    })))
    setKopMetode('tunai')
    setMsg(null)
  }

  // ── Computed values ──────────────────────────────────────────────────────────
  const dsptTarget   = parseNum(dspt.nominalTarget)
  const dsptBayar    = parseNum(dspt.bayarSekarang)
  const dsptDiskon   = parseNum(dspt.diskon)
  const dsptSisa     = Math.max(0, dsptTarget - dsptBayar - dsptDiskon)

  const checkedItems = kopItems.filter(i => i.checked)
  const kopTotal     = checkedItems.reduce((s, i) => s + parseNum(i.nominal), 0)
  const kopTotalDiskon = checkedItems.reduce((s, i) => s + parseNum(i.diskon), 0)
  const kopSisa      = Math.max(0, kopTotal - kopTotalDiskon)

  const canSubmit = selectedSiswa && dsptTarget > 0

  // ── Submit ───────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!selectedSiswa || !canSubmit) return
    setMsg(null)

    const kopItemParams: KopItemParam[] = checkedItems.map(i => ({
      masterItemId: i.masterItemId,
      namaItem: i.namaItem,
      nominal: parseNum(i.nominal),
      bayarSekarang: parseNum(i.nominal) - parseNum(i.diskon),
      diskon: parseNum(i.diskon),
      existingItemId: i.existingItemId,
    }))

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
          koperasi: {
            items: kopItemParams,
            metode: kopMetode,
            existingTagihanId: existingKopId,
            buatTagihanBaru: !existingKopId && checkedItems.length > 0,
          },
        },
        namaKomite,
        namaKoperasiPetugas,
      )

      if (result.error) {
        setMsg({ type: 'error', text: result.error })
      } else {
        setMsg({ type: 'success', text: 'Data berhasil disimpan!' })
        if (result.kuitansiDspt || result.kuitansiKoperasi) {
          setKuitansiDspt(result.kuitansiDspt)
          setKuitansiKop(result.kuitansiKoperasi)
          setShowKuitansi(true)
        }
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">

        {/* ── Info Tahun Ajaran ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          Tahun Ajaran Aktif: <span className="font-semibold text-slate-700 dark:text-slate-300">{tahunAjaranNama}</span>
          <span className="ml-auto text-slate-400">Petugas: {namaKomite} / {namaKoperasiPetugas}</span>
        </div>

        {/* ── Cari Siswa ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pilih Siswa</p>
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
                  Ada data DSPT
                </span>
              )}
              {existingKopId && (
                <span className="text-[11px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium ml-1">
                  Ada data Koperasi
                </span>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500 ml-1" onClick={handleReset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Ketik nama atau NISN siswa..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                className="pl-9 h-10 text-sm"
                autoComplete="off"
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

        {/* ── Loading data ─────────────────────────────────────────────── */}
        {isLoadingData && (
          <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
            <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Memuat data siswa...
          </div>
        )}

        {/* ── Form DSPT + Koperasi ──────────────────────────────────────── */}
        {selectedSiswa && !isLoadingData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ──── Panel DSPT ──────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">DSPT</p>
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
                  placeholder="0 = belum bayar / hanya set target"
                />
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Metode Pembayaran</Label>
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
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Alasan Diskon</Label>
                    <Input
                      value={dspt.alasanDiskon}
                      onChange={e => setDspt(p => ({ ...p, alasanDiskon: e.target.value }))}
                      placeholder="Anak guru, beasiswa..."
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Summary DSPT */}
                {dsptTarget > 0 && (
                  <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Target DSPT</span>
                      <span className="font-mono">{formatRupiah(dsptTarget)}</span>
                    </div>
                    {dsptBayar > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Bayar sekarang</span>
                        <span className="font-mono">− {formatRupiah(dsptBayar)}</span>
                      </div>
                    )}
                    {dsptDiskon > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Diskon</span>
                        <span className="font-mono">− {formatRupiah(dsptDiskon)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-sm pt-1 border-t border-slate-100 dark:border-slate-700">
                      <span className={dsptSisa === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {dsptSisa === 0 ? '✓ Lunas' : 'Sisa Tagihan'}
                      </span>
                      <span className={`font-mono ${dsptSisa === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(dsptSisa)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ──── Panel Koperasi ──────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Koperasi</p>
                <span className="text-[11px] text-slate-400 ml-auto">Perlengkapan Siswa Baru</span>
              </div>

              {existingKopId && (
                <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Tagihan koperasi sudah ada — item yang sudah lunas dinonaktifkan
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Item checklist */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Pilih item yang dibeli / dibayar</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = kopItems.every(i => i.checked)
                        setKopItems(prev => prev.map(i => ({ ...i, checked: !allChecked })))
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {kopItems.every(i => i.checked) ? 'Batal semua' : 'Ceklis semua'}
                    </button>
                  </div>
                  <div className="space-y-1 mt-1">
                    {kopItems.map((item, idx) => (
                      <div key={item.masterItemId}
                        className={`rounded-lg border p-2 transition-colors ${
                          item.checked
                            ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-700'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                        }`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={e => setKopItems(prev => prev.map((x, i) =>
                              i === idx ? { ...x, checked: e.target.checked } : x
                            ))}
                            className="h-4 w-4 rounded accent-green-600 cursor-pointer"
                          />
                          <span className="text-sm flex-1 text-slate-800 dark:text-slate-100">{item.namaItem}</span>
                          <Input
                            value={item.checked ? (item.nominal ? parseNum(item.nominal).toLocaleString('id-ID') : '') : ''}
                            disabled={!item.checked}
                            onChange={e => setKopItems(prev => prev.map((x, i) =>
                              i === idx ? { ...x, nominal: e.target.value.replace(/\D/g, '') } : x
                            ))}
                            className="h-7 w-28 text-xs text-right"
                            placeholder="Nominal"
                          />
                        </div>
                        {item.checked && (
                          <div className="mt-2 flex items-center gap-2 pl-6">
                            <Input
                              value={item.diskon ? parseNum(item.diskon).toLocaleString('id-ID') : ''}
                              onChange={e => setKopItems(prev => prev.map((x, i) =>
                                i === idx ? { ...x, diskon: e.target.value.replace(/\D/g, '') } : x
                              ))}
                              className="h-7 flex-1 text-xs"
                              placeholder="Diskon (0)"
                            />
                            <span className="text-[11px] text-slate-400 flex-shrink-0">diskon</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {kopItems.length === 0 && (
                      <p className="text-xs text-slate-400 py-2">Tidak ada master item koperasi aktif.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Metode Pembayaran Koperasi</Label>
                  <Select value={kopMetode} onValueChange={v => setKopMetode(v as 'tunai' | 'transfer')}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai</SelectItem>
                      <SelectItem value="transfer">Transfer Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary Koperasi */}
                {checkedItems.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5 text-xs">
                    {kopTotalDiskon > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Total diskon</span>
                        <span className="font-mono">− {formatRupiah(kopTotalDiskon)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-sm">
                      <span className="text-green-700 dark:text-green-400">Total Dibayar Koperasi</span>
                      <span className="font-mono text-green-700 dark:text-green-400">{formatRupiah(kopSisa)}</span>
                    </div>
                    <p className="text-slate-400">{checkedItems.length} item dipilih</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Pesan status ──────────────────────────────────────────────── */}
        {msg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700'
              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-700'
          }`}>
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {msg.text}
            {msg.type === 'success' && (kuitansiDspt || kuitansiKop) && (
              <Button
                size="sm" variant="outline"
                className="ml-auto h-7 text-xs gap-1.5"
                onClick={() => setShowKuitansi(true)}
              >
                <Printer className="h-3 w-3" /> Buka Kuitansi Lagi
              </Button>
            )}
          </div>
        )}

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        {selectedSiswa && !isLoadingData && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500">
                {dsptTarget > 0 && <span className="mr-3">DSPT: <strong>{formatRupiah(dsptTarget)}</strong>{dsptBayar > 0 ? ` (bayar ${formatRupiah(dsptBayar)})` : ' (target saja)'}</span>}
                {checkedItems.length > 0 && <span>Koperasi: <strong>{formatRupiah(kopSisa)}</strong> ({checkedItems.length} item)</span>}
              </p>
            </div>
            <Button
              size="sm" variant="ghost"
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
      </div>

      {/* ── Kuitansi 2 halaman modal ────────────────────────────────────── */}
      <KuitansiGandaModal
        dspt={kuitansiDspt}
        koperasi={kuitansiKop}
        open={showKuitansi}
        onClose={() => setShowKuitansi(false)}
        namaKomite={namaKomite}
        namaKoperasi={namaKoperasiPetugas}
      />
    </>
  )
}
