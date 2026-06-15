'use client'

import { useMemo, useState, useTransition, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Search, CheckCircle2, XCircle, Clock, Loader2, Eye, UserPlus, FileSpreadsheet,
  CalendarClock, Settings, GraduationCap, Trophy, ArrowUpDown, ArrowUp, ArrowDown,
  Users, RefreshCw, FileDown, Upload, PackageOpen,
} from 'lucide-react'
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
  asal_sekolah: string; no_telepon_ortu: string
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
      if (q && !`${p.nama_lengkap} ${p.nisn} ${p.no_pendaftaran}`.toLowerCase().includes(q.toLowerCase())) return false
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
        <div className={`rounded-md px-4 py-2 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ── 9 Stat Cards ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        <StatCard label="Total" value={stats.total} color="blue" />
        <StatCard label="Reguler" value={stats.reguler} color="teal" />
        <StatCard label="Prestasi" value={stats.prestasi} color="indigo" />
        <StatCard label="Perlu Verif" value={stats.perluVerif} color="amber" />
        <StatCard label="Diterima" value={stats.diterima} color="green" />
        <StatCard label="Tidak Lulus" value={stats.tidakDiterima} color="red" />
        <StatCard label="Pending" value={stats.kelulusanPending} color="gray" />
        <StatCard label="Daftar Ulang ✓" value={stats.sudahDaftarUlang} color="green" />
        <StatCard label="Belum DU" value={stats.belumDaftarUlang} color="red" />
      </div>

      <Tabs defaultValue="pendaftar">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pendaftar"><Users className="h-4 w-4 mr-1" />Data Pendaftar</TabsTrigger>
          <TabsTrigger value="jadwal"><CalendarClock className="h-4 w-4 mr-1" />Jadwal &amp; Plotting</TabsTrigger>
          <TabsTrigger value="export"><PackageOpen className="h-4 w-4 mr-1" />Export Data</TabsTrigger>
          <TabsTrigger value="pengaturan"><Settings className="h-4 w-4 mr-1" />Pengaturan</TabsTrigger>
        </TabsList>

        {/* ════════════════════════ TAB PENDAFTAR ════════════════════════ */}
        <TabsContent value="pendaftar" className="space-y-3">

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / NISN / no. daftar" value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-8" />
            </div>
            <FilterSelect value={fJalur} onChange={(v) => { setFJalur(v); setPage(1) }} placeholder="Jalur"
              options={[['all', 'Semua Jalur'], ['REGULER', 'Reguler'], ['PRESTASI', 'Prestasi']]} />
            <FilterSelect value={fVerif} onChange={(v) => { setFVerif(v); setPage(1) }} placeholder="Verifikasi"
              options={[['all', 'Semua Verif'], ['pending', 'Belum'], ['ok', 'Terverifikasi'], ['tolak', 'Ditolak']]} />
            <FilterSelect value={fLulus} onChange={(v) => { setFLulus(v); setPage(1) }} placeholder="Kelulusan"
              options={[['all', 'Semua Hasil'], ['PENDING', 'Pending'], ['DITERIMA', 'Diterima'], ['TIDAK DITERIMA', 'Tidak Diterima']]} />
            <FilterSelect value={fDaftarUlang} onChange={(v) => { setFDaftarUlang(v); setPage(1) }} placeholder="Daftar Ulang"
              options={[['all', 'Semua DU'], ['selesai', 'Sudah DU'], ['belum', 'Belum DU']]} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download template Excel untuk import kelulusan">
              <FileDown className="h-4 w-4 mr-1" />Template Kelulusan
            </Button>
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} title="Import kelulusan dari Excel">
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

            <div className="overflow-x-auto">
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

const STAT_COLORS: Record<string, string> = {
  blue:   'border-l-blue-500 bg-blue-50/50',
  teal:   'border-l-teal-500 bg-teal-50/50',
  indigo: 'border-l-indigo-500 bg-indigo-50/50',
  amber:  'border-l-amber-500 bg-amber-50/50',
  green:  'border-l-emerald-500 bg-emerald-50/50',
  red:    'border-l-red-500 bg-red-50/50',
  gray:   'border-l-slate-400 bg-slate-50/50',
}
const STAT_TEXT: Record<string, string> = {
  blue: 'text-blue-700', teal: 'text-teal-700', indigo: 'text-indigo-700',
  amber: 'text-amber-700', green: 'text-emerald-700', red: 'text-red-700', gray: 'text-slate-600',
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`border rounded-lg p-3 border-l-4 ${STAT_COLORS[color] || ''}`}>
      <div className={`text-2xl font-black leading-none ${STAT_TEXT[color] || ''}`}>{value}</div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-1 leading-tight">{label}</div>
    </div>
  )
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[145px] h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
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
