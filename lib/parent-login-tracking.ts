import { ensureSchemaOnce } from '@/lib/schema-guard'
import { isAdministrativeActor, type AuthenticatedActor } from '@/lib/action-security'
import { formatNamaKelas } from '@/lib/utils'

export const LAST_SEEN_THROTTLE_MS = 30 * 60 * 1000
const MAX_THROTTLE_ENTRIES = 2000
const EXPORT_ROW_CAP = 5000

const lastSeenThrottleCache = new Map<string, number>()

export type ParentLoginDataSource = 'tracked' | 'backfill_session' | 'backfill_credential'

export type ParentLoginScope =
  | { mode: 'all'; allowedClassIds: null }
  | { mode: 'scoped'; allowedClassIds: string[] }

export type ParentLoginSort = 'nama_asc' | 'last_login_desc' | 'last_seen_desc' | 'belum_dulu'
export type ParentLoginStatusFilter = 'all' | 'sudah' | 'belum'
export type ParentLoginActivityFilter = 'all' | '7d' | '30d' | 'inactive_30d'

export type ParentLoginFilters = {
  status?: ParentLoginStatusFilter
  tingkat?: string
  kelasId?: string
  aktivitas?: ParentLoginActivityFilter
  q?: string
  sort?: ParentLoginSort
  page?: number
  pageSize?: number | 'semua'
}

export type ParentLoginStudentRow = {
  id: string
  nisn: string
  nama_lengkap: string
  kelas_id: string | null
  kelas_nama: string
  tingkat: number | null
  nama_ayah: string | null
  nama_ibu: string | null
  nomor_whatsapp: string | null
  wa_url: string | null
  status_login: 'sudah' | 'belum'
  first_login_at: string | null
  last_login_at: string | null
  last_seen_at: string | null
  login_count: number
  data_source: ParentLoginDataSource | null
}

export type ParentLoginClassRecap = {
  kelas_id: string
  kelas_nama: string
  tingkat: number
  wali_kelas_nama: string | null
  total_siswa: number
  sudah_login: number
  belum_login: number
  aktif_7_hari: number
  persentase_login: number
}

export type ParentLoginSummary = {
  totalSiswa: number
  sudahLogin: number
  belumLogin: number
  persentaseLogin: number
  aktif7Hari: number
}

export type ParentLoginFilterOptions = {
  tingkatList: number[]
  kelasList: Array<{ id: string; nama: string; tingkat: number }>
}

export type ParentLoginMonitoringResult = {
  summary: ParentLoginSummary
  rows: ParentLoginStudentRow[]
  total: number
  classRecaps: ParentLoginClassRecap[]
  filterOptions: ParentLoginFilterOptions
}

export type ParentLoginExportResult = {
  summary: ParentLoginSummary
  rows: ParentLoginStudentRow[]
  classRecaps: ParentLoginClassRecap[]
}

const LATEST_ACTIVITY_DT_SQL = `CASE
  WHEN pls.last_seen_at IS NOT NULL AND datetime(pls.last_seen_at) > datetime(pls.last_login_at)
    THEN datetime(pls.last_seen_at)
  ELSE datetime(pls.last_login_at)
END`

function setThrottleEntry(siswaId: string, timestampMs: number) {
  if (lastSeenThrottleCache.has(siswaId)) {
    lastSeenThrottleCache.delete(siswaId)
  } else if (lastSeenThrottleCache.size >= MAX_THROTTLE_ENTRIES) {
    const oldestKey = lastSeenThrottleCache.keys().next().value
    if (oldestKey) lastSeenThrottleCache.delete(oldestKey)
  }
  lastSeenThrottleCache.set(siswaId, timestampMs)
}

export function resetParentLastSeenThrottleForTest() {
  lastSeenThrottleCache.clear()
}

