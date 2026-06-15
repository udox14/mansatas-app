'use client'

import { useMemo, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search, CheckCircle2, XCircle, Clock, Loader2, Eye, UserPlus, FileSpreadsheet,
  CalendarClock, Settings, GraduationCap, Trophy,
} from 'lucide-react'
import { DetailModal } from './detail-modal'
import { JadwalPanel } from './jadwal-panel'
import { PengaturanPanel } from './pengaturan-panel'
import {
  verifikasiBerkas, setKelulusan, terimaJadiSiswa, getExportData,
} from '../actions'

export type Pendaftar = {
  id: string; no_pendaftaran: string; tahun_ajaran: string; jalur: string
  status_verifikasi: number | null; status_kelulusan: string; berkas_ditolak: string | null
  siswa_id: string | null; nisn: string; nik: string; nama_lengkap: string; jenis_kelamin: string
  asal_sekolah: string; no_telepon_ortu: string
  tanggal_tes: string | null; sesi_tes: string | null; ruang_tes: string | null; created_at: string
}

export function PmbClient({ pendaftar, jadwal, pengaturan }: {
  pendaftar: Pendaftar[]; jadwal: any[]; pengaturan: Record<string, string>
}) {
  const [q, setQ] = useState('')
  const [fJalur, setFJalur] = useState('all')
  const [fVerif, setFVerif] = useState('all')
  const [fLulus, setFLulus] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const stats = useMemo(() => ({
    total: pendaftar.length,
    reguler: pendaftar.filter((p) => p.jalur === 'REGULER').length,
    prestasi: pendaftar.filter((p) => p.jalur === 'PRESTASI').length,
    pending: pendaftar.filter((p) => p.status_verifikasi === null).length,
    diterima: pendaftar.filter((p) => p.status_kelulusan === 'DITERIMA').length,
    siswa: pendaftar.filter((p) => p.siswa_id).length,
  }), [pendaftar])

  const filtered = useMemo(() => pendaftar.filter((p) => {
    if (q && !`${p.nama_lengkap} ${p.nisn} ${p.no_pendaftaran}`.toLowerCase().includes(q.toLowerCase())) return false
    if (fJalur !== 'all' && p.jalur !== fJalur) return false
    if (fVerif !== 'all') {
      const v = p.status_verifikasi === null ? 'pending' : p.status_verifikasi === 1 ? 'ok' : 'tolak'
      if (v !== fVerif) return false
    }
    if (fLulus !== 'all' && p.status_kelulusan !== fLulus) return false
    return true
  }), [pendaftar, q, fJalur, fVerif, fLulus])

  function flash(r: { success?: string; error?: string }) {
    if (r.success) setMsg({ type: 'ok', text: r.success })
    else if (r.error) setMsg({ type: 'err', text: r.error })
    setTimeout(() => setMsg(null), 4000)
  }

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => setSelected((s) =>
    s.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)))

  const ids = () => Array.from(selected)

  function doVerif(ok: boolean) {
    if (!selected.size) return
    const alasan = ok ? undefined : (prompt('Alasan penolakan berkas:') || 'Berkas tidak valid')
    startTransition(async () => { flash(await verifikasiBerkas(ids(), ok, alasan)); setSelected(new Set()) })
  }
  function doLulus(status: 'DITERIMA' | 'TIDAK DITERIMA') {
    if (!selected.size) return
    startTransition(async () => { flash(await setKelulusan(ids(), status)); setSelected(new Set()) })
  }
  function doTerima(id: string) {
    startTransition(async () => flash(await terimaJadiSiswa(id)))
  }
  async function exportExcel() {
    const r = await getExportData()
    if (r.error) { flash(r); return }
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(r.data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar PMB')
    XLSX.writeFile(wb, `PMB_${pengaturan.tahun_pmb?.replace('/', '-') || 'export'}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-md px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Reguler" value={stats.reguler} />
        <StatCard label="Prestasi" value={stats.prestasi} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Belum Verif" value={stats.pending} />
        <StatCard label="Diterima" value={stats.diterima} />
        <StatCard label="Jadi Siswa" value={stats.siswa} />
      </div>

      <Tabs defaultValue="pendaftar">
        <TabsList>
          <TabsTrigger value="pendaftar"><Eye className="h-4 w-4 mr-1" />Pendaftar</TabsTrigger>
          <TabsTrigger value="jadwal"><CalendarClock className="h-4 w-4 mr-1" />Jadwal Tes</TabsTrigger>
          <TabsTrigger value="pengaturan"><Settings className="h-4 w-4 mr-1" />Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="pendaftar" className="space-y-3">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / NISN / no. daftar" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <FilterSelect value={fJalur} onChange={setFJalur} placeholder="Jalur" options={[['all', 'Semua Jalur'], ['REGULER', 'Reguler'], ['PRESTASI', 'Prestasi']]} />
            <FilterSelect value={fVerif} onChange={setFVerif} placeholder="Verifikasi" options={[['all', 'Semua Verif'], ['pending', 'Belum'], ['ok', 'Diterima'], ['tolak', 'Ditolak']]} />
            <FilterSelect value={fLulus} onChange={setFLulus} placeholder="Kelulusan" options={[['all', 'Semua Hasil'], ['PENDING', 'Pending'], ['DITERIMA', 'Diterima'], ['TIDAK DITERIMA', 'Tidak']]} />
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2 items-center bg-muted/50 rounded-md p-2">
              <span className="text-sm font-medium px-2">{selected.size} dipilih</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => doVerif(true)}><CheckCircle2 className="h-4 w-4 mr-1" />Verifikasi</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => doVerif(false)}><XCircle className="h-4 w-4 mr-1" />Tolak Berkas</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => doLulus('DITERIMA')}>Set Diterima</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => doLulus('TIDAK DITERIMA')}>Set Tidak</Button>
            </div>
          )}

          {/* Table */}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>No. Daftar</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jalur</TableHead>
                  <TableHead>Verifikasi</TableHead>
                  <TableHead>Kelulusan</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{p.no_pendaftaran}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.nama_lengkap}</div>
                      <div className="text-xs text-muted-foreground">{p.nisn} · {p.asal_sekolah}</div>
                    </TableCell>
                    <TableCell><JalurBadge jalur={p.jalur} /></TableCell>
                    <TableCell><VerifBadge v={p.status_verifikasi} /></TableCell>
                    <TableCell><LulusBadge s={p.status_kelulusan} /></TableCell>
                    <TableCell className="text-xs">{p.tanggal_tes ? `${p.tanggal_tes} ${p.sesi_tes || ''}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setDetailId(p.id)}><Eye className="h-4 w-4" /></Button>
                        {p.status_kelulusan === 'DITERIMA' && !p.siswa_id && (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => doTerima(p.id)}>
                            <UserPlus className="h-4 w-4 mr-1" />Jadikan Siswa
                          </Button>
                        )}
                        {p.siswa_id && <span className="text-xs text-emerald-600 self-center px-2">✓ Siswa</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} dari {pendaftar.length} pendaftar</p>
        </TabsContent>

        <TabsContent value="jadwal">
          <JadwalPanel jadwal={jadwal} onFlash={flash} />
        </TabsContent>

        <TabsContent value="pengaturan">
          <PengaturanPanel pengaturan={pengaturan} onFlash={flash} />
        </TabsContent>
      </Tabs>

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center justify-between text-muted-foreground text-xs">{label}{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function JalurBadge({ jalur }: { jalur: string }) {
  const c = jalur === 'PRESTASI' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
  return <span className={`text-xs px-2 py-0.5 rounded-full ${c}`}>{jalur}</span>
}
function VerifBadge({ v }: { v: number | null }) {
  if (v === 1) return <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Terverifikasi</span>
  if (v === 0) return <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" />Ditolak</span>
  return <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />Menunggu</span>
}
function LulusBadge({ s }: { s: string }) {
  if (s === 'DITERIMA') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">DITERIMA</span>
  if (s === 'TIDAK DITERIMA') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">TIDAK</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">PENDING</span>
}
