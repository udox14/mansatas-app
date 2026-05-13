'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AvatarSiswaProps {
  fotoUrl?: string | null
  nama: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'profile' | 'full'
  className?: string
}

export function AvatarSiswa({ fotoUrl, nama, size = 'sm', className }: AvatarSiswaProps) {
  const [open, setOpen] = useState(false)
  
  const sizeClasses = {
    xs: 'h-8 w-6 text-[10px]',
    sm: 'h-9 w-7 text-[10px]',
    md: 'h-12 w-9 text-sm',
    lg: 'h-16 w-12 text-xl',
    xl: 'h-32 w-24 text-4xl',
    profile: 'h-44 w-32 sm:h-48 sm:w-36 text-4xl',
    full: 'h-full w-full text-3xl',
  }
  
  const cls = sizeClasses[size]
  
  const content = (
    <div className={cn('rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 overflow-hidden border border-surface-2', cls, className)}>
      {fotoUrl
        ? <img src={fotoUrl} alt={nama} className="h-full w-full object-cover" />
        : <span className="font-bold">{nama?.charAt(0)?.toUpperCase() || '?'}</span>}
    </div>
  )

  if (!fotoUrl) return content

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} 
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }
        }}
        className={cn('focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:opacity-80 transition-opacity flex-shrink-0 cursor-pointer', size === 'full' && 'h-full w-full')}
      >
        {content}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-1 overflow-hidden bg-transparent border-none shadow-none flex justify-center [&>button.absolute]:bg-slate-900/50 [&>button.absolute]:text-white [&>button.absolute]:hover:bg-slate-900">
          <DialogTitle className="sr-only">Foto {nama}</DialogTitle>
          <img src={fotoUrl} alt={nama} className="w-auto max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
        </DialogContent>
      </Dialog>
    </>
  )
}
