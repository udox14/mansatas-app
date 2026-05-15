'use client'

import { useMemo, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DEFAULT_RPPM_PRINT_SETTINGS,
  RPPM_DPL_OPTIONS,
  RPPM_PANCA_CINTA_OPTIONS,
  RPPM_TEMPLATES,
  buildRppmPrompt,
  cleanTextArray,
  emptyRppmContent,
  normalizePrintSettings,
  normalizeRppmContent,
  parseRppmJson,
  validateRppmContent,
  type RppmContent,
  type RppmPrintSettings,
  type RppmSpec,
  type RppmTemplateType,
} from '@/lib/rppm'
import { buildRppmDocxBlob, buildRppmDocxFilename } from '@/lib/rppm-docx'
import { saveRppmDocument, type RppmSavedDocument, type RppmSigner } from '../actions'
import { RppmPrintDocument } from './rppm-print-document'

type Message = { type: 'success' | 'error'; text: string } | null
type ArrayPath =
  | 'identifikasi.dimensi_profil_lulusan'
  | 'identifikasi.topik_panca_cinta'
  | 'pengalaman_belajar.kegiatan_awal'
  | 'pengalaman_belajar.kegiatan_inti.memahami'
  | 'pengalaman_belajar.kegiatan_inti.mengaplikasi'
  | 'pengalaman_belajar.kegiatan_inti.merefleksi'
  | 'pengalaman_belajar.kegiatan_penutup'

type TextPath =
  | 'identifikasi.asesmen_awal'
  | 'identifikasi.materi_integrasi_kbc'
  | 'desain_pembelajaran.tujuan_pembelajaran'
  | 'desain_pembelajaran.kerangka_pembelajaran'
  | 'asesmen_pembelajaran.asesmen_proses'
  | 'asesmen_pembelajaran.asesmen_akhir'

const DEFAULT_SPEC: RppmSpec = {
  satuan_pendidikan: 'MAN 1 Tasikmalaya',
  mata_pelajaran: '',
  kelas_semester: '',
  topik_pembelajaran: '',
  alokasi_waktu: '2 JP (Pertemuan 1)',
}

const WIZARD_STEPS = [
  { title: 'Template', desc: 'Pilih model RPPM' },
  { title: 'Spesifikasi', desc: 'Isi data dasar' },
  { title: 'Prompt', desc: 'Copy ke AI' },
  { title: 'Import', desc: 'Paste JSON AI' },
  { title: 'Edit', desc: 'Rapikan isi' },
  { title: 'Output', desc: 'Download Word' },
]

