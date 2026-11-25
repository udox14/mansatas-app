'use client'

import { useState, useTransition } from 'react'
import { FileText, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KomiteReportSettings, OpeningBalanceMode, ProofNumberMode } from '@/lib/komite-report-settings'
import { saveKomiteReportSettings } from './actions'

export function ReportSettingsCard({
  initialSettings,
  latestBalance,
}: {
  initialSettings: KomiteReportSettings
  latestBalance?: { period: string; amount: number; note: string | null }
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [period, setPeriod] = useState(latestBalance?.period || new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState(String(latestBalance?.amount ?? 0))
  const [note, setNote] = useState(latestBalance?.note || '')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function save() {
    setMessage('')
    startTransition(async () => {
      const result = await saveKomiteReportSettings({
        ...settings,
        storedPeriod: period,
        storedAmount: Number(amount || 0),
        storedNote: note,
      })
      setMessage(result.error ?? result.success ?? '')
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <FileText className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Format Laporan Keuangan Bulanan / BKU</h2>
          <p className="text-xs text-slate-500">Atur metode saldo awal bawaan, penomoran bukti kas, dan nama pejabat penandatangan laporan BKU.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Metode saldo awal bawaan">
          <Select value={settings.openingBalanceMode} onValueChange={v => setSettings(s => ({ ...s, openingBalanceMode: v as OpeningBalanceMode }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cumulative">Kumulatif otomatis sebelum bulan</SelectItem>
              <SelectItem value="manual">Input manual saat unduh BKU</SelectItem>
              <SelectItem value="stored">Saldo bulanan tersimpan</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Mode nomor bukti kas">
          <Select value={settings.proofNumberMode} onValueChange={v => setSettings(s => ({ ...s, proofNumberMode: v as ProofNumberMode }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="automatic">Otomatis KM/KK</SelectItem>
              <SelectItem value="manual">Manual wajib</SelectItem>
              <SelectItem value="source_first">Nomor sumber, lalu otomatis</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <label className="flex h-9 items-center gap-2 self-end rounded-md border px-3 text-sm">
          <input type="checkbox" checked={settings.signaturesEnabled} onChange={e => setSettings(s => ({ ...s, signaturesEnabled: e.target.checked }))} />
          Tampilkan tiga tanda tangan
        </label>
        <Field label="Bendahara Komite">
          <Input value={settings.treasurerName} onChange={e => setSettings(s => ({ ...s, treasurerName: e.target.value }))} />
        </Field>
        <Field label="Ketua Komite">
          <Input value={settings.chairmanName} onChange={e => setSettings(s => ({ ...s, chairmanName: e.target.value }))} />
        </Field>
        <Field label="Kepala Madrasah">
          <Input value={settings.principalName} onChange={e => setSettings(s => ({ ...s, principalName: e.target.value }))} />
        </Field>
      </div>

      {settings.openingBalanceMode === 'stored' && (
        <fieldset className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
          <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo Awal Bulanan Gabungan Tersimpan</legend>
          <div className="mt-2 grid gap-3 md:grid-cols-[180px_220px_1fr]">
            <Field label="Periode">
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </Field>
            <Field label="Nominal (boleh negatif)">
              <RupiahInput allowNegative value={amount} onValueChange={raw => setAmount(raw)} placeholder="0" />
            </Field>
            <Field label="Catatan audit">
              <Input maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Opsional" />
            </Field>
          </div>
        </fieldset>
      )}

      {message && (
        <p className={`mt-3 rounded-md px-3 py-2 text-xs ${message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pengaturan Laporan
        </Button>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  )
}
