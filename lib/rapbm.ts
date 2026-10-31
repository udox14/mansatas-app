export const RAPBM_FEATURE = 'keuangan-rapbm'
export const RAPBM_MAX_BYTES = 6 * 1024 * 1024
export const RAPBM_READ_ROLES = ['super_admin', 'bendahara_komite', 'ketua_komite', 'anggota_komite', 'kepsek']
export const RAPBM_MANAGE_ROLES = ['super_admin', 'bendahara_komite']

export type RapbmAmounts = { apbn: number | null; komite: number | null; total: number | null }
export type RapbmNote = {
  reference: string
  message: string
  source: number | null
  calculated: number | null
}
export type RapbmItem = {
  order: number
  description: string
  account: string | null
  volume: string | null
  unit: string | null
  reference: string
  amounts: RapbmAmounts
}
export type RapbmGroup = {
  order: number
  label: string
  account: string | null
  reference: string
  subtotalReference: string | null
  amounts: RapbmAmounts
  items: RapbmItem[]
}
export type RapbmDocument = {
  year: number
  title: string
  institution: string
  sheet: string
  income: RapbmGroup[]
  expenses: RapbmGroup[]
  incomeTotal: RapbmAmounts
  expenseTotal: RapbmAmounts
  notes: RapbmNote[]
}
export type RapbmVersion = {
  id: string
  year: number
  version: number
  status: 'draft' | 'published' | 'superseded'
  original_filename: string
  created_at: string
  created_by_name: string
  published_at: string | null
  note_count: number
}
export type RapbmPageData = {
  versions: RapbmVersion[]
  selected: RapbmVersion | null
  document: RapbmDocument | null
  canManage: boolean
  publicationRevision: number
}

export function filterRapbmGroups(groups: RapbmGroup[], query: string, source: string) {
  const term = query.trim().toLocaleLowerCase('id-ID')
  return groups.map(group => ({ ...group, items: group.items.filter(item => {
    const matches = !term || `${group.label} ${group.account || ''} ${item.description} ${item.account || ''}`.toLocaleLowerCase('id-ID').includes(term)
    return matches && (source === 'all' || (source === 'apbn' ? (item.amounts.apbn ?? 0) > 0 : (item.amounts.komite ?? 0) > 0))
  }) })).filter(group => group.items.length > 0)
}

export function rapbmStatusLabel(status: RapbmVersion['status']) {
  return { draft: 'Draft · belum terbit', published: 'Versi terbit', superseded: 'Arsip versi' }[status]
}

export class RapbmValidationError extends Error {}
export type RapbmActionResult = { id: string; year: number; success: string; error?: never } | { error: string; id?: never; year?: never; success?: never }
