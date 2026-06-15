'use client'

import { useMemo, useState, useTransition, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Search, CheckCircle2, XCircle, Clock, Loader2, Eye, UserPlus, FileSpreadsheet,
  CalendarClock, Settings, GraduationCap, Trophy, ArrowUpDown, ArrowUp, ArrowDown,
  Users, RefreshCw, FileDown, Upload, PackageOpen, ChevronDown, ChevronUp, SlidersHorizontal,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DetailModal } from './detail-modal'
import { JadwalPanel } from './jadwal-panel'
import { PengaturanPanel } from './pengaturan-panel'
import { ExportPanel } from './export-panel'
import {
  verifikasiBerkas, setKelulusan, terimaJadiSiswa, bulkAlihReguler, importKelulusan,
} from '../actions'

export type Pendaftar = {
  id: string; no_pendaftaran: string; tahun_ajaran: string; jalur: string
  status_verifikasi: number | null; status_kelulusan: string; berkas_ditolak: string | null
  siswa_id: string | null; nisn: string; nik: string; nama_lengkap: string; jenis_kelamin: string
  asal_sekolah: string; no_telepon_ortu: string; foto_url: string | null
  tanggal_tes: string | null; sesi_tes: string | null; ruang_tes: string | null
  daftar_ulang_status: string | null; created_at: string
}

type SortKey = 'nama_lengkap' | 'jalur' | 'asal_sekolah' | 'status_verifikasi' | 'status_kelulusan' | 'daftar_ulang_status'
type SortDir = 'asc' | 'desc'

const PAGE_SIZES = [10, 25, 50, 100, 0] // 0 = semua

