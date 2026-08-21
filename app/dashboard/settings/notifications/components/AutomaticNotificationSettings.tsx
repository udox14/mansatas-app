'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Eye, RotateCcw, Save, Send, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

type Feedback = {
  message: string
  type: 'success' | 'error'
}

const CHANNELS: { value: NotificationChannel; label: string; shortLabel: string }[] = [
  { value: 'fcm', label: 'FCM / Android', shortLabel: 'FCM' },
  { value: 'webpush', label: 'Web Push / PWA', shortLabel: 'Web Push' },
  { value: 'in_app', label: 'In-app portal', shortLabel: 'In-app' },
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

function getTargetLabel(target: NotificationTargetConfig) {
  const label = TARGETS.find((item) => item.value === target.kind)?.label || target.kind
  return target.value ? `${label} · ${String(target.value)}` : label
}

function getChannelLabels(channels: NotificationChannel[]) {
  return channels
    .map((channel) => CHANNELS.find((item) => item.value === channel)?.shortLabel)
    .filter(Boolean)
    .join(' + ') || '—'
}

export function AutomaticNotificationSettings({ definitions, settings }: Props) {
  const settingsByKey = useMemo(() => new Map(settings.map((setting) => [setting.event_key, setting])), [settings])
  const initialDrafts = useMemo(() => Object.fromEntries(
    definitions.map((definition) => [definition.key, draftFrom(definition, settingsByKey.get(definition.key))]),
  ) as Record<string, Draft>, [definitions, settingsByKey])
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({})
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | NotificationEventDefinition['group']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [pending, startTransition] = useTransition()

  const selectedDefinition = definitions.find((definition) => definition.key === selectedKey) || null
  const selectedDraft = selectedDefinition ? drafts[selectedDefinition.key] : null

  const filteredDefinitions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return definitions.filter((definition) => {
      const draft = drafts[definition.key] || draftFrom(definition, settingsByKey.get(definition.key))
      const matchesSearch = !query || [
        definition.label,
        definition.description,
        GROUP_LABEL[definition.group],
      ].some((value) => value.toLowerCase().includes(query))
      const matchesGroup = groupFilter === 'all' || definition.group === groupFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'enabled' && draft.enabled)
        || (statusFilter === 'disabled' && !draft.enabled)
      return matchesSearch && matchesGroup && matchesStatus
    })
  }, [definitions, drafts, groupFilter, search, settingsByKey, statusFilter])

  const updateDraft = (key: string, update: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], ...update },
    }))
  }

  const setFeedbackFor = (key: string, result: { error?: string; success?: string | boolean }, fallback: string) => {
    setFeedback((current) => ({
      ...current,
      [key]: result.error
        ? { message: result.error, type: 'error' }
        : { message: typeof result.success === 'string' ? result.success : fallback, type: 'success' },
    }))
  }

  const save = (definition: NotificationEventDefinition) => {
    const draft = drafts[definition.key]
    if (!draft) return

    startTransition(async () => {
      const result = await saveAutomaticNotificationSetting({ eventKey: definition.key, ...draft })
      setFeedbackFor(definition.key, result, 'Tersimpan.')
    })
  }

  const reset = (definition: NotificationEventDefinition) => {
    startTransition(async () => {
      const result = await resetAutomaticNotificationSetting(definition.key)
      if (!result.error) {
        updateDraft(definition.key, draftFrom(definition))
        setPreviewKey(null)
      }
      setFeedbackFor(definition.key, result, 'Dikembalikan ke default.')
    })
  }

  const test = (definition: NotificationEventDefinition) => {
    startTransition(async () => {
      const result = await sendAutomaticNotificationTest(definition.key)
      setFeedbackFor(definition.key, result, 'Tes selesai.')
    })
  }

  return (
    <>
      <Card className="border-surface shadow-none">
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Notifikasi Otomatis
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                Atur redaksi, penerima, channel, dan reminder per event tanpa deploy ulang. Event sensitif dimulai nonaktif.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {definitions.length} event tersedia
            </Badge>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_190px_150px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari event notifikasi..."
              className="h-9 text-sm"
              aria-label="Cari event notifikasi"
            />
            <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as typeof groupFilter)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {Object.entries(GROUP_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="enabled">Aktif saja</SelectItem>
                <SelectItem value="disabled">Nonaktif saja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[270px]">Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="min-w-[220px]">Penerima</TableHead>
                <TableHead>Reminder</TableHead>
                <TableHead className="w-[90px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDefinitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Tidak ada event yang sesuai filter.
                  </TableCell>
                </TableRow>
              ) : filteredDefinitions.map((definition) => {
                const draft = drafts[definition.key] || draftFrom(definition, settingsByKey.get(definition.key))
                return (
                  <TableRow key={definition.key}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] font-medium">{GROUP_LABEL[definition.group]}</Badge>
                        <p className="font-medium leading-5">{definition.label}</p>
                        <p className="max-w-[360px] text-xs leading-4 text-muted-foreground">{definition.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={draft.enabled ? 'default' : 'secondary'}
                        className={draft.enabled ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                      >
                        {draft.enabled ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">{getChannelLabels(draft.channels)}</TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">{getTargetLabel(draft.target)}</TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {draft.reminder.enabled ? `${draft.reminder.frequencyMinutes} menit` : 'Nonaktif'}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedKey(definition.key)}>
                        Atur
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(selectedDefinition)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedKey(null)
            setPreviewKey(null)
          }
        }}
      >
        <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {selectedDefinition && selectedDraft && (
            <>
              <SheetHeader className="shrink-0 border-b px-6 py-5 text-left">
                <SheetTitle>{selectedDefinition.label}</SheetTitle>
                <SheetDescription>{selectedDefinition.description}</SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-5">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">Status event</p>
                      <p className="text-xs text-muted-foreground">Event aktif akan diproses sesuai action dan cron yang tersedia.</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={selectedDraft.enabled}
                        onCheckedChange={(checked) => updateDraft(selectedDefinition.key, { enabled: checked === true })}
                        aria-label={`Aktifkan ${selectedDefinition.label}`}
                      />
                      Aktif
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="notification-title">Judul</Label>
                      <Input
                        id="notification-title"
                        value={selectedDraft.titleTemplate}
                        onChange={(event) => updateDraft(selectedDefinition.key, { titleTemplate: event.target.value })}
                        maxLength={160}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notification-body">Isi</Label>
                      <Textarea
                        id="notification-body"
                        value={selectedDraft.bodyTemplate}
                        onChange={(event) => updateDraft(selectedDefinition.key, { bodyTemplate: event.target.value })}
                        maxLength={2000}
                        rows={5}
                        className="resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notification-url">URL tujuan</Label>
                      <Input
                        id="notification-url"
                        value={selectedDraft.urlTemplate}
                        onChange={(event) => updateDraft(selectedDefinition.key, { urlTemplate: event.target.value })}
                        placeholder="/portal-ortu"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Placeholder tersedia</Label>
                    <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/20 p-3">
                      {selectedDefinition.placeholders.map((placeholder) => (
                        <code key={placeholder} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {'{' + placeholder + '}' }
                        </code>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <Label>Channel</Label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {CHANNELS.map((channel) => (
                        <label key={channel.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedDraft.channels.includes(channel.value)}
                            onCheckedChange={(checked) => updateDraft(selectedDefinition.key, {
                              channels: checked === true
                                ? [...selectedDraft.channels, channel.value]
                                : selectedDraft.channels.filter((item) => item !== channel.value),
                            })}
                          />
                          {channel.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="space-y-2">
                      <Label>Penerima default</Label>
                      <Select
                        value={selectedDraft.target.kind}
                        onValueChange={(value) => updateDraft(selectedDefinition.key, {
                          target: { ...selectedDraft.target, kind: value as NotificationTargetConfig['kind'] },
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TARGETS.map((target) => <SelectItem key={target.value} value={target.value}>{target.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notification-target-value">Role / ID target</Label>
                      <Input
                        id="notification-target-value"
                        value={selectedDraft.target.value == null ? '' : String(selectedDraft.target.value)}
                        onChange={(event) => updateDraft(selectedDefinition.key, {
                          target: { ...selectedDraft.target, value: event.target.value || null },
                        })}
                        placeholder={selectedDraft.target.kind === 'staff_role' ? 'mis. guru' : 'opsional'}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={selectedDraft.reminder.enabled}
                        onCheckedChange={(checked) => updateDraft(selectedDefinition.key, {
                          reminder: { ...selectedDraft.reminder, enabled: checked === true },
                        })}
                      />
                      Kirim sebagai reminder berkala
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="notification-lead">Lead (menit)</Label>
                        <Input
                          id="notification-lead"
                          type="number"
                          min={0}
                          value={selectedDraft.reminder.leadMinutes}
                          onChange={(event) => updateDraft(selectedDefinition.key, {
                            reminder: { ...selectedDraft.reminder, leadMinutes: Number(event.target.value) },
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notification-frequency">Frekuensi (menit)</Label>
                        <Input
                          id="notification-frequency"
                          type="number"
                          min={5}
                          value={selectedDraft.reminder.frequencyMinutes}
                          onChange={(event) => updateDraft(selectedDefinition.key, {
                            reminder: { ...selectedDraft.reminder, frequencyMinutes: Number(event.target.value) },
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={selectedDraft.level} onValueChange={(value) => updateDraft(selectedDefinition.key, { level: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Peringatan</SelectItem>
                        <SelectItem value="critical">Penting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {previewKey === selectedDefinition.key && (
                    <Card className="border-blue-200 bg-blue-50/60 shadow-none dark:border-blue-900 dark:bg-blue-950/30">
                      <CardContent className="space-y-1.5 p-4 text-sm">
                        <p className="font-semibold text-blue-800 dark:text-blue-200">{renderPreview(selectedDraft.titleTemplate)}</p>
                        <p className="text-blue-700 dark:text-blue-300">{renderPreview(selectedDraft.bodyTemplate)}</p>
                        <p className="font-mono text-xs text-blue-600 dark:text-blue-400">{renderPreview(selectedDraft.urlTemplate)}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              <SheetFooter className="shrink-0 border-t bg-background p-4 sm:p-6">
                <div className="flex w-full flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => save(selectedDefinition)} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <Save className="h-3.5 w-3.5" /> Simpan
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPreviewKey(previewKey === selectedDefinition.key ? null : selectedDefinition.key)}>
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => test(selectedDefinition)} disabled={pending}>
                    <Send className="h-3.5 w-3.5" /> Kirim tes
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => reset(selectedDefinition)} disabled={pending}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  {feedback[selectedDefinition.key] && (
                    <span className={`ml-auto inline-flex items-center gap-1 text-xs ${feedback[selectedDefinition.key].type === 'error' ? 'text-destructive' : 'text-emerald-600'}`}>
                      <Check className="h-3.5 w-3.5" />
                      {feedback[selectedDefinition.key].message}
                    </span>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