export function RppmGeneratorClient({
  initialDocuments,
  user,
  kepsek,
}: {
  initialDocuments: RppmSavedDocument[]
  user: RppmSigner
  kepsek: RppmSigner | null
}) {
  const firstDoc = initialDocuments[0]
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeId, setActiveId] = useState(firstDoc?.id || null)
  const [templateType, setTemplateType] = useState<RppmTemplateType>(firstDoc?.template_type || 'cooperative-learning')
  const [content, setContent] = useState<RppmContent>(() => firstDoc?.content || emptyRppmContent(DEFAULT_SPEC))
  const [printSettings, setPrintSettings] = useState<RppmPrintSettings>(() => firstDoc?.print_settings || DEFAULT_RPPM_PRINT_SETTINGS)
  const [message, setMessage] = useState<Message>(null)
  const [copied, setCopied] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [jsonInput, setJsonInput] = useState('')
  const [isPending, startTransition] = useTransition()

  const validationErrors = useMemo(() => validateRppmContent(content), [content])
  const canPrint = validationErrors.length === 0
  const prompt = useMemo(() => buildRppmPrompt(templateType, content.spesifikasi), [templateType, content.spesifikasi])

  const selectDocument = (doc: RppmSavedDocument) => {
    setActiveId(doc.id)
    setTemplateType(doc.template_type)
    setContent(normalizeRppmContent(doc.content))
    setPrintSettings(normalizePrintSettings(doc.print_settings))
    setMessage(null)
    setActiveStep(4)
  }

  const newDraft = () => {
    setActiveId(null)
    setTemplateType('cooperative-learning')
    setContent(emptyRppmContent(DEFAULT_SPEC))
    setPrintSettings(DEFAULT_RPPM_PRINT_SETTINGS)
    setMessage(null)
    setJsonInput('')
    setActiveStep(0)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setMessage({ type: 'error', text: 'Prompt gagal disalin. Silakan blok teks prompt lalu salin manual.' })
    }
  }

  const importJsonText = () => {
    const parsed = parseRppmJson(jsonInput, content.spesifikasi)
    if (parsed.error || !parsed.content) {
      setMessage({ type: 'error', text: parsed.error || 'File gagal dibaca.' })
      return
    }
    setContent(parsed.content)
    setActiveStep(4)
    setMessage({ type: 'success', text: 'JSON berhasil diimport. Periksa isinya sebelum disimpan atau diunduh.' })
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

  const downloadDocx = () => {
    if (!canPrint) {
      setMessage({ type: 'error', text: 'Lengkapi field wajib sebelum mengunduh Word.' })
      return
    }

    const blob = buildRppmDocxBlob(templateType, content, printSettings, user, kepsek)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = buildRppmDocxFilename(content)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3 sm:space-y-4">
        <WizardStepper activeStep={activeStep} onChange={setActiveStep} />

        {message && (
          <div className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
          )}>
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
              <SpecInput label="Mata Pelajaran" value={content.spesifikasi.mata_pelajaran} onChange={value => updateSpec(setContent, 'mata_pelajaran', value)} />
              <SpecInput label="Kelas / Semester" value={content.spesifikasi.kelas_semester} onChange={value => updateSpec(setContent, 'kelas_semester', value)} />
              <SpecInput label="Topik Pembelajaran" value={content.spesifikasi.topik_pembelajaran} onChange={value => updateSpec(setContent, 'topik_pembelajaran', value)} />
              <SpecInput label="Alokasi Waktu" value={content.spesifikasi.alokasi_waktu} onChange={value => updateSpec(setContent, 'alokasi_waktu', value)} />
            </div>
          </CardContent>
        </Card>}

        {activeStep === 2 && <Card className="rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                <span>Prompt AI</span>
                <Button size="sm" variant="outline" onClick={copyPrompt} className="h-8 w-full gap-1.5 sm:w-auto">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? 'Tersalin' : 'Copy'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <Textarea value={prompt} readOnly className="min-h-64 resize-y font-mono text-xs leading-5 sm:min-h-72" />
            </CardContent>
          </Card>}

          {activeStep === 3 && <Card className="rounded-lg shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="text-base">Paste JSON dari AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <Textarea
                value={jsonInput}
                onChange={event => setJsonInput(event.target.value)}
                placeholder="Paste output JSON dari AI di sini. Jangan sertakan markdown ```json."
                className="min-h-64 resize-y font-mono text-xs leading-5 sm:min-h-72"
              />
              <div className="flex justify-end">
                <Button onClick={importJsonText} className="w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">
                  <Check className="h-4 w-4" />
                  Import JSON
                </Button>
              </div>
              {validationErrors.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="mb-1 font-semibold">Belum siap unduh</div>
                  <ul className="space-y-1">
                    {validationErrors.slice(0, 8).map(error => <li key={error.path}>- {error.message}</li>)}
                    {validationErrors.length > 8 && <li>- {validationErrors.length - 8} field lain belum lengkap.</li>}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Semua field wajib sudah lengkap.
                </div>
              )}
            </CardContent>
          </Card>}

        {activeStep === 4 && <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
              <span>Edit Isi RPPM</span>
              <Button size="sm" variant="outline" onClick={() => applyTemplateDefaults(setContent, templateType)} className="h-8 w-full sm:w-auto">
                Isi Acuan Template
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <EditorGrid>
              <TextEditor label="Asesmen Awal" value={content.identifikasi.asesmen_awal} onChange={value => updateText(setContent, 'identifikasi.asesmen_awal', value)} />
              <CheckboxListEditor label="Dimensi Profil Lulusan" options={RPPM_DPL_OPTIONS} value={content.identifikasi.dimensi_profil_lulusan} onChange={value => updateArray(setContent, 'identifikasi.dimensi_profil_lulusan', value)} />
              <CheckboxListEditor label="Topik Panca Cinta" options={RPPM_PANCA_CINTA_OPTIONS} value={content.identifikasi.topik_panca_cinta} onChange={value => updateArray(setContent, 'identifikasi.topik_panca_cinta', value)} />
              <TextEditor label="Materi Integrasi KBC" value={content.identifikasi.materi_integrasi_kbc} onChange={value => updateText(setContent, 'identifikasi.materi_integrasi_kbc', value)} />
              <TextEditor label="Tujuan Pembelajaran" value={content.desain_pembelajaran.tujuan_pembelajaran} onChange={value => updateText(setContent, 'desain_pembelajaran.tujuan_pembelajaran', value)} />
              <KerangkaEditor
                value={content.desain_pembelajaran.kerangka_pembelajaran}
                templateType={templateType}
                spec={content.spesifikasi}
                onChange={value => updateText(setContent, 'desain_pembelajaran.kerangka_pembelajaran', value)}
              />
              <PointListEditor label="Kegiatan Awal" value={content.pengalaman_belajar.kegiatan_awal} onChange={value => updateArray(setContent, 'pengalaman_belajar.kegiatan_awal', value)} onReset={() => updateArray(setContent, 'pengalaman_belajar.kegiatan_awal', defaultKegiatanAwal())} />
              <PointListEditor label="Inti - Memahami" value={content.pengalaman_belajar.kegiatan_inti.memahami} onChange={value => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.memahami', value)} onReset={() => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.memahami', getTemplateInti(templateType, 'memahami'))} />
              <PointListEditor label="Inti - Mengaplikasi" value={content.pengalaman_belajar.kegiatan_inti.mengaplikasi} onChange={value => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.mengaplikasi', value)} onReset={() => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.mengaplikasi', getTemplateInti(templateType, 'mengaplikasi'))} />
              <PointListEditor label="Inti - Merefleksi" value={content.pengalaman_belajar.kegiatan_inti.merefleksi} onChange={value => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.merefleksi', value)} onReset={() => updateArray(setContent, 'pengalaman_belajar.kegiatan_inti.merefleksi', getTemplateInti(templateType, 'merefleksi'))} />
              <PointListEditor label="Kegiatan Penutup" value={content.pengalaman_belajar.kegiatan_penutup} onChange={value => updateArray(setContent, 'pengalaman_belajar.kegiatan_penutup', value)} onReset={() => updateArray(setContent, 'pengalaman_belajar.kegiatan_penutup', defaultKegiatanPenutup())} />
              <TextEditor label="Asesmen Proses" value={content.asesmen_pembelajaran.asesmen_proses} onChange={value => updateText(setContent, 'asesmen_pembelajaran.asesmen_proses', value)} />
              <TextEditor label="Asesmen Akhir" value={content.asesmen_pembelajaran.asesmen_akhir} onChange={value => updateText(setContent, 'asesmen_pembelajaran.asesmen_akhir', value)} />
            </EditorGrid>
          </CardContent>
        </Card>}

        {activeStep === 5 && <Card className="rounded-lg shadow-sm">
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
            <PrintSettingsEditor settings={printSettings} onChange={setPrintSettings} />
            <div className="max-h-[72vh] max-w-full overflow-auto rounded-lg border bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
              <div className="mx-auto w-max origin-top-left shadow-lg">
                <RppmPrintDocument templateType={templateType} content={content} settings={printSettings} user={user} kepsek={kepsek} />
              </div>
            </div>
          </CardContent>
        </Card>}

        <WizardNav activeStep={activeStep} onChange={setActiveStep} />
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Draft Tersimpan</span>
              <Button size="sm" variant="outline" onClick={newDraft} className="h-8">Baru</Button>
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

