'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AvatarSiswaProps {
  fotoUrl?: string | null
  nama: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function AvatarSiswa({ fotoUrl, nama, size = 'sm', className }: AvatarSiswaProps) {
  const [open, setOpen] = useState(false)
  
  const sizeClasses = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-sm',
    lg: 'h-16 w-16 text-2xl',
    xl: 'h-24 w-24 text-4xl',
  }
  
  const cls = sizeClasses[size]
  
  const content = (
    <div className={cn('rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 overflow-hidden', cls, className)}>
      {fotoUrl
        ? <img src={fotoUrl} alt={nama} className="h-full w-full object-cover" />
        : <span className="font-bold">{nama?.charAt(0)?.toUpperCase() || '?'}</span>}
    </div>
  )

  if (!fotoUrl) return content

  return (
    <>
      <button 
        type="button" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} 
        className="focus:outline-none hover:opacity-80 transition-opacity flex-shrink-0"
      >
        {content}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-1 overflow-hidden bg-transparent border-none shadow-none flex justify-center [&>button.absolute]:bg-slate-900/50 [&>button.absolute]:text-white [&>button.absolute]:hover:bg-slate-900">
          <DialogTitle className="sr-only">Foto {nama}</DialogTitle>
          <img src={fotoUrl} alt={nama} className="w-auto max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
        </DialogContent>
      </Dialog>
    </>
  )
}
