export type ForgottenAgendaRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export function normalizeForgottenMonthlyLimit(value: unknown, fallback = 2): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback
}

export function canReviewForgottenAgendaForRoles(
  roles: string[],
  structuralRoleId: string | null | undefined,
): boolean {
  if (roles.includes('super_admin')) return true
  return roles.includes('wakamad') && structuralRoleId === 'jbt_waka_kurikulum'
}

export function isForgottenAgendaRequestWindow(input: {
  tanggal: string
  today: string
  currentMinutes: number
  endMinutes: number
  timeRestrictionEnabled: boolean
}): boolean {
  return input.timeRestrictionEnabled
    && input.tanggal === input.today
    && input.currentMinutes >= input.endMinutes
}
