'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeWIB } from '@/lib/time'
import { DSPT_TEMPLATES, type DsptAudience, type DsptTemplate } from '@/lib/dspt-reminder-config'
import {
  archiveDsptReminderTemplate, listDsptReminderHistory, loadDsptReminderOptions, previewDsptReminder,
  saveDsptReminderTemplate, searchDsptReminderStudents, sendDsptReminder,
} from './reminder-actions'

type Options = Awaited<ReturnType<typeof loadDsptReminderOptions>>
type Student = Awaited<ReturnType<typeof searchDsptReminderStudents>>[number]
type Confirmation = { id: string; count: number; title: string; body: string; label: string }
type TemplateDraft = Omit<DsptTemplate, 'id'> & { id: string | null }
const emptyTemplate: TemplateDraft = { id: null, name: '', title: '', body: '' }

export function DsptReminderDialog() {
  const [tab, setTab] = useState('send')
  const [options, setOptions] = useState<Options | null>(null)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listDsptReminderHistory>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState<DsptAudience['payment']>('unpaid')
  const [scope, setScope] = useState<DsptAudience['scope']['kind']>('all')
  const [grade, setGrade] = useState('10')
  const [classId, setClassId] = useState('')
  const [templateId, setTemplateId] = useState('pengingat')
  const [draft, setDraft] = useState(emptyTemplate)
  const [archiveId, setArchiveId] = useState('')
  const [term, setTerm] = useState('')
  const [students, setStudents] = useState<Student[] | null>(null)
  const [selected, setSelected] = useState<Student[]>([])
  const [preview, setPreview] = useState<Confirmation | null>(null)

  const audience: DsptAudience = {
    payment,
    scope: scope === 'grade' ? { kind: scope, grade: Number(grade) }
      : scope === 'class' ? { kind: scope, classId }
      : scope === 'students' ? { kind: scope, studentIds: selected.map(student => student.id) }
      : { kind: 'all' },
  }

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await action()
    } catch {
      setError('Permintaan belum selesai. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  function changeTab(value: string) {
    setTab(value)
    setError('')
    setStatus('')
    if (value === 'history' && !history) void run(async () => setHistory(await listDsptReminderHistory()))
  }

  function changePayment(value: DsptAudience['payment']) {
    setPayment(value)
    if (DSPT_TEMPLATES.some(template => template.id === templateId)) setTemplateId(value === 'all' ? 'informasi' : 'pengingat')
    setPreview(null)
  }

  function toggleStudent(student: Student) {
    setSelected(current => current.some(row => row.id === student.id)
      ? current.filter(row => row.id !== student.id) : [...current, student])
    setPreview(null)
  }

  return (
    <Dialog onOpenChange={open => {
      if (open) void run(async () => setOptions(await loadDsptReminderOptions()))
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Bell className="h-4 w-4" />Kirim Notifikasi DSPT</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notifikasi DSPT untuk Orang Tua</DialogTitle>
          <DialogDescription>Pengingat masuk ke Portal Orang Tua dan perangkat yang sudah mengaktifkan notifikasi.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="w-full">
            <TabsTrigger value="send" disabled={busy}>Kirim</TabsTrigger>
            <TabsTrigger value="templates" disabled={busy}>Templat</TabsTrigger>
            <TabsTrigger value="history" disabled={busy}>Riwayat</TabsTrigger>
          </TabsList>
          <fieldset disabled={busy} className="min-w-0">
            <TabsContent value="send" className="space-y-4">
              {!options ? <p className="text-sm text-muted-foreground">{busy ? 'Memuat pilihan…' : 'Tutup dan buka kembali untuk memuat pilihan.'}</p> : <>
                {!options.enabled && <p className="rounded-md border p-3 text-sm text-muted-foreground">Pratinjau tersedia. Pengiriman DSPT belum diaktifkan.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dspt-notice-payment">Status DSPT</Label>
                    <Select value={payment} onValueChange={changePayment} disabled={busy}>
                      <SelectTrigger id="dspt-notice-payment"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="unpaid">Belum lunas</SelectItem><SelectItem value="all">Semua</SelectItem></SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{payment === 'unpaid' ? 'Termasuk cicilan. Bukti yang sedang diperiksa dilewati.' : 'Termasuk siswa aktif yang lunas atau belum punya tagihan.'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dspt-notice-scope">Sasaran</Label>
                    <Select value={scope} onValueChange={(value: typeof scope) => { setScope(value); setPreview(null) }} disabled={busy}>
                      <SelectTrigger id="dspt-notice-scope"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua tingkat</SelectItem><SelectItem value="grade">Tingkat tertentu</SelectItem>
                        <SelectItem value="class">Kelas tertentu</SelectItem><SelectItem value="students">Pilih siswa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {scope === 'grade' && <div className="space-y-2">
                  <Label htmlFor="dspt-notice-grade">Tingkat</Label>
                  <Select value={grade} onValueChange={value => { setGrade(value); setPreview(null) }} disabled={busy}>
                    <SelectTrigger id="dspt-notice-grade"><SelectValue /></SelectTrigger>
                    <SelectContent>{['10', '11', '12'].map(value => <SelectItem key={value} value={value}>Kelas {value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>}
                {scope === 'class' && <div className="space-y-2">
                  <Label htmlFor="dspt-notice-class">Kelas</Label>
                  <Select value={classId} onValueChange={value => { setClassId(value); setPreview(null) }} disabled={busy}>
                    <SelectTrigger id="dspt-notice-class"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                    <SelectContent>{options.classes.map(row => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>}
                {scope === 'students' && <div className="space-y-2">
                  <Label htmlFor="dspt-notice-student">Cari siswa aktif</Label>
                  <form className="flex gap-2" onSubmit={event => {
                    event.preventDefault()
                    void run(async () => setStudents(await searchDsptReminderStudents(term)))
                  }}>
                    <Input id="dspt-notice-student" placeholder="Nama atau NISN" maxLength={100} value={term} onChange={event => setTerm(event.target.value)} />
                    <Button type="submit" variant="outline" disabled={term.trim().length < 2}>Cari</Button>
                  </form>
                  {students?.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada siswa aktif yang cocok.</p>}
                  {!!students?.length && <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                    {students.map(student => <li key={student.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selected.some(row => row.id === student.id)} onChange={() => toggleStudent(student)} />
                        {student.name} <span className="text-muted-foreground">({student.className})</span>
                      </label>
                    </li>)}
                  </ul>}
                  {!!selected.length && <div className="flex flex-wrap gap-1" aria-label="Siswa dipilih">
                    {selected.map(student => <Button key={student.id} size="sm" variant="secondary"
                      aria-label={`Hapus ${student.name} dari sasaran`} onClick={() => toggleStudent(student)}>{student.name} ×</Button>)}
                  </div>}
                </div>}
                <div className="space-y-2">
                  <Label htmlFor="dspt-notice-template">Templat pesan</Label>
                  <Select value={templateId} onValueChange={value => { setTemplateId(value); setPreview(null) }} disabled={busy}>
                    <SelectTrigger id="dspt-notice-template"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...DSPT_TEMPLATES.filter(template => payment === 'unpaid' || template.id === 'informasi'), ...options.templates]
                        .map(template => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" disabled={(scope === 'class' && !classId) || (scope === 'students' && !selected.length)}
                  onClick={() => void run(async () => {
                    setPreview(null)
                    const result = await previewDsptReminder(audience, templateId)
                    if (result.error) setError(result.error)
                    else setPreview({ id: crypto.randomUUID(), count: result.count!, title: result.title!, body: result.body!, label: result.label! })
                  })}>Pratinjau penerima dan pesan</Button>
                {preview && <section aria-label="Pratinjau notifikasi" className="space-y-2 rounded-md border p-4">
                  <p className="text-sm font-semibold">{preview.label} · {preview.count} siswa</p>
                  <p className="text-sm font-medium">{preview.title}</p>
                  <p className="whitespace-pre-wrap break-words text-sm">{preview.body}</p>
                  <p className="text-xs text-muted-foreground">Pesan dapat terlihat di layar terkunci. Hindari nama siswa, nominal, atau rincian pribadi. Untuk sasaran Semua, gunakan pesan netral.</p>
                  {!preview.count && <p className="text-sm text-muted-foreground">Tidak ada penerima. Ubah status DSPT atau sasaran.</p>}
                  <Button disabled={!options.enabled || !preview.count} onClick={() => void run(async () => {
                    const result = await sendDsptReminder(audience, templateId, preview)
                    if (result.error) {
                      setError(result.error)
                      if (result.refresh) setPreview(null)
                      return
                    }
                    setPreview(null)
                    setStatus('Notifikasi masuk antrean.')
                    setHistory(null)
                  })}>Konfirmasi kirim ke {preview.count} siswa</Button>
                </section>}
              </>}
            </TabsContent>
            <TabsContent value="templates" className="space-y-4">
              <p className="text-sm text-muted-foreground">Templat tersimpan dan dapat dipakai bersama oleh tim Bendahara Komite.</p>
              {options && <>
                {options.templates.map(template => <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2" key={template.id}>
                  <span className="text-sm font-medium">{template.name}</span>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setDraft(template); setArchiveId('') }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (archiveId !== template.id) { setArchiveId(template.id); return }
                      void run(async () => {
                        const result = await archiveDsptReminderTemplate(template.id)
                        if (result.error) { setError(result.error); return }
                        setOptions({ ...options, templates: options.templates.filter(row => row.id !== template.id) })
                        if (draft.id === template.id) setDraft(emptyTemplate)
                        if (templateId === template.id) setTemplateId(payment === 'all' ? 'informasi' : 'pengingat')
                        setArchiveId('')
                        setPreview(null)
                        setStatus('Templat diarsipkan.')
                      })
                    }}>{archiveId === template.id ? 'Konfirmasi arsip' : 'Arsipkan'}</Button>
                  </div>
                </div>)}
                <form className="space-y-3" onSubmit={event => {
                  event.preventDefault()
                  void run(async () => {
                    const result = await saveDsptReminderTemplate(draft.id, draft)
                    if (result.error || !result.template) { setError(result.error || 'Templat gagal disimpan.'); return }
                    setOptions({ ...options, templates: [...options.templates.filter(row => row.id !== draft.id), result.template] })
                    setDraft(emptyTemplate)
                    setPreview(null)
                    setStatus('Templat tersimpan.')
                  })
                }}>
                  <h3 className="text-sm font-semibold">{draft.id ? 'Edit templat' : 'Buat templat'}</h3>
                  <Label htmlFor="dspt-template-name">Nama templat</Label>
                  <Input id="dspt-template-name" required maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                  <Label htmlFor="dspt-template-title">Judul notifikasi</Label>
                  <Input id="dspt-template-title" required maxLength={100} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
                  <Label htmlFor="dspt-template-body">Isi notifikasi</Label>
                  <Textarea id="dspt-template-body" required maxLength={400} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} />
                  <div className="flex gap-2">
                    <Button type="submit">Simpan templat</Button>
                    {draft.id && <Button type="button" variant="outline" onClick={() => setDraft(emptyTemplate)}>Batal edit</Button>}
                  </div>
                </form>
              </>}
            </TabsContent>
            <TabsContent value="history" className="space-y-3">
              <Button variant="outline" onClick={() => void run(async () => setHistory(await listDsptReminderHistory()))}>Muat ulang riwayat</Button>
              {history?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengiriman DSPT.</p>}
              {history?.map(row => <article className="space-y-1 border-b pb-3 text-sm" key={row.id}>
                <p className="font-semibold">{row.title}</p>
                <p className="text-muted-foreground">{row.sender} · {formatDateTimeWIB(row.created_at)} WIB</p>
                <p className="whitespace-pre-wrap break-words">{row.body}</p>
                <p>{row.audience_label} · {row.recipient_count} siswa</p>
                <p className="font-medium">{row.failed_at ? 'Antrean gagal' : row.finished_at ? 'Selesai diproses' : 'Dalam antrean'}</p>
                <p>In-app {row.in_app}/{row.recipient_count} · {row.skipped} siswa dilewati karena status berubah</p>
                <p>FCM {row.fcm_accepted} diterima penyedia · {row.no_fcm} siswa tanpa perangkat · {row.fcm_skipped} tujuan dilewati · {row.fcm_failed} gagal</p>
                <p>VAPID {row.webpush_accepted} diterima penyedia · {row.no_webpush} siswa tanpa perangkat · {row.webpush_skipped} tujuan dilewati · {row.webpush_failed} gagal</p>
              </article>)}
            </TabsContent>
          </fieldset>
        </Tabs>
        {busy && <p className="text-sm text-muted-foreground" role="status">Memproses…</p>}
        {status && <p className="text-sm" role="status">{status}</p>}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
