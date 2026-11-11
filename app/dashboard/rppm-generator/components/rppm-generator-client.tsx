'use client'

import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Download,
  FileText,
  Loader2,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DEFAULT_RPPM_PRINT_SETTINGS,
  RPPM_TEMPLATES,
  buildRppmAttachmentsPrompt,
  buildRppmPrompt,
  emptyRppmPackage,
  formatTanggalRppm,
  hasCurrentRppmImport,
  normalizePrintSettings,
  normalizeRppmContent,
  parseRppmPackage,
  replaceRppmAttachments,
  validateRppmContent,
  validateRppmOutput,
  type RppmContent,
  type RppmPrintSettings,
  type RppmSpec,
  type RppmTemplateType,
} from '@/lib/rppm'
import { buildRppmDocxBlob, buildRppmDocxFilename } from '@/lib/rppm-docx'
import { downloadBlobFile } from '@/lib/pdf/download'
import { saveRppmDocument, type RppmMapelOption, type RppmSavedDocument, type RppmSigner } from '../actions'
import { RppmPrintDocument } from './rppm-print-document'

type Message = { type: 'success' | 'error'; text: string } | null
const DEFAULT_SPEC: RppmSpec = {
  satuan_pendidikan: 'MAN 1 Tasikmalaya',
  mata_pelajaran: '',
  kelas_semester: '',
  topik_pembelajaran: '',
  alokasi_waktu: '2 JP (Pertemuan 1)',
  konteks_topik: '',
  tanggal_ttd: new Date().toISOString().slice(0, 10),
}

function defaultSpec(mapelOptions: RppmMapelOption[]): RppmSpec {
  return {
    ...DEFAULT_SPEC,
    mata_pelajaran: mapelOptions.length === 1 ? mapelOptions[0].nama_mapel : '',
  }
}

const WIZARD_STEPS = [
  { title: 'Template', desc: 'Pilih model RPPM' },
  { title: 'Spesifikasi', desc: 'Isi data dasar' },
  { title: 'Prompt', desc: 'Copy ke AI' },
  { title: 'Import', desc: 'Paste JSON AI' },
  { title: 'Output', desc: 'Download Word' },
]
const IMPORT_STEP = 3
const OUTPUT_STEP = WIZARD_STEPS.length - 1

