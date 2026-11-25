'use client'

import { useState, useTransition } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DsptEntryMode, DsptPackage } from '@/lib/pmb-contract'
import { saveDsptSettings } from './actions'

export function DsptSettingsCard({
  initial,
}: {
  initial: { mode: DsptEntryMode; defaultAmount: number; packages: DsptPackage[]; allowOverride: boolean }
}) {
  const [mode, setMode] = useState(initial.mode)
  const [defaultAmount, setDefaultAmount] = useState(String(initial.defaultAmount || ''))
  const [packages, setPackages] = useState(initial.packages)
  const [allowOverride, setAllowOverride] = useState(initial.allowOverride)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  const update = (id: string, patch: Partial<DsptPackage>) =>
    setPackages(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)))
  const add = () =>
    setPackages(rows => [...rows, { id: crypto.randomUUID(), label: '', amount: 0, isActive: true, sortOrder: rows.length * 10 + 10 }])
  const remove = (id: string) => update(id, { isActive: false })

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Nominal DSPT Kasir Daftar Ulang</h2>
        <p className="text-xs text-slate-500">Atur cara kasir menentukan target DSPT siswa baru saat proses daftar ulang PMB.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Mode penetapan nominal</Label>
          <Select value={mode} onValueChange={value => setMode(value as DsptEntryMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual per siswa</SelectItem>
              <SelectItem value="default">Nominal default tunggal</SelectItem>
              <SelectItem value="package">Pilihan paket nominal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dspt-default-amount">Nominal default</Label>
          <RupiahInput
            id="dspt-default-amount"
            value={defaultAmount}
            onValueChange={raw => setDefaultAmount(raw)}
            disabled={mode !== 'default'}
            placeholder="0"
          />
        </div>
      </div>

      {mode === 'package' && (
        <div className="mt-4 space-y-2">
          {packages.map(row => (
            <div key={row.id} className={`grid items-center gap-2 rounded-lg border p-2.5 md:grid-cols-[1fr_200px_90px_40px] ${row.isActive ? '' : 'opacity-50'}`}>
              <Input value={row.label} onChange={event => update(row.id, { label: event.target.value })} placeholder="Nama paket" />
              <RupiahInput
                value={row.amount ? String(row.amount) : ''}
                onValueChange={raw => update(row.id, { amount: Number(raw) || 0 })}
                placeholder="Nominal"
              />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={row.isActive} onChange={event => update(row.id, { isActive: event.target.checked })} /> Aktif
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(row.id)} aria-label="Nonaktifkan paket">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="mr-1 h-4 w-4" />Tambah Paket
          </Button>
        </div>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allowOverride} onChange={event => setAllowOverride(event.target.checked)} />
        Kasir boleh mengubah nominal di luar paket/default dengan mencantumkan alasan
      </label>

      {message && (
        <p className={`mt-3 rounded-md px-3 py-2 text-xs ${message.toLowerCase().includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveDsptSettings({ mode, defaultAmount: Number(defaultAmount || 0), packages, allowOverride })
              setMessage(result.error || result.success || '')
            })
          }
        >
          <Save className="mr-1.5 h-4 w-4" />Simpan Pengaturan DSPT
        </Button>
      </div>
    </section>
  )
}
