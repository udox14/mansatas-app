import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn(async () => undefined) }))
vi.mock('@/lib/schema-guard', () => ({
  ensureSchemaOnce: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}))

import { createAuth, hashPassword } from '@/utils/auth'
import {
  buildParentLoginReminderWaUrl,
  LAST_SEEN_THROTTLE_MS,
  normalizeIndonesianWhatsAppNumber,
  queryParentLoginMonitoring,
  recordParentLogin,
  resetParentLastSeenThrottleForTest,
  resolveParentLoginScope,
  touchParentLastSeen,
} from './parent-login-tracking'

type RecordedCall = { sql: string; args: unknown[] }

function createMockDb(options?: {
  passwordHash?: string
  waliClassIds?: string[]
  bkClassIds?: string[]
  firstMap?: (sql: string, args: unknown[]) => unknown
  allMap?: (sql: string, args: unknown[]) => unknown[]
}) {
  const calls: RecordedCall[] = []

  const db = {
    prepare(sql: string) {
      const execute = (args: unknown[]) => ({
        async first() {
          calls.push({ sql, args })
          if (options?.firstMap) {
            const custom = options.firstMap(sql, args)
            if (custom !== undefined) return custom
          }
          if (sql.includes('FROM siswa s') && sql.includes('WHERE s.nisn = ?')) {
            return {
              id: 'siswa-1',
              nisn: '0098765432',
              nama_lengkap: 'Ahmad Fauzan',
              tanggal_lahir: '2009-05-14',
              status: 'aktif',
              kelas_tingkat: 10,
            }
          }
          if (sql.includes('SELECT password_hash FROM parent_credentials')) {
            return options?.passwordHash ? { password_hash: options.passwordHash } : null
          }
          if (sql.includes('SELECT COUNT(*) AS total')) {
            return { total: 0 }
          }
          if (sql.includes('COUNT(*) AS total_siswa')) {
            return { total_siswa: 0, sudah_login: 0, aktif_7_hari: 0 }
          }
          return null
        },
        async all() {
          calls.push({ sql, args })
          if (options?.allMap) {
            const custom = options.allMap(sql, args)
            if (custom !== undefined) return { results: custom }
          }
          if (sql.includes('FROM kelas WHERE wali_kelas_id = ?')) {
            return { results: (options?.waliClassIds || []).map(id => ({ kelas_id: id })) }
          }
          if (sql.includes('FROM kelas_binaan_bk kb')) {
            return { results: (options?.bkClassIds || []).map(id => ({ kelas_id: id })) }
          }
          return { results: [] }
        },
        async run() {
          calls.push({ sql, args })
          return { success: true, meta: { changes: 1 } }
        },
      })

      return {
        ...execute([]),
        bind(...args: unknown[]) {
          return execute(args)
        },
      }
    },
  } as unknown as D1Database

  return { db, calls }
}

