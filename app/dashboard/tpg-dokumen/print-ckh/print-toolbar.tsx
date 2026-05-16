'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintToolbar() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
      <p className="text-sm font-semibold text-slate-800">Cetak CKH Massal</p>
      <Button onClick={() => window.print()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
        <Printer className="h-4 w-4" />
        Print / Simpan PDF
      </Button>
    </div>
  )
}