function WizardStepper({ activeStep, onChange }: { activeStep: number; onChange: (step: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex gap-2 lg:grid lg:grid-cols-6">
        {WIZARD_STEPS.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => onChange(index)}
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

function EditorGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}

function TextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <Textarea value={value} onChange={event => onChange(event.target.value)} className="mt-1 min-h-28" />
    </div>
  )
}

function ArrayEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <Textarea value={value.join('\n')} onChange={event => onChange(cleanTextArray(event.target.value))} className="mt-1 min-h-28" />
    </div>
  )
}

function CheckboxListEditor({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  const extra = value.filter(item => !options.some(option => matchesOption(item, option)))

  const toggle = (option: string) => {
    const checked = value.some(item => matchesOption(item, option))
    if (checked) onChange(value.filter(item => !matchesOption(item, option)))
    else onChange([...value, option])
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="mt-2 grid gap-2">
        {options.map(option => {
          const checked = value.some(item => matchesOption(item, option))
          return (
            <label key={option} className="flex cursor-pointer items-start gap-2 rounded-md bg-slate-50 px-2 py-2 text-xs leading-5 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800">
              <input type="checkbox" checked={checked} onChange={() => toggle(option)} className="mt-1 rounded" />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
      {extra.length > 0 && (
        <div className="mt-3">
          <Label className="text-[11px] font-medium text-slate-500">Tambahan dari AI</Label>
          <Textarea value={extra.join('\n')} onChange={event => onChange([...value.filter(item => !extra.includes(item)), ...cleanTextArray(event.target.value)])} className="mt-1 min-h-20 text-xs" />
        </div>
      )}
    </div>
  )
}

function KerangkaEditor({ value, templateType, spec, onChange }: { value: string; templateType: RppmTemplateType; spec: RppmSpec; onChange: (value: string) => void }) {
  const parts = parseKerangka(value)
  const update = (key: keyof KerangkaParts, nextValue: string) => onChange(buildKerangka({ ...parts, [key]: nextValue }))

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 lg:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-xs font-medium">Kerangka Pembelajaran</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(defaultKerangkaText(templateType, spec))} className="h-8 w-full sm:w-auto">
          Contoh Struktur
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextEditor label="Metode" value={parts.metode} onChange={value => update('metode', value)} />
        <TextEditor label="Kemitraan Pembelajaran" value={parts.kemitraan} onChange={value => update('kemitraan', value)} />
        <TextEditor label="Lingkungan Pembelajaran" value={parts.lingkungan} onChange={value => update('lingkungan', value)} />
        <TextEditor label="Pemanfaatan Digital" value={parts.digital} onChange={value => update('digital', value)} />
      </div>
    </div>
  )
}

function PointListEditor({ label, value, onChange, onReset }: { label: string; value: string[]; onChange: (value: string[]) => void; onReset?: () => void }) {
  const updateItem = (index: number, item: string) => onChange(value.map((old, i) => i === index ? item : old))
  const removeItem = (index: number) => onChange(value.filter((_, i) => i !== index))
  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const current = next[index]
    next[index] = next[target]
    next[target] = current
    onChange(next)
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex gap-2">
          {onReset && <Button type="button" size="sm" variant="outline" onClick={onReset} className="h-8 flex-1 sm:flex-none">Acuan</Button>}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, ''])} className="h-8 flex-1 sm:flex-none">Tambah</Button>
        </div>
      </div>
      {value.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-center text-xs text-slate-400">Belum ada poin.</p>
      ) : value.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900 sm:grid-cols-[28px_1fr_auto]">
          <div className="pt-2 text-center text-xs font-semibold text-slate-500">{index + 1}</div>
          <Textarea value={item} onChange={event => updateItem(index, event.target.value)} className="min-h-20 text-sm" />
          <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-col">
            <Button type="button" size="sm" variant="outline" onClick={() => moveItem(index, -1)} disabled={index === 0} className="h-8 px-2">Naik</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => moveItem(index, 1)} disabled={index === value.length - 1} className="h-8 px-2">Turun</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => removeItem(index)} className="h-8 px-2 text-rose-600">Hapus</Button>
          </div>
        </div>
      ))}
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

