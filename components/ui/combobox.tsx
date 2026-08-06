'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options = [],
  value,
  onValueChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ditemukan',
  className,
  disabled = false,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === value)
  }, [options, value])

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase().trim()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, search])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        clearTimeout(timer)
      }
    }
  }, [isOpen])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300 text-slate-900 dark:text-slate-100 text-left',
          !selectedOption && 'text-slate-500 dark:text-slate-400'
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-2 pb-1.5 pt-1">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              className="flex h-7 w-full rounded-md bg-transparent text-xs outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto pt-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <div
                    key={option.value}
                    onClick={() => {
                      onValueChange(option.value)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
                      isSelected && 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
