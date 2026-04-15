'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface DataPaginationProps {
  total: number
  page: number
  pageSize: number | 'semua'
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number | 'semua') => void
  entityLabel?: string
}

export function DataPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  entityLabel = 'data',
}: DataPaginationProps) {
  const isSemua = pageSize === 'semua'
  const totalPages = isSemua ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)))
  const from = isSemua ? 1 : (page - 1) * (pageSize as number) + 1
  const to   = isSemua ? total : Math.min(page * (pageSize as number), total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
      {/* Info */}
      <span>
        {total === 0 ? `0 ${entityLabel}` : `${from}–${to} dari ${total} ${entityLabel}`}
      </span>

      <div className="flex items-center gap-3">
        {/* Page size */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 hidden sm:inline">Tampil</span>
          <Select
            value={String(pageSize)}
            onValueChange={v => {
              onPageSizeChange(v === 'semua' ? 'semua' : parseInt(v))
              onPageChange(1)
            }}
          >
            <SelectTrigger className="h-7 w-20 text-xs rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
              <SelectItem value="semua">Semua</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nav buttons — hidden when semua */}
        {!isSemua && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-md"
              disabled={page <= 1} onClick={() => onPageChange(1)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-md"
              disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 select-none">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-md"
              disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-md"
              disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Hook sederhana untuk state pagination */
export function usePagination(defaultSize: number | 'semua' = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'semua'>(defaultSize)

  function paginate<T>(data: T[]): T[] {
    if (pageSize === 'semua') return data
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }

  function reset() { setPage(1) }

  return { page, pageSize, setPage, setPageSize, paginate, reset }
}

// re-export useState so consumers don't need an extra import
import { useState } from 'react'
