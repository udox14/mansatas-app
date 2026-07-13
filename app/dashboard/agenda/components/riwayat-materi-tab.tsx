'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, BookOpen, Calendar, ChevronRight, Clock, Search } from 'lucide-react'
import { formatNamaKelas } from '@/lib/utils'
import { formatTimeWIB } from '@/lib/time'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { RiwayatTahunAjaran } from '../actions'

interface RiwayatItem {
  id: string
  tanggal: string
  materi: string
  waktu_input: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  nama_mapel: string
  kelas_id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
}

interface KelasGroup {
  kelas_id: string
  label: string
  count: number
  lastTanggal: string
  mapel: string[]
  items: RiwayatItem[]
}

interface Props {
  data: RiwayatItem[]
  tahunAjaranOptions: RiwayatTahunAjaran[]
  selectedTahunAjaranId: string | null | undefined
}

export function RiwayatMateriTab({ data, tahunAjaranOptions, selectedTahunAjaranId }: Props) {
  const [selectedKelasId, setSelectedKelasId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const fmtTgl = (tgl: string) => {
    return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const fmtWaktu = (iso: string) => {
    return formatTimeWIB(iso, { legacyShiftedWIB: true })
  }

  const kelasGroups = useMemo<KelasGroup[]>(() => {
    const map = new Map<string, KelasGroup>()

    for (const item of data) {
      const label = formatNamaKelas(item.tingkat, item.nomor_kelas, item.kelompok)
      const existing = map.get(item.kelas_id)
      if (existing) {
        existing.count += 1
        existing.items.push(item)
        if (item.tanggal > existing.lastTanggal) existing.lastTanggal = item.tanggal
        if (!existing.mapel.includes(item.nama_mapel)) existing.mapel.push(item.nama_mapel)
      } else {
        map.set(item.kelas_id, {
          kelas_id: item.kelas_id,
          label,
          count: 1,
          lastTanggal: item.tanggal,
          mapel: [item.nama_mapel],
          items: [item],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'id-ID'))
  }, [data])

  const selectedGroup = kelasGroups.find(group => group.kelas_id === selectedKelasId) ?? null
  const filteredItems = (selectedGroup?.items ?? []).filter(item =>
    item.nama_mapel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.materi.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedTahunAjaran = tahunAjaranOptions.find(ta => ta.id === selectedTahunAjaranId)
  const handleTahunAjaranChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tahun_ajaran_id', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const tahunAjaranFilter = (
    <div className="rounded-lg border bg-white dark:bg-slate-900 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Riwayat Materi</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pilih tahun ajaran untuk melihat riwayat agenda mengajar.
          </p>
        </div>
        {tahunAjaranOptions.length > 0 && (
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Tahun Ajaran
            </label>
            <Select value={selectedTahunAjaranId || undefined} onValueChange={handleTahunAjaranChange}>
              <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 text-xs">
                <SelectValue placeholder="Pilih tahun ajaran" />
              </SelectTrigger>
              <SelectContent>
                {tahunAjaranOptions.map(ta => (
                  <SelectItem key={ta.id} value={ta.id} className="text-xs">
                    {ta.nama} SMT {ta.semester}{ta.is_active === 1 ? ' · Aktif' : ''} ({ta.jumlah_agenda})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {selectedTahunAjaran && selectedTahunAjaran.is_active === 1 && (
        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">Menampilkan tahun ajaran aktif.</p>
      )}
    </div>
  )

  if (data.length === 0) {
    return (
      <div className="space-y-3">
        {tahunAjaranFilter}
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <BookOpen className="h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Belum ada riwayat agenda pada tahun ajaran ini.</p>
        </div>
      </div>
    )
  }

  if (!selectedGroup) {
    return (
      <div className="space-y-2">
        {tahunAjaranFilter}
        <div className="rounded-lg border bg-white dark:bg-slate-900 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pilih Kelas</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{kelasGroups.length} kelas memiliki riwayat agenda.</p>
        </div>

        <div className="grid gap-2">
          {kelasGroups.map(group => (
            <button
              key={group.kelas_id}
              onClick={() => {
                setSelectedKelasId(group.kelas_id)
                setSearchTerm('')
              }}
              className="w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-3 text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{group.label}</p>
                    <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {group.count} agenda
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Terakhir {fmtTgl(group.lastTanggal)} · {group.mapel.slice(0, 3).join(', ')}
                    {group.mapel.length > 3 ? ` +${group.mapel.length - 3} mapel` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tahunAjaranFilter}
      <div className="rounded-lg border bg-white dark:bg-slate-900 px-3 py-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedKelasId(null)
              setSearchTerm('')
            }}
            className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Kembali ke daftar kelas"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedGroup.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedGroup.count} riwayat agenda</p>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari mapel atau materi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-8 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Riwayat materi tidak ditemukan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div key={item.id} className="rounded-lg border bg-white dark:bg-slate-900 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.nama_mapel}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {fmtTgl(item.tanggal)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Jam {item.jam_ke_mulai === item.jam_ke_selesai ? item.jam_ke_mulai : `${item.jam_ke_mulai}-${item.jam_ke_selesai}`} · {fmtWaktu(item.waktu_input)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-2.5 py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {item.materi}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