function updateText(setContent: Dispatch<SetStateAction<RppmContent>>, path: TextPath, value: string) {
  setContent(prev => {
    const next = structuredClone(prev)
    if (path === 'identifikasi.asesmen_awal') next.identifikasi.asesmen_awal = value
    if (path === 'identifikasi.materi_integrasi_kbc') next.identifikasi.materi_integrasi_kbc = value
    if (path === 'desain_pembelajaran.tujuan_pembelajaran') next.desain_pembelajaran.tujuan_pembelajaran = value
    if (path === 'desain_pembelajaran.kerangka_pembelajaran') next.desain_pembelajaran.kerangka_pembelajaran = value
    if (path === 'asesmen_pembelajaran.asesmen_proses') next.asesmen_pembelajaran.asesmen_proses = value
    if (path === 'asesmen_pembelajaran.asesmen_akhir') next.asesmen_pembelajaran.asesmen_akhir = value
    return next
  })
}

function updateArray(setContent: Dispatch<SetStateAction<RppmContent>>, path: ArrayPath, value: string[]) {
  setContent(prev => {
    const next = structuredClone(prev)
    if (path === 'identifikasi.dimensi_profil_lulusan') next.identifikasi.dimensi_profil_lulusan = value
    if (path === 'identifikasi.topik_panca_cinta') next.identifikasi.topik_panca_cinta = value
    if (path === 'pengalaman_belajar.kegiatan_awal') next.pengalaman_belajar.kegiatan_awal = value
    if (path === 'pengalaman_belajar.kegiatan_inti.memahami') next.pengalaman_belajar.kegiatan_inti.memahami = value
    if (path === 'pengalaman_belajar.kegiatan_inti.mengaplikasi') next.pengalaman_belajar.kegiatan_inti.mengaplikasi = value
    if (path === 'pengalaman_belajar.kegiatan_inti.merefleksi') next.pengalaman_belajar.kegiatan_inti.merefleksi = value
    if (path === 'pengalaman_belajar.kegiatan_penutup') next.pengalaman_belajar.kegiatan_penutup = value
    return next
  })
}

