'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export interface KuitansiPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hrefBase: string
  title?: string
  subtitle?: string
  defaultGoodsReceipt?: boolean
  defaultAttachment?: boolean
}

function KuitansiPrintDialogBody({
  onOpenChange,
  hrefBase,
  title,
  subtitle,
  defaultGoodsReceipt,
  defaultAttachment,
}: Omit<KuitansiPrintDialogProps, 'open'> & {
  title: string
  defaultGoodsReceipt: boolean
  defaultAttachment: boolean
}) {
  const [includeGoodsReceipt, setIncludeGoodsReceipt] = useState(defaultGoodsReceipt)
  const [includeAttachment, setIncludeAttachment] = useState(defaultAttachment)

  const query = new URLSearchParams({
    goodsReceipt: includeGoodsReceipt ? '1' : '0',
    attachment: includeAttachment ? '1' : '0',
  })
  const href = `${hrefBase}?${query.toString()}`

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {subtitle && <DialogDescription className="break-words text-xs">{subtitle}</DialogDescription>}
      </DialogHeader>

      <div className="space-y-3 py-1">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="kuitansi-goods-receipt"
            checked={includeGoodsReceipt}
            onCheckedChange={checked => setIncludeGoodsReceipt(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label htmlFor="kuitansi-goods-receipt" className="cursor-pointer text-sm font-medium leading-snug">
              Sertakan keterangan penerimaan barang/pekerjaan
            </Label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan baris konfirmasi &ldquo;Barang/pekerjaan tersebut telah diterima/diselesaikan dengan lengkap dan baik&rdquo; di bagian bawah kuitansi.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="kuitansi-attachment"
            checked={includeAttachment}
            onCheckedChange={checked => setIncludeAttachment(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label htmlFor="kuitansi-attachment" className="cursor-pointer text-sm font-medium leading-snug">
              Sertakan Halaman 2 (Lampiran Kuitansi)
            </Label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan rincian pos anggaran dan daftar item pembayaran pada halaman terpisah.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Batal
        </Button>
        <Button asChild size="sm" className="gap-1.5">
          <a href={href} target="_blank" rel="noreferrer" onClick={() => onOpenChange(false)}>
            <Printer className="h-4 w-4" /> Buka / Cetak PDF
          </a>
        </Button>
      </div>
    </DialogContent>
  )
}

export function KuitansiPrintDialog({
  open,
  onOpenChange,
  hrefBase,
  title = 'Cetak Kuitansi Pengeluaran',
  subtitle,
  defaultGoodsReceipt = true,
  defaultAttachment = false,
}: KuitansiPrintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <KuitansiPrintDialogBody
          key={`${hrefBase}:${defaultGoodsReceipt}:${defaultAttachment}`}
          onOpenChange={onOpenChange}
          hrefBase={hrefBase}
          title={title}
          subtitle={subtitle}
          defaultGoodsReceipt={defaultGoodsReceipt}
          defaultAttachment={defaultAttachment}
        />
      )}
    </Dialog>
  )
}
