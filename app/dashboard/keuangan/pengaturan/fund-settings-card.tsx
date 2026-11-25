'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { FundSourceSelect } from '@/components/dashboard/komite-fund-fields'
import { komiteFundLabel } from '@/lib/komite-funds'
import { saveKomiteFundOpeningBalance, saveKomiteFundSetting } from './actions'

export function FundSettingsCard({
  years,
  overdrafts,
  canUpdate,
}: {
  years: number[]
  overdrafts: { source: string; allow_negative: number }[]
  canUpdate: boolean
}) {
  const [settings, setSettings] = useState(() => Object.fromEntries(overdrafts.map(row => [row.source, Boolean(row.allow_negative)])))
  const [openingAmount, setOpeningAmount] = useState('')
  const [message, setMessage] = useState('')
  const [pending, start] = useTransition()

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Kebijakan Saldo & Saldo Awal per Sumber Dana</CardTitle>
        <CardDescription>
          Secara default, pencairan SPB atau pengeluaran ditahan ketika saldo kas sumber dana kurang. Anda juga dapat mencatat saldo awal bulanan per angkatan/dana umum di bawah ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2.5">
          <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300">Izin Saldo Minus per Sumber Dana</legend>
          <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {['general', ...years.map(String)].map(source => (
              <div key={source} className="flex items-center gap-2">
                <Checkbox
                  id={`allow-negative-${source}`}
                  checked={settings[source] ?? false}
                  disabled={!canUpdate || pending}
                  onCheckedChange={value => {
                    const allowed = value === true
                    start(async () => {
                      const result = await saveKomiteFundSetting(source, allowed)
                      if (result.success) setSettings(current => ({ ...current, [source]: allowed }))
                      setMessage(result.error ?? result.success ?? '')
                    })
                  }}
                />
                <Label htmlFor={`allow-negative-${source}`} className="text-sm font-normal">
                  Izinkan saldo minus · {komiteFundLabel(source)}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        {canUpdate && (
          <form
            className="grid items-end gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
            action={data =>
              start(async () => {
                const result = await saveKomiteFundOpeningBalance(data)
                setMessage(result.error ?? result.success ?? '')
              })
            }
          >
            <div className="space-y-1.5">
              <Label htmlFor="opening-fund" className="text-xs">Sumber dana</Label>
              <FundSourceSelect id="opening-fund" name="fund" required years={years} includeUnmapped />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening-period" className="text-xs">Periode bulan</Label>
              <Input id="opening-period" name="period" required type="month" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening-amount" className="text-xs">Saldo awal bulan</Label>
              <RupiahInput id="opening-amount" name="amount" allowNegative required value={openingAmount} onValueChange={raw => setOpeningAmount(raw)} placeholder="0" />
            </div>
            <Button disabled={pending}>Simpan Saldo Awal</Button>
          </form>
        )}
        {message && <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{message}</p>}
      </CardContent>
    </Card>
  )
}
