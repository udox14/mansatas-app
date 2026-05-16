'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, Loader2, Plus, Printer,
  RotateCw, Save, Settings2, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CKH_DEFAULT_SATUAN, CKH_DEFAULT_VOL, countCkhItems, formatCkhDate, formatCkhMonth } from '@/lib/ckh'
import {
  acceptCkhSuggestion,
  deleteCkhRow,
  deleteCkhTemplate,
  deleteCkhTemplateNote,
  finalizeCkhDocument,
  refreshCkhDraft,
  saveCkhRow,
  saveCkhSignatureSettings,
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
}

type SignatureSettings = {
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
}

const printProfileLabel: CSSProperties = { width: '112px', whiteSpace: 'nowrap' }

const roleOptions = [
  'super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas',
  'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam',
]

function sourceLabel(source: string) {
  if (source === 'autofill') return 'Agenda'
  if (source === 'calendar') return 'Kalender'
  return 'Manual'
}

function upper(value: string | null | undefined) {
  return String(value || '').toUpperCase()
}

function appendCkhLine(value: string) {
  return value.trim() ? `${value.replace(/\s+$/, '')}\n` : ''
}

function shouldUseKepalaTu(user: any, userRoles: string[] = []) {
  const roles = new Set([...(userRoles || []), user?.role].filter(Boolean))
  const jabatan = String(user?.jabatan_cetak || '').toLowerCase()
  return roles.has('admin_tu') ||
    roles.has('operator') ||
    roles.has('pramubakti') ||
    jabatan.includes('staff tu') ||
    jabatan.includes('admin tu') ||
    jabatan.includes('tata usaha') ||
    jabatan.includes('operator emis') ||
    jabatan.includes('pramubakti')
}

function normalizeSignatureSettings(document: any): SignatureSettings {
  return {
    signature_enabled: Number(document?.signature_enabled || 0),
    signature_x_mm: Number(document?.signature_x_mm ?? 14),
    signature_y_mm: Number(document?.signature_y_mm ?? 12),
    signature_width_mm: Number(document?.signature_width_mm ?? 38),
  }
}

function signatureImageStyle(settings: SignatureSettings): CSSProperties {
  return {
    position: 'absolute',
    left: `${settings.signature_x_mm}mm`,
    top: `${settings.signature_y_mm}mm`,
    width: `${settings.signature_width_mm}mm`,
    height: 'auto',
    maxHeight: '28mm',
    objectFit: 'contain',
    zIndex: 10,
    pointerEvents: 'none',
  }
}

function MissingProfilePrint() {
  return <span style={{ fontStyle: 'italic' }}>Silakan isi dulu di Profil</span>
}

function MissingProfileInline() {
  return <span className="italic text-amber-700">Silakan isi dulu di Profil</span>
}

