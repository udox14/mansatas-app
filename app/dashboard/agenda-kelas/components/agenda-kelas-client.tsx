'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarDays, FileSpreadsheet, Loader2, Printer, Settings2, X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AgendaKelasOption, AgendaKelasPageData, AgendaKelasSignaturePlacement, AgendaKelasSignatureSettings } from '../actions'
import { getAgendaKelasCetakExportData, getAgendaKelasHari, saveAgendaKelasSignatureSettings } from '../actions'
import { AgendaKelasTemplate } from './agenda-kelas-template'
import { downloadBlobFile } from '@/lib/pdf/download'
import { loadAgendaKelasExportAssets } from '@/lib/agenda-kelas-export-assets'
import { agendaKelasXlsxFilename, buildAgendaKelasXlsxBlob } from '@/lib/agenda-kelas-xlsx'

type PaperSize = 'F4' | 'A4'
type PrintPeriod = 'date' | 'month'
type Props = { daftarKelas: AgendaKelasOption[]; today: string; initialSignatureSettings: AgendaKelasSignatureSettings }

const DEFAULT_SIGNATURE_SETTINGS: AgendaKelasSignatureSettings = {
  kepala: { enabled: 1, x_mm: 8, y_mm: 4, width_mm: 38 },
  wali: { enabled: 1, x_mm: 8, y_mm: 4, width_mm: 38 },
}

function monthFromDate(date: string) { return date.slice(0, 7) }
function absolutePrintHtml(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement
  for (const image of clone.querySelectorAll<HTMLImageElement>('img[src]')) {
    const src = image.getAttribute('src')
    if (src) image.setAttribute('src', new URL(src, window.location.href).toString())
  }
  return clone.innerHTML
}

export function AgendaKelasClient({ daftarKelas, today, initialSignatureSettings }: Props) {
  const [tingkat, setTingkat] = useState<'all' | '10' | '11' | '12'>('all')
  const [tanggal, setTanggal] = useState(today)
  const [bulan, setBulan] = useState(monthFromDate(today))
  const [signatureSettings, setSignatureSettings] = useState(initialSignatureSettings)
  const kelasTampil = useMemo(() => daftarKelas
    .filter(kelas => tingkat === 'all' || kelas.tingkat === Number(tingkat))
    .sort((a, b) => a.tingkat - b.tingkat || Number(a.nomor_kelas) - Number(b.nomor_kelas) || a.kelompok.localeCompare(b.kelompok, 'id')),
  [daftarKelas, tingkat])

  return <div className="space-y-4">
    <div className="rounded-lg border border-surface bg-surface p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2"><div className="rounded-md border border-indigo-100 bg-indigo-50 p-2 dark:border-indigo-900 dark:bg-indigo-950/40"><CalendarDays className="h-4 w-4 text-indigo-600" /></div><div><p className="text-sm font-semibold">Daftar Kelas</p><p className="text-xs text-slate-500">Agenda hanya dimuat saat kelas akan dicetak.</p></div></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-medium text-slate-600"><span>Tanggal</span><Input type="date" value={tanggal} onChange={event => setTanggal(event.target.value)} className="h-9 w-36 text-xs" /></label>
          <label className="space-y-1 text-xs font-medium text-slate-600"><span>Bulan</span><Input type="month" value={bulan} onChange={event => setBulan(event.target.value)} className="h-9 w-40 text-xs" /></label>
          <Select value={tingkat} onValueChange={value => setTingkat(value as typeof tingkat)}><SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Tingkat" /></SelectTrigger><SelectContent><SelectItem value="all">Semua tingkat</SelectItem><SelectItem value="10">Tingkat 10</SelectItem><SelectItem value="11">Tingkat 11</SelectItem><SelectItem value="12">Tingkat 12</SelectItem></SelectContent></Select>
        </div>
      </div>
    </div>
    <div className="overflow-hidden rounded-lg border border-surface bg-surface">
      <div className="hidden grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(130px,1fr)_auto] gap-3 border-b border-surface-2 bg-surface-2/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:grid"><span>Kelas</span><span>Wali Kelas</span><span>KM</span><span className="text-right">Aksi</span></div>
      {kelasTampil.map(kelas => <div key={kelas.id} className="grid grid-cols-1 gap-3 border-b border-surface-2 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(130px,1fr)_auto] md:items-center">
        <div><p className="font-semibold text-slate-800 dark:text-slate-100">{kelas.label}</p><p className="text-xs text-slate-500">{kelas.jumlah_siswa} siswa aktif</p></div>
        <div><p className="text-sm font-medium">{kelas.wali_kelas_nama}</p>{kelas.wali_kelas_nip ? <p className="text-xs text-slate-500">NIP. {kelas.wali_kelas_nip}</p> : null}</div>
        <div><p className="text-sm font-medium">{kelas.km_nama}</p><p className="text-xs text-slate-500">Ketua Murid</p></div>
        <div className="flex flex-wrap justify-start gap-2 md:justify-end"><SignatureSettingsModal settings={signatureSettings} kelas={kelas} onApply={setSignatureSettings} /><CetakAgendaKelasModal kelas={kelas} initialDate={tanggal} initialMonth={bulan} signatureSettings={signatureSettings} /></div>
      </div>)}
      {!kelasTampil.length ? <div className="p-8 text-center text-sm text-slate-500">Tidak ada kelas pada tingkat ini.</div> : null}
    </div>
  </div>
}