export async function ensureParentLoginStatsSchema(db: D1Database): Promise<void> {
  await ensureSchemaOnce('parent-login-stats', async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS parent_login_stats (
        siswa_id        TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
        first_login_at  TEXT NOT NULL,
        last_login_at   TEXT NOT NULL,
        last_seen_at    TEXT,
        login_count     INTEGER NOT NULL DEFAULT 1,
        data_source     TEXT NOT NULL DEFAULT 'tracked'
                        CHECK(data_source IN ('tracked', 'backfill_session', 'backfill_credential')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_parent_login_stats_last_login
      ON parent_login_stats(last_login_at DESC)
    `).run()
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_parent_login_stats_last_seen
      ON parent_login_stats(last_seen_at DESC)
    `).run()
  })
}

/**
 * Mencatat event login baru orang tua ke parent_login_stats secara atomik.
 */
export async function recordParentLogin(
  db: D1Database,
  siswaId: string,
  nowIso = new Date().toISOString()
): Promise<void> {
  if (!siswaId) return
  await ensureParentLoginStatsSchema(db)
  await db.prepare(`
    INSERT INTO parent_login_stats (
      siswa_id, first_login_at, last_login_at, last_seen_at, login_count, data_source, updated_at
    ) VALUES (?, ?, ?, ?, 1, 'tracked', ?)
    ON CONFLICT(siswa_id) DO UPDATE SET
      last_login_at = excluded.last_login_at,
      last_seen_at = excluded.last_seen_at,
      login_count = parent_login_stats.login_count + 1,
      data_source = 'tracked',
      updated_at = excluded.updated_at
  `).bind(siswaId, nowIso, nowIso, nowIso, nowIso).run()

  const parsedMs = Date.parse(nowIso)
  setThrottleEntry(siswaId, Number.isFinite(parsedMs) ? parsedMs : Date.now())
}

/**
 * Memperbarui last_seen_at saat orang tua membuka portal dengan throttle 30 menit
 * (cache in-memory per isolate + guard SQL) agar hemat operasi tulis D1.
 */
export async function touchParentLastSeen(
  db: D1Database,
  siswaId: string,
  nowMs = Date.now()
): Promise<boolean> {
  if (!siswaId) return false
  const previousMs = lastSeenThrottleCache.get(siswaId)
  if (previousMs !== undefined && nowMs - previousMs < LAST_SEEN_THROTTLE_MS) {
    return false
  }

  await ensureParentLoginStatsSchema(db)
  const nowIso = new Date(nowMs).toISOString()
  await db.prepare(`
    INSERT INTO parent_login_stats (
      siswa_id, first_login_at, last_login_at, last_seen_at, login_count, data_source, updated_at
    ) VALUES (?, ?, ?, ?, 1, 'tracked', ?)
    ON CONFLICT(siswa_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
    WHERE parent_login_stats.last_seen_at IS NULL
       OR datetime(parent_login_stats.last_seen_at) <= datetime(excluded.last_seen_at, '-30 minutes')
  `).bind(siswaId, nowIso, nowIso, nowIso, nowIso).run()

  setThrottleEntry(siswaId, nowMs)
  return true
}

export function normalizeIndonesianWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null

  let normalized = digits
  if (normalized.startsWith('0')) {
    normalized = `62${normalized.slice(1)}`
  } else if (normalized.startsWith('8')) {
    normalized = `62${normalized}`
  }

  if (!normalized.startsWith('62') || normalized.length < 10 || normalized.length > 15) {
    return null
  }
  return normalized
}

