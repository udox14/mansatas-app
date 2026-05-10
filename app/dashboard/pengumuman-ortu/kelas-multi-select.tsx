'use client'

import { useState } from 'react'

type Kelas = {
  id: string
  tingkat: string | number
  nomor_kelas: string | number
  kelompok?: string | null
}

export function KelasMultiSelect({ kelasRows }: { kelasRows: Kelas[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(kelasRows.map((k) => k.id)))
  const clearAll = () => setSelected(new Set())

  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={selectAll} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors">
          Pilih semua kelas
        </button>
        <button type="button" onClick={clearAll} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors">
          Kosongkan pilihan
        </button>
      </div>

      <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1.5 dark:border-slate-800 dark:bg-slate-900">
        {kelasRows.length === 0 ? (
          <p className="px-1 py-1 text-xs text-slate-500 dark:text-slate-400">Belum ada kelas tersedia.</p>
        ) : kelasRows.map((k) => {
          const checked = selected.has(k.id)
          return (
            <label key={k.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-slate-700 border border-slate-100 hover:border-slate-200 cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 transition-colors">
              <input
                type="checkbox"
                name="kelas_ids"
                value={k.id}
                checked={checked}
                onChange={() => toggleOne(k.id)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:checked:bg-emerald-600"
              />
              <span>{k.tingkat}-{k.nomor_kelas}{k.kelompok ? ` ${k.kelompok}` : ''}</span>
            </label>
          )
        })}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Centang kelas tujuan pengumuman.</p>
    </div>
  )
}