function SignatureSettingsModal({ settings, kelas, onApply }: { settings: AgendaKelasSignatureSettings; kelas: AgendaKelasOption; onApply: (settings: AgendaKelasSignatureSettings) => void }) {
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState(settings); const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null)
  const update = (signer: keyof AgendaKelasSignatureSettings, key: keyof AgendaKelasSignaturePlacement, value: number) => setDraft(previous => ({ ...previous, [signer]: { ...previous[signer], [key]: value } }))
  const save = async () => { setSaving(true); setMessage(null); try { const result = await saveAgendaKelasSignatureSettings(draft); if (result.error || !result.settings) setMessage(result.error || 'Pengaturan gagal disimpan.'); else { setDraft(result.settings); onApply(result.settings); setMessage('Pengaturan disimpan.') } } catch { setMessage('Pengaturan gagal disimpan.') } finally { setSaving(false) } }
  const people = [{ key: 'kepala' as const, label: 'Kepala Madrasah', name: 'Kepala MAN 1 Tasikmalaya', signature: null }, { key: 'wali' as const, label: `Wali ${kelas.label}`, name: kelas.wali_kelas_nama, signature: kelas.wali_kelas_signature_url }]
  return <DialogPrimitive.Root open={open} onOpenChange={next => { setOpen(next); if (next) { setDraft(settings); setMessage(null) } }}><DialogPrimitive.Trigger asChild><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs"><Settings2 className="h-3.5 w-3.5" />Tanda tangan</Button></DialogPrimitive.Trigger><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" /><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-surface bg-background p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><DialogPrimitive.Title className="font-semibold">Atur Tanda Tangan</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-xs text-slate-500">Pengaturan posisi berlaku untuk seluruh cetak Agenda Kelas.</DialogPrimitive.Description></div><DialogPrimitive.Close className="p-1 text-slate-400"><X className="h-4 w-4" /></DialogPrimitive.Close></div><div className="grid gap-3 sm:grid-cols-2">{people.map(person => { const placement = draft[person.key]; return <div key={person.key} className="space-y-3 rounded-lg border border-surface p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(placement.enabled)} onChange={event => update(person.key, 'enabled', event.target.checked ? 1 : 0)} />{person.label}</label><p className="text-xs text-slate-500">{person.name}{person.key === 'wali' && !person.signature ? ' — file tanda tangan belum tersedia.' : ''}</p><SignatureControl label="Geser kanan (mm)" value={placement.x_mm} onChange={value => update(person.key, 'x_mm', value)} /><SignatureControl label="Geser turun (mm)" value={placement.y_mm} onChange={value => update(person.key, 'y_mm', value)} /><SignatureControl label="Lebar tanda tangan (mm)" value={placement.width_mm} min={15} max={120} onChange={value => update(person.key, 'width_mm', value)} /></div> })}</div>{message ? <p className="mt-3 text-xs text-slate-600">{message}</p> : null}<div className="mt-4 flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDraft(DEFAULT_SIGNATURE_SETTINGS)} disabled={saving}>Reset</Button><Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}</Button></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}