export function buildParentLoginReminderWaUrl(params: {
  namaSiswa: string
  nisn: string
  kelasNama: string
  nomorWhatsapp: string | null | undefined
  portalUrl?: string
}): string | null {
  const phone = normalizeIndonesianWhatsAppNumber(params.nomorWhatsapp)
  if (!phone) return null

  const cleanNisn = String(params.nisn || '').replace(/\D/g, '') || params.nisn
  const portalLocation = params.portalUrl ? ` melalui ${params.portalUrl}` : ''
  const message = [
    `Assalamu'alaikum Bapak/Ibu wali murid dari *${params.namaSiswa}* (Kelas ${params.kelasNama}).`,
    `Kami informasikan Portal Orang Tua MAN 1 Tasikmalaya sudah tersedia${portalLocation} untuk memantau kehadiran, jadwal, nilai, dan administrasi putra/putri Anda.`,
    `Silakan masuk menggunakan Username: *${cleanNisn}* (NISN anak) dan Password awal berupa NISN atau tanggal lahir anak (format DDMMYYYY).`,
    `Jika mengalami kendala login, silakan hubungi pihak madrasah. Terima kasih.`,
  ].join('\n\n')

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export async function resolveParentLoginScope(
  db: D1Database,
  actor: AuthenticatedActor
): Promise<ParentLoginScope> {
  if (isAdministrativeActor(actor)) {
    return { mode: 'all', allowedClassIds: null }
  }

  const [waliRows, bkRows] = await Promise.all([
    db.prepare('SELECT id AS kelas_id FROM kelas WHERE wali_kelas_id = ?')
      .bind(actor.id)
      .all<{ kelas_id: string }>(),
    db.prepare(`
      SELECT kb.kelas_id
      FROM kelas_binaan_bk kb
      JOIN tahun_ajaran ta ON ta.id = kb.tahun_ajaran_id AND ta.is_active = 1
      WHERE kb.guru_bk_id = ?
    `).bind(actor.id).all<{ kelas_id: string }>(),
  ])

  const ids = new Set<string>()
  for (const row of waliRows.results || []) {
    if (row.kelas_id) ids.add(row.kelas_id)
  }
  for (const row of bkRows.results || []) {
    if (row.kelas_id) ids.add(row.kelas_id)
  }

  return { mode: 'scoped', allowedClassIds: Array.from(ids) }
}

function emptyResult(): ParentLoginMonitoringResult {
  return {
    summary: {
      totalSiswa: 0,
      sudahLogin: 0,
      belumLogin: 0,
      persentaseLogin: 0,
      aktif7Hari: 0,
    },
    rows: [],
    total: 0,
    classRecaps: [],
    filterOptions: { tingkatList: [], kelasList: [] },
  }
}

function parseTingkatFilter(value?: string): number | null {
  const num = Number(value)
  return Number.isInteger(num) && num > 0 && num <= 20 ? num : null
}

function resolveOrderBy(sort?: ParentLoginSort): string {
  switch (sort) {
    case 'last_login_desc':
      return 'CASE WHEN pls.last_login_at IS NULL THEN 1 ELSE 0 END ASC, datetime(pls.last_login_at) DESC, s.nama_lengkap ASC'
    case 'last_seen_desc':
      return `CASE WHEN COALESCE(pls.last_seen_at, pls.last_login_at) IS NULL THEN 1 ELSE 0 END ASC, ${LATEST_ACTIVITY_DT_SQL} DESC, s.nama_lengkap ASC`
    case 'belum_dulu':
      return 'CASE WHEN pls.siswa_id IS NULL THEN 0 ELSE 1 END ASC, CASE WHEN k.id IS NULL THEN 1 ELSE 0 END ASC, k.tingkat ASC, k.kelompok ASC, CAST(k.nomor_kelas AS INTEGER) ASC, s.nama_lengkap ASC'
    case 'nama_asc':
    default:
      return 'CASE WHEN k.id IS NULL THEN 1 ELSE 0 END ASC, k.tingkat ASC, k.kelompok ASC, CAST(k.nomor_kelas AS INTEGER) ASC, s.nama_lengkap ASC'
  }
}

function buildWhereClauses(scope: ParentLoginScope, filters: ParentLoginFilters) {
  const baseWhere: string[] = ["s.status = 'aktif'"]
  const baseParams: unknown[] = []

  if (scope.mode === 'scoped') {
    const placeholders = scope.allowedClassIds.map(() => '?').join(',')
    baseWhere.push(`s.kelas_id IN (${placeholders})`)
    baseParams.push(...scope.allowedClassIds)
  }

  const tingkat = parseTingkatFilter(filters.tingkat)
  if (tingkat !== null) {
    baseWhere.push('k.tingkat = ?')
    baseParams.push(tingkat)
  }

  const rawKelasId = String(filters.kelasId || '').trim()
  const cleanKelasId = rawKelasId && rawKelasId !== 'all' ? rawKelasId : ''
  if (cleanKelasId) {
    if (scope.mode === 'all' || scope.allowedClassIds.includes(cleanKelasId)) {
      baseWhere.push('s.kelas_id = ?')
      baseParams.push(cleanKelasId)
    }
  }

  const rowWhere = [...baseWhere]
  const rowParams = [...baseParams]

  if (filters.status === 'sudah') {
    rowWhere.push('pls.siswa_id IS NOT NULL')
  } else if (filters.status === 'belum') {
    rowWhere.push('pls.siswa_id IS NULL')
  }

  if (filters.aktivitas === '7d') {
    rowWhere.push(`pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} >= datetime('now', '-7 days')`)
  } else if (filters.aktivitas === '30d') {
    rowWhere.push(`pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} >= datetime('now', '-30 days')`)
  } else if (filters.aktivitas === 'inactive_30d') {
    rowWhere.push(`pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} < datetime('now', '-30 days')`)
  }

  const cleanQuery = String(filters.q || '').trim().slice(0, 100)
  if (cleanQuery) {
    rowWhere.push(`(
      LOWER(s.nama_lengkap) LIKE LOWER(?)
      OR s.nisn LIKE ?
      OR LOWER(COALESCE(s.nama_ayah, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(s.nama_ibu, '')) LIKE LOWER(?)
    )`)
    const pattern = `%${cleanQuery}%`
    rowParams.push(pattern, pattern, pattern, pattern)
  }

  return {
    baseWhereSql: `WHERE ${baseWhere.join(' AND ')}`,
    baseParams,
    rowWhereSql: `WHERE ${rowWhere.join(' AND ')}`,
    rowParams,
    tingkat,
  }
}

function mapStudentRow(row: any): ParentLoginStudentRow {
  const kelasNama = row.kelas_id
    ? formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)
    : 'Belum Masuk Kelas'
  const statusLogin: 'sudah' | 'belum' = row.has_login ? 'sudah' : 'belum'

  return {
    id: row.id,
    nisn: row.nisn || '',
    nama_lengkap: row.nama_lengkap || '',
    kelas_id: row.kelas_id || null,
    kelas_nama: kelasNama,
    tingkat: row.tingkat !== null && row.tingkat !== undefined ? Number(row.tingkat) : null,
    nama_ayah: row.nama_ayah || null,
    nama_ibu: row.nama_ibu || null,
    nomor_whatsapp: row.nomor_whatsapp || null,
    wa_url: buildParentLoginReminderWaUrl({
      namaSiswa: row.nama_lengkap || '',
      nisn: row.nisn || '',
      kelasNama,
      nomorWhatsapp: row.nomor_whatsapp,
    }),
    status_login: statusLogin,
    first_login_at: row.first_login_at || null,
    last_login_at: row.last_login_at || null,
    last_seen_at: row.last_seen_at || null,
    login_count: statusLogin === 'sudah' ? Number(row.login_count || 0) : 0,
    data_source: (row.data_source as ParentLoginDataSource | null) || null,
  }
}

