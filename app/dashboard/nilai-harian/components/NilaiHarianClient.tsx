'use client'

import { useState, useCallback, useTransition, useRef, useMemo } from 'react'
import Script from 'next/script'
import {
  Plus, Pencil, Trash2, Save, Loader2, Download, Upload, FileSpreadsheet,
  BarChart2, BookOpen, Users, AlertCircle, CheckCircle2, X, Settings,
  ChevronDown, TrendingUp, TrendingDown, Minus, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useReactToPrint } from 'react-to-print'
import type { PenugasanGuru, NilaiHeader, NilaiDetail } from '../actions'
import {
  getNilaiHeaders, getNilaiDetail, buatSesiNilai, editSesiNilai,
  hapusSesiNilai, simpanNilaiSiswa, getRekapNilai, simpanKKM,
} from '../actions'
import { todayWIB } from '@/lib/time'

// ============================================================
// HELPERS
// ============================================================
const fmtTanggal = (d: string) => {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return d }
}
const gradeColor = (n: number, kkm: number) => {
  if (n >= kkm) return 'text-emerald-700 dark:text-emerald-400'
  if (n >= kkm * 0.8) return 'text-amber-600'
  return 'text-rose-600'
}
const today = todayWIB

// ============================================================
// TOAST
// ============================================================
function useToast() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const show = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000) }
  return { msg, show }
}

