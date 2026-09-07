/* eslint-disable @next/next/no-img-element -- Camera previews use temporary blob URLs. */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CameraCapture } from '@/components/shared/camera-capture'
import { compressAgendaImage } from '@/app/dashboard/agenda/components/image-compression'
import { Camera, CheckCircle2, Clock, Plus, RefreshCw } from 'lucide-react'
import { getPramubaktiReports, submitPramubaktiReport } from './actions'
import { PbDetails, PbStatus } from '@/components/pramubakti/report-details'
import { todayWIB, currentTimeWIB } from '@/lib/time'
import { minutes, type PbItem } from '@/lib/pramubakti'

export function PramubaktiClient({ initialData }: { initialData: Awaited<ReturnType<typeof getPramubaktiReports>> }) {
  const [data, setData] = useState(initialData)
  const [selected, setSelected] = useState<string | null>(null)
  const [jobs, setJobs] = useState<string[]>([])
  const [tempat, setTempat] = useState('')
  const [camera, setCamera] = useState(false)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [requestId, setRequestId] = useState('')
  const [start, setStart] = useState(data.today.slice(0, 7) + '-01')
  const [end, setEnd] = useState(data.today)
  const [history, setHistory] = useState(data.items)
  const [clock, setClock] = useState(() => currentTimeWIB().hhmm)
  useEffect(() => {
    const timer = window.setInterval(() => setClock(currentTimeWIB().hhmm), 15000)
    return () => window.clearInterval(timer)
  }, [])
  function canFill(item: PbItem) {
    return data.today === todayWIB() && (!data.rules.restricted || !item.slot || (minutes(clock) >= minutes(item.slot.start) - 5 && minutes(clock) <= minutes(item.slot.end)))
  }
  useEffect(() => {
    if (!foto) { setPreview(''); return }
    const url = URL.createObjectURL(foto)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])
  const slots = data.items.filter(i => i.tanggal === data.today && i.slot && i.status !== 'TAMBAHAN')
  const completed = slots.filter(i => i.report || i.leave).length
  const begin = (slot: string) => { setSelected(slot); setJobs([]); setTempat(''); setFoto(null); setCamera(false); setMessage(''); setRequestId(crypto.randomUUID()) }
  async function refresh() {
    setBusy(true)
    try { const fresh = await getPramubaktiReports(); setData(fresh); setHistory(fresh.items) } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal memuat data.') } finally { setBusy(false) }
  }
  async function capture(file: File) {
    setCamera(false); setBusy(true)
    try { setFoto(await compressAgendaImage(file)) } catch { setMessage('Foto gagal diproses. Ambil ulang foto.') } finally { setBusy(false) }
  }
  async function submit() {
    if (!foto || !selected) return
    setBusy(true); setMessage('')
    try {
      const form = new FormData()
      form.set('tanggal', data.today); form.set('request_id', requestId); form.set('slot_id', selected === 'extra' ? '' : selected); form.set('tempat', tempat); form.set('foto', foto)
      jobs.forEach(job => form.append('jobs', job))
      const result = await submitPramubaktiReport(form)
      setMessage(result.error || result.success || '')
      if (!result.error) { setSelected(null); setFoto(null); const fresh = await getPramubaktiReports(); setData(fresh); setHistory(fresh.items) }
    } catch { setMessage('Koneksi terputus. Coba kirim ulang; laporan yang sudah tersimpan tidak akan digandakan.') } finally { setBusy(false) }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface bg-surface p-4">
      <div><p className="font-semibold">{new Date(data.today + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'full' })}</p><p className="text-sm text-slate-500">{completed} dari {slots.length} slot wajib terselesaikan · WIB</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={refresh} disabled={busy} aria-label="Muat ulang"><RefreshCw className="h-4 w-4" /></Button><Button onClick={() => begin('extra')} disabled={busy}><Plus className="mr-2 h-4 w-4" />Laporan tambahan</Button></div>
    </div>
    {message && <p role="status" className="rounded-lg border bg-surface p-3 text-sm">{message}</p>}
    {!slots.length && <p className="rounded-xl border border-dashed p-6 text-center text-slate-500">Tidak ada kewajiban hari ini. Laporan tambahan tetap dapat diisi.</p>}
    {slots.map(item => <div key={item.key} className="rounded-xl border border-surface bg-surface p-4"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" />{item.slot!.start}–{item.slot!.end} WIB</p><PbStatus item={item} /></div>{!item.report && !item.leave ? <Button variant="outline" onClick={() => begin(item.slot!.id)} disabled={busy || !canFill(item)}>Isi laporan</Button> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div>{!item.report && !item.leave && !canFill(item) && <p className="mt-2 text-xs text-slate-500">Pengisian dibuka lima menit sebelum {item.slot!.start}, berakhir {item.slot!.end} WIB. Muat ulang setelah tanggal berganti.</p>}</div>)}
    {selected && <section className="space-y-4 rounded-xl border border-emerald-300 bg-surface p-5">
      <h2 className="font-semibold">{selected === 'extra' ? 'Laporan tambahan' : 'Laporan wajib'}</h2>
      <fieldset disabled={busy || camera} className="space-y-3"><legend className="mb-2 text-sm font-medium">1. Pilih pekerjaan</legend><div className="flex flex-wrap gap-3">{data.jobs.filter(j => j.active).map(job => <label key={job.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={jobs.includes(job.id)} onChange={e => setJobs(old => e.target.checked ? [...old, job.id] : old.filter(id => id !== job.id))} />{job.name}</label>)}</div><label className="block space-y-2 text-sm"><span>2. Tempat melakukan pekerjaan</span><Input value={tempat} maxLength={300} onChange={e => setTempat(e.target.value)} placeholder="Contoh: halaman depan dan koridor kelas X" /></label></fieldset>
      <div><p className="mb-2 text-sm font-medium">3. Foto pekerjaan (wajib)</p>{camera ? <CameraCapture onCapture={capture} onClose={() => setCamera(false)} /> : <div className="space-y-3">{preview && <img src={preview} alt="Pratinjau pekerjaan" className="max-h-72 rounded-lg object-contain" />}<Button variant="outline" disabled={busy || !jobs.length || !tempat.trim()} onClick={() => setCamera(true)}><Camera className="mr-2 h-4 w-4" />{foto ? 'Ambil ulang foto' : 'Buka kamera'}</Button></div>}</div>
      <div className="flex gap-2"><Button disabled={busy || camera || !foto || !jobs.length || !tempat.trim()} onClick={submit}>{busy ? 'Memproses…' : 'Kirim laporan'}</Button><Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setFoto(null); setCamera(false) }}>Batal</Button></div>
    </section>}
    <section className="space-y-3 rounded-xl border border-surface bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Riwayat pribadi</h2><Link className="text-sm text-emerald-600 underline" href="/dashboard/ckh-generator">Buka CKH Generator</Link></div><div className="flex flex-wrap items-end gap-2"><label className="text-xs">Dari<Input aria-label="Riwayat dari" type="date" value={start} max={todayWIB()} onChange={e => setStart(e.target.value)} /></label><label className="text-xs">Sampai<Input aria-label="Riwayat sampai" type="date" value={end} max={todayWIB()} onChange={e => setEnd(e.target.value)} /></label><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { setHistory((await getPramubaktiReports(start, end)).items) } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal memuat riwayat.') } finally { setBusy(false) } }}>Tampilkan</Button></div><PbDetails items={history} /></section>
  </div>
}