function mapSummaryRow(row: any): ParentLoginSummary {
  const totalSiswa = Number(row?.total_siswa || 0)
  const sudahLogin = Number(row?.sudah_login || 0)
  const belumLogin = Math.max(0, totalSiswa - sudahLogin)
  const aktif7Hari = Number(row?.aktif_7_hari || 0)
  const persentaseLogin = totalSiswa > 0 ? Math.round((sudahLogin / totalSiswa) * 1000) / 10 : 0
  return { totalSiswa, sudahLogin, belumLogin, persentaseLogin, aktif7Hari }
}

function mapClassRecapRow(row: any): ParentLoginClassRecap {
  const totalSiswa = Number(row.total_siswa || 0)
  const sudahLogin = Number(row.sudah_login || 0)
  const belumLogin = Math.max(0, totalSiswa - sudahLogin)
  const persentaseLogin = totalSiswa > 0 ? Math.round((sudahLogin / totalSiswa) * 1000) / 10 : 0
  return {
    kelas_id: row.kelas_id,
    kelas_nama: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    tingkat: Number(row.tingkat || 0),
    wali_kelas_nama: row.wali_kelas_nama || null,
    total_siswa: totalSiswa,
    sudah_login: sudahLogin,
    belum_login: belumLogin,
    aktif_7_hari: Number(row.aktif_7_hari || 0),
    persentase_login: persentaseLogin,
  }
}

