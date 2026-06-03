'use client'

import { useState, useTransition } from 'react'
import { Landmark, Loader2, QrCode, Save, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveKomitePaymentSettings, uploadKomiteQrisAction } from './actions'

type KomitePaymentSettings = {
  bankLabel: string
  rekening: string
  atasNama: string
  whatsapp: string
  qrisUrl: string
}

export function PengaturanKomiteClient({ initialSettings }: { initialSettings: KomitePaymentSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [msg, setMsg] = useState('')
  const [qrisMsg, setQrisMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSave = (formData: FormData) => {
    setMsg('')
    startTransition(async () => {
      const res = await saveKomitePaymentSettings(formData)
      setMsg(res.error ?? res.success ?? '')
    })
  }

  const handleQrisUpload = (formData: FormData) => {
    setQrisMsg('')
    startTransition(async () => {
      const res = await uploadKomiteQrisAction(formData)
      if (res.url) setSettings((prev) => ({ ...prev, qrisUrl: res.url! }))
      setQrisMsg(res.error ?? res.success ?? '')
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={handleSave} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-md bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Rekening Pembayaran</h2>
            <p className="text-xs text-slate-500">Data ini tampil di wizard pembayaran DSPT Portal Orang Tua.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bankLabel" className="text-xs">Nama bank/label</Label>
            <Input id="bankLabel" name="bankLabel" defaultValue={settings.bankLabel} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rekening" className="text-xs">Nomor rekening</Label>
            <Input id="rekening" name="rekening" defaultValue={settings.rekening} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atasNama" className="text-xs">Atas nama</Label>
            <Input id="atasNama" name="atasNama" defaultValue={settings.atasNama} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-xs">Nomor WhatsApp komite</Label>
            <Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsapp} className="h-9" placeholder="628..." />
          </div>
        </div>

        {msg && (
          <p className={`mt-4 rounded-md px-3 py-2 text-xs ${msg.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {msg}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Simpan
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-md bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">QR Code</h2>
            <p className="text-xs text-slate-500">QRIS yang tampil di portal orang tua.</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <img src={settings.qrisUrl} alt="QR code komite" className="mx-auto max-h-72 w-full rounded-md bg-white object-contain" />
        </div>

        <form action={handleQrisUpload} className="mt-4 space-y-3">
          <Input name="qris" type="file" accept="image/*" className="h-9 text-xs" />
          <Button type="submit" variant="outline" size="sm" className="h-9 w-full gap-1.5" disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            Upload QR Code
          </Button>
          {qrisMsg && (
            <p className={`rounded-md px-3 py-2 text-xs ${qrisMsg.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {qrisMsg}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
