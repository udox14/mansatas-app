export type StudentFinanceScope = 'active' | 'inactive'

export function isStudentInFinanceScope(status: string | null | undefined, scope: StudentFinanceScope) {
  return scope === 'active'
    ? status === 'aktif'
    : status !== 'aktif' && status !== 'dihapus'
}

export function studentFinanceScopeSql(scope: StudentFinanceScope, alias = 's') {
  return scope === 'active'
    ? `${alias}.status = 'aktif'`
    : `${alias}.status <> 'aktif' AND ${alias}.status <> 'dihapus'`
}
