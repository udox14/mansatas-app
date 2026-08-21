'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Eye, RotateCcw, Save, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  resetAutomaticNotificationSetting,
  saveAutomaticNotificationSetting,
  sendAutomaticNotificationTest,
} from '../actions'
import type { NotificationChannel, NotificationEventDefinition, NotificationReminderConfig, NotificationTargetConfig } from '@/lib/notification-catalog'

type SettingRow = {
  event_key: string
  enabled: number
  title_template: string
  body_template: string
  url_template: string
  channels_json: string
  target_json: string
  reminder_json: string
  level: string
}

type Draft = {
  enabled: boolean
  titleTemplate: string
  bodyTemplate: string
  urlTemplate: string
  channels: NotificationChannel[]
  target: NotificationTargetConfig
  reminder: NotificationReminderConfig
  level: string
}

type Props = {
  definitions: NotificationEventDefinition[]
  settings: SettingRow[]
}

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'fcm', label: 'FCM / Android' },
  { value: 'webpush', label: 'Web Push / PWA' },
  { value: 'in_app', label: 'In-app portal' },
]

const TARGETS: { value: NotificationTargetConfig['kind']; label: string }[] = [
  { value: 'staff_role', label: 'Pegawai berdasarkan role' },
  { value: 'staff_all', label: 'Semua pegawai' },
  { value: 'staff_users', label: 'Pegawai dari konteks event' },
  { value: 'parent_student', label: 'Orang tua siswa terkait' },
  { value: 'parent_students', label: 'Orang tua dari daftar siswa event' },
  { value: 'parent_class', label: 'Orang tua berdasarkan kelas' },
  { value: 'parent_grade', label: 'Orang tua berdasarkan tingkat' },
  { value: 'parents_all', label: 'Semua orang tua' },
]

const GROUP_LABEL: Record<NotificationEventDefinition['group'], string> = {
  keuangan: 'Keuangan',
  orang_tua: 'Orang tua',
  kesiswaan: 'Kesiswaan',
  akademik: 'Akademik',
  agenda: 'Agenda',
  administrasi: 'Administrasi',
}

const SAMPLE_VALUES: Record<string, string> = {
  nama_siswa: 'Ahmad Fauzan',
  kelas: 'XII IPA 1',
  tanggal: '21 Agustus 2026',
  alasan: 'Keperluan keluarga',
  catatan: 'Mohon diperhatikan',
  nominal: 'Rp1.000.000',
  nomor_kuitansi: 'KWT-2026-0001',
  judul: 'Pengumuman penting',
  isi_pengumuman: 'Isi pengumuman contoh.',
  nama_guru: 'Bapak/Ibu Guru',
  waktu: '08.00',
  tempat: 'Ruang Rapat',
  agenda: 'Rapat koordinasi',
  nama_pelanggaran: 'Terlambat masuk kelas',
  level_sanksi: 'Teguran',
  nomor_surat: 'SP/2026/0001',
  jumlah_sesi: '2',
  status: 'belum selesai',
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  try {
    const parsed = JSON.parse(value || '')
    return parsed as T
  } catch {
    return fallback
  }
}

function draftFrom(definition: NotificationEventDefinition, setting?: SettingRow): Draft {
  const channels = parseJson<NotificationChannel[]>(setting?.channels_json, definition.defaultChannels)
  const target = parseJson<NotificationTargetConfig>(setting?.target_json, definition.defaultTarget)
  const reminder = parseJson<NotificationReminderConfig>(setting?.reminder_json, definition.reminder)
  return {
    enabled: setting ? Number(setting.enabled) === 1 : definition.defaultEnabled,
    titleTemplate: setting?.title_template || definition.defaultTitle,
    bodyTemplate: setting?.body_template || definition.defaultBody,
    urlTemplate: setting?.url_template || definition.defaultUrl,
    channels: channels.filter((channel) => CHANNELS.some((item) => item.value === channel)),
    target: target?.kind ? target : definition.defaultTarget,
    reminder: { ...definition.reminder, ...reminder },
    level: setting?.level || definition.defaultLevel,
  }
}

function renderPreview(value: string) {
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => SAMPLE_VALUES[key] || `{${key}}`)
}

function targetValue(target: NotificationTargetConfig) {
  return target.kind
}

