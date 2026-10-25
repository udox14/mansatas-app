'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardGuideButton } from '@/components/layout/dashboard-guide'

export function PrintToolbar() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
      <p className="text-sm font-semibold text-slate-800" data-dashboard-guide-target="page-title" data-dashboard-guide-title="Cetak CKH Massal">Cetak CKH Massal</p>
      <div className="flex items-center gap-2">
        <DashboardGuideButton />
        <Button onClick={() => window.print()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
          <Printer className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
      </div>
    </div>
  )
}
