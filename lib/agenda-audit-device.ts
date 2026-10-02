import { parseDeviceInfo } from './device-info'

// Audit Agenda focuses on phones; keep the underlying session/activity history.
export function isAgendaAuditPhone(userAgent?: string | null) {
  return parseDeviceInfo(userAgent).type === 'mobile'
}

// Column names are internal constants, never request input. Apply before LIMIT,
// COUNT and GROUP BY so old desktop alerts cannot distort pagination or totals.
export function agendaAuditPhoneSql(column: string) {
  const ua = `LOWER(COALESCE(${column}, ''))`
  const android = `${ua} GLOB '*android [0-9]*'`
  return `(((${android}) AND ${ua} NOT LIKE '%tablet%'
    AND (${ua} LIKE '%mobile%' OR ${ua} LIKE '%wv%'))
    OR (NOT (${android}) AND ${ua} LIKE '%iphone%'))`
}
