'use client'

import { ArrowLeft, Printer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface PrintCeklisToolbarProps {
  teacherCount: number
}

export function PrintCeklisToolbar({ teacherCount }: PrintCeklisToolbarProps) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <div>
          <p className="text-sm font-semibold text-slate-800">Cetak Ceklis Berkas TPG</p>
          <p className="text-xs text-slate-500">
            {teacherCount} Guru terpilih &bull; {teacherCount * 2} Lembar (Asli &amp; Salinan)
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => window.print()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
          <Printer className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
      </div>
    </div>
  )
}
