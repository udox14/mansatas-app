'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Undo2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AyatGridProps {
  surahNama: string
  startAyat?: number
  endAyat?: number
  jumlahAyat: number
  progressAwal: number[] // array of ayat yang SEBELUMNYA SUDAH hafal (hijau persisten)
  onSave: (selectedAyat: number[]) => void
  isSaving: boolean
}

export function AyatGrid({ surahNama, startAyat = 1, endAyat, jumlahAyat, progressAwal, onSave, isSaving }: AyatGridProps) {
  const actualEndAyat = endAyat || (startAyat + jumlahAyat - 1)
  const [selected, setSelected] = useState<Set<number>>(new Set(progressAwal))
  const [lastAdded, setLastAdded] = useState<number | null>(null)
  const [autoFill, setAutoFill] = useState(true)

  // Update effect if progressAwal changes (e.g. switching surah)
  useEffect(() => {
    setSelected(new Set(progressAwal))
    setLastAdded(null)
  }, [progressAwal])

  const toggleAyat = (ayat: number) => {
    const newSet = new Set(selected)
    
    if (newSet.has(ayat)) {
      newSet.delete(ayat)
      if (lastAdded === ayat) setLastAdded(null)
    } else {
      if (autoFill && lastAdded !== null && Math.abs(ayat - lastAdded) > 1) {
        const start = Math.min(ayat, lastAdded)
        const end = Math.max(ayat, lastAdded)
        for (let i = start; i <= end; i++) {
          if (i >= startAyat && i <= actualEndAyat) {
            newSet.add(i)
          }
        }
      } else {
        newSet.add(ayat)
      }
      setLastAdded(ayat)
    }
    setSelected(newSet)
  }

  const markAll = () => {
    const newSet = new Set(selected)
    for (let i = startAyat; i <= actualEndAyat; i++) {
      newSet.add(i)
    }
    setSelected(newSet)
    setLastAdded(actualEndAyat)
  }

  const clearAll = () => {
    const newSet = new Set(selected)
    for (let i = startAyat; i <= actualEndAyat; i++) {
      newSet.delete(i)
    }
    setSelected(newSet)
    setLastAdded(null)
  }

  const resetChanges = () => {
    setSelected(new Set(progressAwal))
    setLastAdded(null)
  }

  // Calculate count in range
  const countInRange = Array.from(selected).filter(a => a >= startAyat && a <= actualEndAyat).length
  const progressAwalInRange = progressAwal.filter(a => a >= startAyat && a <= actualEndAyat)

  // Calculate if there are unsaved changes
  const hasChanges = Array.from(selected).sort().join(',') !== [...progressAwal].sort().join(',')
  // Also, compute how many are strictly "NEW" for this session
  const numNew = Array.from(selected).filter(a => !progressAwal.includes(a) && a >= startAyat && a <= actualEndAyat).length

  // Build array of ayat numbers to display
  const ayatNumbers: number[] = []
  for (let i = startAyat; i <= actualEndAyat; i++) {
    ayatNumbers.push(i)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-semibold text-lg">{surahNama} {startAyat > 1 || actualEndAyat < (startAyat + jumlahAyat - 1) ? `(Ayat ${startAyat} - ${actualEndAyat})` : ''}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {countInRange} / {ayatNumbers.length} Ayat Dihafal (Juz Ini)
            {numNew > 0 && <span className="text-emerald-600 ml-2 font-medium">(+{numNew} Setoran Baru)</span>}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-2 sm:py-0 h-9 rounded-md cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">
            <input 
              type="checkbox" 
              checked={autoFill} 
              onChange={(e) => setAutoFill(e.target.checked)}
              className="rounded w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500 border-slate-300"
            />
            Isi Rentang Cepat
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={markAll}>
              <Check className="h-4 w-4 mr-1.5" />
              Hafal Semua
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAll}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Kosongkan
            </Button>
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={resetChanges} disabled={isSaving} title="Reset Perubahan Belum Disimpan">
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={() => onSave(Array.from(selected))}
              disabled={!hasChanges || isSaving}
              className={cn(hasChanges && "bg-emerald-600 hover:bg-emerald-700")}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {ayatNumbers.map((num) => {
          const isSaved = progressAwal.includes(num)
          const isSelected = selected.has(num)
          const isNewlySelected = isSelected && !isSaved

          return (
            <button
              key={num}
              onClick={() => toggleAyat(num)}
              className={cn(
                "h-10 w-full rounded-md font-medium text-sm flex items-center justify-center transition-all",
                isSelected
                  ? isNewlySelected
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-500 dark:border-emerald-500 shadow-sm ring-2 ring-emerald-500 ring-offset-1" // New selection visual
                    : "bg-emerald-500 text-white shadow-sm" // Previously saved visual
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 border border-slate-200 dark:border-slate-800" // Not selected
              )}
            >
              {num}
            </button>
          )
        })}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t mt-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-500"></div> Sudah Dihafal
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/50 border-2 border-emerald-500 dark:border-emerald-500"></div> Setoran Baru (belum simpan)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800"></div> Belum Dihafal
        </div>
      </div>
    </div>
  )
}
