'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PB_DAYS, type PbSlot, type PbJob } from '@/lib/pramubakti'
import { getPramubaktiSettings, savePramubaktiSettings } from './actions'

const box = 'space-y-4 rounded-xl border border-surface bg-surface p-5'
const select = 'rounded-md border border-surface bg-surface p-2 text-sm'
export function PramubaktiSettingsClient({ initialData }: { initialData: Awaited<ReturnType<typeof getPramubaktiSettings>> }) {
  const [data, setData] = useState(initialData)
  const [date, setDate] = useState(initialData.tomorrow)
  const [slots, setSlots] = useState<PbSlot[]>(initialData.versions.at(-1)?.slots || [])
  const [holiday, setHoliday] = useState({ start_date: initialData.tomorrow, end_date: initialData.tomorrow, reason: '' })
  const [jobs, setJobs] = useState(initialData.jobs)
  const [templates, setTemplates] = useState(initialData.templates)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(payload: Parameters<typeof savePramubaktiSettings>[0]) {
    setBusy(true); setMessage('')
    try { const result = await savePramubaktiSettings(payload); setMessage(result.error || result.success || ''); if (!result.error) { const fresh = await getPramubaktiSettings(); setData(fresh); setJobs(fresh.jobs) } } catch { setMessage('Gagal menyimpan. Coba lagi.') } finally { setBusy(false) }
  }
  function editJob(index: number, patch: Partial<PbJob>) { setJobs(old => old.map((j, i) => i === index ? { ...j, ...patch } : j)) }
  return <div className="space-y-4">
    <p className="text-sm text-slate-500">Batas waktu dan ambang telat mengikuti <Link className="text-emerald-700 underline" href="/dashboard/settings">Perilaku Input Guru dan Pramubakti</Link>.</p>
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    <fieldset disabled={busy} className={box}><h2 className="font-semibold">Jadwal laporan wajib bersama</h2><p className="text-sm text-slate-500">Satu laporan per slot untuk setiap Pramubakti. Jadwal baru berlaku mulai besok atau tanggal berikutnya. Mengosongkan semua slot menghentikan kewajiban sejak tanggal berlaku.</p>
      <label className="block max-w-xs text-sm">Mulai berlaku<Input type="date" value={date} min={data.tomorrow} onChange={e => setDate(e.target.value)} /></label>
      {slots.map((slot, index) => <div key={slot.id} className="flex flex-wrap items-center gap-2"><select aria-label={`Hari slot ${index + 1}`} className={select} value={slot.weekday} onChange={e => setSlots(old => old.map((s, i) => i === index ? { ...s, weekday: Number(e.target.value) } : s))}>{PB_DAYS.slice(1).map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select>{(['start', 'end'] as const).map(key => <label key={key} className="text-xs">{key === 'start' ? 'Mulai' : 'Selesai'}<Input aria-label={`${key} slot ${index + 1}`} type="time" className="w-32" value={slot[key]} onChange={e => setSlots(old => old.map((s, i) => i === index ? { ...s, [key]: e.target.value } : s))} /></label>)}<Button variant="ghost" onClick={() => setSlots(old => old.filter((_, i) => i !== index))}>Hapus</Button></div>)}
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSlots(old => [...old, { id: crypto.randomUUID(), weekday: 1, start: '07:00', end: '08:00' }])}>Tambah slot</Button><Button onClick={() => save({ type: 'schedule', effective_date: date, slots })}>Simpan versi jadwal</Button></div>
      <details><summary className="cursor-pointer text-sm">Riwayat versi jadwal ({data.versions.length})</summary>{data.versions.map(v => <div key={v.id} className="mt-2 rounded border p-3 text-xs"><p className="font-semibold">Mulai {v.effective_date}</p><p>{v.slots.map(s => `${PB_DAYS[s.weekday]} ${s.start}–${s.end}`).join(' · ') || 'Tanpa kewajiban'}</p><button className="mt-2 text-emerald-700 underline" onClick={() => setSlots(v.slots)}>Salin slot ke formulir</button></div>)}</details>
    </fieldset>
    <fieldset disabled={busy} className={box}><h2 className="font-semibold">Libur kerja Pramubakti</h2><p className="text-sm text-slate-500">Terpisah dari kalender pendidikan. Penambahan/pembatalan berlaku untuk libur mendatang.</p><div className="flex flex-wrap gap-2">{(['start_date', 'end_date'] as const).map(key => <label key={key} className="text-xs">{key === 'start_date' ? 'Dari' : 'Sampai'}<Input type="date" min={data.tomorrow} value={holiday[key]} onChange={e => setHoliday(old => ({ ...old, [key]: e.target.value }))} /></label>)}</div><Input aria-label="Alasan libur" placeholder="Alasan libur" maxLength={500} value={holiday.reason} onChange={e => setHoliday(old => ({ ...old, reason: e.target.value }))} /><Button onClick={() => save({ type: 'holiday', ...holiday })}>Tambahkan libur</Button>{data.holidays.map(h => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"><span>{h.start_date}–{h.end_date}: {h.reason}</span>{h.start_date >= data.tomorrow && <Button variant="outline" onClick={() => { const reason = window.prompt('Alasan pembatalan libur:'); if (reason) void save({ type: 'removeHoliday', id: h.id, reason }) }}>Batalkan libur</Button>}</div>)}</fieldset>
    <fieldset disabled={busy} className={box}><h2 className="font-semibold">Pilihan pekerjaan</h2><p className="text-sm text-slate-500">Perubahan nama tidak mengubah laporan lama.</p>{jobs.map((job, index) => <div key={job.id || `new-${index}`} className="flex flex-wrap items-center gap-2"><Input aria-label="Nama pekerjaan" className="max-w-sm" maxLength={100} value={job.name} onChange={e => editJob(index, { name: e.target.value })} /><Input aria-label="Urutan pekerjaan" className="w-24" type="number" value={job.sort_order} onChange={e => editJob(index, { sort_order: Number(e.target.value) })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={job.active === 1} onChange={e => editJob(index, { active: e.target.checked ? 1 : 0 })} />Aktif</label><Button variant="outline" onClick={() => save({ type: 'job', job })}>Simpan</Button></div>)}<Button variant="outline" onClick={() => setJobs(old => [...old, { id: '', name: '', sort_order: old.length + 1, active: 1 }])}>Tambah pekerjaan</Button></fieldset>
    <fieldset disabled={busy} className={box}><h2 className="font-semibold">Template CKH Pramubakti</h2>{(['monthly', 'daily'] as const).map(key => <label key={key} className="block space-y-2 text-sm"><span>{key === 'monthly' ? 'Kegiatan Bulanan' : 'Catatan Kinerja Harian'}</span><textarea className="min-h-24 w-full rounded-lg border border-surface bg-surface p-3" maxLength={2000} value={templates[key]} onChange={e => setTemplates(old => ({ ...old, [key]: e.target.value }))} /></label>)}<p className="text-xs text-slate-500">Catatan harian wajib memuat {'{pekerjaan}'} dan {'{tempat}'}.</p><div className="rounded-lg bg-surface-2 p-3 text-sm"><p className="mb-2 font-medium">Pratinjau</p>{[templates.monthly, templates.daily].map((t, i) => <p key={i}>{t.replaceAll('{pekerjaan}', 'Membersihkan dan Membuang Sampah').replaceAll('{tempat}', 'halaman depan')}</p>)}</div><Button onClick={() => save({ type: 'templates', ...templates })}>Simpan template CKH</Button></fieldset>
  </div>
}