export function RppmGeneratorClient({
  initialDocuments,
  mapelOptions,
  user,
  kepsek,
}: {
  initialDocuments: RppmSavedDocument[]
  mapelOptions: RppmMapelOption[]
  user: RppmSigner
  kepsek: RppmSigner | null
}) {
  const firstDoc = initialDocuments[0]
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeId, setActiveId] = useState(firstDoc?.id || null)
  const [templateType, setTemplateType] = useState<RppmTemplateType>(firstDoc?.template_type || 'cooperative-learning')
  const [content, setContent] = useState<RppmContent>(() => firstDoc?.content || emptyRppmPackage(defaultSpec(mapelOptions)))
  const [printSettings, setPrintSettings] = useState<RppmPrintSettings>(() => firstDoc?.print_settings || DEFAULT_RPPM_PRINT_SETTINGS)
  const [message, setMessage] = useState<Message>(null)
  const [copied, setCopied] = useState(false)
  const [activeStep, setActiveStep] = useState(firstDoc ? OUTPUT_STEP : 0)
  const [jsonInput, setJsonInput] = useState('')
  const [attachmentInput, setAttachmentInput] = useState('')
  const [isPending, startTransition] = useTransition()

  const isPackage = content.format === 'paket-v1'
  const validationErrors = useMemo(() => validateRppmOutput(templateType, content), [templateType, content])
  const outputMessages = validationErrors[0]?.path === 'acuan_import' ? validationErrors.slice(0, 1) : validationErrors
  const canPrint = validationErrors.length === 0
  const prompt = useMemo(() => buildRppmPrompt(templateType, content.spesifikasi, isPackage), [templateType, content.spesifikasi, isPackage])
  const attachmentPrompt = activeStep === IMPORT_STEP && isPackage
    && hasCurrentRppmImport(templateType, content) && !validateRppmContent(content).length
    ? buildRppmAttachmentsPrompt(templateType, content)
    : null

  const selectDocument = (doc: RppmSavedDocument) => {
    setActiveId(doc.id)
    setTemplateType(doc.template_type)
    setContent(normalizeRppmContent(doc.content))
    setPrintSettings(normalizePrintSettings(doc.print_settings))
    setMessage(null)
    setJsonInput('')
    setAttachmentInput('')
    setActiveStep(OUTPUT_STEP)
  }

  const newDraft = () => {
    setActiveId(null)
    setTemplateType('cooperative-learning')
    setContent(emptyRppmPackage(defaultSpec(mapelOptions)))
    setPrintSettings(DEFAULT_RPPM_PRINT_SETTINGS)
    setMessage(null)
    setJsonInput('')
    setAttachmentInput('')
    setActiveStep(0)
  }

  const copyPrompt = async (text: string, kind: 'package' | 'attachments') => {
    try {
      await navigator.clipboard.writeText(text)
      if (kind === 'package') {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } else {
        setMessage({ type: 'success', text: 'Prompt lampiran tersalin.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Prompt gagal disalin. Silakan blok teks prompt lalu salin manual.' })
    }
  }

  const importJsonText = (kind: 'package' | 'attachments') => {
    try {
      const next = kind === 'package'
        ? parseRppmPackage(jsonInput, templateType, content.spesifikasi)
        : replaceRppmAttachments(attachmentInput, templateType, content)
      setContent(next)
      setJsonInput('')
      setAttachmentInput('')
      setActiveStep(OUTPUT_STEP)
      setMessage({ type: 'success', text: kind === 'package' ? 'RPPM berhasil diimpor.' : 'Ketiga lampiran berhasil diperbarui.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof SyntaxError
          ? 'JSON belum valid. Salin ulang respons AI secara lengkap.'
          : error instanceof Error ? error.message : 'Hasil AI gagal dibaca.',
      })
    }
  }

  const save = (status: 'DRAFT' | 'FINAL') => {
    if (status === 'FINAL' && !canPrint) {
      setMessage({ type: 'error', text: 'Lengkapi field wajib sebelum menyimpan final.' })
      return
    }

    startTransition(async () => {
      const result = await saveRppmDocument({
        id: activeId,
        template_type: templateType,
        content,
        print_settings: printSettings,
        status,
      })

      if (result.error || !result.document) {
        setMessage({ type: 'error', text: result.error || 'Gagal menyimpan RPPM.' })
        return
      }

      setActiveId(result.document.id)
      setDocuments(prev => {
        const next = prev.filter(doc => doc.id !== result.document!.id)
        return [result.document!, ...next]
      })
      setMessage({ type: 'success', text: status === 'FINAL' ? 'RPPM disimpan sebagai final.' : 'Draft RPPM berhasil disimpan.' })
    })
  }

  const downloadDocx = async () => {
    if (!canPrint) {
      setMessage({ type: 'error', text: 'Lengkapi field wajib sebelum mengunduh Word.' })
      return
    }

    try {
      const blob = buildRppmDocxBlob(templateType, content, printSettings, user, kepsek)
      await downloadBlobFile(blob, buildRppmDocxFilename(content))
      setMessage({ type: 'success', text: 'Dokumen Word berhasil disiapkan.' })
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'Gagal mengunduh Word.' })
    }
  }

  return (
    <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3 sm:space-y-4">
        {isPackage && <WizardStepper activeStep={activeStep} onChange={setActiveStep} />}

        {message && (
          <div className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
          )} role={message.type === 'error' ? 'alert' : 'status'}>
            {message.type === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {activeStep === 0 && <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="text-base">Template RPPM</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {RPPM_TEMPLATES.map(template => (
                <button
                  key={template.type}
                  type="button"
                  onClick={() => setTemplateType(template.type)}
                  className={cn(
                    'flex min-h-[156px] flex-col justify-start rounded-lg border p-4 text-left transition',
                    templateType === template.type
                      ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950',
                  )}
                >
                  <div className="text-sm font-semibold leading-5">{template.shortLabel}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>}

        {activeStep === 1 && <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="text-base">Spesifikasi</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <SpecInput label="Satuan Pendidikan" value={content.spesifikasi.satuan_pendidikan} onChange={value => updateSpec(setContent, 'satuan_pendidikan', value)} />
              <MapelSelect value={content.spesifikasi.mata_pelajaran} options={mapelOptions} onChange={value => updateSpec(setContent, 'mata_pelajaran', value)} />
              <SpecInput label="Kelas / Semester" value={content.spesifikasi.kelas_semester} onChange={value => updateSpec(setContent, 'kelas_semester', value)} />
              <SpecInput label="Topik Pembelajaran" value={content.spesifikasi.topik_pembelajaran} onChange={value => updateSpec(setContent, 'topik_pembelajaran', value)} />
              <SpecInput label="Alokasi Waktu" value={content.spesifikasi.alokasi_waktu} onChange={value => updateSpec(setContent, 'alokasi_waktu', value)} />
              <div>
                <Label className="text-xs font-medium">Tanggal Tanda Tangan</Label>
                <Input type="date" value={content.spesifikasi.tanggal_ttd || ''} onChange={event => updateSpec(setContent, 'tanggal_ttd', event.target.value)} className="mt-1" />
                <p className="mt-1 text-xs text-slate-500">Akan tampil sebagai: Tasikmalaya{content.spesifikasi.tanggal_ttd ? `, ${formatTanggalRppm(content.spesifikasi.tanggal_ttd)}` : ', ...'}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium">Konteks Topik / Catatan Pengarah</Label>
                <Textarea
                  value={content.spesifikasi.konteks_topik || ''}
                  onChange={event => updateSpec(setContent, 'konteks_topik', event.target.value)}
                  placeholder="Contoh: Topik IDHOFAH difokuskan pada pengertian, syarat-syarat, contoh susunan, dan perbandingan dengan frasa kepemilikan dalam bahasa Indonesia. Bisa juga tempel teks bacaan yang ingin dipakai."
                  className="mt-1 min-h-32"
                />
                <p className="mt-1 text-xs text-slate-500">Dipakai untuk mengarahkan prompt AI saja. Di dokumen, Topik Pembelajaran tetap memakai judul ringkas di atas.</p>
              </div>
            </div>
          </CardContent>
        </Card>}

        {activeStep === 2 && <Card className="rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                <span>Prompt AI</span>
                <Button size="sm" variant="outline" onClick={() => copyPrompt(prompt, 'package')} className="h-8 w-full gap-1.5 sm:w-auto">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? 'Tersalin' : 'Copy'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <Textarea value={prompt} readOnly className="min-h-64 resize-y font-mono text-xs leading-5 sm:min-h-72" />
            </CardContent>
          </Card>}

          {activeStep === IMPORT_STEP && <Card className="rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="text-base">Impor Paket RPPM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <Textarea
                value={jsonInput}
                onChange={event => setJsonInput(event.target.value)}
                aria-label="JSON paket RPPM dari AI"
                placeholder="Tempel hasil JSON dari prompt paket lengkap."
                className="min-h-64 resize-y font-mono text-xs leading-5 sm:min-h-72"
              />
              <div className="flex justify-end">
                <Button onClick={() => importJsonText('package')} disabled={!jsonInput.trim()} className="w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
                  <Check className="h-4 w-4" />
                  Import JSON
                </Button>
              </div>
              {attachmentPrompt && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Perbarui Lampiran</summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-500">Buat ulang tiga lampiran dari naskah RPPM yang sudah diimpor.</p>
                    <Textarea value={attachmentPrompt} readOnly aria-label="Prompt pembaruan lampiran" className="min-h-32 font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => copyPrompt(attachmentPrompt, 'attachments')}>
                      <Clipboard className="mr-2 h-4 w-4" />
                      Salin Prompt Lampiran
                    </Button>
                    <Textarea
                      value={attachmentInput}
                      onChange={event => setAttachmentInput(event.target.value)}
                      aria-label="JSON lampiran dari AI"
                      placeholder="Tempel hasil JSON dari prompt pembaruan lampiran."
                      className="min-h-32 font-mono text-xs"
                    />
                    <Button size="sm" disabled={!attachmentInput.trim()} onClick={() => importJsonText('attachments')}>
                      Impor Lampiran
                    </Button>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>}

        {activeStep === OUTPUT_STEP && <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="flex flex-col gap-3 text-base lg:flex-row lg:items-center lg:justify-between">
              <span>Output Word</span>
              <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
                <Button variant="outline" onClick={() => save('DRAFT')} disabled={isPending} className="w-full gap-1.5">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Draft
                </Button>
                <Button variant="outline" onClick={() => save('FINAL')} disabled={isPending || !canPrint} className="w-full gap-1.5">
                  <FileText className="h-4 w-4" />
                  Simpan Final
                </Button>
                <Button onClick={downloadDocx} disabled={!canPrint} className="w-full gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800">
                  <Download className="h-4 w-4" />
                  Download Word
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="font-semibold">Belum siap diunduh</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {outputMessages.map(error => <li key={error.path}>{error.message}</li>)}
                </ul>
                {isPackage && <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveStep(IMPORT_STEP)}>Kembali ke Import</Button>}
              </div>
            )}
            {canPrint && <p className="text-sm text-slate-500">Unduh dokumen untuk menyuntingnya di Word.</p>}
            <PrintSettingsEditor settings={printSettings} onChange={setPrintSettings} />
            <div className="max-h-[72vh] max-w-full overflow-auto rounded-lg border bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
              <div className="mx-auto w-max origin-top-left shadow-lg">
                <RppmPrintDocument templateType={templateType} content={content} settings={printSettings} user={user} kepsek={kepsek} />
              </div>
            </div>
          </CardContent>
        </Card>}

        {isPackage && <WizardNav activeStep={activeStep} onChange={setActiveStep} />}
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Draft Tersimpan</span>
              <Button size="sm" variant="outline" onClick={newDraft} disabled={isPending} className="h-8">Draft Baru</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0 xl:max-h-[70vh] xl:overflow-auto">
            {documents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-slate-400">Belum ada draft.</p>
            ) : documents.map(doc => (
              <button
                key={doc.id}
                type="button"
                onClick={() => selectDocument(doc)}
                disabled={isPending}
                className={cn(
                  'w-full rounded-lg border p-3 text-left text-sm transition',
                  activeId === doc.id ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900',
                )}
              >
                <div className="line-clamp-2 font-semibold">{doc.title || 'RPPM Tanpa Judul'}</div>
                <div className="mt-1 text-xs text-slate-500">{doc.mapel || '-'} | {doc.kelas_semester || '-'}</div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{RPPM_TEMPLATES.find(t => t.type === doc.template_type)?.shortLabel}</span>
                  <span>{formatDate(doc.updated_at)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function SpecInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <Input value={value} onChange={event => onChange(event.target.value)} className="mt-1" />
    </div>
  )
}

function MapelSelect({ value, options, onChange }: { value: string; options: RppmMapelOption[]; onChange: (value: string) => void }) {
  const selectedValue = options.some(option => option.nama_mapel === value) ? value : ''

  return (
    <div>
      <Label className="text-xs font-medium">Mata Pelajaran</Label>
      <Combobox
        value={selectedValue}
        onValueChange={onChange}
        options={options.map(option => ({ value: option.nama_mapel, label: option.nama_mapel }))}
        placeholder={options.length === 0 ? 'Mapel belum tersedia' : 'Pilih mata pelajaran'}
        searchPlaceholder="Cari mata pelajaran..."
        emptyText="Mata pelajaran tidak ditemukan"
        disabled={options.length === 0}
        className="mt-1"
      />
      <p className="mt-1 text-xs text-slate-500">
        {options.length === 0
          ? 'Belum ada mata pelajaran yang tersedia. Hubungi admin akademik.'
          : options.length === 1
            ? 'Mapel otomatis mengikuti penugasan mengajar Anda.'
            : 'Ketik untuk mencari dan memilih mata pelajaran.'}
      </p>
      {value && !selectedValue && (
        <p className="mt-1 text-xs text-amber-600">Mapel tersimpan &quot;{value}&quot; sudah tidak tersedia. Pilih mapel yang tersedia sebelum menyimpan.</p>
      )}
    </div>
  )
}

function WizardStepper({ activeStep, onChange }: { activeStep: number; onChange: (step: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex gap-2 lg:grid lg:grid-cols-5">
        {WIZARD_STEPS.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => onChange(index)}
            aria-current={activeStep === index ? 'step' : undefined}
            className={cn(
              'min-w-[132px] rounded-md px-3 py-2 text-left transition sm:min-w-[150px] lg:min-w-0',
              activeStep === index
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]">Step {index + 1}</span>
            <span className="block text-sm font-semibold">{step.title}</span>
            <span className={cn('hidden text-[11px] sm:block', activeStep === index ? 'text-slate-200 dark:text-slate-600' : 'text-slate-400')}>{step.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function WizardNav({ activeStep, onChange }: { activeStep: number; onChange: (step: number) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <Button
        variant="outline"
        onClick={() => onChange(Math.max(0, activeStep - 1))}
        disabled={activeStep === 0}
        className="gap-1.5 px-2 sm:px-4"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Sebelumnya</span>
        <span className="sm:hidden">Prev</span>
      </Button>
      <div className="px-1 text-center text-xs font-medium text-slate-500">
        {activeStep + 1} / {WIZARD_STEPS.length}
      </div>
      <Button
        onClick={() => onChange(Math.min(WIZARD_STEPS.length - 1, activeStep + 1))}
        disabled={activeStep === WIZARD_STEPS.length - 1}
        className="gap-1.5 px-2 sm:px-4 bg-slate-900 text-white hover:bg-slate-800"
      >
        <span className="hidden sm:inline">Selanjutnya</span>
        <span className="sm:hidden">Next</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function PrintSettingsEditor({ settings, onChange }: { settings: RppmPrintSettings; onChange: (settings: RppmPrintSettings) => void }) {
  const updateMargin = (key: keyof RppmPrintSettings['margins'], value: string) => {
    const n = Number(value)
    onChange({
      ...settings,
      margins: { ...settings.margins, [key]: Number.isFinite(n) ? n : 20 },
    })
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3 md:grid-cols-[160px_repeat(4,1fr)]">
      <div className="col-span-2 sm:col-span-1">
        <Label className="text-xs font-medium">Kertas</Label>
        <select
          value={settings.paper}
          onChange={event => onChange({ ...settings, paper: event.target.value === 'A4' ? 'A4' : 'F4' })}
          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <option value="F4">F4 / Folio</option>
          <option value="A4">A4</option>
        </select>
      </div>
      {(['top', 'right', 'bottom', 'left'] as const).map(key => (
        <div key={key}>
          <Label className="text-xs font-medium">Margin {marginLabel(key)}</Label>
          <Input type="number" min={0} max={50} value={settings.margins[key]} onChange={event => updateMargin(key, event.target.value)} className="mt-1" />
        </div>
      ))}
    </div>
  )
}

function updateSpec(setContent: Dispatch<SetStateAction<RppmContent>>, key: keyof RppmSpec, value: string) {
  setContent(prev => ({ ...prev, spesifikasi: { ...prev.spesifikasi, [key]: value } }))
}

function marginLabel(key: keyof RppmPrintSettings['margins']) {
  if (key === 'top') return 'Atas'
  if (key === 'right') return 'Kanan'
  if (key === 'bottom') return 'Bawah'
  return 'Kiri'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