function SignatureControl({ label, value, min = -20, max = 80, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) { return <label className="block space-y-1 text-[11px] text-slate-600"><span>{label}</span><Input type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="h-8 text-xs" /></label> }

function CetakAgendaKelasModal({ kelas, initialDate, initialMonth, signatureSettings }: { kelas: AgendaKelasOption; initialDate: string; initialMonth: string; signatureSettings: AgendaKelasSignatureSettings }) {
  const [open, setOpen] = useState(false); const [format, setFormat] = useState<'PDF' | 'XLSX'>('PDF'); const [paperSize, setPaperSize] = useState<PaperSize>('F4'); const [period, setPeriod] = useState<PrintPeriod>('date'); const [date, setDate] = useState(initialDate); const [month, setMonth] = useState(initialMonth); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [status, setStatus] = useState<string | null>(null); const [pages, setPages] = useState<AgendaKelasPageData[]>([]); const printRef = useRef<HTMLDivElement>(null)
  const loadPages = async () => { if (period === 'date') { const result = await getAgendaKelasHari(kelas.id, date); if (result.error || !result.data) throw new Error(result.error || 'Agenda tidak ditemukan.'); return [result.data] }; const result = await getAgendaKelasCetakExportData([kelas.id], [month]); if (result.error) throw new Error(result.error); if (!result.pages.length) throw new Error('Tidak ada agenda dengan jam KBM aktif pada bulan ini.'); return result.pages }
  const openPrintDialog = () => window.setTimeout(() => { const target = printRef.current; if (!target) return; const popup = window.open('', '_blank'); if (!popup) { setError('Popup diblokir browser. Izinkan popup untuk mencetak PDF.'); return }; const size = paperSize === 'A4' ? '297mm 210mm' : '330mm 215mm'; popup.document.write(`<!DOCTYPE html><html><head><title>Agenda Kelas ${kelas.label}</title><style>@page{size:${size};margin:0}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head><body>${absolutePrintHtml(target)}</body></html>`); popup.document.close(); const images = Array.from(popup.document.images); Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve() }))).then(() => { popup.focus(); popup.print() }) }, 100)
  const execute = async () => { setLoading(true); setError(null); setStatus('Mengambil agenda kelas...'); try { const loaded = await loadPages(); setPages(loaded); if (format === 'PDF') { setStatus(`${loaded.length} halaman siap dicetak.`); openPrintDialog() } else { setStatus('Menyiapkan file Excel...'); const assets = await loadAgendaKelasExportAssets(loaded, signatureSettings); const file = await buildAgendaKelasXlsxBlob(loaded, signatureSettings, assets, { paperSize }); await downloadBlobFile(file, agendaKelasXlsxFilename(loaded)); setStatus(`Excel berhasil diunduh (${loaded.length} halaman).`) } } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyiapkan cetak.') } finally { setLoading(false) } }
  return <><Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setDate(initialDate); setMonth(initialMonth); setError(null); setStatus(null); setOpen(true) }}><Printer className="h-3.5 w-3.5" />Cetak</Button><DialogPrimitive.Root open={open} onOpenChange={setOpen}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" /><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-surface bg-background p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><DialogPrimitive.Title className="font-semibold">Cetak Agenda {kelas.label}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-xs text-slate-500">Pilih format, ukuran kertas, dan periode yang akan dicetak.</DialogPrimitive.Description></div><DialogPrimitive.Close className="p-1 text-slate-400"><X className="h-4 w-4" /></DialogPrimitive.Close></div><div className="grid gap-3 sm:grid-cols-2"><Choice label="Format cetak" value={format} onChange={value => setFormat(value as 'PDF' | 'XLSX')} options={['PDF', 'XLSX']} /><Choice label="Ukuran kertas" value={paperSize} onChange={value => setPaperSize(value as PaperSize)} options={['F4', 'A4']} /></div><div className="mt-4"><p className="mb-2 text-xs font-semibold text-slate-600">Periode cetak</p><div className="flex gap-2"><Button type="button" variant={period === 'date' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('date')}>Satu tanggal</Button><Button type="button" variant={period === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('month')}>Satu bulan</Button></div><div className="mt-3">{period === 'date' ? <label className="text-xs text-slate-600">Tanggal<Input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 h-9" /></label> : <label className="text-xs text-slate-600">Bulan<Input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 h-9" /></label>}</div></div><p className="mt-3 text-xs text-slate-500">{format === 'PDF' ? 'PDF akan dibuka di dialog cetak browser; pilih Save as PDF untuk mengunduhnya.' : `Excel menggunakan pengaturan cetak ${paperSize} landscape.`}</p>{error ? <p className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p> : null}{status ? <p className="mt-3 text-xs text-emerald-700">{status}</p> : null}<div className="mt-5 flex justify-end"><Button type="button" disabled={loading || !date || !month} onClick={execute} className="gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : format === 'XLSX' ? <FileSpreadsheet className="h-4 w-4" /> : <Printer className="h-4 w-4" />}{loading ? 'Menyiapkan...' : format === 'XLSX' ? 'Unduh XLSX' : 'Cetak / Simpan PDF'}</Button></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root><div ref={printRef} className="absolute left-[-99999px] top-0">{pages.map((page, index) => <AgendaKelasTemplate key={`${page.kelas.id}-${page.tanggal}`} data={page} signatureSettings={signatureSettings} paperSize={paperSize} pageBreak={index > 0} />)}</div></>
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="space-y-1 text-xs text-slate-600"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></label> }