// ============================================================
// MINI BAR CHART (no library)
// ============================================================
function MiniBarChart({ data, kkm }: { data: number[]; kkm: number }) {
  const max = Math.max(...data, 100)
  const buckets = [
    { label: '< 60', count: data.filter(v => v < 60).length, color: 'bg-rose-400' },
    { label: '60–74', count: data.filter(v => v >= 60 && v < kkm).length, color: 'bg-amber-400' },
    { label: `${kkm}–84`, count: data.filter(v => v >= kkm && v < 85).length, color: 'bg-emerald-400' },
    { label: '85–100', count: data.filter(v => v >= 85).length, color: 'bg-blue-400' },
  ]
  const bmax = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div className="flex items-end gap-2 h-20">
      {buckets.map(b => (
        <div key={b.label} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{b.count}</span>
          <div className={cn('w-full rounded-t transition-all', b.color)} style={{ height: `${(b.count / bmax) * 52}px`, minHeight: b.count > 0 ? 4 : 0 }} />
          <span className="text-[9px] text-slate-400 leading-tight text-center">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// FORM SESI DIALOG
// ============================================================
function FormSesiDialog({ open, onClose, existing, penugasanId, kkmDefault }: {
  open: boolean; onClose: (refresh?: boolean) => void;
  existing: NilaiHeader | null; penugasanId: string; kkmDefault: number
}) {
  const [isPending, startTransition] = useTransition()
  const [judul, setJudul] = useState(existing?.judul || '')
  const [tanggal, setTanggal] = useState(existing?.tanggal || today())
  const [ket, setKet] = useState(existing?.keterangan || '')
  const [kkm, setKkm] = useState(existing?.kkm ?? kkmDefault)
  const { msg, show } = useToast()

  const handleSubmit = () => {
    if (!judul.trim()) { show(false, 'Judul wajib diisi.'); return }
    startTransition(async () => {
      const res = existing
        ? await editSesiNilai(existing.id, { judul, tanggal, keterangan: ket, kkm })
        : await buatSesiNilai({ penugasan_id: penugasanId, judul, tanggal, keterangan: ket, kkm })
      if (res.error) { show(false, res.error); return }
      onClose(true)
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-sm">{existing ? 'Edit' : 'Tambah'} Sesi Penilaian</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {msg && <div className={cn('text-xs px-3 py-2 rounded-lg flex items-center gap-2', msg.ok ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 text-rose-700')}>
            {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}{msg.text}
          </div>}
          <div className="space-y-1"><Label className="text-xs">Judul <span className="text-rose-500">*</span></Label>
            <Input value={judul} onChange={e => setJudul(e.target.value)} placeholder="cth: Ulangan Harian 1" className="h-8 text-xs rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Tanggal</Label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-8 text-xs rounded-lg" />
            </div>
            <div className="space-y-1"><Label className="text-xs">KKM</Label>
              <Input type="number" min={0} max={100} value={kkm} onChange={e => setKkm(Number(e.target.value))} className="h-8 text-xs rounded-lg" />
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Keterangan (opsional)</Label>
            <Textarea value={ket} onChange={e => setKet(e.target.value)} rows={2} placeholder="Catatan sesi..." className="text-xs rounded-lg resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onClose()} className="flex-1 h-8 text-xs rounded-lg">Batal</Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}{existing ? 'Simpan' : 'Buat'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// TAB: INPUT NILAI
// ============================================================
function TabInput({ penugasanId, kelas_id, kkm }: { penugasanId: string; kelas_id: string; kkm: number }) {
  const [headers, setHeaders] = useState<NilaiHeader[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedHeader, setSelectedHeader] = useState<NilaiHeader | null>(null)
  const [detail, setDetail] = useState<NilaiDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [nilaiDraft, setNilaiDraft] = useState<Record<string, string>>({})
  const [catatanDraft, setCatatanDraft] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<NilaiHeader | null>(null)
  const { msg, show } = useToast()
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const loadHeaders = useCallback(async () => {
    setLoading(true)
    const res = await getNilaiHeaders(penugasanId)
    setHeaders(res); setLoaded(true); setLoading(false)
  }, [penugasanId])

  const loadDetail = useCallback(async (header: NilaiHeader) => {
    setSelectedHeader(header); setDetailLoading(true)
    const res = await getNilaiDetail(header.id, kelas_id)
    setDetail(res)
    const draftN: Record<string, string> = {}
    const draftC: Record<string, string> = {}
    res.forEach(s => { draftN[s.siswa_id] = s.nilai != null ? String(s.nilai) : ''; draftC[s.siswa_id] = s.catatan || '' })
    setNilaiDraft(draftN); setCatatanDraft(draftC); setDetailLoading(false)
  }, [kelas_id])

  useState(() => { loadHeaders() })
  const _ = useMemo(() => { loadHeaders() }, [loadHeaders])

  const handleSaveNilai = async () => {
    if (!selectedHeader) return
    setIsSaving(true)
    const data = detail.map(s => ({
      siswa_id: s.siswa_id,
      nilai: parseFloat(nilaiDraft[s.siswa_id] || '0') || 0,
      catatan: catatanDraft[s.siswa_id] || '',
    }))
    const res = await simpanNilaiSiswa(selectedHeader.id, data)
    if (res.error) show(false, res.error)
    else { show(true, res.success!); await loadHeaders() }
    setIsSaving(false)
  }

  const handleHapusSesi = (id: string) => {
    if (!confirm('Hapus sesi ini beserta semua nilainya?')) return
    startTransition(async () => {
      const res = await hapusSesiNilai(id)
      if (res.error) show(false, res.error)
      else { show(true, 'Sesi dihapus.'); if (selectedHeader?.id === id) { setSelectedHeader(null); setDetail([]) }; await loadHeaders() }
    })
  }

  // Import Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedHeader) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = (window as any).XLSX
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const logs: string[] = []
        const newDraft = { ...nilaiDraft }
        const newCat = { ...catatanDraft }
        for (const row of rows) {
          const nisn = String(row['NISN'] || row['nisn'] || '').trim()
          const nilai = parseFloat(String(row['NILAI'] || row['nilai'] || ''))
          const cat = String(row['CATATAN'] || row['catatan'] || '').trim()
          const siswa = detail.find(s => String(s.nisn).trim() === nisn)
          if (!siswa) { logs.push(`NISN ${nisn} tidak ditemukan`); continue }
          if (isNaN(nilai) || nilai < 0 || nilai > 100) { logs.push(`NISN ${nisn}: nilai tidak valid (${row['NILAI']})`); continue }
          newDraft[siswa.siswa_id] = String(nilai)
          if (cat) newCat[siswa.siswa_id] = cat
        }
        setNilaiDraft(newDraft); setCatatanDraft(newCat); setImportLogs(logs)
        show(true, `${rows.length - logs.length} baris berhasil diimport.`)
      } catch { show(false, 'Gagal membaca file Excel.') }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX; if (!XLSX) return
    const rows = detail.map(s => ({ NISN: s.nisn, NAMA: s.nama_lengkap, NILAI: '', CATATAN: '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Nilai')
    XLSX.writeFile(wb, `Template_${selectedHeader?.judul || 'Nilai'}.xlsx`)
  }

  return (
    <div className="space-y-3">
      {msg && <div className={cn('text-xs px-3 py-2 rounded-lg flex items-center gap-2', msg.ok ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border border-rose-200')}>
        {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}{msg.text}
      </div>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{headers.length} sesi penilaian</p>
        <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> Tambah Sesi
        </Button>
      </div>

      {loading && <div className="text-center py-8 text-slate-400 text-xs"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Memuat sesi...</div>}

      {loaded && headers.length === 0 && (
        <div className="py-10 text-center bg-surface rounded-xl border border-surface">
          <BookOpen className="h-7 w-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Belum ada sesi penilaian.</p>
        </div>
      )}

      {/* Daftar Sesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {headers.map(h => {
          const isSelected = selectedHeader?.id === h.id
          return (
            <div key={h.id} onClick={() => loadDetail(h)}
              className={cn('border rounded-xl p-3 cursor-pointer transition-all space-y-2', isSelected ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300' : 'border-surface bg-surface hover:border-blue-200')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{h.judul}</p>
                  <p className="text-[10px] text-slate-400">{fmtTanggal(h.tanggal)} · KKM {h.kkm}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditTarget(h); setShowForm(true) }}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); handleHapusSesi(h.id) }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Users className="h-3 w-3" />{h.jumlah_siswa} siswa</span>
                {h.rata_rata != null && <span className={cn('font-bold', gradeColor(h.rata_rata, h.kkm))}>Rata-rata: {h.rata_rata}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabel Input Nilai */}
      {selectedHeader && (
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold text-sm text-blue-900">{selectedHeader.judul}</p>
              <p className="text-[10px] text-blue-600">{fmtTanggal(selectedHeader.tanggal)} · KKM {selectedHeader.kkm}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadTemplate} className="h-7 px-2 text-[10px] flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Download className="h-3 w-3" /> Template
              </button>
              <label className="h-7 px-2 text-[10px] flex items-center gap-1 border border-blue-200 rounded-lg hover:bg-blue-50 text-blue-700 cursor-pointer">
                <Upload className="h-3 w-3" /> Import Excel
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
              </label>
            </div>
          </div>

          {importLogs.length > 0 && (
            <div className="mx-4 mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700 space-y-0.5">
              <p className="font-bold">⚠ {importLogs.length} baris gagal diimport:</p>
              {importLogs.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          )}

          {detailLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Memuat daftar siswa...</div>
          ) : (
            <>
              {/* ── MOBILE: Card per siswa (no horizontal scroll) ── */}
              <div className="block md:hidden divide-y divide-slate-100">
                {detail.map((s, i) => {
                  const n = parseFloat(nilaiDraft[s.siswa_id] || '')
                  const color = isNaN(n) ? 'text-slate-700 dark:text-slate-300' : gradeColor(n, selectedHeader.kkm)
                  const bgColor = isNaN(n) ? '' : n >= selectedHeader.kkm ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' : n >= selectedHeader.kkm * 0.8 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                  return (
                    <div key={s.siswa_id} className="px-4 py-3 space-y-2">
                      {/* Nama + No */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 shrink-0 w-5">{i + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{s.nisn}</p>
                          </div>
                        </div>
                        {/* Nilai badge (preview) */}
                        {!isNaN(n) && (
                          <span className={`text-sm font-black shrink-0 ${color}`}>{n}</span>
                        )}
                      </div>
                      {/* Input row */}
                      <div className="flex gap-2 pl-7">
                        <div className="w-24 shrink-0">
                          <Input
                            type="number" min={0} max={100} step={0.5}
                            value={nilaiDraft[s.siswa_id] || ''}
                            onChange={e => setNilaiDraft(prev => ({ ...prev, [s.siswa_id]: e.target.value }))}
                            placeholder="Nilai"
                            className={`h-9 text-sm text-center rounded-lg font-bold ${color}`}
                          />
                        </div>
                        <Input
                          value={catatanDraft[s.siswa_id] || ''}
                          onChange={e => setCatatanDraft(prev => ({ ...prev, [s.siswa_id]: e.target.value }))}
                          placeholder="Catatan (opsional)"
                          className="h-9 text-xs rounded-lg flex-1"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── DESKTOP: Tabel ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 w-8">No</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Nama Siswa</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 w-20">NISN</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400 w-24">Nilai</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {detail.map((s, i) => {
                      const n = parseFloat(nilaiDraft[s.siswa_id] || '')
                      const color = isNaN(n) ? '' : gradeColor(n, selectedHeader.kkm)
                      return (
                        <tr key={s.siswa_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">{s.nama_lengkap}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-mono">{s.nisn}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number" min={0} max={100} step={0.5}
                              value={nilaiDraft[s.siswa_id] || ''}
                              onChange={e => setNilaiDraft(prev => ({ ...prev, [s.siswa_id]: e.target.value }))}
                              className={cn('h-7 text-xs text-center rounded w-full', color)}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              value={catatanDraft[s.siswa_id] || ''}
                              onChange={e => setCatatanDraft(prev => ({ ...prev, [s.siswa_id]: e.target.value }))}
                              placeholder="opsional..."
                              className="h-7 text-xs rounded w-full"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!detailLoading && detail.length > 0 && (
            <div className="px-4 py-3 border-t border-surface flex justify-end">
              <Button size="sm" onClick={handleSaveNilai} disabled={isSaving} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-lg">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan Nilai
              </Button>
            </div>
          )}
        </div>
      )}

      <FormSesiDialog open={showForm} onClose={r => { setShowForm(false); setEditTarget(null); if (r) loadHeaders() }} existing={editTarget} penugasanId={penugasanId} kkmDefault={kkm} />
    </div>
  )
}

// ============================================================
// TAB: REKAP
// ============================================================
function TabRekap({ penugasanId, mapelNama, kelasLabel }: { penugasanId: string; mapelNama: string; kelasLabel: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRekapNilai>> | null>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const load = useCallback(async () => {
    setLoading(true); const res = await getRekapNilai(penugasanId)
    setData(res); setLoading(false)
  }, [penugasanId])

  useMemo(() => { load() }, [load])

  const handleExportExcel = () => {
    if (!data) return
    const XLSX = (window as any).XLSX; if (!XLSX) return
    const cols = ['NO', 'NISN', 'NAMA', ...data.headers.map(h => h.judul), 'RATA-RATA']
    const rows = data.rows.map((r, i) => {
      const obj: any = { NO: i + 1, NISN: r.nisn, NAMA: r.nama_lengkap }
      data.headers.forEach(h => { obj[h.judul] = r.nilai[h.id] ?? '' })
      obj['RATA-RATA'] = r.rata_rata ?? ''
      return obj
    })
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai')
    XLSX.writeFile(wb, `Rekap_${mapelNama}_${kelasLabel}.xlsx`)
  }

  if (loading) return <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Memuat rekap...</div>
  if (!data || data.headers.length === 0) return <div className="py-10 text-center text-slate-400 text-sm">Belum ada data nilai.</div>

  const { headers, rows, kkm } = data

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-7 text-xs gap-1 rounded-lg">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => handlePrint()} className="h-7 text-xs gap-1 rounded-lg">
          <Printer className="h-3.5 w-3.5" /> Cetak PDF
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800">No</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 sticky left-6 bg-slate-50 dark:bg-slate-800">Nama Siswa</th>
              {headers.map(h => (
                <th key={h.id} className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  <div>{h.judul}</div>
                  <div className="text-[9px] font-normal text-slate-400">{fmtTanggal(h.tanggal)}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400">Rata-rata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <tr key={r.siswa_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100 whitespace-nowrap">{r.nama_lengkap}</td>
                {headers.map(h => {
                  const n = r.nilai[h.id]
                  return (
                    <td key={h.id} className={cn('px-3 py-2 text-center font-semibold', n != null ? gradeColor(n, kkm) : 'text-slate-300')}>
                      {n != null ? n : '-'}
                    </td>
                  )
                })}
                <td className={cn('px-3 py-2 text-center font-bold', r.rata_rata != null ? gradeColor(r.rata_rata, kkm) : 'text-slate-300')}>
                  {r.rata_rata ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hidden Print Area */}
      <div className="hidden">
        <style>{`@media print { @page { size: 215mm 330mm; margin: 20mm; } body { -webkit-print-color-adjust: exact; } }`}</style>
        <div ref={printRef} style={{ fontFamily: 'Times New Roman, serif', fontSize: '10px', color: '#000' }}>
          <img src="/kopsurat.png" alt="Kop Surat" style={{ display: 'block', width: 'calc(100% + 40mm)', marginLeft: '-20mm', marginRight: '-20mm', marginTop: '-20mm' }} />
          <div style={{ textAlign: 'center', margin: '10px 0 12px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>REKAP NILAI HARIAN</h3>
            <p style={{ fontSize: '10px', margin: '2px 0 0' }}>{mapelNama} — {kelasLabel}</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '3px 4px' }}>No</th>
                <th style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>Nama Siswa</th>
                {headers.map(h => <th key={h.id} style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{h.judul}<br /><span style={{ fontWeight: 'normal', fontSize: '8px' }}>{h.tanggal}</span></th>)}
                <th style={{ border: '1px solid #000', padding: '3px 4px' }}>Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.siswa_id}>
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{r.nama_lengkap}</td>
                  {headers.map(h => <td key={h.id} style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{r.nilai[h.id] ?? '-'}</td>)}
                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 'bold' }}>{r.rata_rata ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '20px', textAlign: 'right', fontSize: '9px' }}>
            <p>Tasikmalaya, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}</p>
            <p style={{ marginTop: '4px' }}>Guru Mata Pelajaran,</p>
            <div style={{ height: '48px' }} />
            <p>(__________________________)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TAB: ANALITIK
// ============================================================
function TabAnalitik({ penugasanId }: { penugasanId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRekapNilai>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [kkm, setKkm] = useState(75)
  const [kkmInput, setKkmInput] = useState('75')
  const [savingKkm, setSavingKkm] = useState(false)
  const { msg, show } = useToast()

  const load = useCallback(async () => {
    setLoading(true); const res = await getRekapNilai(penugasanId)
    setData(res); setKkm(res.kkm); setKkmInput(String(res.kkm)); setLoading(false)
  }, [penugasanId])

  useMemo(() => { load() }, [load])

  const handleSaveKkm = async () => {
    const v = parseInt(kkmInput); if (isNaN(v) || v < 0 || v > 100) { show(false, 'KKM harus 0-100'); return }
    setSavingKkm(true)
    const res = await simpanKKM(penugasanId, v); if (res.success) { setKkm(v); show(true, res.success) } else show(false, res.error!)
    setSavingKkm(false)
  }

  if (loading) return <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
  if (!data || data.headers.length === 0) return <div className="py-10 text-center text-slate-400 text-sm">Belum ada data nilai untuk dianalisis.</div>

  const { headers, rows } = data
  const allValues = rows.flatMap(r => headers.map(h => r.nilai[h.id]).filter(v => v != null) as number[])

  return (
    <div className="space-y-4">
      {/* KKM Setting */}
      <div className="bg-surface border border-surface rounded-xl p-3 flex items-end gap-3">
        <div className="space-y-1 flex-1 max-w-xs">
          <Label className="text-xs flex items-center gap-1"><Settings className="h-3 w-3" /> KKM Mapel ini</Label>
          <Input type="number" min={0} max={100} value={kkmInput} onChange={e => setKkmInput(e.target.value)} className="h-8 text-xs rounded-lg w-32" />
        </div>
        <Button size="sm" onClick={handleSaveKkm} disabled={savingKkm} className="h-8 text-xs bg-slate-700 hover:bg-slate-800 text-white rounded-lg gap-1">
          {savingKkm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan KKM
        </Button>
        {msg && <p className={cn('text-xs', msg.ok ? 'text-emerald-600' : 'text-rose-600')}>{msg.text}</p>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Siswa', val: rows.length, icon: Users, color: 'bg-blue-50 text-blue-700' },
          { label: 'Total Sesi', val: headers.length, icon: BookOpen, color: 'bg-violet-50 text-violet-700' },
          { label: 'Rata-rata Kelas', val: allValues.length ? (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1) : '-', icon: TrendingUp, color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' },
          { label: 'Di Bawah KKM', val: rows.filter(r => { const vals = headers.map(h => r.nilai[h.id]).filter(v => v != null) as number[]; return vals.length > 0 && (vals.reduce((a, b) => a + b, 0) / vals.length) < kkm }).length, icon: TrendingDown, color: 'bg-rose-50 text-rose-700' },
        ].map(card => (
          <div key={card.label} className="bg-surface border border-surface rounded-xl p-3 flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', card.color)}>
              <card.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{card.label}</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-none">{card.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per Sesi Analitik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {headers.map(h => {
          const vals = rows.map(r => r.nilai[h.id]).filter(v => v != null) as number[]
          const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-'
          const min = vals.length ? Math.min(...vals) : null
          const max = vals.length ? Math.max(...vals) : null
          const lulus = vals.filter(v => v >= kkm).length
          return (
            <div key={h.id} className="bg-surface border border-surface rounded-xl p-3 space-y-3">
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-100">{h.judul}</p>
                <p className="text-[10px] text-slate-400">{fmtTanggal(h.tanggal)} · {vals.length} nilai</p>
              </div>
              <MiniBarChart data={vals} kkm={kkm} />
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div><p className="text-slate-400">Rata-rata</p><p className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200">{avg}</p></div>
                <div><p className="text-slate-400">Min–Max</p><p className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200">{min ?? '-'}–{max ?? '-'}</p></div>
                <div><p className="text-slate-400">Lulus KKM</p><p className="font-bold text-emerald-600">{lulus}/{vals.length}</p></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Top & Bottom Performers */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['top', 'bottom'] as const).map(type => {
            const sorted = [...rows]
              .filter(r => r.rata_rata != null)
              .sort((a, b) => type === 'top' ? (b.rata_rata! - a.rata_rata!) : (a.rata_rata! - b.rata_rata!))
              .slice(0, 5)
            return (
              <div key={type} className="bg-surface border border-surface rounded-xl overflow-hidden">
                <div className={cn('px-4 py-2.5 border-b flex items-center gap-2', type === 'top' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'bg-rose-50 border-rose-100')}>
                  {type === 'top' ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
                  <p className={cn('font-bold text-sm', type === 'top' ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-700')}>{type === 'top' ? '5 Nilai Tertinggi' : '5 Nilai Terendah'}</p>
                </div>
                <div className="divide-y divide-surface-2">
                  {sorted.map((r, i) => (
                    <div key={r.siswa_id} className="px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}.</span>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">{r.nama_lengkap}</p>
                      </div>
                      <span className={cn('text-sm font-bold', gradeColor(r.rata_rata!, kkm))}>{r.rata_rata}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// MAIN CLIENT COMPONENT
// ============================================================
export function NilaiHarianClient({ penugasanList }: { penugasanList: PenugasanGuru[] }) {
  const [selectedPenugasan, setSelectedPenugasan] = useState<PenugasanGuru | null>(
    penugasanList.length === 1 ? penugasanList[0] : null
  )

  return (
    <div className="space-y-4">
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* Pilih Mapel + Kelas */}
      <div className="bg-surface border border-surface rounded-xl p-4">
        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-blue-500" /> Mata Pelajaran & Kelas
        </Label>
        {penugasanList.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Anda belum memiliki penugasan mengajar di tahun ajaran aktif.
          </div>
        ) : (
          <Select
            value={selectedPenugasan?.id || ''}
            onValueChange={v => setSelectedPenugasan(penugasanList.find(p => p.id === v) || null)}
          >
            <SelectTrigger className="h-9 text-sm rounded-lg max-w-sm">
              <SelectValue placeholder="-- Pilih Mapel & Kelas --" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {penugasanList.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-sm">
                  {p.mapel_nama} — {p.kelas_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedPenugasan && (
        <Tabs defaultValue="input" className="space-y-4">
          <TabsList className="bg-surface border border-surface p-0.5 rounded-lg h-auto">
            <TabsTrigger value="input" className="text-xs px-3 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Input Nilai
            </TabsTrigger>
            <TabsTrigger value="rekap" className="text-xs px-3 py-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Rekap
            </TabsTrigger>
            <TabsTrigger value="analitik" className="text-xs px-3 py-2 rounded-md data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              Analitik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="m-0">
            <TabInput penugasanId={selectedPenugasan.id} kelas_id={selectedPenugasan.kelas_id} kkm={selectedPenugasan.kkm} />
          </TabsContent>
          <TabsContent value="rekap" className="m-0">
            <TabRekap penugasanId={selectedPenugasan.id} mapelNama={selectedPenugasan.mapel_nama} kelasLabel={selectedPenugasan.kelas_label} />
          </TabsContent>
          <TabsContent value="analitik" className="m-0">
            <TabAnalitik penugasanId={selectedPenugasan.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
