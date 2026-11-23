'use client'

import { CaretRight, Info, Wallet } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function rupiah(v: number) {
  return new Intl.NumberFormat('id-ID').format(v || 0)
}

export function PortalFinanceReminderDialog({
  open,
  onOpenChange,
  siswaNama,
  kelasLabel,
  dsptRemaining,
  sppRemaining,
  totalSisaTagihan,
  pendingConfirmationTotal,
  onGoToKeuangan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  siswaNama: string
  kelasLabel: string
  dsptRemaining: number
  sppRemaining: number
  totalSisaTagihan: number
  pendingConfirmationTotal: number
  onGoToKeuangan: () => void
}) {
  if (totalSisaTagihan <= 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="portal-dialog max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-0 text-[#1A1A18] sm:max-w-md">
        <DialogHeader className="border-b border-[#D8D4CC] bg-[#F2F0EC] p-5 text-left">
          <div className="flex items-center gap-3 pr-6">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF1EF] text-[#C2522D]">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-[#1A1A18]">
                Informasi Administrasi Keuangan
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-[#6B6B63]">
                {siswaNama} · Kelas {kelasLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-[#6B6B63]">
            Berikut ringkasan catatan administrasi keuangan ananda yang masih memiliki sisa kewajiban saat ini. Bapak/Ibu dapat melihat rinciannya kapan saja melalui menu Keuangan.
          </p>

          <div className="rounded-xl border border-[#D8D4CC] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B63]">
              Total Sisa Tercatat
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#C2522D]">
              Rp {rupiah(totalSisaTagihan)}
            </p>

            {(dsptRemaining > 0 || sppRemaining > 0) && (
              <div className="mt-3 space-y-1.5 border-t border-[#D8D4CC] pt-3 text-xs">
                {dsptRemaining > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B6B63]">Sisa DSPT</span>
                    <span className="font-bold tabular-nums text-[#1A1A18]">Rp {rupiah(dsptRemaining)}</span>
                  </div>
                )}
                {sppRemaining > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B6B63]">Saldo Awal SPP</span>
                    <span className="font-bold tabular-nums text-[#1A1A18]">Rp {rupiah(sppRemaining)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {pendingConfirmationTotal > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <p>
                Saat ini terdapat pengajuan pembayaran sebesar <strong className="tabular-nums">Rp {rupiah(pendingConfirmationTotal)}</strong> yang sedang dalam proses pengecekan oleh bendahara komite.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[#D8D4CC] bg-[#F2F0EC] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-lg border border-[#D8D4CC] bg-white px-4 text-sm font-semibold text-[#1A1A18] transition-colors hover:bg-[#FAF9F7]"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onGoToKeuangan()
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[#C2522D] px-4 text-sm font-bold text-white transition-colors hover:bg-[#A8421F]"
          >
            Buka Menu Keuangan
            <CaretRight className="h-4 w-4" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
