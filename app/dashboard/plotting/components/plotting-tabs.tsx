// BUAT FILE BARU
// Lokasi: app/dashboard/plotting/components/plotting-tabs.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import React from 'react'

export function PlottingTabs({ children, defaultValue }: { children: React.ReactNode, defaultValue: string }) {
  const router = useRouter()
  
  return (
    <Tabs 
      defaultValue={defaultValue} 
      onValueChange={(val) => {
        // Otomatis inject parameter tab ke URL tanpa reload halaman
        router.replace(`?tab=${val}`, { scroll: false })
      }} 
      className="w-full space-y-6"
    >
      {children}
    </Tabs>
  )
}