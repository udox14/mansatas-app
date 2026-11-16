'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DisciplineHistoryRecord } from '@/lib/discipline-history'

export const ALL_DISCIPLINE_PERIODS = 'all-periods'

export function DisciplinePeriodSelect({ records, activeId, value, onChange }: {
  records: DisciplineHistoryRecord[]
  activeId?: string
  value: string
  onChange: (value: string) => void
}) {
  const periods = new Map(records.map(record => [record.tahun_ajaran_id, record.periode]))
  const activeLabel = activeId ? periods.get(activeId) : undefined
  if (activeId) periods.delete(activeId)
  const historical = [...periods.entries()].sort((a, b) => b[1].localeCompare(a[1], 'id'))

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Periode riwayat pelanggaran" className="h-8 w-auto max-w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DISCIPLINE_PERIODS}>Semua tahun ajaran</SelectItem>
        {activeId && <SelectItem value={activeId}>{activeLabel ? `${activeLabel} (aktif)` : 'Semester aktif'}</SelectItem>}
        {historical.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
