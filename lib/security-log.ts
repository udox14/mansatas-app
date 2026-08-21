const SENSITIVE_KEY = /(authorization|cookie|token|password|secret|nisn|nik|nip|private[_-]?key|payload|file|body)/i

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[redacted-depth]'
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}…` : value
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactValue(item, depth + 1))
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (typeof value !== 'object') return String(value)

  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactValue(item, depth + 1)
  }
  return output
}

export function createCorrelationId(): string {
  return crypto.randomUUID()
}

export function logSecurityEvent(
  severity: 'info' | 'warning' | 'error',
  event: string,
  details: Record<string, unknown> = {},
  correlationId = createCorrelationId()
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    type: 'security',
    severity,
    event,
    correlationId,
    ...redactValue(details) as Record<string, unknown>,
  })

  if (severity === 'error') console.error(payload)
  else if (severity === 'warning') console.warn(payload)
  else console.info(payload)
  return correlationId
}

export function publicServerError(
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
): { error: string; correlationId: string; success?: undefined; data?: undefined } {
  const correlationId = logSecurityEvent('error', event, {
    ...details,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
  })
  return { error: `Terjadi kesalahan pada server. ID: ${correlationId}`, correlationId }
}