export function PmbClient({ pendaftar, jadwal, pengaturan }: {
  pendaftar: Pendaftar[]; jadwal: any[]; pengaturan: Record<string, string>
}) {
  const [q, setQ] = useState('')
  const [fJalur, setFJalur] = useState('all')
  const [fVerif, setFVerif] = useState('all')
  const [fLulus, setFLulus] = useState('all')
  const [fDaftarUlang, setFDaftarUlang] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('nama_lengkap')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const importRef = useRef<HTMLInputElement>(null)
  const [showAllStats, setShowAllStats] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)

  // ── Stats (9 kartu, sama persis old app) ────────────────────
  const stats = useMemo(() => ({
    total:          pendaftar.length,
    reguler:        pendaftar.filter((p) => p.jalur === 'REGULER').length,
    prestasi:       pendaftar.filter((p) => p.jalur === 'PRESTASI').length,
    perluVerif:     pendaftar.filter((p) => p.status_verifikasi === null).length,
    diterima:       pendaftar.filter((p) => p.status_kelulusan === 'DITERIMA').length,
    tidakDiterima:  pendaftar.filter((p) => p.status_kelulusan === 'TIDAK DITERIMA').length,
    kelulusanPending: pendaftar.filter((p) => p.status_kelulusan === 'PENDING').length,
    sudahDaftarUlang: pendaftar.filter((p) => p.daftar_ulang_status === 'SELESAI').length,
    belumDaftarUlang: pendaftar.filter((p) => p.status_kelulusan === 'DITERIMA' && p.daftar_ulang_status !== 'SELESAI').length,
  }), [pendaftar])

  // ── Filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = pendaftar.filter((p) => {
      if (q && !`${p.nama_lengkap} ${p.nisn} ${p.no_pendaftaran} ${p.asal_sekolah} ${p.nik} ${p.no_telepon_ortu}`.toLowerCase().includes(q.toLowerCase())) return false
      if (fJalur !== 'all' && p.jalur !== fJalur) return false
      if (fVerif !== 'all') {
        const v = p.status_verifikasi === null ? 'pending' : p.status_verifikasi === 1 ? 'ok' : 'tolak'
        if (v !== fVerif) return false
      }
      if (fLulus !== 'all' && p.status_kelulusan !== fLulus) return false
      if (fDaftarUlang !== 'all') {
        const du = p.daftar_ulang_status === 'SELESAI' ? 'selesai' : 'belum'
        if (du !== fDaftarUlang) return false
      }
      return true
    })

    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'id')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [pendaftar, q, fJalur, fVerif, fLulus, fDaftarUlang, sortKey, sortDir])

  // ── Pagination ────────────────────────────────────────────────
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize)
  const paginated = useMemo(() => {
    if (pageSize === 0) return filtered
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-emerald-600" /> : <ArrowDown className="h-3 w-3 ml-1 text-emerald-600" />
  }

  // ── Flash ─────────────────────────────────────────────────────
  function flash(r: { success?: string; error?: string }) {
    if (r.success) setMsg({ type: 'ok', text: r.success })
    else if (r.error) setMsg({ type: 'err', text: r.error })
    setTimeout(() => setMsg(null), 4000)
  }

  // ── Select ────────────────────────────────────────────────────
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected((s) => s.size === paginated.length ? new Set() : new Set(paginated.map((p) => p.id)))
  const ids = () => Array.from(selected)

  // ── Bulk actions ──────────────────────────────────────────────
  function doVerif(ok: boolean) {
    if (!selected.size) return
    const alasan = ok ? undefined : (prompt('Alasan penolakan berkas:') || 'Berkas tidak valid')
    startTransition(async () => { flash(await verifikasiBerkas(ids(), ok, alasan)); setSelected(new Set()) })
  }
  function doLulus(status: 'DITERIMA' | 'TIDAK DITERIMA' | 'PENDING') {
    if (!selected.size) return
    startTransition(async () => { flash(await setKelulusan(ids(), status)); setSelected(new Set()) })
  }
  function doAlihReguler() {
    if (!selected.size) return
    if (!confirm(`Alihkan ${selected.size} pendaftar ke Jalur Reguler?`)) return
    startTransition(async () => { flash(await bulkAlihReguler(ids())); setSelected(new Set()) })
  }
  function doTerima(id: string) {
    startTransition(async () => flash(await terimaJadiSiswa(id)))
  }

  // ── Template Kelulusan ─────────────────────────────────────────
  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const rows = filtered.map((p) => ({ no_pendaftaran: p.no_pendaftaran, nama_lengkap: p.nama_lengkap, jalur: p.jalur, status_kelulusan: '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Kelulusan')
    XLSX.writeFile(wb, `Template_Kelulusan_PMB.xlsx`)
  }

  async function handleImportKelulusan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = (XLSX.utils.sheet_to_json(ws) as { no_pendaftaran: string; status_kelulusan: string }[])
    if (!rows.length) { flash({ error: 'File kosong atau format salah' }); return }
    startTransition(async () => { flash(await importKelulusan(rows)) })
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {msg && (
        <Alert className={msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
          <AlertDescription className="font-medium">{msg.text}</AlertDescription>
        </Alert>
      )}

      {/* ── Stats Cards ── */}
      {/* Stats Mobile (Collapsible) */}
      <div className="block lg:hidden space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {(showAllStats
            ? [
                { label: "Total", value: stats.total, color: "blue", icon: Users },
                { label: "Reguler", value: stats.reguler, color: "teal", icon: GraduationCap },
                { label: "Prestasi", value: stats.prestasi, color: "indigo", icon: Trophy },
                { label: "Perlu Verif", value: stats.perluVerif, color: "amber", icon: Clock },
                { label: "Diterima", value: stats.diterima, color: "green", icon: CheckCircle2 },
                { label: "Tidak Lulus", value: stats.tidakDiterima, color: "red", icon: XCircle },
                { label: "Pending", value: stats.kelulusanPending, color: "gray", icon: Loader2 },
                { label: "Daftar Ulang ✓", value: stats.sudahDaftarUlang, color: "green", icon: CheckCircle2 },
                { label: "Belum DU", value: stats.belumDaftarUlang, color: "red", icon: XCircle },
              ]
            : [
                { label: "Total", value: stats.total, color: "blue", icon: Users },
                { label: "Reguler", value: stats.reguler, color: "teal", icon: GraduationCap },
              ]
          ).map((s, idx) => (
            <StatCard key={idx} label={s.label} value={s.value} color={s.color} icon={s.icon} />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 py-1 h-8 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-100 dark:border-slate-800"
          onClick={() => setShowAllStats(!showAllStats)}
        >
          {showAllStats ? (
            <>Sembunyikan Statistik <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Tampilkan Semua Statistik (9) <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </Button>
      </div>

      {/* Stats Desktop (Always Grid) */}
      <div className="hidden lg:grid lg:grid-cols-9 gap-2">
        <StatCard label="Total" value={stats.total} color="blue" icon={Users} />
        <StatCard label="Reguler" value={stats.reguler} color="teal" icon={GraduationCap} />
        <StatCard label="Prestasi" value={stats.prestasi} color="indigo" icon={Trophy} />
        <StatCard label="Perlu Verif" value={stats.perluVerif} color="amber" icon={Clock} />
        <StatCard label="Diterima" value={stats.diterima} color="green" icon={CheckCircle2} />
        <StatCard label="Tidak Lulus" value={stats.tidakDiterima} color="red" icon={XCircle} />
        <StatCard label="Pending" value={stats.kelulusanPending} color="gray" icon={Loader2} />
        <StatCard label="Daftar Ulang ✓" value={stats.sudahDaftarUlang} color="green" icon={CheckCircle2} />
        <StatCard label="Belum DU" value={stats.belumDaftarUlang} color="red" icon={XCircle} />
      </div>

      <Tabs defaultValue="pendaftar">
        <TabsList className="w-full flex justify-start items-center overflow-x-auto scrollbar-none bg-slate-100/80 dark:bg-slate-900/60 p-1 h-10 rounded-lg gap-1 border border-slate-200/50 dark:border-slate-800/80">
          <TabsTrigger value="pendaftar" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0"><Users className="h-4 w-4 shrink-0" />Data Pendaftar</TabsTrigger>
          <TabsTrigger value="jadwal" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0"><CalendarClock className="h-4 w-4 shrink-0" />Jadwal &amp; Plotting</TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0"><PackageOpen className="h-4 w-4 shrink-0" />Export Data</TabsTrigger>
          <TabsTrigger value="pengaturan" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all shrink-0"><Settings className="h-4 w-4 shrink-0" />Pengaturan</TabsTrigger>
        </TabsList>

        {/* ════════════════════════ TAB PENDAFTAR ════════════════════════ */}
        <TabsContent value="pendaftar" className="space-y-3">

          {/* Filter & Search Bar */}
          {/* Mobile Filter & Search */}
          <div className="flex lg:hidden gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / NISN / asal sekolah / HP..." value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-9 h-9 w-full" />
            </div>
            <Button variant="outline" className="h-9 px-3 flex items-center gap-1.5 text-xs shrink-0" onClick={() => setShowFilterModal(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </Button>

            <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
              <DialogContent className="max-w-[90vw] sm:max-w-md rounded-xl p-4">
                <DialogHeader>
                  <DialogTitle className="text-sm font-semibold">Filter &amp; Aksi Data</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-500">Jalur</Label>
                      <FilterSelect value={fJalur} onChange={(v) => { setFJalur(v); setPage(1) }} placeholder="Jalur"
                        options={[['all', 'Semua Jalur'], ['REGULER', 'Reguler'], ['PRESTASI', 'Prestasi']]} className="w-full" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-500">Verifikasi Berkas</Label>
                      <FilterSelect value={fVerif} onChange={(v) => { setFVerif(v); setPage(1) }} placeholder="Verifikasi"
                        options={[['all', 'Semua Verif'], ['pending', 'Belum'], ['ok', 'Terverifikasi'], ['tolak', 'Ditolak']]} className="w-full" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-500">Hasil Kelulusan</Label>
                      <FilterSelect value={fLulus} onChange={(v) => { setFLulus(v); setPage(1) }} placeholder="Kelulusan"
                        options={[['all', 'Semua Hasil'], ['PENDING', 'Pending'], ['DITERIMA', 'Diterima'], ['TIDAK DITERIMA', 'Tidak Diterima']]} className="w-full" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-500">Daftar Ulang</Label>
                      <FilterSelect value={fDaftarUlang} onChange={(v) => { setFDaftarUlang(v); setPage(1) }} placeholder="Daftar Ulang"
                        options={[['all', 'Semua DU'], ['selesai', 'Sudah DU'], ['belum', 'Belum DU']]} className="w-full" />
                    </div>
                  </div>

                  <hr className="my-2 border-slate-100 dark:border-slate-800" />

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => { downloadTemplate(); setShowFilterModal(false); }} className="w-full text-xs h-9" title="Download template Excel untuk import kelulusan">
                      <FileDown className="h-4 w-4 mr-1" /> Template Kelulusan
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { importRef.current?.click(); setShowFilterModal(false); }} className="w-full text-xs h-9" title="Import kelulusan dari Excel">
                      <Upload className="h-4 w-4 mr-1" /> Import Kelulusan
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportKelulusan} />
          </div>

          {/* Desktop Filter & Search */}
          <div className="hidden lg:flex flex-wrap gap-2 items-center w-full">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / NISN / asal sekolah / NIK / HP..." value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-9 h-9" />
            </div>
            <FilterSelect value={fJalur} onChange={(v) => { setFJalur(v); setPage(1) }} placeholder="Jalur"
              options={[['all', 'Semua Jalur'], ['REGULER', 'Reguler'], ['PRESTASI', 'Prestasi']]} />
            <FilterSelect value={fVerif} onChange={(v) => { setFVerif(v); setPage(1) }} placeholder="Verifikasi"
              options={[['all', 'Semua Verif'], ['pending', 'Belum'], ['ok', 'Terverifikasi'], ['tolak', 'Ditolak']]} />
            <FilterSelect value={fLulus} onChange={(v) => { setFLulus(v); setPage(1) }} placeholder="Kelulusan"
              options={[['all', 'Semua Hasil'], ['PENDING', 'Pending'], ['DITERIMA', 'Diterima'], ['TIDAK DITERIMA', 'Tidak Diterima']]} />
            <FilterSelect value={fDaftarUlang} onChange={(v) => { setFDaftarUlang(v); setPage(1) }} placeholder="Daftar Ulang"
              options={[['all', 'Semua DU'], ['selesai', 'Sudah DU'], ['belum', 'Belum DU']]} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download template Excel untuk import kelulusan" className="h-9">
              <FileDown className="h-4 w-4 mr-1" />Template Kelulusan
            </Button>
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} title="Import kelulusan dari Excel" className="h-9">
              <Upload className="h-4 w-4 mr-1" />Import Kelulusan
            </Button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportKelulusan} />
          </div>

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2 items-center bg-slate-900 text-white rounded-md p-3">
              <span className="text-sm font-semibold px-1">{selected.size} dipilih</span>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => doVerif(true)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Verifikasi
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => doVerif(false)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />Tolak Berkas
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => doLulus('DITERIMA')}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />Luluskan
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => doLulus('TIDAK DITERIMA')}>
                  <XCircle className="h-3.5 w-3.5 mr-1 text-red-400" />Tidak Lulus
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => doLulus('PENDING')}>
                  Reset Kelulusan
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={doAlihReguler}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1 text-blue-400" />Alih Reguler
                </Button>
              </div>
              {pending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            </div>
          )}

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                  <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)} className="text-xs">{s === 0 ? 'Semua' : `${s} baris`}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filtered.length} dari {pendaftar.length} pendaftar</span>
              </div>
              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
                  <span className="text-xs px-2">{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
                </div>
              )}
            </div>

            {/* Mobile compact cards list view */}
            <div className="block lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map((p) => {
                const isSel = selected.has(p.id)
                return (
                  <div key={p.id} className={`p-3 flex items-start gap-3 transition-all ${isSel ? 'bg-primary/5' : 'bg-transparent'}`}>
                    <div className="pt-1.5 flex-shrink-0">
                      <Checkbox checked={isSel} onCheckedChange={() => toggle(p.id)} />
                    </div>

                    {/* Photo Frame 3:4 */}
                    <div className="w-14 h-[75px] rounded-md overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-150 flex-shrink-0 flex items-center justify-center relative">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.foto_url}
                          alt={p.nama_lengkap}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-350 dark:text-slate-700 p-1">
                          <Users className="h-5 w-5 stroke-[1.2]" />
                          <span className="text-[7px] font-medium mt-0.5">No Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-50 leading-snug truncate">
                          {p.nama_lengkap}
                        </h4>
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDetailId(p.id)}>
                            <Eye className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground truncate leading-none">
                        {p.nisn} · {p.asal_sekolah}
                      </p>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 items-center pt-0.5">
                        <JalurBadge jalur={p.jalur} />
                        <VerifBadge v={p.status_verifikasi} />
                        <LulusBadge s={p.status_kelulusan} />
                      </div>

                      {/* Additional row info / actions */}
                      <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-100/50 dark:border-slate-800/50">
                        <span className="text-[10px] text-muted-foreground">
                          {p.tanggal_tes ? `${p.tanggal_tes} (${p.sesi_tes})` : 'Belum diplot'}
                        </span>
                        
                        {p.status_kelulusan === 'DITERIMA' && !p.siswa_id && (
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[9px] font-bold" disabled={pending} onClick={() => doTerima(p.id)}>
                            <UserPlus className="h-3 w-3 mr-0.5" /> Siswa
                          </Button>
                        )}
                        {p.siswa_id && <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">✓ Siswa</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {paginated.length === 0 && (
                <div className="text-center text-muted-foreground py-10 text-sm">
                  Tidak ada data sesuai filter
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 py-2">
                      <Checkbox checked={selected.size > 0 && selected.size === paginated.length} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide">No. Daftar</TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort('nama_lengkap')}>
                      <span className="flex items-center">Nama <SortIcon k="nama_lengkap" /></span>
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort('jalur')}>
                      <span className="flex items-center">Jalur <SortIcon k="jalur" /></span>
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort('status_verifikasi')}>
                      <span className="flex items-center">Berkas <SortIcon k="status_verifikasi" /></span>
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort('status_kelulusan')}>
                      <span className="flex items-center">Kelulusan <SortIcon k="status_kelulusan" /></span>
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide">Jadwal Tes</TableHead>
                    <TableHead className="py-2 text-xs font-bold uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort('daftar_ulang_status')}>
                      <span className="flex items-center">Daftar Ulang <SortIcon k="daftar_ulang_status" /></span>
                    </TableHead>
                    <TableHead className="py-2 text-right text-xs font-bold uppercase tracking-wide">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="py-2"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                      <TableCell className="py-2 font-mono text-xs text-muted-foreground">{p.no_pendaftaran}</TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-sm leading-tight">{p.nama_lengkap}</div>
                        <div className="text-xs text-muted-foreground">{p.nisn} · {p.asal_sekolah}</div>
                      </TableCell>
                      <TableCell className="py-2"><JalurBadge jalur={p.jalur} /></TableCell>
                      <TableCell className="py-2"><VerifBadge v={p.status_verifikasi} /></TableCell>
                      <TableCell className="py-2"><LulusBadge s={p.status_kelulusan} /></TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {p.tanggal_tes ? <><div>{p.tanggal_tes}</div><div className="opacity-70">{p.sesi_tes} · {p.ruang_tes}</div></> : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        {p.daftar_ulang_status === 'SELESAI'
                          ? <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Selesai</span>
                          : p.status_kelulusan === 'DITERIMA'
                            ? <span className="text-xs text-amber-600">Belum</span>
                            : <span className="text-xs text-slate-300">—</span>
                        }
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDetailId(p.id)}><Eye className="h-4 w-4" /></Button>
                          {p.status_kelulusan === 'DITERIMA' && !p.siswa_id && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => doTerima(p.id)}>
                              <UserPlus className="h-3.5 w-3.5 mr-1" />Jadi Siswa
                            </Button>
                          )}
                          {p.siswa_id && <span className="text-xs text-emerald-600 self-center px-1 font-semibold">✓ Siswa</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-sm">
                        Tidak ada data sesuai filter
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════ TAB JADWAL ════════════════════════ */}
        <TabsContent value="jadwal">
          <JadwalPanel jadwal={jadwal} pendaftar={pendaftar} onFlash={flash} />
        </TabsContent>

        {/* ════════════════════════ TAB EXPORT ════════════════════════ */}
        <TabsContent value="export">
          <ExportPanel pendaftar={pendaftar} pengaturan={pengaturan} onFlash={flash} />
        </TabsContent>

        {/* ════════════════════════ TAB PENGATURAN ════════════════════════ */}
        <TabsContent value="pengaturan">
          <PengaturanPanel pengaturan={pengaturan} onFlash={flash} />
        </TabsContent>
      </Tabs>

      {detailId && <DetailModal id={detailId} pendaftar={pendaftar} onClose={() => setDetailId(null)} onFlash={flash} />}
    </div>
  )
}

