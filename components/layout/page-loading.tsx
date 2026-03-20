// Lokasi: components/layout/page-loading.tsx
// Komponen loading standar untuk semua Suspense fallback di dashboard
// Menggantikan pola lama yang beda-beda di setiap page.tsx

import { Loader2 } from 'lucide-react'

interface PageLoadingProps {
  text?: string
}

export function PageLoading({ text = 'Memuat data...' }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}
