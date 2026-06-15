'use client'

import * as React from 'react'
import { Settings, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveWhatsappSettingsAction } from '../actions'

type SettingsModalProps = {
  currentConfig: {
    provider: string
    phoneNumberId: string
    kirimdevApiKey: string
    kirimdevWebhookSecret: string
  }
}

export function SettingsModal({ currentConfig }: SettingsModalProps) {
  const [open, setOpen] = React.useState(false)
  const [state, action, isPending] = React.useActionState(saveWhatsappSettingsAction, null)

  React.useEffect(() => {
    if (state?.success) {
      setOpen(false)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Settings className="h-4 w-4" />
          Pengaturan API
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pengaturan WhatsApp API</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="provider" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Provider WhatsApp
            </Label>
            <select
              id="provider"
              name="provider"
              defaultValue={currentConfig.provider}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="kirimdev">Kirimdev (Official Meta API)</option>
              <option value="meta">Meta Cloud API (Langsung)</option>
              <option value="wablas">Wablas (Unofficial API)</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone_number_id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              WhatsApp Phone Number ID
            </Label>
            <Input
              id="phone_number_id"
              name="phone_number_id"
              placeholder="Contoh: 106540352242922"
              defaultValue={currentConfig.phoneNumberId}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="kirimdev_api_key" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kirimdev API Key / Meta Access Token
            </Label>
            <Input
              id="kirimdev_api_key"
              name="kirimdev_api_key"
              type="password"
              placeholder="kdv_live_..."
              defaultValue={currentConfig.kirimdevApiKey}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="kirimdev_webhook_secret" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kirimdev Webhook Secret / Meta App Secret
            </Label>
            <Input
              id="kirimdev_webhook_secret"
              name="kirimdev_webhook_secret"
              type="password"
              placeholder="whsec_..."
              defaultValue={currentConfig.kirimdevWebhookSecret}
              className="h-9 text-sm"
            />
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800 space-y-1">
            <Label htmlFor="password" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Password Konfirmasi (Diperlukan)
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Masukkan password admin/konfirmasi"
              className="h-9 text-sm border-rose-200 dark:border-rose-900 focus-visible:ring-rose-500"
            />
          </div>

          {state?.error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-800">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
