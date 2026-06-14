'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CalendarPlus, Camera, XCircle, Loader2, ArrowLeft, ArrowRight,
  CheckCircle2, AlertCircle, ListChecks,
} from 'lucide-react'
import { compressAgendaImage } from '../../agenda/components/image-compression'
import { formatDateWIB } from '@/lib/time'
import { buatPertemuan, getPertemuan, loadAbsensi, simpanAbsensi } from '../actions'
import type { PertemuanRow, AbsensiSiswa } from '../actions'

type View = 'list' | 'step1' | 'step2'
const STATUS_OPT: Array<{ key: AbsensiSiswa['status']; label: string; cls: string }> = [
  { key: 'HADIR', label: 'H', cls: 'bg-emerald-600 text-white' },
  { key: 'SAKIT', label: 'S', cls: 'bg-blue-600 text-white' },
  { key: 'IZIN', label: 'I', cls: 'bg-sky-600 text-white' },
  { key: 'ALFA', label: 'A', cls: 'bg-rose-600 text-white' },
]

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PertemuanWizard({ ekskulId }: { ekskulId: string }) {
  const [view, setView] = useState<View>('list')
  const [pertemuanList, setPertemuanList] = useState<PertemuanRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [msg, setMsg] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Step 1 form
  const [tanggal, setTanggal] = useState(todayLocal())
  const [judul, setJudul] = useState('')
  const [catatan, setCatatan] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 absensi
  const [currentPertemuan, setCurrentPertemuan] = useState<{ id: string; label: string } | null>(null)
  const [absensi, setAbsensi] = useState<AbsensiSiswa[]>([])
  const [loadingAbsensi, setLoadingAbsensi] = useState(false)
  const [savingAbsensi, setSavingAbsensi] = useState(false)

  const reloadList = async () => {
    setLoadingList(true)
    setPertemuanList(await getPertemuan(ekskulId))
    setLoadingList(false)
  }
  useEffect(() => { reloadList() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ekskulId])

  const resetStep1 = () => {
    setTanggal(todayLocal()); setJudul(''); setCatatan('')
    setFotoFile(null); setFotoPreview(null)
  }

  const handleFoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressAgendaImage(file)
      setFotoFile(compressed)
      setFotoPreview(URL.createObjectURL(compressed))
    } catch {
      setMsg({ tipe: 'error', teks: 'Foto gagal diproses. Coba ambil ulang.' })
    } finally { e.target.value = '' }
  }, [])

  const openStep2 = async (pertemuanId: string, label: string) => {
    setCurrentPertemuan({ id: pertemuanId, label })
    setView('step2')
    setLoadingAbsensi(true)
    const res = await loadAbsensi(pertemuanId, ekskulId)
    setAbsensi(res.siswa)
    setLoadingAbsensi(false)
  }

  // Step 1 submit → create pertemuan → go step 2
  const handleCreate = async () => {
    if (!tanggal) { setMsg({ tipe: 'error', teks: 'Tanggal wajib diisi.' }); return }
    setSubmitting(true); setMsg(null)
    const fd = new FormData()
    fd.append('ekstrakurikuler_id', ekskulId)
    fd.append('tanggal', tanggal)
    fd.append('judul', judul.trim())
    fd.append('catatan', catatan.trim())
    if (fotoFile) fd.append('foto', fotoFile)

    const res = await buatPertemuan(fd)
    setSubmitting(false)
    if (res.error || !res.id) { setMsg({ tipe: 'error', teks: res.error || 'Gagal membuat pertemuan.' }); return }
    const label = `${formatDateWIB(tanggal)}${judul.trim() ? ' · ' + judul.trim() : ''}`
    resetStep1()
    await openStep2(res.id, label)
  }

  const setStatus = (siswaId: string, status: AbsensiSiswa['status']) => {
    setAbsensi(prev => prev.map(a => a.siswa_id === siswaId ? { ...a, status, catatan: status === 'HADIR' ? '' : a.catatan } : a))
  }
  const setCatatanSiswa = (siswaId: string, catatan: string) => {
    setAbsensi(prev => prev.map(a => a.siswa_id === siswaId ? { ...a, catatan } : a))
  }

  const handleSaveAbsensi = async () => {
    if (!currentPertemuan) return
    setSavingAbsensi(true); setMsg(null)
    const res = await simpanAbsensi(
      currentPertemuan.id, ekskulId,
      absensi.map(a => ({ siswa_id: a.siswa_id, status: a.status, catatan: a.catatan })),
    )
    setSavingAbsensi(false)
    if (res.error) { setMsg({ tipe: 'error', teks: res.error }); return }
    setMsg({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
    await reloadList()
    setView('list')
  }

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">{pertemuanList.length} pertemuan (semester ini)</p>
          <Button size="sm" onClick={() => { resetStep1(); setMsg(null); setView('step1') }}>
            <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Buat Pertemuan
          </Button>
        </div>

        {msg && (
          <div className={`p-2.5 text-xs rounded-lg border ${msg.tipe === 'sukses' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>{msg.teks}</div>
        )}

        {loadingList ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-slate-400" /></div>
        ) : pertemuanList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
            <CalendarPlus className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada pertemuan. Klik Buat Pertemuan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pertemuanList.map(pt => (
              <button key={pt.id} onClick={() => openStep2(pt.id, `${formatDateWIB(pt.tanggal)}${pt.judul ? ' · ' + pt.judul : ''}`)}
                className="w-full text-left rounded-lg border bg-white dark:bg-slate-900 px-4 py-3 hover:border-emerald-400 transition-colors flex items-center gap-3">
                {pt.foto_url ? (
                  <img src={pt.foto_url} alt="" className="h-10 w-10 rounded object-cover border" />
                ) : (
                  <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><CalendarPlus className="h-4 w-4 text-slate-400" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDateWIB(pt.tanggal)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{pt.judul || 'Tanpa judul'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${pt.jml_tidak_hadir > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>
                    {pt.jml_tidak_hadir > 0 ? `${pt.jml_tidak_hadir} tdk hadir` : 'Semua hadir'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── STEP 1: BUAT PERTEMUAN (presensi pembina) ──
  if (view === 'step1') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Button>
          <span className="text-xs text-slate-400">Langkah 1 dari 2 · Detail Pertemuan</span>
        </div>

        {msg && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2"><AlertCircle className="h-3.5 w-3.5 mt-0.5" />{msg.teks}</div>}

        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal Latihan <span className="text-rose-500">*</span></Label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Judul / Materi</Label>
              <Input value={judul} onChange={e => setJudul(e.target.value)} placeholder="Mis. Latihan rutin" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Catatan</Label>
            <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Catatan kegiatan (opsional)" className="text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Foto Kegiatan (opsional)</Label>
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Preview" className="w-full max-h-56 object-cover rounded-lg border" />
                <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"><XCircle className="h-4 w-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 transition-colors">
                <Camera className="h-7 w-7 text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Ketuk untuk ambil foto</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
          </div>

          <Button onClick={handleCreate} disabled={submitting || !tanggal} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : <>Lanjut: Absensi Siswa <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </div>
      </div>
    )
  }

  // ── STEP 2: ABSENSI SISWA ──
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => { reloadList(); setView('list') }}><ArrowLeft className="h-4 w-4 mr-1" />Selesai</Button>
        <span className="text-xs text-slate-400">Langkah 2 dari 2 · Absensi</span>
      </div>

      <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 px-4 py-2.5 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{currentPertemuan?.label} — default <b>Hadir</b>, tandai yang tidak hadir.</p>
      </div>

      {msg && (
        <div className={`p-2.5 text-xs rounded-lg border ${msg.tipe === 'sukses' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>{msg.teks}</div>
      )}

      {loadingAbsensi ? (
        <div className="py-10 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-slate-400" /></div>
      ) : absensi.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-400">Belum ada anggota. Tambah anggota dulu di tab Anggota.</div>
      ) : (
        <div className="space-y-2">
          {absensi.map(a => (
            <div key={a.siswa_id} className="rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{a.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">{a.nisn}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {STATUS_OPT.map(opt => (
                    <button key={opt.key} onClick={() => setStatus(a.siswa_id, opt.key)}
                      className={`h-7 w-7 rounded-md text-xs font-bold transition-colors ${a.status === opt.key ? opt.cls : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {a.status !== 'HADIR' && (
                <Input value={a.catatan} onChange={e => setCatatanSiswa(a.siswa_id, e.target.value)}
                  placeholder="Catatan (opsional)" className="h-7 text-xs mt-2" />
              )}
            </div>
          ))}

          <Button onClick={handleSaveAbsensi} disabled={savingAbsensi} className="w-full mt-2">
            {savingAbsensi ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Simpan Absensi</>}
          </Button>
        </div>
      )}
    </div>
  )
}