/* ── Sub-komponen ─────────────────────────────────────────── */

const STAT_CONFIG: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue:   { bg: 'bg-blue-50/40 dark:bg-blue-950/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-900/50', iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  teal:   { bg: 'bg-teal-50/40 dark:bg-teal-950/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-100 dark:border-teal-900/50', iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  indigo: { bg: 'bg-indigo-50/40 dark:bg-indigo-950/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-900/50', iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  amber:  { bg: 'bg-amber-50/40 dark:bg-amber-950/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900/50', iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  green:  { bg: 'bg-emerald-50/40 dark:bg-emerald-950/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/50', iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  red:    { bg: 'bg-red-50/40 dark:bg-red-950/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-100 dark:border-red-900/50', iconBg: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  gray:   { bg: 'bg-slate-50/40 dark:bg-slate-900/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200/60 dark:border-slate-800', iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-350' },
}

function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ComponentType<any>
}) {
  const conf = STAT_CONFIG[color] || STAT_CONFIG.gray
  return (
    <Card className={`border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${conf.border} ${conf.bg}`}>
      <CardContent className="p-3 flex flex-col justify-between h-full space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mr-1">
            {label}
          </span>
          <div className={`p-1 rounded-md ${conf.iconBg} flex-shrink-0`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className={`text-2xl font-black tracking-tight leading-none ${conf.text}`}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterSelect({ value, onChange, placeholder, options, className }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][]; className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${className || 'w-[145px]'}`}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export function JalurBadge({ jalur }: { jalur: string }) {
  return jalur === 'PRESTASI'
    ? <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">PRESTASI</Badge>
    : <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700 bg-blue-50">REGULER</Badge>
}
export function VerifBadge({ v }: { v: number | null }) {
  if (v === 1) return <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Terverifikasi</span>
  if (v === 0) return <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />Ditolak</span>
  return <span className="text-xs text-amber-600 font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Menunggu</span>
}
export function LulusBadge({ s }: { s: string }) {
  if (s === 'DITERIMA') return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100">DITERIMA</Badge>
  if (s === 'TIDAK DITERIMA') return <Badge variant="destructive" className="text-[10px]">TIDAK</Badge>
  return <Badge variant="outline" className="text-[10px] text-slate-500">PENDING</Badge>
}