async function queryClassRecaps(
  db: D1Database,
  scope: ParentLoginScope,
  tingkat: number | null
): Promise<ParentLoginClassRecap[]> {
  const where: string[] = []
  const params: unknown[] = []

  if (scope.mode === 'scoped') {
    const placeholders = scope.allowedClassIds.map(() => '?').join(',')
    where.push(`k.id IN (${placeholders})`)
    params.push(...scope.allowedClassIds)
  }
  if (tingkat !== null) {
    where.push('k.tingkat = ?')
    params.push(tingkat)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const result = await db.prepare(`
    SELECT
      k.id AS kelas_id,
      k.tingkat,
      k.nomor_kelas,
      k.kelompok,
      COALESCE(u.nama_lengkap, u.name) AS wali_kelas_nama,
      COUNT(s.id) AS total_siswa,
      SUM(CASE WHEN pls.siswa_id IS NOT NULL THEN 1 ELSE 0 END) AS sudah_login,
      SUM(CASE WHEN pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS aktif_7_hari
    FROM kelas k
    LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
    LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
    LEFT JOIN "user" u ON u.id = k.wali_kelas_id
    ${whereSql}
    GROUP BY k.id
    HAVING COUNT(s.id) > 0
    ORDER BY k.tingkat ASC, k.kelompok ASC, CAST(k.nomor_kelas AS INTEGER) ASC
  `).bind(...params).all<any>()

  return (result.results || []).map(mapClassRecapRow)
}

export async function queryParentLoginMonitoring(
  db: D1Database,
  scope: ParentLoginScope,
  filters: ParentLoginFilters = {}
): Promise<ParentLoginMonitoringResult> {
  if (scope.mode === 'scoped' && scope.allowedClassIds.length === 0) {
    return emptyResult()
  }

  await ensureParentLoginStatsSchema(db)

  const { baseWhereSql, baseParams, rowWhereSql, rowParams, tingkat } = buildWhereClauses(scope, filters)
  const orderBy = resolveOrderBy(filters.sort)
  const isSemua = filters.pageSize === 'semua'
  const pageSize = isSemua
    ? EXPORT_ROW_CAP
    : Math.max(10, Math.min(200, Number(filters.pageSize) || 25))
  const page = isSemua ? 1 : Math.max(1, Number(filters.page) || 1)
  const offset = (page - 1) * pageSize

  const scopeClassWhere = scope.mode === 'scoped'
    ? `WHERE id IN (${scope.allowedClassIds.map(() => '?').join(',')})`
    : ''
  const scopeClassParams = scope.mode === 'scoped' ? [...scope.allowedClassIds] : []

  const [kelasOptionsRes, summaryRes, countRes, rowsRes, classRecaps] = await Promise.all([
    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok
      FROM kelas
      ${scopeClassWhere}
      ORDER BY tingkat ASC, kelompok ASC, CAST(nomor_kelas AS INTEGER) ASC
    `).bind(...scopeClassParams).all<any>(),
    db.prepare(`
      SELECT
        COUNT(*) AS total_siswa,
        SUM(CASE WHEN pls.siswa_id IS NOT NULL THEN 1 ELSE 0 END) AS sudah_login,
        SUM(CASE WHEN pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS aktif_7_hari
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
      ${baseWhereSql}
    `).bind(...baseParams).first<any>(),
    db.prepare(`
      SELECT COUNT(*) AS total
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
      ${rowWhereSql}
    `).bind(...rowParams).first<{ total: number }>(),
    db.prepare(`
      SELECT
        s.id,
        s.nisn,
        s.nama_lengkap,
        s.kelas_id,
        s.nama_ayah,
        s.nama_ibu,
        s.nomor_whatsapp,
        k.tingkat,
        k.nomor_kelas,
        k.kelompok,
        CASE WHEN pls.siswa_id IS NOT NULL THEN 1 ELSE 0 END AS has_login,
        pls.first_login_at,
        pls.last_login_at,
        pls.last_seen_at,
        pls.login_count,
        pls.data_source
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
      ${rowWhereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...rowParams, pageSize, offset).all<any>(),
    queryClassRecaps(db, scope, tingkat),
  ])

  const kelasList = (kelasOptionsRes.results || []).map((k: any) => ({
    id: k.id,
    nama: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
    tingkat: Number(k.tingkat || 0),
  }))
  const tingkatList = Array.from(new Set(kelasList.map(k => k.tingkat).filter(t => t > 0))).sort((a, b) => a - b)

  return {
    summary: mapSummaryRow(summaryRes),
    rows: (rowsRes.results || []).map(mapStudentRow),
    total: Number(countRes?.total || 0),
    classRecaps,
    filterOptions: { tingkatList, kelasList },
  }
}

export async function queryParentLoginExportRows(
  db: D1Database,
  scope: ParentLoginScope,
  filters: ParentLoginFilters = {}
): Promise<ParentLoginExportResult> {
  if (scope.mode === 'scoped' && scope.allowedClassIds.length === 0) {
    const empty = emptyResult()
    return { summary: empty.summary, rows: [], classRecaps: [] }
  }

  await ensureParentLoginStatsSchema(db)

  const { baseWhereSql, baseParams, rowWhereSql, rowParams, tingkat } = buildWhereClauses(scope, filters)
  const orderBy = resolveOrderBy(filters.sort)

  const [summaryRes, rowsRes, classRecaps] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total_siswa,
        SUM(CASE WHEN pls.siswa_id IS NOT NULL THEN 1 ELSE 0 END) AS sudah_login,
        SUM(CASE WHEN pls.siswa_id IS NOT NULL AND ${LATEST_ACTIVITY_DT_SQL} >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS aktif_7_hari
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
      ${baseWhereSql}
    `).bind(...baseParams).first<any>(),
    db.prepare(`
      SELECT
        s.id,
        s.nisn,
        s.nama_lengkap,
        s.kelas_id,
        s.nama_ayah,
        s.nama_ibu,
        s.nomor_whatsapp,
        k.tingkat,
        k.nomor_kelas,
        k.kelompok,
        CASE WHEN pls.siswa_id IS NOT NULL THEN 1 ELSE 0 END AS has_login,
        pls.first_login_at,
        pls.last_login_at,
        pls.last_seen_at,
        pls.login_count,
        pls.data_source
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN parent_login_stats pls ON pls.siswa_id = s.id
      ${rowWhereSql}
      ORDER BY ${orderBy}
      LIMIT ?
    `).bind(...rowParams, EXPORT_ROW_CAP).all<any>(),
    queryClassRecaps(db, scope, tingkat),
  ])

  return {
    summary: mapSummaryRow(summaryRes),
    rows: (rowsRes.results || []).map(mapStudentRow),
    classRecaps,
  }
}
