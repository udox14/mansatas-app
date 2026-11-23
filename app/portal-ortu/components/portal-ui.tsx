'use client'

import type React from 'react'
import { twMerge } from 'tailwind-merge'

export function StandardCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('rounded-2xl border border-[#D8D4CC] bg-white p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function PortalPageHeader({
  title,
  description,
  Icon,
  tourId,
}: {
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  tourId?: string
}) {
  return (
    <div data-tour-id={tourId} className="flex min-w-0 items-start justify-between gap-4 border-b border-[#D8D4CC] pb-5">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.75rem,7vw,2.35rem)] font-medium leading-tight tracking-[-0.035em] text-[#1A1A18]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B6B63]">{description}</p>
      </div>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#D8D4CC] bg-[#F2F0EC] text-[#C2522D]">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  )
}