type KerangkaParts = {
  metode: string
  kemitraan: string
  lingkungan: string
  digital: string
}

function applyTemplateDefaults(setContent: Dispatch<SetStateAction<RppmContent>>, templateType: RppmTemplateType) {
  setContent(prev => ({
    ...prev,
    desain_pembelajaran: {
      ...prev.desain_pembelajaran,
      kerangka_pembelajaran: prev.desain_pembelajaran.kerangka_pembelajaran.trim() || defaultKerangkaText(templateType, prev.spesifikasi),
    },
    pengalaman_belajar: {
      kegiatan_awal: prev.pengalaman_belajar.kegiatan_awal.length > 0 ? prev.pengalaman_belajar.kegiatan_awal : defaultKegiatanAwal(),
      kegiatan_inti: {
        memahami: prev.pengalaman_belajar.kegiatan_inti.memahami.length > 0 ? prev.pengalaman_belajar.kegiatan_inti.memahami : getTemplateInti(templateType, 'memahami'),
        mengaplikasi: prev.pengalaman_belajar.kegiatan_inti.mengaplikasi.length > 0 ? prev.pengalaman_belajar.kegiatan_inti.mengaplikasi : getTemplateInti(templateType, 'mengaplikasi'),
        merefleksi: prev.pengalaman_belajar.kegiatan_inti.merefleksi.length > 0 ? prev.pengalaman_belajar.kegiatan_inti.merefleksi : getTemplateInti(templateType, 'merefleksi'),
      },
      kegiatan_penutup: prev.pengalaman_belajar.kegiatan_penutup.length > 0 ? prev.pengalaman_belajar.kegiatan_penutup : defaultKegiatanPenutup(),
    },
    asesmen_pembelajaran: {
      asesmen_proses: prev.asesmen_pembelajaran.asesmen_proses.trim() || defaultAsesmenProses(),
      asesmen_akhir: prev.asesmen_pembelajaran.asesmen_akhir.trim() || defaultAsesmenAkhir(),
    },
  }))
}

function parseKerangka(value: string): KerangkaParts {
  const parts: KerangkaParts = { metode: '', kemitraan: '', lingkungan: '', digital: '' }
  let current: keyof KerangkaParts = 'metode'

  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^praktik pedagogis/i.test(line)) continue

    const matched = matchKerangkaHeading(line)
    if (matched) {
      current = matched.key
      if (matched.value) appendKerangka(parts, current, matched.value)
      continue
    }

    appendKerangka(parts, current, line)
  }

  return parts
}

function matchKerangkaHeading(line: string): { key: keyof KerangkaParts; value: string } | null {
  const normalized = line.toLowerCase()
  const pairs: Array<[keyof KerangkaParts, RegExp]> = [
    ['metode', /^metode\s*:?\s*/i],
    ['kemitraan', /^kemitraan pembelajaran(?:\s*\(opsional\))?\s*:?\s*/i],
    ['lingkungan', /^lingkungan pembelajaran\s*:?\s*/i],
    ['digital', /^pemanfaatan digital(?:\s*\(opsional\))?\s*:?\s*/i],
  ]

  for (const [key, regex] of pairs) {
    if (regex.test(line)) return { key, value: line.replace(regex, '').trim() }
  }
  if (normalized.includes('ruang kelas') || normalized.includes('budaya belajar')) return { key: 'lingkungan', value: line }
  if (normalized.includes('video') || normalized.includes('pencarian informasi') || normalized.includes('produk')) return { key: 'digital', value: line }
  return null
}

function appendKerangka(parts: KerangkaParts, key: keyof KerangkaParts, value: string) {
  const clean = value.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()
  if (!clean) return
  parts[key] = parts[key] ? `${parts[key]}\n${clean}` : clean
}

