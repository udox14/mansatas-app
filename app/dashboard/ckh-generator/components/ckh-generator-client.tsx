'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, CalendarDays, Check, FileText, Loader2, Plus, Printer,
  RefreshCw, Save, Settings2, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CKH_DEFAULT_SATUAN, CKH_DEFAULT_VOL, formatCkhDate, formatCkhMonth } from '@/lib/ckh'
import {
  acceptCkhSuggestion,
  addCkhRow,
  deleteCkhRow,
  deleteCkhTemplate,
  deleteCkhTemplateNote,
  refreshCkhDraft,
  saveCkhRow,
  saveCkhTemplate,
  saveCkhTemplateNote,
} from '../actions'

type Row = {
  id: string
  tanggal: string
  row_order: number
  kegiatan_bulanan: string
  catatan_harian: string
  vol: number
  satuan: string
  source: string
  source_key: string | null
  is_manual: number
  has_conflict: number
  suggested_kegiatan_bulanan: string | null
  suggested_catatan_harian: string | null
}

type Template = {
  id: string
  role: string
  jabatan_cetak: string | null
  title: string
  sort_order: number
  is_active: number
  notes: Array<{ id: string; template_id: string; note: string; sort_order: number; is_active: number }>
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const PAPER = {
  a4: { label: 'A4', css: '210mm 297mm' },
  f4: { label: 'F4 / Folio', css: '215mm 330mm' },
  legal: { label: 'Legal', css: '216mm 356mm' },
}

const roleOptions = [
  'super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas',
  'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam',
]

function sourceLabel(source: string) {
  if (source === 'autofill') return 'Agenda'
  if (source === 'calendar') return 'Kalender'
  return 'Manual'
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function CkhPrintDocument({
  rows,
  user,
  kepsek,
  year,
  month,
  pageCss,
  margins,
}: {
  rows: Row[]
  user: any
  kepsek: any
  year: number
  month: number
  pageCss: string
  margins: { top: number; right: number; bottom: number; left: number }
}) {
  const monthLabel = formatCkhMonth(year, month)
  const lastRow = rows[rows.length - 1]
  const tanggalCetak = lastRow?.tanggal
    ? new Date(lastRow.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ fontFamily: 'Tahoma, sans-serif', color: '#000', background: '#fff', fontSize: '10.5pt' }}>
      <style>{`
        @media print {
          @page { size: ${pageCss}; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ckh-print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>CATATAN KINERJA HARIAN</div>
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>ASN MAN 1 TASIKMALAYA</div>
        <div style={{ fontSize: '10pt', fontWeight: 700, marginTop: '2px' }}>BULAN : {monthLabel}</div>
      </div>

      <table style={{ marginBottom: '8px', borderCollapse: 'collapse', fontSize: '10pt' }}>
        <tbody>
          <tr><td style={{ width: '95px' }}>NAMA</td><td style={{ width: '10px' }}>:</td><td>{user.nama_lengkap}</td></tr>
          <tr><td>NIP</td><td>:</td><td>{user.nip || '-'}</td></tr>
          <tr><td>PANGKAT / GOL.</td><td>:</td><td>-</td></tr>
          <tr><td>JABATAN</td><td>:</td><td>{user.jabatan_cetak || '-'}</td></tr>
        </tbody>
      </table>

      <table className="ckh-print-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10pt' }}>
        <thead>
          <tr>
            <th style={th('7mm')}>NO</th>
            <th style={th('22mm')}>TANGGAL</th>
            <th style={th('44mm')}>KEGIATAN BULANAN</th>
            <th style={th(undefined)}>CATATAN KINERJA HARIAN</th>
            <th style={th('12mm')}>VOL</th>
            <th style={th('20mm')}>SATUAN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td style={td('center')}>{index + 1}</td>
              <td style={td('center')}>{formatCkhDate(row.tanggal)}</td>
              <td style={td('left')}>{row.kegiatan_bulanan}</td>
              <td style={td('left')}>{row.catatan_harian}</td>
              <td style={td('center')}>{row.vol || CKH_DEFAULT_VOL}</td>
              <td style={td('center')}>{row.satuan || CKH_DEFAULT_SATUAN}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18mm', fontSize: '10pt' }}>
        <div style={{ width: '46%', textAlign: 'center' }}>
          <div>Mengetahui :</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>
            {kepsek?.jabatan_cetak || 'KEPALA MAN 1 TASIKMALAYA'}
          </div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{kepsek?.nama_lengkap || 'Kepala Madrasah belum diatur'}</div>
          <div>NIP. {kepsek?.nip || '-'}</div>
        </div>
        <div style={{ width: '46%', textAlign: 'center' }}>
          <div>Tasikmalaya, {tanggalCetak}</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>
            {user.jabatan_cetak || user.role || 'Pegawai'}
          </div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{user.nama_lengkap}</div>
          <div>NIP. {user.nip || '-'}</div>
        </div>
      </div>
    </div>
  )
}

function th(width?: string): CSSProperties {
  return {
    border: '1px solid #000',
    padding: '4px 3px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontWeight: 700,
    width,
  }
}

function td(textAlign: 'left' | 'center'): CSSProperties {
  return {
    border: '1px solid #000',
    padding: '4px 4px',
    textAlign,
    verticalAlign: 'middle',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

function PrintDialog({ rows, user, kepsek, year, month }: { rows: Row[]; user: any; kepsek: any; year: number; month: number }) {
  const [paper, setPaper] = useState<keyof typeof PAPER>('f4')
  const [margins, setMargins] = useState({ top: 15, right: 12, bottom: 15, left: 12 })
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })
  const profileMissing = !user.nip || !user.jabatan_cetak || !kepsek?.nip

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2">
          <Printer className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Pengaturan Cetak CKH</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {profileMissing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              NIP atau jabatan cetak belum lengkap. Data ini harus dilengkapi admin di Guru & Pegawai agar tanda tangan tidak kosong.
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Ukuran kertas</Label>
            <Select value={paper} onValueChange={value => setPaper(value as keyof typeof PAPER)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAPER).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['top', 'right', 'bottom', 'left'] as const).map(key => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs capitalize">Margin {key} (mm)</Label>
                <Input
                  type="number"
                  min={0}
                  max={40}
                  value={margins[key]}
                  onChange={e => setMargins(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <Button onClick={() => handlePrint()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Printer className="h-4 w-4" />
            Buka Dialog Print
          </Button>
        </div>
        <div className="hidden">
          <div ref={printRef}>
            <CkhPrintDocument
              rows={rows}
              user={user}
              kepsek={kepsek}
              year={year}
              month={month}
              pageCss={PAPER[paper].css}
              margins={margins}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CkhGeneratorClient({
  initialData,
  year,
  month,
  canManageTemplates,
}: {
  initialData: any
  year: number
  month: number
  canManageTemplates: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(initialData.rows)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [monthValue, setMonthValue] = useState(`${year}-${String(month).padStart(2, '0')}`)

  const templates: Template[] = initialData.templates
  const allTemplates: Template[] = initialData.allTemplates
  const activityTitles = useMemo(() => Array.from(new Set(templates.map(t => t.title))), [templates])
  const notesByActivity = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const template of templates) {
      map.set(template.title, template.notes.map(note => note.note))
    }
    return map
  }, [templates])

  useEffect(() => {
    setRows(initialData.rows)
  }, [initialData.rows])

  const updateRowLocal = (id: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  const saveRow = (row: Row) => {
    startTransition(async () => {
      const res = await saveCkhRow(row.id, {
        tanggal: row.tanggal,
        kegiatan_bulanan: row.kegiatan_bulanan,
        catatan_harian: row.catatan_harian,
      })
      setMessage(res?.error ? { type: 'error', text: res.error } : { type: 'success', text: 'Baris CKH disimpan.' })
      router.refresh()
    })
  }

  const refresh = () => {
    startTransition(async () => {
      const res = await refreshCkhDraft(initialData.document.id)
      setMessage(res?.error ? { type: 'error', text: res.error } : { type: 'success', text: res.success || 'Draft diperbarui.' })
      router.refresh()
    })
  }

  const goMonth = () => {
    const [nextYear, nextMonth] = monthValue.split('-').map(Number)
    router.push(`/dashboard/ckh-generator?year=${nextYear}&month=${nextMonth}`)
  }

  const addRow = (tanggal: string) => {
    startTransition(async () => {
      const res = await addCkhRow(initialData.document.id, tanggal)
      if (res?.error) setMessage({ type: 'error', text: res.error })
      router.refresh()
    })
  }

  const removeRow = (rowId: string) => {
    if (!confirm('Hapus baris CKH ini?')) return
    startTransition(async () => {
      const res = await deleteCkhRow(rowId)
      if (res?.error) setMessage({ type: 'error', text: res.error })
      router.refresh()
    })
  }

  const acceptSuggestion = (rowId: string) => {
    startTransition(async () => {
      const res = await acceptCkhSuggestion(rowId)
      if (res?.error) setMessage({ type: 'error', text: res.error })
      router.refresh()
    })
  }

  return (
    <Tabs defaultValue="dokumen" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList className={cn('grid w-full max-w-md', canManageTemplates ? 'grid-cols-2' : 'grid-cols-1')}>
          <TabsTrigger value="dokumen" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Dokumen</TabsTrigger>
          {canManageTemplates && <TabsTrigger value="template" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Template</TabsTrigger>}
        </TabsList>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-surface bg-surface p-1">
            <CalendarDays className="ml-2 h-4 w-4 text-slate-400" />
            <Input type="month" value={monthValue} onChange={e => setMonthValue(e.target.value)} className="h-8 w-36 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0" />
            <Button size="sm" variant="outline" onClick={goMonth} className="h-8">Buka</Button>
          </div>
          <Button variant="outline" onClick={refresh} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <PrintDialog rows={rows} user={initialData.user} kepsek={initialData.kepsek} year={year} month={month} />
        </div>
      </div>

      {message && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
        )}>
          {message.text}
        </div>
      )}

      <TabsContent value="dokumen" className="mt-0">
        <div className="overflow-x-auto rounded-xl border border-surface bg-slate-100 p-2 sm:p-4">
          <div className="mx-auto min-w-[980px] max-w-[1120px] bg-white p-8 shadow-sm" style={{ fontFamily: 'Tahoma, sans-serif' }}>
            <div className="text-center text-black">
              <h2 className="text-base font-bold">CATATAN KINERJA HARIAN</h2>
              <h3 className="text-base font-bold">ASN MAN 1 TASIKMALAYA</h3>
              <p className="mt-1 text-sm font-bold">BULAN : {formatCkhMonth(year, month)}</p>
            </div>

            <div className="mt-5 grid grid-cols-[120px_12px_1fr] text-sm text-black">
              <span>NAMA</span><span>:</span><span>{initialData.user.nama_lengkap}</span>
              <span>NIP</span><span>:</span><span>{initialData.user.nip || <span className="text-amber-700">Belum diisi admin</span>}</span>
              <span>PANGKAT / GOL.</span><span>:</span><span>-</span>
              <span>JABATAN</span><span>:</span><span>{initialData.user.jabatan_cetak || <span className="text-amber-700">Belum diisi admin</span>}</span>
            </div>

            <div className="mt-4 overflow-hidden border border-black">
              <table className="w-full table-fixed border-collapse text-[12px] text-black">
                <thead>
                  <tr className="bg-white">
                    <th className="w-10 border border-black p-1">NO</th>
                    <th className="w-28 border border-black p-1">TANGGAL</th>
                    <th className="w-64 border border-black p-1">KEGIATAN BULANAN</th>
                    <th className="border border-black p-1">CATATAN KINERJA HARIAN</th>
                    <th className="w-14 border border-black p-1">VOL</th>
                    <th className="w-24 border border-black p-1">SATUAN</th>
                    <th className="w-28 border border-black p-1 print:hidden">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className={cn(row.has_conflict && 'bg-amber-50')}>
                      <td className="border border-black p-1 text-center align-top">{index + 1}</td>
                      <td className="border border-black p-1 align-top">
                        <Input
                          type="date"
                          value={row.tanggal}
                          onChange={e => updateRowLocal(row.id, { tanggal: e.target.value })}
                          onBlur={() => saveRow(row)}
                          className="h-8 border-0 p-0 text-center text-[12px] shadow-none focus-visible:ring-0"
                        />
                      </td>
                      <td className="border border-black p-1 align-top">
                        <input
                          list="ckh-activities"
                          value={row.kegiatan_bulanan}
                          onChange={e => updateRowLocal(row.id, { kegiatan_bulanan: e.target.value })}
                          onBlur={() => saveRow(row)}
                          className="min-h-8 w-full resize-none bg-transparent text-[12px] outline-none"
                        />
                      </td>
                      <td className="border border-black p-1 align-top">
                        <textarea
                          value={row.catatan_harian}
                          onChange={e => updateRowLocal(row.id, { catatan_harian: e.target.value })}
                          onBlur={() => saveRow(row)}
                          rows={2}
                          className="w-full resize-none bg-transparent text-[12px] outline-none"
                        />
                        {(notesByActivity.get(row.kegiatan_bulanan) || []).length > 0 && (
                          <select
                            value=""
                            onChange={e => {
                              if (!e.target.value) return
                              updateRowLocal(row.id, { catatan_harian: e.target.value })
                              startTransition(async () => {
                                await saveCkhRow(row.id, {
                                  tanggal: row.tanggal,
                                  kegiatan_bulanan: row.kegiatan_bulanan,
                                  catatan_harian: e.target.value,
                                })
                                router.refresh()
                              })
                            }}
                            className="mt-1 h-7 w-full rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-600 print:hidden"
                          >
                            <option value="">Pilih catatan template...</option>
                            {(notesByActivity.get(row.kegiatan_bulanan) || []).map(note => (
                              <option key={note} value={note}>{note}</option>
                            ))}
                          </select>
                        )}
                        {row.has_conflict ? (
                          <div className="mt-2 rounded border border-amber-300 bg-amber-100 p-2 text-[11px] text-amber-800">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>Agenda/kalender punya versi baru: {row.suggested_catatan_harian}</span>
                            </div>
                            <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={() => acceptSuggestion(row.id)}>
                              <Check className="mr-1 h-3 w-3" /> Pakai versi baru
                            </Button>
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-black p-1 text-center align-top">{row.vol || CKH_DEFAULT_VOL}</td>
                      <td className="border border-black p-1 text-center align-top">{row.satuan || CKH_DEFAULT_SATUAN}</td>
                      <td className="border border-black p-1 align-top print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{sourceLabel(row.source)}</span>
                          <button onClick={() => addRow(row.tanggal)} className="rounded p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600" title="Tambah baris">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => removeRow(row.id)} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Hapus baris">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="ckh-activities">
                {activityTitles.map(title => <option key={title} value={title} />)}
              </datalist>
              <datalist id="ckh-notes">
                {Array.from(new Set(rows.flatMap(row => notesByActivity.get(row.kegiatan_bulanan) || []))).map(note => (
                  <option key={note} value={note} />
                ))}
              </datalist>
            </div>

            <div className="mt-12 flex justify-between text-center text-sm text-black">
              <div className="w-[45%]">
                <p>Mengetahui :</p>
                <p className="mb-20 font-bold uppercase">{initialData.kepsek?.jabatan_cetak || 'KEPALA MAN 1 TASIKMALAYA'}</p>
                <p className="font-bold underline">{initialData.kepsek?.nama_lengkap || 'Kepala Madrasah belum diatur'}</p>
                <p>NIP. {initialData.kepsek?.nip || '-'}</p>
              </div>
              <div className="w-[45%]">
                <p>Tasikmalaya, {new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="mb-20 font-bold uppercase">{initialData.user.jabatan_cetak || initialData.user.role}</p>
                <p className="font-bold underline">{initialData.user.nama_lengkap}</p>
                <p>NIP. {initialData.user.nip || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      {canManageTemplates && (
        <TabsContent value="template" className="mt-0">
          <TemplateAdmin templates={allTemplates} />
        </TabsContent>
      )}
    </Tabs>
  )
}

function TemplateAdmin({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [templateForm, setTemplateForm] = useState<Template | null>(null)
  const [noteForm, setNoteForm] = useState<{ id?: string; template_id: string; note: string; sort_order: number } | null>(null)
  const [roleFilter, setRoleFilter] = useState('_all')
  const filteredTemplates = roleFilter === '_all'
    ? templates
    : templates.filter(template => template.role === roleFilter)

  const submitTemplate = (formData: FormData) => {
    startTransition(async () => {
      await saveCkhTemplate(formData)
      setTemplateForm(null)
      router.refresh()
    })
  }

  const submitNote = (formData: FormData) => {
    startTransition(async () => {
      await saveCkhTemplateNote(formData)
      setNoteForm(null)
      router.refresh()
    })
  }

  const removeTemplate = (id: string) => {
    if (!confirm('Hapus template kegiatan beserta catatannya?')) return
    startTransition(async () => {
      await deleteCkhTemplate(id)
      router.refresh()
    })
  }

  const removeNote = (id: string) => {
    if (!confirm('Hapus catatan template ini?')) return
    startTransition(async () => {
      await deleteCkhTemplateNote(id)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-xl border border-surface bg-surface">
        <div className="flex items-center justify-between border-b border-surface-2 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Template CKH</p>
            <p className="text-xs text-slate-500">Kegiatan bulanan per role dan opsional jabatan cetak.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all" className="text-xs">Semua Role</SelectItem>
                {roleOptions.map(role => (
                  <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setTemplateForm({ id: '', role: roleFilter === '_all' ? 'guru' : roleFilter, jabatan_cetak: null, title: '', sort_order: 0, is_active: 1, notes: [] })} className="gap-1.5">
              <Plus className="h-4 w-4" /> Template
            </Button>
          </div>
        </div>
        <div className="divide-y divide-surface-2">
          {filteredTemplates.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada template.</p>
          ) : filteredTemplates.map(template => (
            <div key={template.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{template.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{template.role}{template.jabatan_cetak ? ` | ${template.jabatan_cetak}` : ' | Semua jabatan'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setNoteForm({ template_id: template.id, note: '', sort_order: 0 })} className="h-8 px-2 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTemplateForm(template)} className="h-8 px-2 text-xs">
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeTemplate(template.id)} className="h-8 px-2 text-xs text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {template.notes.length === 0 ? (
                  <span className="text-xs text-slate-400">Belum ada catatan turunan.</span>
                ) : template.notes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => setNoteForm({ id: note.id, template_id: template.id, note: note.note, sort_order: note.sort_order })}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    {note.note}
                    <X onClick={(e) => { e.stopPropagation(); removeNote(note.id) }} className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-surface bg-surface p-4">
        {!templateForm && !noteForm ? (
          <div className="flex min-h-56 flex-col items-center justify-center text-center text-sm text-slate-500">
            <Settings2 className="mb-2 h-8 w-8 text-slate-300" />
            Pilih template/catatan untuk diedit, atau tambah yang baru.
          </div>
        ) : templateForm ? (
          <form action={submitTemplate} className="space-y-3">
            <input type="hidden" name="id" value={templateForm.id} />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Form Template</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateForm(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select name="role" defaultValue={templateForm.role}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roleOptions.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jabatan cetak khusus</Label>
              <Input name="jabatan_cetak" defaultValue={templateForm.jabatan_cetak || ''} placeholder="Kosongkan untuk semua jabatan" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kegiatan bulanan</Label>
              <Input name="title" defaultValue={templateForm.title} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Urutan</Label>
              <Input name="sort_order" type="number" defaultValue={templateForm.sort_order} />
            </div>
            <Button disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Template'}
            </Button>
          </form>
        ) : noteForm ? (
          <form action={submitNote} className="space-y-3">
            <input type="hidden" name="id" value={noteForm.id || ''} />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Form Catatan Harian</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNoteForm(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kegiatan bulanan</Label>
              <Select name="template_id" defaultValue={noteForm.template_id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{templates.map(template => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan harian</Label>
              <Input name="note" defaultValue={noteForm.note} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Urutan</Label>
              <Input name="sort_order" type="number" defaultValue={noteForm.sort_order} />
            </div>
            <Button disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Catatan'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
