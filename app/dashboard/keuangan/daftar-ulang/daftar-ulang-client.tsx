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
  User, Banknote, Info, RotateCcw,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { searchSiswa } from '../actions'
import { getDaftarUlangSiswaData, processDaftarUlang } from './actions'
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

function parseNum(s: string) { return parseInt(s.replace(/\D/g, ''), 10) || 0 }

function fmtKelas(s: SiswaResult) {
  if (!s.tingkat) return '-'
  return `${s.tingkat}-${s.nomor_kelas}${s.kelompok ? ' ' + s.kelompok : ''}`
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
      const res = await searchSiswa(val)
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
                placeholder="Cari nama siswa atau NISN..."
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
      </div>

      <KuitansiModal
        data={kuitansiDspt}
        open={showKuitansi}
        onClose={() => setShowKuitansi(false)}
      />
    </>
  )
}