function buildKerangka(parts: KerangkaParts) {
  return [
    `Metode: ${parts.metode}`,
    'Kemitraan pembelajaran (opsional):',
    parts.kemitraan,
    'Lingkungan Pembelajaran:',
    parts.lingkungan,
    'Pemanfaatan Digital (opsional):',
    parts.digital,
  ].filter(Boolean).join('\n')
}

function defaultKerangkaText(templateType: RppmTemplateType, spec: RppmSpec) {
  const template = RPPM_TEMPLATES.find(item => item.type === templateType) || RPPM_TEMPLATES[0]
  const topic = spec.topik_pembelajaran || 'topik pembelajaran'
  return buildKerangka({
    metode: template.methodText,
    kemitraan: [
      'Kolaborasi guru dengan murid.',
      'Kolaborasi guru dengan wali kelas.',
      'Kolaborasi antarmurid (peer teaching).',
    ].join('\n'),
    lingkungan: [
      'Lingkungan fisik: ruang kelas fleksibel dan kondusif dalam setting kelompok dengan perangkat audio visual.',
      'Ruang virtual: daring jika diperlukan, misalnya Google Meet/Zoom/kelas digital.',
      'Budaya belajar: kolaboratif, interaktif, dan dukungan guru untuk mengaktifkan murid.',
    ].join('\n'),
    digital: [
      `Video/Animasi: guru menggunakan video/animasi tentang ${topic} sebagai stimulus.`,
      `Pencarian Informasi: murid menggunakan browser, Qur'an digital, perpustakaan digital, atau sumber relevan terkait ${topic}.`,
      `Pembuatan Produk: murid memakai PowerPoint/Google Slides, Canva/PosterMyWall, MindMeister/XMind, atau alat digital relevan untuk menyajikan hasil belajar tentang ${topic}.`,
    ].join('\n'),
  })
}

function defaultKegiatanAwal() {
  return [
    'Mengucapkan salam dan mengajak berdoa.',
    'Mengkondisikan murid siap untuk belajar.',
    'Mempresensi dan mengapresiasi kehadiran murid.',
    'Memotivasi murid dengan ice breaking, permainan singkat, atau aktivitas menggembirakan.',
    'Melakukan apersepsi/refleksi awal dengan mengaitkan materi sebelumnya.',
    'Mengajukan pertanyaan pemantik sesuai topik pembelajaran.',
    'Menyampaikan tujuan, kegiatan pembelajaran, dan teknik penilaian.',
  ]
}

function defaultKegiatanPenutup() {
  return [
    'Melakukan penguatan, penarikan kesimpulan, refleksi, dan umpan balik.',
    'Melaksanakan Exit Ticket sebagai asesmen formatif sederhana di akhir pembelajaran.',
    'Murid menjawab satu atau beberapa pertanyaan singkat sebelum meninggalkan kelas.',
    'Guru menyampaikan informasi kegiatan yang akan datang sebagai rencana tindak lanjut.',
    'Guru menutup kegiatan dengan mengajak murid bersyukur, berdoa, dan mengucapkan salam.',
  ]
}

function defaultAsesmenProses() {
  return 'Asesmen untuk perbaikan proses pembelajaran yang berfungsi sebagai umpan balik untuk membantu murid memahami progres belajar mereka serta menjadi bahan refleksi guru dalam mengajar. Bentuk asesmen dapat berupa penilaian sejawat, penilaian diri, observasi, jurnal, pertanyaan diagnostik, dan umpan balik formatif.'
}

function defaultAsesmenAkhir() {
  return 'Asesmen untuk mengukur capaian pembelajaran murid pada akhir pembelajaran. Bentuk asesmen dipilih sesuai topik dan model pembelajaran, misalnya penilaian proyek, produk, portofolio, kinerja, tes tertulis, atau tes lisan.'
}

function getTemplateInti(templateType: RppmTemplateType, key: keyof RppmContent['pengalaman_belajar']['kegiatan_inti']) {
  const template = RPPM_TEMPLATES.find(item => item.type === templateType) || RPPM_TEMPLATES[0]
  return [...template.intiHints[key]]
}

function matchesOption(value: string, option: string) {
  const a = normalizeOption(value)
  const b = normalizeOption(option)
  const code = b.match(/^(dpl|topik)(\d+)/)?.[0]
  return a === b || Boolean(code && a.startsWith(code))
}

function normalizeOption(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
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
