'use client'

import { useRouter } from 'next/navigation'

type KelasOption = {
  id: string
  label: string
}

export function KelasSelector({
  kelasList,
  selectedKelasId,
  view = 'home',
  risiko,
  quickEdit = false,
}: {
  kelasList: KelasOption[]
  selectedKelasId: string
  view?: string
  risiko?: string
  quickEdit?: boolean
}) {
  const router = useRouter()
  const buildHref = (kelasId: string) => {
    const params = new URLSearchParams({ kelas: kelasId, view })
    if (risiko) params.set('risiko', risiko)
    if (quickEdit) params.set('edit', '1')
    return `/dashboard/kelas-binaan?${params.toString()}`
  }

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm p-3">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 block">
        Pilih Kelas
      </label>
      <select
        value={selectedKelasId}
        onChange={(e) => router.push(buildHref(e.target.value))}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-amber-400"
      >
        {kelasList.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  )
}