export function AutomaticNotificationSettings({ definitions, settings }: Props) {
  const settingsByKey = useMemo(() => new Map(settings.map((setting) => [setting.event_key, setting])), [settings])
  const initialDrafts = useMemo(() => Object.fromEntries(
    definitions.map((definition) => [definition.key, draftFrom(definition, settingsByKey.get(definition.key))]),
  ) as Record<string, Draft>, [definitions, settingsByKey])
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts)
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const updateDraft = (key: string, update: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...update } }))
  }

  const save = (definition: NotificationEventDefinition) => {
    const draft = drafts[definition.key]
    startTransition(async () => {
      const result = await saveAutomaticNotificationSetting({ eventKey: definition.key, ...draft })
      setFeedback((current) => ({ ...current, [definition.key]: result.error || 'Tersimpan.' }))
    })
  }

  const reset = (definition: NotificationEventDefinition) => {
    startTransition(async () => {
      const result = await resetAutomaticNotificationSetting(definition.key)
      if (!result.error) {
        updateDraft(definition.key, draftFrom(definition))
      }
      setFeedback((current) => ({ ...current, [definition.key]: result.error || 'Dikembalikan ke default.' }))
    })
  }

  const test = (definition: NotificationEventDefinition) => {
    startTransition(async () => {
      const result = await sendAutomaticNotificationTest(definition.key)
      setFeedback((current) => ({ ...current, [definition.key]: result.error || result.success || 'Tes selesai.' }))
    })
  }

  const grouped = definitions.reduce<Record<string, NotificationEventDefinition[]>>((result, definition) => {
    const key = definition.group
    result[key] ||= []
    result[key].push(definition)
    return result
  }, {})

  return (
    <section className="rounded-2xl border border-surface bg-surface p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Notifikasi Otomatis</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Atur redaksi, penerima, channel, dan reminder per event tanpa deploy ulang. Event sensitif dimulai nonaktif.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {definitions.length} event tersedia
        </span>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([group, groupDefinitions]) => (
          <div key={group} className="space-y-2">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{GROUP_LABEL[group as NotificationEventDefinition['group']]}</p>
            {groupDefinitions.map((definition) => {
              const draft = drafts[definition.key] || draftFrom(definition, settingsByKey.get(definition.key))
              const feedbackText = feedback[definition.key]
              return (
                <details key={definition.key} open={definition.defaultEnabled} className="group rounded-xl border border-surface-2 bg-surface-2/20">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <input
                      type="checkbox"
                      aria-label={`Aktifkan ${definition.label}`}
                      checked={draft.enabled}
                      onChange={(event) => updateDraft(definition.key, { enabled: event.target.checked })}
                      onClick={(event) => event.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{definition.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{definition.description}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${draft.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {draft.enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </summary>

                  <div className="grid gap-4 border-t border-surface-2 px-4 py-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">Judul</span>
                        <Input value={draft.titleTemplate} onChange={(event) => updateDraft(definition.key, { titleTemplate: event.target.value })} maxLength={160} className="h-9 text-sm" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">Isi</span>
                        <Textarea value={draft.bodyTemplate} onChange={(event) => updateDraft(definition.key, { bodyTemplate: event.target.value })} maxLength={2000} rows={4} className="resize-y text-sm" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">URL tujuan</span>
                        <Input value={draft.urlTemplate} onChange={(event) => updateDraft(definition.key, { urlTemplate: event.target.value })} placeholder="/portal-ortu" className="h-9 text-sm" />
                      </label>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500">Placeholder yang tersedia</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {definition.placeholders.map((placeholder) => <code key={placeholder} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{'{' + placeholder + '}'}</code>)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500">Channel</span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                          {CHANNELS.map((channel) => (
                            <label key={channel.value} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={draft.channels.includes(channel.value)}
                                onChange={(event) => updateDraft(definition.key, { channels: event.target.checked ? [...draft.channels, channel.value] : draft.channels.filter((item) => item !== channel.value) })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {channel.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                        <label className="block space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500">Penerima default</span>
                          <select
                            value={targetValue(draft.target)}
                            onChange={(event) => updateDraft(definition.key, { target: { ...draft.target, kind: event.target.value as NotificationTargetConfig['kind'] } })}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                          >
                            {TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[11px] font-semibold text-slate-500">Role / ID target</span>
                          <Input
                            value={draft.target.value == null ? '' : String(draft.target.value)}
                            onChange={(event) => updateDraft(definition.key, { target: { ...draft.target, value: event.target.value || null } })}
                            placeholder={draft.target.kind === 'staff_role' ? 'mis. guru' : 'opsional'}
                            className="h-9 text-xs"
                          />
                        </label>
                      </div>

                      <div className="rounded-lg border border-surface-2 p-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input type="checkbox" checked={draft.reminder.enabled} onChange={(event) => updateDraft(definition.key, { reminder: { ...draft.reminder, enabled: event.target.checked } })} className="h-4 w-4 rounded border-slate-300" />
                          Kirim sebagai reminder berkala
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="space-y-1"><span className="text-[10px] text-slate-500">Lead (menit)</span><Input type="number" min={0} value={draft.reminder.leadMinutes} onChange={(event) => updateDraft(definition.key, { reminder: { ...draft.reminder, leadMinutes: Number(event.target.value) } })} className="h-8 text-xs" /></label>
                          <label className="space-y-1"><span className="text-[10px] text-slate-500">Frekuensi (menit)</span><Input type="number" min={5} value={draft.reminder.frequencyMinutes} onChange={(event) => updateDraft(definition.key, { reminder: { ...draft.reminder, frequencyMinutes: Number(event.target.value) } })} className="h-8 text-xs" /></label>
                        </div>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500">Level</span>
                        <select value={draft.level} onChange={(event) => updateDraft(definition.key, { level: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
                          <option value="info">Info</option>
                          <option value="warning">Peringatan</option>
                          <option value="critical">Penting</option>
                        </select>
                      </label>

                      {previewKey === definition.key && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/30">
                          <p className="font-bold text-blue-800 dark:text-blue-200">{renderPreview(draft.titleTemplate)}</p>
                          <p className="mt-1 text-blue-700 dark:text-blue-300">{renderPreview(draft.bodyTemplate)}</p>
                          <p className="mt-2 font-mono text-[10px] text-blue-600 dark:text-blue-400">{renderPreview(draft.urlTemplate)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-surface-2 pt-3 lg:col-span-2 sm:flex-row sm:items-center">
                      <Button type="button" size="sm" onClick={() => save(definition)} disabled={pending} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><Save className="h-3.5 w-3.5" /> Simpan</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setPreviewKey(previewKey === definition.key ? null : definition.key)} className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Preview</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => test(definition)} disabled={pending} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Kirim tes ke saya</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => reset(definition)} disabled={pending} className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Reset default</Button>
                      {feedbackText && <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${feedbackText.includes('Placeholder') || feedbackText.includes('gagal') || feedbackText.includes('nonaktif') ? 'text-red-600' : 'text-emerald-600'}`}><Check className="h-3.5 w-3.5" />{feedbackText}</span>}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
