'use client'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export type SiswaStatusFilterValue = 'aktif' | 'lulus' | 'keluar' | 'pindah' | 'semua'

const SISWA_STATUS_OPTIONS: { value: SiswaStatusFilterValue; label: string }[] = [
  { value: 'aktif', label: 'Siswa Aktif' },
  { value: 'lulus', label: 'Lulus' },
  { value: 'keluar', label: 'Keluar' },
  { value: 'pindah', label: 'Pindah' },
  { value: 'semua', label: 'Semua Siswa' },
]

export function matchSiswaStatusFilter(status: string | null | undefined, filter: SiswaStatusFilterValue) {
  if (filter === 'semua') return true
  return status === filter
}

export function SiswaStatusFilter({
  value,
  onValueChange,
  className = 'h-8 w-40 text-xs rounded-md',
}: {
  value: SiswaStatusFilterValue
  onValueChange: (value: SiswaStatusFilterValue) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={v => onValueChange(v as SiswaStatusFilterValue)}>
      <SelectTrigger className={className}><SelectValue placeholder="Status Siswa" /></SelectTrigger>
      <SelectContent>
        {SISWA_STATUS_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