function CkhPrintDocument({
  rows,
  user,
  kepsek,
  kepalaTu,
  userRoles,
  signatureSettings,
  year,
  month,
  pageCss,
  margins,
}: {
  rows: Row[]
  user: any
  kepsek: any
  kepalaTu: any
  userRoles: string[]
  signatureSettings: SignatureSettings
  year: number
  month: number
  pageCss: string
  margins: { top: number; right: number; bottom: number; left: number }
}) {
  const signer = shouldUseKepalaTu(user, userRoles) ? kepalaTu : kepsek
  const signerLabel = shouldUseKepalaTu(user, userRoles) ? 'KEPALA TU' : 'KEPALA MAN 1 TASIKMALAYA'
  const missingSignerLabel = shouldUseKepalaTu(user, userRoles) ? 'KEPALA TU BELUM DIATUR' : 'KEPALA MADRASAH BELUM DIATUR'
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
          <tr><td style={printProfileLabel}>NAMA</td><td style={{ width: '10px' }}>:</td><td>{user.nama_lengkap}</td></tr>
          <tr><td style={printProfileLabel}>NIP</td><td>:</td><td>{user.nip || <MissingProfilePrint />}</td></tr>
          <tr><td style={printProfileLabel}>PANGKAT / GOL.</td><td>:</td><td>{user.pangkat_golongan || <MissingProfilePrint />}</td></tr>
          <tr><td style={printProfileLabel}>JABATAN</td><td>:</td><td>{user.jabatan_cetak || <MissingProfilePrint />}</td></tr>
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
        <div style={{ width: '46%', textAlign: 'left', paddingLeft: '14mm' }}>
          <div>Mengetahui :</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>
            {signerLabel}
          </div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{upper(signer?.nama_lengkap) || missingSignerLabel}</div>
          <div>NIP. {signer?.nip || <MissingProfilePrint />}</div>
        </div>
        <div style={{ width: '46%', textAlign: 'left', paddingLeft: '14mm', position: 'relative' }}>
          {signatureSettings.signature_enabled && user.signature_url ? (
            <img src={user.signature_url} alt="" style={signatureImageStyle(signatureSettings)} />
          ) : null}
          <div>Tasikmalaya, {tanggalCetak}</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>
            {user.jabatan_cetak || user.role || 'Pegawai'}
          </div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{upper(user.nama_lengkap)}</div>
          <div>NIP. {user.nip || <MissingProfilePrint />}</div>
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

function sortCkhRows(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const byDate = a.tanggal.localeCompare(b.tanggal)
    if (byDate !== 0) return byDate
    const byOrder = Number(a.row_order || 0) - Number(b.row_order || 0)
    if (byOrder !== 0) return byOrder
    return a.id.localeCompare(b.id)
  })
}

function getApplicableTemplates(allTemplates: Template[], userRoles: string[], jabatanCetak: string | null | undefined) {
  const roles = userRoles.length > 0 ? userRoles : ['guru']
  const jabatan = String(jabatanCetak || '').toLowerCase()
  const candidates = allTemplates
    .filter(template => Number(template.is_active) === 1)
    .filter(template => roles.includes(template.role))
    .filter(template => !template.jabatan_cetak || template.jabatan_cetak.toLowerCase() === jabatan)
    .sort((a, b) => {
      const bySpecific = Number(Boolean(b.jabatan_cetak)) - Number(Boolean(a.jabatan_cetak))
      if (bySpecific !== 0) return bySpecific
      const byRole = a.role.localeCompare(b.role)
      if (byRole !== 0) return byRole
      const byOrder = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (byOrder !== 0) return byOrder
      return a.title.localeCompare(b.title, 'id-ID')
    })

  const byTitle = new Map<string, Template>()
  for (const template of candidates) {
    const key = template.title.toLowerCase()
    if (!byTitle.has(key) || template.jabatan_cetak) byTitle.set(key, template)
  }
  return Array.from(byTitle.values())
}

function getMonthUrl(year: number, month: number) {
  return `/dashboard/ckh-generator?year=${year}&month=${month}`
}

function PrintDialog({
  rows,
  user,
  kepsek,
  kepalaTu,
  userRoles,
  signatureSettings,
  year,
  month,
}: {
  rows: Row[]
  user: any
  kepsek: any
  kepalaTu: any
  userRoles: string[]
  signatureSettings: SignatureSettings
  year: number
  month: number
}) {
  const [paper, setPaper] = useState<keyof typeof PAPER>('f4')
  const [margins, setMargins] = useState({ top: 15, right: 12, bottom: 15, left: 12 })
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })
  const signer = shouldUseKepalaTu(user, userRoles) ? kepalaTu : kepsek
  const profileMissing = !user.nip || !user.jabatan_cetak || !signer?.nip

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
              kepalaTu={kepalaTu}
              userRoles={userRoles}
              signatureSettings={signatureSettings}
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

