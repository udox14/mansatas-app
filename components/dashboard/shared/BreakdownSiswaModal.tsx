'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Users, GraduationCap, School } from 'lucide-react'

type Props = {
  total: number
  angkatan: { angkatan: number; count: number }[]
  kelas: { kelas: string; count: number }[]
  children: React.ReactNode
}

export function BreakdownSiswaModal({ total, angkatan, kelas, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Breakdown Siswa Aktif ({total})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto px-1">
            {/* Per Angkatan */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                <GraduationCap className="h-4 w-4" /> Per Angkatan
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {angkatan.map((a) => (
                  <div key={a.angkatan} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Angkatan {a.angkatan}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{a.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per Kelas */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                <School className="h-4 w-4" /> Per Rombel
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kelas.map((k) => (
                  <div key={k.kelas} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{k.kelas}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{k.count}</span>
                  </div>
                ))}
                {kelas.length === 0 && (
                  <div className="col-span-full text-xs text-slate-400 italic">Belum ada siswa yang masuk ke rombel di TA ini.</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
