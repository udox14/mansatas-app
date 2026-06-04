'use client'

import { useState, useTransition } from 'react'
import { Landmark, Loader2, Plus, QrCode, Save, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KomitePaymentAccount, KomitePaymentSettings } from '@/lib/komite-payment-settings'
import { saveKomitePaymentSettings, uploadKomiteQrisAction } from './actions'

function createAccount(): KomitePaymentAccount {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rekening-${Date.now()}`
  return { id, bankLabel: '', rekening: '', atasNama: '', isActive: true }
}

export function PengaturanKomiteClient({ initialSettings }: { initialSettings: KomitePaymentSettings }) {
  const [accounts, setAccounts] = useState<KomitePaymentAccount[]>(
    initialSettings.accounts.length > 0 ? initialSettings.accounts : [createAccount()]
  )
  const [whatsapp, setWhatsapp] = useState(initialSettings.whatsapp)
  const [qrisUrl, setQrisUrl] = useState(initialSettings.qrisUrl)
  const [qrisEnabled, setQrisEnabled] = useState(initialSettings.qrisEnabled)
  const [msg, setMsg] = useState('')
  const [qrisMsg, setQrisMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  const updateAccount = (id: string, patch: Partial<KomitePaymentAccount>) => {
    setAccounts((prev) => prev.map((account) => account.id === id ? { ...account, ...patch } : account))
  }

  const removeAccount = (id: string) => {
    setAccounts((prev) => prev.length === 1 ? prev : prev.filter((account) => account.id !== id))
  }

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
      if (res.url) setQrisUrl(res.url)
      setQrisMsg(res.error ?? res.success ?? '')
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form action={handleSave} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Rekening Pembayaran</h2>
              <p className="text-xs text-slate-500">Rekening aktif akan tampil di wizard pembayaran DSPT Portal Orang Tua.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setAccounts((prev) => [...prev, createAccount()])}>
            <Plus className="h-3.5 w-3.5" />
            Tambah Rekening
          </Button>
        </div>

        <div className="space-y-3">
          {accounts.map((account, index) => (
            <div key={account.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <input type="hidden" name="accountId" value={account.id} />
              {account.isActive && <input type="hidden" name="activeAccountIds" value={account.id} />}
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rekening {index + 1}</p>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={account.isActive}
                      onChange={(event) => updateAccount(account.id, { isActive: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Aktif
                  </label>
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600" disabled={accounts.length === 1} onClick={() => removeAccount(account.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama bank/label</Label>
                  <Input name="bankLabel" value={account.bankLabel} onChange={(event) => updateAccount(account.id, { bankLabel: event.target.value })} className="h-9" placeholder="BJB Syariah" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nomor rekening</Label>
                  <Input name="rekening" value={account.rekening} onChange={(event) => updateAccount(account.id, { rekening: event.target.value })} className="h-9" placeholder="5160..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Atas nama</Label>
                  <Input name="atasNama" value={account.atasNama} onChange={(event) => updateAccount(account.id, { atasNama: event.target.value })} className="h-9" placeholder="Komite MAN 1 Tasikmalaya" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-xs">Nomor WhatsApp komite</Label>
            <Input id="whatsapp" name="whatsapp" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className="h-9" placeholder="628..." />
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <Label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={qrisEnabled} onChange={(event) => setQrisEnabled(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Tampilkan QRIS di Portal Orang Tua
            </Label>
            <input type="hidden" name="qrisEnabled" value={qrisEnabled ? '1' : '0'} />
            <p className="mt-1 text-xs text-slate-500">Jika dimatikan, pilihan QRIS tidak muncul di portal.</p>
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
            Simpan Pengaturan
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
            <p className="text-xs text-slate-500">{qrisEnabled ? 'QRIS aktif di portal orang tua.' : 'QRIS sedang disembunyikan dari portal.'}</p>
          </div>
        </div>

        <div className={`rounded-lg border p-3 ${qrisEnabled ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950' : 'border-dashed border-slate-300 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-950'}`}>
          <img src={qrisUrl} alt="QR code komite" className="mx-auto max-h-72 w-full rounded-md bg-white object-contain" />
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