describe('parent login tracking utilities', () => {
  beforeEach(() => {
    resetParentLastSeenThrottleForTest()
  })

  it('normalizes Indonesian WhatsApp numbers and rejects invalid values', () => {
    expect(normalizeIndonesianWhatsAppNumber('081234567890')).toBe('6281234567890')
    expect(normalizeIndonesianWhatsAppNumber('+62 812-3456-7890')).toBe('6281234567890')
    expect(normalizeIndonesianWhatsAppNumber('6281234567890')).toBe('6281234567890')
    expect(normalizeIndonesianWhatsAppNumber('81234567890')).toBe('6281234567890')

    expect(normalizeIndonesianWhatsAppNumber('')).toBeNull()
    expect(normalizeIndonesianWhatsAppNumber(null)).toBeNull()
    expect(normalizeIndonesianWhatsAppNumber('08123')).toBeNull()
    expect(normalizeIndonesianWhatsAppNumber('12025550101')).toBeNull()
  })

  it('builds WhatsApp reminder URL without leaking sensitive fields', () => {
    const url = buildParentLoginReminderWaUrl({
      namaSiswa: 'Siti Aisyah',
      nisn: '0091234567',
      kelasNama: '10-1 KEAGAMAAN',
      nomorWhatsapp: '081234567890',
    })

    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/)
    const decoded = decodeURIComponent(url!.split('text=')[1])
    expect(decoded).toContain('Siti Aisyah')
    expect(decoded).toContain('10-1 KEAGAMAAN')
    expect(decoded).toContain('0091234567')
    expect(decoded).not.toContain('2009')

    expect(
      buildParentLoginReminderWaUrl({
        namaSiswa: 'Siti Aisyah',
        nisn: '0091234567',
        kelasNama: '10-1',
        nomorWhatsapp: 'invalid',
      })
    ).toBeNull()
  })

  it('records parent login upsert and seeds the 30-minute last-seen throttle', async () => {
    const { db, calls } = createMockDb()
    const nowIso = '2026-11-23T06:00:00.000Z'

    await recordParentLogin(db, 'siswa-1', nowIso)

    const upsertCall = calls.find(c => c.sql.includes('INSERT INTO parent_login_stats'))
    expect(upsertCall).toBeDefined()
    expect(upsertCall?.sql).toContain('login_count = parent_login_stats.login_count + 1')
    expect(upsertCall?.args).toEqual(['siswa-1', nowIso, nowIso, nowIso, nowIso])

    // Immediate touch within 30 minutes should be skipped by in-memory throttle
    const touchedImmediately = await touchParentLastSeen(db, 'siswa-1', Date.parse(nowIso) + 60_000)
    expect(touchedImmediately).toBe(false)
  })

  it('throttles touchParentLastSeen for 30 minutes and writes again once expired', async () => {
    const { db, calls } = createMockDb()
    const t0 = Date.parse('2026-11-23T06:00:00.000Z')

    const first = await touchParentLastSeen(db, 'siswa-2', t0)
    const withinWindow = await touchParentLastSeen(db, 'siswa-2', t0 + 10 * 60 * 1000)
    const afterWindow = await touchParentLastSeen(db, 'siswa-2', t0 + LAST_SEEN_THROTTLE_MS + 1000)

    expect(first).toBe(true)
    expect(withinWindow).toBe(false)
    expect(afterWindow).toBe(true)

    const touchCalls = calls.filter(c => c.sql.includes('ON CONFLICT(siswa_id) DO UPDATE SET'))
    expect(touchCalls).toHaveLength(2)

    resetParentLastSeenThrottleForTest()
    const afterReset = await touchParentLastSeen(db, 'siswa-2', t0 + LAST_SEEN_THROTTLE_MS + 2000)
    expect(afterReset).toBe(true)
  })

  it('resolves full scope for administrative roles and union class scope for wali_kelas / guru_bk', async () => {
    const { db } = createMockDb({
      waliClassIds: ['kelas-1', 'kelas-2'],
      bkClassIds: ['kelas-2', 'kelas-3'],
    })

    const adminScope = await resolveParentLoginScope(db, {
      kind: 'staff',
      id: 'admin-1',
      roles: ['kepsek'],
      sessionId: 'sess-1',
    })
    expect(adminScope).toEqual({ mode: 'all', allowedClassIds: null })

    const waliBkScope = await resolveParentLoginScope(db, {
      kind: 'staff',
      id: 'guru-1',
      roles: ['wali_kelas', 'guru_bk'],
      sessionId: 'sess-2',
    })
    expect(waliBkScope).toEqual({
      mode: 'scoped',
      allowedClassIds: ['kelas-1', 'kelas-2', 'kelas-3'],
    })
  })

  it('short-circuits queryParentLoginMonitoring when scoped teacher has no assigned classes', async () => {
    const { db, calls } = createMockDb()
    const result = await queryParentLoginMonitoring(db, { mode: 'scoped', allowedClassIds: [] })

    expect(result).toEqual({
      summary: { totalSiswa: 0, sudahLogin: 0, belumLogin: 0, persentaseLogin: 0, aktif7Hari: 0 },
      rows: [],
      total: 0,
      classRecaps: [],
      filterOptions: { tingkatList: [], kelasList: [] },
    })
    expect(calls).toHaveLength(0)
  })

  it('enforces allowedClassIds and ignores unauthorized kelasId filters in scoped mode', async () => {
    const { db, calls } = createMockDb()
    await queryParentLoginMonitoring(
      db,
      { mode: 'scoped', allowedClassIds: ['kelas-10a'] },
      { kelasId: 'kelas-unauthorized' }
    )

    const studentRowQuery = calls.find(c => c.sql.includes('FROM siswa s') && c.sql.includes('LIMIT ? OFFSET ?'))
    expect(studentRowQuery).toBeDefined()
    expect(studentRowQuery?.args).not.toContain('kelas-unauthorized')
    expect(studentRowQuery?.args).toContain('kelas-10a')
  })
})

describe('signInParent login tracking integration', () => {
  let passwordHash = ''

  beforeAll(async () => {
    passwordHash = await hashPassword('0098765432')
  })

  beforeEach(() => {
    resetParentLastSeenThrottleForTest()
  })

  it('does not create parent_session or record login when verifyOnly is true', async () => {
    const { db, calls } = createMockDb({ passwordHash })
    const auth = createAuth(db)

    const res = await auth.api.signInParent({
      body: { nisn: '0098765432', password: '0098765432' },
      asResponse: false,
      verifyOnly: true,
    })

    expect(res).toMatchObject({
      verified: true,
      user: { type: 'parent', siswa_id: 'siswa-1', nisn: '0098765432' },
    })
    expect(calls.some(c => c.sql.includes('INSERT INTO parent_session'))).toBe(false)
    expect(calls.some(c => c.sql.includes('INSERT INTO parent_login_stats'))).toBe(false)
  })

  it('creates parent_session and records login into parent_login_stats on normal parent login', async () => {
    const { db, calls } = createMockDb({ passwordHash })
    const auth = createAuth(db)

    const res = await auth.api.signInParent({
      body: { nisn: '0098765432', password: '0098765432' },
      asResponse: true,
    }) as Response

    expect(res.status).toBe(200)
    expect(calls.some(c => c.sql.includes('INSERT INTO parent_session'))).toBe(true)
    expect(calls.some(c => c.sql.includes('INSERT INTO parent_login_stats'))).toBe(true)
  })
})
