import type { DsptAudience } from './dspt-reminder-config'

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
}

export function parseDsptAudience(input: unknown): DsptAudience | null {
  if (!input || typeof input !== 'object' || !('payment' in input) || !('scope' in input)) return null
  const { payment, scope } = input
  if ((payment !== 'all' && payment !== 'unpaid') || !scope || typeof scope !== 'object' || !('kind' in scope)) return null
  if (scope.kind === 'all') return { payment, scope: { kind: 'all' } }
  if (scope.kind === 'grade' && 'grade' in scope && typeof scope.grade === 'number' && [10, 11, 12].includes(scope.grade)) {
    return { payment, scope: { kind: 'grade', grade: scope.grade } }
  }
  if (scope.kind === 'class' && 'classId' in scope && validId(scope.classId)) {
    return { payment, scope: { kind: 'class', classId: scope.classId } }
  }
  if (scope.kind === 'students' && 'studentIds' in scope && Array.isArray(scope.studentIds)
    && scope.studentIds.length > 0 && scope.studentIds.length <= 2000 && scope.studentIds.every(validId)) {
    return { payment, scope: { kind: 'students', studentIds: [...new Set<string>(scope.studentIds)].sort() } }
  }
  return null
}

export function dsptEligibilitySql(payment: DsptAudience['payment']) {
  // Match the portal's outstanding balance. A missing or all-zero bill has no positive balance.
  return payment === 'all' ? "s.status = 'aktif'" : `s.status = 'aktif'
    AND COALESCE(d.nominal_target, 0) > COALESCE(d.total_dibayar, 0) + COALESCE(d.total_diskon, 0)
    AND NOT EXISTS (SELECT 1 FROM fin_payment_submissions p
      WHERE p.siswa_id = s.id AND p.kategori = 'dspt' AND p.status = 'menunggu_konfirmasi')`
}

export function dsptRecipientsQuery(audience: DsptAudience) {
  const { scope, payment } = audience
  const filters = {
    all: '',
    grade: 'AND CAST(k.tingkat AS INTEGER) = ?',
    class: 'AND s.kelas_id = ?',
    students: 'AND s.id IN (SELECT value FROM json_each(?))',
  }
  const bindings = scope.kind === 'grade' ? [scope.grade] : scope.kind === 'class' ? [scope.classId]
    : scope.kind === 'students' ? [JSON.stringify(scope.studentIds)] : []
  const sql = `SELECT s.id FROM siswa s
    ${scope.kind === 'grade' ? 'JOIN kelas k ON k.id = s.kelas_id' : ''}
    ${payment === 'unpaid' ? 'JOIN fin_dspt d ON d.siswa_id = s.id' : ''}
    WHERE ${dsptEligibilitySql(payment)} ${filters[scope.kind]}`
  return { sql, bindings }
}