function SignatureSettingsDialog({
  documentId,
  signatureUrl,
  settings,
  onApply,
}: {
  documentId: string
  signatureUrl: string | null
  settings: SignatureSettings
  onApply: (settings: SignatureSettings) => void
}) {
  const [draft, setDraft] = useState<SignatureSettings>(settings)
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const saveSettings = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await saveCkhSignatureSettings(documentId, {
        enabled: Boolean(draft.signature_enabled),
        xMm: draft.signature_x_mm,
        yMm: draft.signature_y_mm,
        widthMm: draft.signature_width_mm,
      })
      if (res?.error) {
        setMessage(res.error)
        return
      }
      if (res?.settings) onApply(res.settings as SignatureSettings)
      setMessage('Pengaturan tanda tangan diterapkan.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateNumber = (key: keyof Pick<SignatureSettings, 'signature_x_mm' | 'signature_y_mm' | 'signature_width_mm'>, value: string) => {
    setDraft(prev => ({ ...prev, [key]: Number(value) }))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Tanda Tangan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Pengaturan Tanda Tangan CKH</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!signatureUrl ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Tanda tangan belum diunggah. Unggah dulu lewat Profil Saya, lalu kembali ke CKH.
            </div>
          ) : null}

          <label className="flex items-center gap-2 rounded-lg border border-surface-2 bg-surface-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draft.signature_enabled)}
              onChange={e => setDraft(prev => ({ ...prev, signature_enabled: e.target.checked ? 1 : 0 }))}
              disabled={!signatureUrl}
              className="h-4 w-4"
            />
            Pakai tanda tangan pada dokumen CKH ini
          </label>

          <div className="relative h-40 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="absolute right-6 top-5 w-56 text-sm text-black">
              <div>Tasikmalaya, 31 Januari 2026</div>
              <div className="mb-20 font-bold uppercase">JABATAN CETAK</div>
              {signatureUrl && draft.signature_enabled ? (
                <img src={signatureUrl} alt="Preview tanda tangan" style={signatureImageStyle(draft)} />
              ) : null}
              <div className="font-bold underline">NAMA PEGAWAI</div>
              <div>NIP. 000000000000000000</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Geser kanan (mm)</Label>
              <Input type="number" value={draft.signature_x_mm} min={-20} max={80} onChange={e => updateNumber('signature_x_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={-20} max={80} value={draft.signature_x_mm} onChange={e => updateNumber('signature_x_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geser turun (mm)</Label>
              <Input type="number" value={draft.signature_y_mm} min={-20} max={80} onChange={e => updateNumber('signature_y_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={-20} max={80} value={draft.signature_y_mm} onChange={e => updateNumber('signature_y_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lebar (mm)</Label>
              <Input type="number" value={draft.signature_width_mm} min={15} max={90} onChange={e => updateNumber('signature_width_mm', e.target.value)} disabled={!signatureUrl} />
              <input type="range" min={15} max={90} value={draft.signature_width_mm} onChange={e => updateNumber('signature_width_mm', e.target.value)} disabled={!signatureUrl} className="w-full" />
            </div>
          </div>

          {message ? <p className="text-xs text-slate-500">{message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft({ signature_enabled: signatureUrl ? 1 : 0, signature_x_mm: 14, signature_y_mm: 12, signature_width_mm: 38 })}
              disabled={!signatureUrl || isSaving}
            >
              Reset
            </Button>
            <Button onClick={saveSettings} disabled={!signatureUrl || isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
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
  const [isSyncing, setIsSyncing] = useState(false)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(String(month))
  const [selectedYear, setSelectedYear] = useState(String(year))
  const [allTemplates, setAllTemplates] = useState<Template[]>(initialData.allTemplates)
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(normalizeSignatureSettings(initialData.document))
  const [documentStatus, setDocumentStatus] = useState<string>(initialData.document?.status || 'DRAFT')

  const templates = useMemo(
    () => getApplicableTemplates(allTemplates, initialData.userRoles || [], initialData.user?.jabatan_cetak),
    [allTemplates, initialData.userRoles, initialData.user?.jabatan_cetak],
  )
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const start = Math.min(year, currentYear) - 2
    const end = Math.max(year, currentYear) + 1
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }, [year])
  const activityTitles = useMemo(() => Array.from(new Set(templates.map(t => t.title))), [templates])
  const notesByActivity = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const template of templates) {
      map.set(template.title, template.notes.map(note => note.note))
    }
    return map
  }, [templates])
  const signatureUsesKepalaTu = shouldUseKepalaTu(initialData.user, initialData.userRoles)
  const primarySigner = signatureUsesKepalaTu ? initialData.kepalaTu : initialData.kepsek
  const primarySignerLabel = signatureUsesKepalaTu ? 'KEPALA TU' : 'KEPALA MAN 1 TASIKMALAYA'
  const missingSignerLabel = signatureUsesKepalaTu ? 'KEPALA TU BELUM DIATUR' : 'KEPALA MADRASAH BELUM DIATUR'

  useEffect(() => {
    setRows(initialData.rows)
  }, [initialData.rows])

  useEffect(() => {
    setAllTemplates(initialData.allTemplates)
  }, [initialData.allTemplates])

  useEffect(() => {
    setSelectedMonth(String(month))
    setSelectedYear(String(year))
    setSignatureSettings(normalizeSignatureSettings(initialData.document))
    setDocumentStatus(initialData.document?.status || 'DRAFT')
  }, [initialData.document, month, year])

  const updateRowLocal = (id: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row))
  }

  const saveRow = (row: Row) => {
    startTransition(async () => {
      const res = await saveCkhRow(row.id, {
        tanggal: row.tanggal,
        kegiatan_bulanan: row.kegiatan_bulanan,
        catatan_harian: row.catatan_harian,
        vol: row.vol,
      })
      if (res?.row) updateRowLocal(row.id, res.row as Partial<Row>)
      if (!res?.error) setDocumentStatus('DRAFT')
      setMessage(res?.error ? { type: 'error', text: res.error } : { type: 'success', text: 'Baris CKH disimpan.' })
    })
  }

  const finalizeDocument = () => {
    startTransition(async () => {
      const res = await finalizeCkhDocument(initialData.document.id)
      if (res?.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setDocumentStatus('FINAL')
      setMessage({ type: 'success', text: 'CKH berhasil dikirim.' })
    })
  }

  const syncDraft = async () => {
    setIsSyncing(true)
    try {
      const res = await refreshCkhDraft(initialData.document.id)
      if (res?.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      if (res?.rows) setRows(sortCkhRows(res.rows as Row[]))
      setDocumentStatus('DRAFT')
      setMessage({ type: 'success', text: res.success || 'Draft disinkronkan.' })
    } finally {
      setIsSyncing(false)
    }
  }

  const goMonth = () => {
    const nextYear = Number(selectedYear)
    const nextMonth = Number(selectedMonth)
    router.push(getMonthUrl(nextYear, nextMonth))
  }

  const shiftMonth = (offset: number) => {
    const next = new Date(year, month - 1 + offset, 1)
    router.push(getMonthUrl(next.getFullYear(), next.getMonth() + 1))
  }

  const removeRow = (rowId: string) => {
    if (!confirm('Hapus baris CKH ini?')) return
    startTransition(async () => {
      setBusyRowId(rowId)
      try {
        const res = await deleteCkhRow(rowId)
        if (res?.error) {
          setMessage({ type: 'error', text: res.error })
          return
        }
        setRows(prev => prev.filter(row => row.id !== rowId))
        setDocumentStatus('DRAFT')
        setMessage({ type: 'success', text: 'Baris CKH dihapus.' })
      } finally {
        setBusyRowId(null)
      }
    })
  }

  const acceptSuggestion = (rowId: string) => {
    startTransition(async () => {
      const res = await acceptCkhSuggestion(rowId)
      if (res?.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setRows(prev => prev.map(row => row.id === rowId ? {
        ...row,
        kegiatan_bulanan: row.suggested_kegiatan_bulanan || row.kegiatan_bulanan,
        catatan_harian: row.suggested_catatan_harian || row.catatan_harian,
        is_manual: 0,
        has_conflict: 0,
        suggested_kegiatan_bulanan: null,
        suggested_catatan_harian: null,
      } : row))
      setDocumentStatus('DRAFT')
      setMessage({ type: 'success', text: 'Versi baru dipakai.' })
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
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-surface bg-surface p-1">
            <Button size="sm" variant="ghost" onClick={() => shiftMonth(-1)} className="h-8 w-8 p-0" title="Bulan sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CalendarDays className="ml-2 h-4 w-4 text-slate-400" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-32 border-0 bg-transparent text-sm shadow-none focus:ring-0">
                <SelectValue aria-label="Bulan CKH" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, index) => (
                  <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-8 w-24 border-0 bg-transparent text-sm shadow-none focus:ring-0">
                <SelectValue aria-label="Tahun CKH" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(option => (
                  <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={goMonth} className="h-8">Buka</Button>
            <Button size="sm" variant="ghost" onClick={() => shiftMonth(1)} className="h-8 w-8 p-0" title="Bulan berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={syncDraft} disabled={isSyncing} className="gap-2">
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Sinkronkan Agenda
          </Button>
          <SignatureSettingsDialog
            documentId={initialData.document.id}
            signatureUrl={initialData.user.signature_url}
            settings={signatureSettings}
            onApply={settings => {
              setSignatureSettings(settings)
              setDocumentStatus('DRAFT')
            }}
          />
          <PrintDialog
            rows={rows}
            user={initialData.user}
            kepsek={initialData.kepsek}
            kepalaTu={initialData.kepalaTu}
            userRoles={initialData.userRoles}
            signatureSettings={signatureSettings}
            year={year}
            month={month}
          />
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
          <div className="mx-auto min-w-[980px] max-w-[1120px] rounded-lg bg-white p-8 shadow-sm ring-1 ring-slate-200" style={{ fontFamily: 'Tahoma, sans-serif' }}>
            <div className="text-center text-black">
              <h2 className="text-base font-bold">CATATAN KINERJA HARIAN</h2>
              <h3 className="text-base font-bold">ASN MAN 1 TASIKMALAYA</h3>
              <p className="mt-1 text-sm font-bold">BULAN : {formatCkhMonth(year, month)}</p>
            </div>

            <div className="mt-5 grid grid-cols-[132px_12px_1fr] text-sm text-black">
              <span>NAMA</span><span>:</span><span>{initialData.user.nama_lengkap}</span>
              <span>NIP</span><span>:</span><span>{initialData.user.nip || <MissingProfileInline />}</span>
              <span>PANGKAT / GOL.</span><span>:</span><span>{initialData.user.pangkat_golongan || <MissingProfileInline />}</span>
              <span>JABATAN</span><span>:</span><span>{initialData.user.jabatan_cetak || <MissingProfileInline />}</span>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-slate-300">
              <table className="w-full table-fixed border-collapse text-[12px] text-slate-900">
                <thead>
                  <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                    <th className="w-10 border border-slate-300 p-2">NO</th>
                    <th className="w-28 border border-slate-300 p-2">TANGGAL</th>
                    <th className="w-64 border border-slate-300 p-2">KEGIATAN BULANAN</th>
                    <th className="border border-slate-300 p-2">CATATAN KINERJA HARIAN</th>
                    <th className="w-14 border border-slate-300 p-2">VOL</th>
                    <th className="w-24 border border-slate-300 p-2">SATUAN</th>
                    <th className="w-32 border border-slate-300 p-2 print:hidden">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className={cn('bg-white transition-colors hover:bg-slate-50', row.has_conflict && 'bg-amber-50 hover:bg-amber-50')}>
                      <td className="border border-slate-300 p-2 text-center align-top font-medium text-slate-500">{index + 1}</td>
                      <td className="border border-slate-300 p-1.5 align-top">
                        <Input
                          type="date"
                          value={row.tanggal}
                          onChange={e => updateRowLocal(row.id, { tanggal: e.target.value })}
                          onBlur={e => saveRow({ ...row, tanggal: e.target.value })}
                          className="h-8 rounded-md border-slate-200 bg-white px-1 text-center text-[12px] shadow-none focus-visible:ring-1"
                        />
                      </td>
                      <td className="border border-slate-300 p-1.5 align-top">
                        <div className="flex items-start gap-1">
                          <textarea
                          value={row.kegiatan_bulanan}
                          onChange={e => updateRowLocal(row.id, { kegiatan_bulanan: e.target.value })}
                          onBlur={e => saveRow({ ...row, kegiatan_bulanan: e.target.value })}
                            rows={2}
                            className="min-h-8 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] leading-relaxed outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                          />
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => updateRowLocal(row.id, { kegiatan_bulanan: appendCkhLine(row.kegiatan_bulanan) })}
                            className="rounded-md p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 print:hidden"
                            title="Tambah kegiatan bulanan di tanggal ini"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="border border-slate-300 p-1.5 align-top">
                        <div className="flex items-start gap-1">
                          <textarea
                            value={row.catatan_harian}
                            onChange={e => {
                              const catatan = e.target.value
                              updateRowLocal(row.id, { catatan_harian: catatan, vol: countCkhItems(catatan) })
                            }}
                            onBlur={e => saveRow({ ...row, catatan_harian: e.target.value, vol: countCkhItems(e.target.value) })}
                            rows={2}
                            className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] leading-relaxed outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                          />
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              const catatan = appendCkhLine(row.catatan_harian)
                              updateRowLocal(row.id, { catatan_harian: catatan, vol: countCkhItems(catatan) })
                            }}
                            className="rounded-md p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 print:hidden"
                            title="Tambah catatan kinerja di tanggal ini"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {(notesByActivity.get(row.kegiatan_bulanan) || []).length > 0 && (
                          <select
                            value=""
                            onChange={e => {
                              if (!e.target.value) return
                              const catatan = e.target.value
                              const vol = countCkhItems(catatan)
                              updateRowLocal(row.id, { catatan_harian: catatan, vol })
                              startTransition(async () => {
                                const res = await saveCkhRow(row.id, {
                                  tanggal: row.tanggal,
                                  kegiatan_bulanan: row.kegiatan_bulanan,
                                  catatan_harian: catatan,
                                  vol,
                                })
                                if (res?.row) updateRowLocal(row.id, res.row as Partial<Row>)
                                if (!res?.error) setDocumentStatus('DRAFT')
                                setMessage(res?.error ? { type: 'error', text: res.error } : { type: 'success', text: 'Baris CKH disimpan.' })
                              })
                            }}
                            className="mt-1 h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 print:hidden"
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
                      <td className="border border-slate-300 p-1.5 text-center align-top">
                        <Input
                          type="number"
                          min={1}
                          value={row.vol || CKH_DEFAULT_VOL}
                          onChange={e => updateRowLocal(row.id, { vol: Math.max(1, Number(e.target.value) || 1) })}
                          onBlur={e => saveRow({ ...row, vol: Math.max(1, Number(e.target.value) || 1) })}
                          className="h-8 rounded-md border-slate-200 bg-white px-1 text-center text-[12px] shadow-none focus-visible:ring-1"
                        />
                      </td>
                      <td className="border border-slate-300 p-2 text-center align-top">{row.satuan || CKH_DEFAULT_SATUAN}</td>
                      <td className="border border-slate-300 p-1.5 align-top print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">{sourceLabel(row.source)}</span>
                          <button disabled={busyRowId === row.id} onClick={() => removeRow(row.id)} className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Hapus baris">
                            {busyRowId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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

            <div className="mt-12 flex justify-between text-sm text-black">
              <div className="w-[45%] pl-14 text-left">
                <p>Mengetahui :</p>
                <p className="mb-20 font-bold uppercase">{primarySignerLabel}</p>
                <p className="font-bold underline">{upper(primarySigner?.nama_lengkap) || missingSignerLabel}</p>
                <p>NIP. {primarySigner?.nip || <MissingProfileInline />}</p>
              </div>
              <div className="relative w-[45%] pl-14 text-left">
                {signatureSettings.signature_enabled && initialData.user.signature_url ? (
                  <img src={initialData.user.signature_url} alt="" style={signatureImageStyle(signatureSettings)} className="print:block" />
                ) : null}
                <p>Tasikmalaya, {new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="mb-20 font-bold uppercase">{initialData.user.jabatan_cetak || initialData.user.role}</p>
                <p className="font-bold underline">{upper(initialData.user.nama_lengkap)}</p>
                <p>NIP. {initialData.user.nip || <MissingProfileInline />}</p>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      {canManageTemplates && (
        <TabsContent value="template" className="mt-0">
          <TemplateAdmin templates={allTemplates} onTemplatesChange={setAllTemplates} />
        </TabsContent>
      )}

      <div className={cn(
        'flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        documentStatus === 'FINAL'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}>
        <div>
          <p className="font-semibold">{documentStatus === 'FINAL' ? 'Siap diambil TU' : 'Belum dikirim'}</p>
          <p className="text-xs opacity-80">
            {documentStatus === 'FINAL'
              ? 'Dokumen ini akan muncul di Dokumen TPG TU.'
              : 'Klik Kirim CKH setelah data sudah benar.'}
          </p>
        </div>
        <Button onClick={finalizeDocument} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Kirim CKH
        </Button>
      </div>
    </Tabs>
  )
}

function TemplateAdmin({ templates, onTemplatesChange }: { templates: Template[]; onTemplatesChange: (templates: Template[]) => void }) {
  const [isPending, startTransition] = useTransition()
  const [templateList, setTemplateList] = useState<Template[]>(templates)
  const [templateForm, setTemplateForm] = useState<Template | null>(null)
  const [noteForm, setNoteForm] = useState<{ id?: string; template_id: string; note: string; sort_order: number } | null>(null)
  const [roleFilter, setRoleFilter] = useState('_all')
  useEffect(() => {
    setTemplateList(templates)
  }, [templates])
  const updateTemplateList = (updater: (templates: Template[]) => Template[]) => {
    setTemplateList(prev => {
      const next = updater(prev)
      onTemplatesChange(next)
      return next
    })
  }
  const filteredTemplates = roleFilter === '_all'
    ? templateList
    : templateList.filter(template => template.role === roleFilter)

  const submitTemplate = (formData: FormData) => {
    startTransition(async () => {
      const res = await saveCkhTemplate(formData)
      if (res?.template) {
        const saved = res.template as Template
        updateTemplateList(prev => {
          const existing = prev.find(template => template.id === saved.id)
          if (existing) {
            return prev.map(template => template.id === saved.id ? { ...existing, ...saved, notes: existing.notes } : template)
          }
          return [...prev, saved].sort((a, b) => a.role.localeCompare(b.role) || a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'id-ID'))
        })
      }
      setTemplateForm(null)
    })
  }

  const submitNote = (formData: FormData) => {
    startTransition(async () => {
      const res = await saveCkhTemplateNote(formData)
      if (res?.note) {
        const saved = res.note as Template['notes'][number]
        updateTemplateList(prev => prev.map(template => {
          if (template.id !== saved.template_id) {
            return { ...template, notes: template.notes.filter(note => note.id !== saved.id) }
          }
          const existing = template.notes.find(note => note.id === saved.id)
          const notes = existing
            ? template.notes.map(note => note.id === saved.id ? saved : note)
            : [...template.notes, saved]
          return { ...template, notes: notes.sort((a, b) => a.sort_order - b.sort_order || a.note.localeCompare(b.note, 'id-ID')) }
        }))
      }
      setNoteForm(null)
    })
  }

  const removeTemplate = (id: string) => {
    if (!confirm('Hapus template kegiatan beserta catatannya?')) return
    startTransition(async () => {
      await deleteCkhTemplate(id)
      updateTemplateList(prev => prev.filter(template => template.id !== id))
      setTemplateForm(current => current?.id === id ? null : current)
    })
  }

  const removeNote = (id: string) => {
    if (!confirm('Hapus catatan template ini?')) return
    startTransition(async () => {
      await deleteCkhTemplateNote(id)
      updateTemplateList(prev => prev.map(template => ({
        ...template,
        notes: template.notes.filter(note => note.id !== id),
      })))
      setNoteForm(current => current?.id === id ? null : current)
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
                <SelectContent>{templateList.map(template => <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>)}</SelectContent>
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
