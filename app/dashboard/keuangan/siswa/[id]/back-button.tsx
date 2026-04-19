'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" /> Kembali
    </button>
  )
}
