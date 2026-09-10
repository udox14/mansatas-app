export type CashDirection = 'income' | 'expense'
export type CashMethod = 'tunai' | 'transfer' | 'qris'
export type CashSource = 'dspt' | 'spp' | 'manual'
export type CashEntryStatus = 'active' | 'void'

export interface CashflowFilters {
  dateFrom?: string
  dateTo?: string
  direction?: CashDirection | 'all'
  source?: CashSource | 'all'
  categoryId?: string
  method?: CashMethod | 'all'
  recorderId?: string
  status?: CashEntryStatus | 'all'
  angkatan?: string
  kelasId?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface CashflowCategory {
  id: string
  direction: CashDirection
  name: string
  sortOrder: number
  isActive: boolean
  isSystem: boolean
}

export interface CashflowEntry {
  id: string
  origin: 'student' | 'manual'
  direction: CashDirection
  source: CashSource
  categoryId: string | null
  categoryName: string
  transactionDate: string
  amount: number
  method: CashMethod
  counterparty: string
  description: string
  proofUrl: string | null
  proofNumber: string | null
  recorderId: string | null
  recorderName: string
  studentId: string | null
  studentName: string | null
  studentClass: string | null
  angkatan: number | null
  status: CashEntryStatus
  voidReason: string | null
  createdAt: string
}

export interface CashflowSummary {
  totalIncome: number
  manualIncome: number
  totalExpense: number
}

export interface CashflowSeriesPoint {
  key: string
  label: string
  total: number
  count: number
}

export interface CashflowAnalytics {
  income: { total: number; count: number; average: number; largest: number }
  expense: { total: number; count: number; average: number; largest: number }
  monthlyIncome: CashflowSeriesPoint[]
  monthlyExpense: CashflowSeriesPoint[]
  incomeSources: CashflowSeriesPoint[]
  incomeMethods: CashflowSeriesPoint[]
  incomeCategories: CashflowSeriesPoint[]
  expenseMethods: CashflowSeriesPoint[]
  expenseCategories: CashflowSeriesPoint[]
}

export interface CashflowPageData {
  entries: CashflowEntry[]
  totalRows: number
  summary: CashflowSummary
  analytics: CashflowAnalytics
  categories: CashflowCategory[]
  recorders: Array<{ id: string; name: string }>
  classes: Array<{ id: string; label: string }>
  angkatan: number[]
}

export const CASH_METHODS: CashMethod[] = ['tunai', 'transfer', 'qris']

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function normalizeCashflowFilters(filters: CashflowFilters = {}): Required<Pick<CashflowFilters, 'page' | 'pageSize'>> & CashflowFilters {
  const page = Number.isInteger(filters.page) && Number(filters.page) > 0 ? Number(filters.page) : 1
  const requestedSize = Number(filters.pageSize) || 20
  const pageSize = Math.min(100, Math.max(10, requestedSize))
  return {
    ...filters,
    search: filters.search?.trim().slice(0, 100) || undefined,
    page,
    pageSize,
  }
}
