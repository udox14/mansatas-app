'use client'

import { useMemo, useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Zap, Loader2, Search, Save, FileSpreadsheet, Upload } from 'lucide-react'
import { tambahSlotJadwal, hapusSlotJadwal, autoPlotting, saveManualPlotting } from '../actions'
import type { Pendaftar } from './pmb-client'

type Slot = { id: string; tanggal: string; sesi: string; ruang: string; kapasitas: number }

type PlottingRow = {
  id: string; no_pendaftaran: string; nama_lengkap: string
  tanggal_tes: string; sesi_tes: string; ruang_tes: string
}

export function JadwalPanel({ jadwal, pendaftar, onFlash }: {
  jadwal: Slot[]
  pendaftar: Pendaftar[]
  onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [pending, start] = useTransition()
  const importRef = useRef<HTMLInputElement>(null)

  // ── Slot form ──────────────────────────────────────────
  const [form, setForm] = useState({ tanggal: '', sesi: '', ruang: '', kapasitas: '36' })

  function addSlot() {
    if (!form.tanggal || !form.sesi || !form.ruang) { onFlash({ error: 'Isi semua field slot' }); return }
    start(async () => {
      onFlash(await tambahSlotJadwal({ ...form, kapasitas: Number(form.kapasitas) || 36 }))
      setForm({ tanggal: '', sesi: '', ruang: '', kapasitas: '36' })
    })
  }
  function removeSlot(id: string) {
    if (!confirm('Hapus slot ini?')) return
    start(async () => onFlash(await hapusSlotJadwal(id)))
  }
  function doAutoPlot() {
    if (!confirm('Auto-plotting: distribusikan semua pendaftar REGULER terverifikasi yang belum terjadwal. Lanjutkan?')) return
    start(async () => onFlash(await autoPlotting()))
  }

  // ── Slot occupancy stats ───────────────────────────────
  const slotStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of pendaftar) {
      if (p.tanggal_tes && p.sesi_tes && p.ruang_tes) {
        const k = `${p.tanggal_tes}|${p.sesi_tes}|${p.ruang_tes}`
        map[k] = (map[k] || 0) + 1
      }
    }
    return map
  }, [pendaftar])

  // ── Plotting state ─────────────────────────────────────
  const [search, setSearch] = useState('')
  const [fTgl, setFTgl] = useState('all')
  const [fSesi, setFSesi] = useState('all')
  const [fRuang, setFRuang] = useState('all')
  const [edits, setEdits] = useState<Record<string, { tanggal_tes: string; sesi_tes: string; ruang_tes: string }>>({})
  const [saving, setSaving] = useState(false)

  const allTgl = useMemo(() => [...new Set(jadwal.map((j) => j.tanggal))].sort(), [jadwal])
  const allSesi = useMemo(() => [...new Set(jadwal.map((j) => j.sesi))].sort(), [jadwal])
  const allRuang = useMemo(() => [...new Set(jadwal.map((j) => j.ruang))].sort(), [jadwal])

  // Hanya pendaftar terverifikasi
  const plottingRows = useMemo<PlottingRow[]>(() => {
    return pendaftar
      .filter((p) => p.status_verifikasi === 1)
      .map((p) => ({
        id: p.id, no_pendaftaran: p.no_pendaftaran, nama_lengkap: p.nama_lengkap,
        tanggal_tes: p.tanggal_tes || '', sesi_tes: p.sesi_tes || '', ruang_tes: p.ruang_tes || '',
      }))
  }, [pendaftar])

  function getVal(id: string, field: 'tanggal_tes' | 'sesi_tes' | 'ruang_tes', fallback: string) {
    return edits[id]?.[field] ?? fallback
  }
  function setEdit(id: string, field: 'tanggal_tes' | 'sesi_tes' | 'ruang_tes', val: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  const filteredPlot = useMemo(() => {
    return plottingRows.filter((p) => {
      if (search && !`${p.nama_lengkap} ${p.no_pendaftaran}`.toLowerCase().includes(search.toLowerCase())) return false
      const tgl = getVal(p.id, 'tanggal_tes', p.tanggal_tes)
      const sesi = getVal(p.id, 'sesi_tes', p.sesi_tes)
      const ruang = getVal(p.id, 'ruang_tes', p.ruang_tes)
      if (fTgl === 'blank' ? tgl : fTgl !== 'all' && tgl !== fTgl) return false
      if (fSesi !== 'all' && sesi !== fSesi) return false
      if (fRuang !== 'all' && ruang !== fRuang) return false
      return true
    })
  }, [plottingRows, search, fTgl, fSesi, fRuang, edits])

  async function saveChanges() {
    const changes = Object.entries(edits).map(([id, v]) => {
      const orig = plottingRows.find((r) => r.id === id)
      return {
        id,
        tanggal_tes: v.tanggal_tes ?? orig?.tanggal_tes ?? '',
        sesi_tes: v.sesi_tes ?? orig?.sesi_tes ?? '',
        ruang_tes: v.ruang_tes ?? orig?.ruang_tes ?? '',
      }
    })
    if (!changes.length) { onFlash({ error: 'Tidak ada perubahan' }); return }
    setSaving(true)
    const res = await saveManualPlotting(changes)
    setSaving(false)
    onFlash(res)
    if (!res.error) setEdits({})
  }

  async function exportPlot() {
    const XLSX = await import('xlsx')
    const rows = plottingRows.map((p) => ({
      no_pendaftaran: p.no_pendaftaran, nama_lengkap: p.nama_lengkap,
      tanggal_tes: getVal(p.id, 'tanggal_tes', p.tanggal_tes),
      sesi_tes: getVal(p.id, 'sesi_tes', p.sesi_tes),
      ruang_tes: getVal(p.id, 'ruang_tes', p.ruang_tes),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Plotting Jadwal Tes')
    XLSX.writeFile(wb, 'Plotting_Jadwal_Tes.xlsx')
  }

  async function importPlot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = (XLSX.utils.sheet_to_json(ws) as { no_pendaftaran: string; tanggal_tes?: string; sesi_tes?: string; ruang_tes?: string }[])
    if (!rows.length) { onFlash({ error: 'File kosong' }); return }
    const byNoPendaftaran: Record<string, PlottingRow> = {}
    for (const r of plottingRows) byNoPendaftaran[r.no_pendaftaran] = r
    const newEdits = { ...edits }
    let matched = 0
    for (const row of rows) {
      const orig = byNoPendaftaran[row.no_pendaftaran]
      if (!orig) continue
      newEdits[orig.id] = {
        tanggal_tes: row.tanggal_tes || orig.tanggal_tes,
        sesi_tes: row.sesi_tes || orig.sesi_tes,
        ruang_tes: row.ruang_tes || orig.ruang_tes,
      }
      matched++
    }
    setEdits(newEdits)
    onFlash({ success: `${matched} baris diimport — cek lalu klik Simpan` })
    e.target.value = ''
  }

  const editCount = Object.keys(edits).length

  return (
    <Tabs defaultValue="plotting">
      <TabsList>
        <TabsTrigger value="slot">Konfigurasi Slot</TabsTrigger>
        <TabsTrigger value="plotting">
          Plotting Jadwal
          {editCount > 0 && <span className="ml-1.5 text-amber-600 font-bold">({editCount}✎)</span>}
        </TabsTrigger>
      </TabsList>

      {/* ════ TAB SLOT ════ */}
      <TabsContent value="slot" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tambah Slot Jadwal Tes</CardTitle>
            <CardDescription>Definisikan slot tanggal/sesi/ruang untuk auto-plotting dan manual plotting.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Tanggal</Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Sesi</Label>
                <Input placeholder="Pagi / Siang" value={form.sesi} onChange={(e) => setForm({ ...form, sesi: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ruang</Label>
                <Input placeholder="R-01" value={form.ruang} onChange={(e) => setForm({ ...form, ruang: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Kapasitas</Label>
                <Input type="number" min={1} value={form.kapasitas} onChange={(e) => setForm({ ...form, kapasitas: e.target.value })} />
              </div>
              <Button onClick={addSlot} disabled={pending} className="mt-5">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Slot Terdaftar ({jadwal.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={doAutoPlot} disabled={pending}>
              <Zap className="h-4 w-4 mr-1 text-amber-500" />Auto-Plotting
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {jadwal.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">Belum ada slot jadwal.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs">Sesi</TableHead>
                    <TableHead className="text-xs">Ruang</TableHead>
                    <TableHead className="text-xs text-center">Kapasitas</TableHead>
                    <TableHead className="text-xs text-center">Terisi</TableHead>
                    <TableHead className="text-xs text-center">Sisa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jadwal.map((s) => {
                    const k = `${s.tanggal}|${s.sesi}|${s.ruang}`
                    const terisi = slotStats[k] || 0
                    const sisa = s.kapasitas - terisi
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{s.tanggal}</TableCell>
                        <TableCell className="text-sm">{s.sesi}</TableCell>
                        <TableCell className="text-sm">{s.ruang}</TableCell>
                        <TableCell className="text-sm text-center">{s.kapasitas}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${terisi > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{terisi}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${sisa > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{sisa}</span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => removeSlot(s.id)} disabled={pending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ════ TAB PLOTTING ════ */}
      <TabsContent value="plotting" className="space-y-3 mt-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama / no daftar" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
          <Select value={fTgl} onValueChange={setFTgl}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tanggal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tgl</SelectItem>
              <SelectItem value="blank">Belum diplot</SelectItem>
              {allTgl.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSesi} onValueChange={setFSesi}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Sesi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sesi</SelectItem>
              {allSesi.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fRuang} onValueChange={setFRuang}>
            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Ruang" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Ruang</SelectItem>
              {allRuang.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPlot}><FileSpreadsheet className="h-4 w-4 mr-1" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Import</Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importPlot} />
          {editCount > 0 && (
            <Button size="sm" onClick={saveChanges} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Simpan ({editCount} perubahan)
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground px-1">
          {filteredPlot.length} dari {plottingRows.length} pendaftar terverifikasi
          {' · '}{plottingRows.filter((p) => (edits[p.id]?.tanggal_tes ?? p.tanggal_tes)).length} sudah dijadwalkan
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-2">No. Daftar</TableHead>
                  <TableHead className="text-xs py-2">Nama</TableHead>
                  <TableHead className="text-xs py-2">Tanggal Tes</TableHead>
                  <TableHead className="text-xs py-2">Sesi</TableHead>
                  <TableHead className="text-xs py-2">Ruang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlot.map((p) => {
                  const changed = !!edits[p.id]
                  return (
                    <TableRow key={p.id} className={changed ? 'bg-amber-50' : ''}>
                      <TableCell className="py-2 font-mono text-xs text-muted-foreground">{p.no_pendaftaran}</TableCell>
                      <TableCell className="py-2 text-sm font-medium">{p.nama_lengkap}</TableCell>
                      <TableCell className="py-2">
                        <Select value={getVal(p.id, 'tanggal_tes', p.tanggal_tes) || '__none__'}
                          onValueChange={(v) => setEdit(p.id, 'tanggal_tes', v === '__none__' ? '' : v)}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Pilih tgl" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {allTgl.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Select value={getVal(p.id, 'sesi_tes', p.sesi_tes) || '__none__'}
                          onValueChange={(v) => setEdit(p.id, 'sesi_tes', v === '__none__' ? '' : v)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Sesi" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {allSesi.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Select value={getVal(p.id, 'ruang_tes', p.ruang_tes) || '__none__'}
                          onValueChange={(v) => setEdit(p.id, 'ruang_tes', v === '__none__' ? '' : v)}>
                          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Ruang" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {allRuang.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredPlot.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                      Tidak ada pendaftar sesuai filter
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
