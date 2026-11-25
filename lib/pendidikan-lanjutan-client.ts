'use client'

import { useEffect, useState } from 'react'
import type { ComboboxOption } from '@/components/ui/combobox'
import type { Kampus, Prodi } from '@/lib/pendidikan-lanjutan'

type PendidikanCatalog = {
  kampusList: Kampus[]
  kampusOptions: ComboboxOption[]
  prodiByKampus: Record<string, Prodi[]>
}

const EMPTY_CATALOG: PendidikanCatalog = {
  kampusList: [],
  kampusOptions: [],
  prodiByKampus: {},
}

let cachedCatalog: PendidikanCatalog | null = null
let catalogPromise: Promise<PendidikanCatalog> | null = null

export function loadPendidikanLanjutanClient(): Promise<PendidikanCatalog> {
  if (cachedCatalog) return Promise.resolve(cachedCatalog)
  if (catalogPromise) return catalogPromise

  catalogPromise = Promise.all([
    fetch('/data/kampus.json').then(res => {
      if (!res.ok) throw new Error(`Gagal memuat kampus (${res.status})`)
      return res.json() as Promise<Kampus[]>
    }),
    fetch('/data/prodi.json').then(res => {
      if (!res.ok) throw new Error(`Gagal memuat prodi (${res.status})`)
      return res.json() as Promise<Record<string, Prodi[]>>
    }),
  ])
    .then(([kampusList, prodiByKampus]) => {
      const kampusOptions: ComboboxOption[] = kampusList.map(k => ({
        value: k.id,
        label: k.nama,
        keywords: `${k.singkatan} ${k.kota} ${k.provinsi} ${k.npsn ?? ''}`,
        description: [k.singkatan, k.kota, k.jenis].filter(Boolean).join(' · '),
      }))
      cachedCatalog = { kampusList, kampusOptions, prodiByKampus }
      return cachedCatalog
    })
    .catch(error => {
      catalogPromise = null
      throw error
    })

  return catalogPromise
}

export function usePendidikanLanjutanData() {
  const [catalog, setCatalog] = useState<PendidikanCatalog>(() => cachedCatalog ?? EMPTY_CATALOG)
  const [loading, setLoading] = useState<boolean>(() => !cachedCatalog)

  useEffect(() => {
    if (catalog === cachedCatalog && cachedCatalog !== null) return
    let cancelled = false
    loadPendidikanLanjutanClient()
      .then(data => {
        if (!cancelled) {
          setCatalog(data)
          setLoading(false)
        }
      })
      .catch(error => {
        console.error('Gagal memuat data referensi perguruan tinggi:', error)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [catalog])

  return { ...catalog, loading }
}
