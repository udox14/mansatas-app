import { getCloudflareContext } from '@opennextjs/cloudflare'

export const WA_FEATURE_ID = 'whatsapp'
export const WA_ALFA_PURPOSE = 'attendance_alfa'
export const WA_ALFA_TEMPLATE = 'attendance_alfa_parent'
export const WA_DEFAULT_LANGUAGE = 'id'
export const WA_DEFAULT_PROVIDER = 'wablas'

type D1MetaResult = { meta?: { changes?: number } }

type WaOutboxRow = {
  id: string
  campaign_id: string | null
  purpose: string
  category: string
  recipient_phone: string
  recipient_name: string | null
  template_name: string | null
  language_code: string | null
  body_text: string | null
  payload_json: string | null
  siswa_ids: string | null
  attendance_date: string | null
  status: string
  retry_count: number
  max_retry: number
}

export type WaTargetScope = 'all' | 'kelas' | 'tingkat' | 'siswa'

export type WaCampaignPreview = {
  totalSiswa: number
  totalValidRecipients: number
  totalInvalidOrEmpty: number
  sampleRecipients: Array<{ siswa_id: string; nama_lengkap: string; kelas_label: string; nomor_whatsapp: string; normalized_phone: string }>
}

function getEnvValue(env: Record<string, any>, key: string): string {
  return String(env[key] || process.env[key] || '').trim()
}

export async function getWhatsAppConfig() {
  const { env } = await getCloudflareContext({ async: true })
  return {
    provider: (getEnvValue(env as any, 'WHATSAPP_PROVIDER') || WA_DEFAULT_PROVIDER).toLowerCase(),
    accessToken: getEnvValue(env as any, 'WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: getEnvValue(env as any, 'WHATSAPP_PHONE_NUMBER_ID'),
    verifyToken: getEnvValue(env as any, 'WHATSAPP_VERIFY_TOKEN'),
    appSecret: getEnvValue(env as any, 'WHATSAPP_APP_SECRET'),
    graphVersion: getEnvValue(env as any, 'WHATSAPP_GRAPH_VERSION') || 'v20.0',
    wablasBaseUrl: getEnvValue(env as any, 'WABLAS_BASE_URL') || 'https://texas.wablas.com',
    wablasToken: getEnvValue(env as any, 'WABLAS_TOKEN'),
    wablasSecretKey: getEnvValue(env as any, 'WABLAS_SECRET_KEY'),
  }
}

export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = String(raw).trim()
  if (!value) return null
  value = value.replace(/[^\d+]/g, '')
  if (value.startsWith('+')) value = value.slice(1)
  if (value.startsWith('00')) value = value.slice(2)
  if (value.startsWith('0')) value = `62${value.slice(1)}`
  if (value.startsWith('8')) value = `62${value}`
  if (!/^62\d{8,14}$/.test(value)) return null
  return value
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

function buildTemplateComponents(payloadJson: string | null | undefined) {
  const payload = parseJson<any>(payloadJson, {})
  if (Array.isArray(payload.components)) return payload.components
  const bodyParams = Array.isArray(payload.bodyParams) ? payload.bodyParams : []
  if (bodyParams.length === 0) return undefined
  return [{
    type: 'body',
    parameters: bodyParams.map((text: unknown) => ({ type: 'text', text: String(text ?? '') })),
  }]
}

async function sendViaCloudApi(row: WaOutboxRow) {
  const config = await getWhatsAppConfig()
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN atau WHATSAPP_PHONE_NUMBER_ID belum dikonfigurasi.')
  }

  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: row.recipient_phone,
  }

  if (row.template_name) {
    payload.type = 'template'
    payload.template = {
      name: row.template_name,
      language: { code: row.language_code || WA_DEFAULT_LANGUAGE },
    }
    const components = buildTemplateComponents(row.payload_json)
    if (components) payload.template.components = components
  } else {
    payload.type = 'text'
    payload.text = { preview_url: true, body: row.body_text || '' }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.error?.message || `WhatsApp API error ${response.status}`)
  }
  return String(json?.messages?.[0]?.id || '')
}

async function sendViaWablas(row: WaOutboxRow) {
  const config = await getWhatsAppConfig()
  if (!config.wablasToken || !config.wablasSecretKey) {
    throw new Error('WABLAS_TOKEN atau WABLAS_SECRET_KEY belum dikonfigurasi.')
  }

  const baseUrl = config.wablasBaseUrl.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/api/send-message`, {
    method: 'POST',
    headers: {
      Authorization: `${config.wablasToken}.${config.wablasSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: row.recipient_phone,
      message: row.body_text || '',
      flag: 'instant',
    }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.status === false) {
    throw new Error(json?.message || json?.error || `WABLAS API error ${response.status}`)
  }
  return String(json?.data?.messages?.[0]?.id || json?.data?.id || json?.id || '')
}

async function sendViaConfiguredProvider(row: WaOutboxRow) {
  const config = await getWhatsAppConfig()
  if (config.provider === 'meta' || config.provider === 'cloud_api') {
    return sendViaCloudApi(row)
  }
  return sendViaWablas(row)
}

export async function ensureWhatsAppTables(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS wa_campaigns (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT 'school_announcement',
        template_name TEXT,
        language_code TEXT NOT NULL DEFAULT 'id',
        category TEXT NOT NULL DEFAULT 'utility',
        body_text TEXT NOT NULL,
        target_scope TEXT NOT NULL DEFAULT 'all',
        kelas_id TEXT REFERENCES kelas(id) ON DELETE SET NULL,
        tingkat INTEGER,
        total_recipients INTEGER NOT NULL DEFAULT 0,
        total_enqueued INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS wa_campaign_recipients (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        campaign_id TEXT NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
        siswa_id TEXT REFERENCES siswa(id) ON DELETE SET NULL,
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        outbox_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(campaign_id, recipient_phone)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS wa_outbox (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        campaign_id TEXT REFERENCES wa_campaigns(id) ON DELETE SET NULL,
        purpose TEXT NOT NULL DEFAULT 'custom',
        category TEXT NOT NULL DEFAULT 'utility',
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        template_name TEXT,
        language_code TEXT NOT NULL DEFAULT 'id',
        body_text TEXT,
        payload_json TEXT,
        siswa_ids TEXT,
        attendance_date TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retry INTEGER NOT NULL DEFAULT 3,
        scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT,
        provider_message_id TEXT,
        error_message TEXT,
        created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS wa_daily_locks (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        tanggal TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        outbox_id TEXT REFERENCES wa_outbox(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tanggal, recipient_phone, purpose)
      )
    `),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_wa_outbox_status_due ON wa_outbox(status, scheduled_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_wa_outbox_attendance ON wa_outbox(purpose, attendance_date, recipient_phone)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_wa_outbox_campaign ON wa_outbox(campaign_id, status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign ON wa_campaign_recipients(campaign_id, status)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_wa_daily_locks_lookup ON wa_daily_locks(tanggal, recipient_phone, purpose)'),
  ])
}

function kelasLabel(row: any) {
  return `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ` ${row.kelompok}` : ''}`
}

function buildTargetWhere(scope: WaTargetScope, options: { kelasId?: string | null; tingkat?: number | null; siswaIds?: string[] }) {
  const conditions = ["s.status = 'aktif'", "s.nomor_whatsapp IS NOT NULL", "TRIM(s.nomor_whatsapp) <> ''"]
  const params: any[] = []
  if (scope === 'kelas' && options.kelasId) {
    conditions.push('s.kelas_id = ?')
    params.push(options.kelasId)
  } else if (scope === 'tingkat' && options.tingkat) {
    conditions.push('k.tingkat = ?')
    params.push(options.tingkat)
  } else if (scope === 'siswa' && options.siswaIds?.length) {
    conditions.push(`s.id IN (${options.siswaIds.map(() => '?').join(',')})`)
    params.push(...options.siswaIds)
  }
  return { where: conditions.join(' AND '), params }
}

export async function previewWhatsAppRecipients(
  db: D1Database,
  scope: WaTargetScope,
  options: { kelasId?: string | null; tingkat?: number | null; siswaIds?: string[] } = {}
): Promise<WaCampaignPreview> {
  await ensureWhatsAppTables(db)
  const { where, params } = buildTargetWhere(scope, options)
  const rows = await db.prepare(`
    SELECT s.id AS siswa_id, s.nama_lengkap, s.nomor_whatsapp, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE ${where}
    ORDER BY k.tingkat, k.kelompok, CAST(k.nomor_kelas AS INTEGER), s.nama_lengkap
    LIMIT 2000
  `).bind(...params).all<any>()

  const byPhone = new Map<string, any>()
  let invalid = 0
  for (const row of rows.results || []) {
    const normalized = normalizeWhatsAppNumber(row.nomor_whatsapp)
    if (!normalized) {
      invalid += 1
      continue
    }
    if (!byPhone.has(normalized)) {
      byPhone.set(normalized, {
        siswa_id: row.siswa_id,
        nama_lengkap: row.nama_lengkap,
        kelas_label: kelasLabel(row),
        nomor_whatsapp: row.nomor_whatsapp,
        normalized_phone: normalized,
      })
    }
  }

  return {
    totalSiswa: rows.results?.length || 0,
    totalValidRecipients: byPhone.size,
    totalInvalidOrEmpty: invalid,
    sampleRecipients: Array.from(byPhone.values()).slice(0, 10),
  }
}

export async function enqueueAttendanceAlfaNotifications(
  db: D1Database,
  options: { penugasanId: string; tanggal: string; createdBy?: string | null }
) {
  await ensureWhatsAppTables(db)
  const alfaRows = await db.prepare(`
    SELECT ab.siswa_id, s.nama_lengkap, s.nomor_whatsapp, k.tingkat, k.nomor_kelas, k.kelompok
    FROM absensi_siswa ab
    JOIN siswa s ON s.id = ab.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE ab.penugasan_id = ? AND ab.tanggal = ? AND ab.status = 'ALFA'
      AND s.status = 'aktif'
      AND s.nomor_whatsapp IS NOT NULL
      AND TRIM(s.nomor_whatsapp) <> ''
    ORDER BY s.nama_lengkap
  `).bind(options.penugasanId, options.tanggal).all<any>()

  const grouped = new Map<string, any[]>()
  for (const row of alfaRows.results || []) {
    const phone = normalizeWhatsAppNumber(row.nomor_whatsapp)
    if (!phone) continue
    const existingLock = await db.prepare(`
      SELECT 1 FROM wa_daily_locks
      WHERE tanggal = ? AND recipient_phone = ? AND purpose = ?
      LIMIT 1
    `).bind(options.tanggal, phone, WA_ALFA_PURPOSE).first()
    if (existingLock) continue
    const existingOutbox = await db.prepare(`
      SELECT 1 FROM wa_outbox
      WHERE attendance_date = ? AND recipient_phone = ? AND purpose = ?
        AND status IN ('queued', 'sending', 'sent', 'delivered', 'read')
      LIMIT 1
    `).bind(options.tanggal, phone, WA_ALFA_PURPOSE).first()
    if (existingOutbox) continue
    if (!grouped.has(phone)) grouped.set(phone, [])
    grouped.get(phone)!.push(row)
  }

  const statements: D1PreparedStatement[] = []
  for (const [phone, rows] of grouped) {
    const names = rows.map(row => row.nama_lengkap).join(', ')
    const kelas = rows.map(row => kelasLabel(row)).filter(Boolean).join(', ')
    const body = `Ananda ${names} tercatat ALFA pada ${options.tanggal}. Mohon konfirmasi kepada wali kelas atau pihak madrasah.`
    statements.push(db.prepare(`
      INSERT INTO wa_outbox
        (purpose, category, recipient_phone, recipient_name, template_name, language_code, body_text, payload_json, siswa_ids, attendance_date, scheduled_at, created_by)
      VALUES (?, 'utility', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+15 minutes'), ?)
    `).bind(
      WA_ALFA_PURPOSE,
      phone,
      names,
      WA_ALFA_TEMPLATE,
      WA_DEFAULT_LANGUAGE,
      body,
      JSON.stringify({ bodyParams: [names, options.tanggal, kelas] }),
      JSON.stringify(rows.map(row => row.siswa_id)),
      options.tanggal,
      options.createdBy || null
    ))
  }
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100))
  return { enqueued: statements.length }
}

export async function createWhatsAppCampaign(db: D1Database, input: {
  title: string
  bodyText: string
  purpose: string
  category: string
  templateName?: string | null
  languageCode?: string | null
  targetScope: WaTargetScope
  kelasId?: string | null
  tingkat?: number | null
  siswaIds?: string[]
  createdBy: string
}) {
  await ensureWhatsAppTables(db)
  const preview = await previewWhatsAppRecipients(db, input.targetScope, {
    kelasId: input.kelasId,
    tingkat: input.tingkat,
    siswaIds: input.siswaIds,
  })
  if (preview.totalValidRecipients === 0) throw new Error('Tidak ada nomor WhatsApp valid pada target ini.')

  const campaign = await db.prepare(`
    INSERT INTO wa_campaigns
      (title, purpose, template_name, language_code, category, body_text, target_scope, kelas_id, tingkat, total_recipients, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)
    RETURNING id
  `).bind(
    input.title,
    input.purpose,
    input.templateName || null,
    input.languageCode || WA_DEFAULT_LANGUAGE,
    input.category,
    input.bodyText,
    input.targetScope,
    input.targetScope === 'kelas' ? input.kelasId || null : null,
    input.targetScope === 'tingkat' ? input.tingkat || null : null,
    preview.totalValidRecipients,
    input.createdBy
  ).first<{ id: string }>()
  if (!campaign?.id) throw new Error('Gagal membuat campaign WhatsApp.')

  const { where, params } = buildTargetWhere(input.targetScope, {
    kelasId: input.kelasId,
    tingkat: input.tingkat,
    siswaIds: input.siswaIds,
  })
  const rows = await db.prepare(`
    SELECT s.id AS siswa_id, s.nama_lengkap, s.nomor_whatsapp
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE ${where}
    ORDER BY s.nama_lengkap
  `).bind(...params).all<any>()

  const byPhone = new Map<string, any>()
  for (const row of rows.results || []) {
    const phone = normalizeWhatsAppNumber(row.nomor_whatsapp)
    if (!phone || byPhone.has(phone)) continue
    byPhone.set(phone, row)
  }

  const statements: D1PreparedStatement[] = []
  for (const [phone, row] of byPhone) {
    const payloadJson = JSON.stringify({ bodyParams: [input.bodyText] })
    statements.push(db.prepare(`
      INSERT INTO wa_outbox
        (campaign_id, purpose, category, recipient_phone, recipient_name, template_name, language_code, body_text, payload_json, siswa_ids, scheduled_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).bind(
      campaign.id,
      input.purpose,
      input.category,
      phone,
      row.nama_lengkap,
      input.templateName || null,
      input.languageCode || WA_DEFAULT_LANGUAGE,
      input.bodyText,
      payloadJson,
      JSON.stringify([row.siswa_id]),
      input.createdBy
    ))
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO wa_campaign_recipients
        (campaign_id, siswa_id, recipient_phone, recipient_name)
      VALUES (?, ?, ?, ?)
    `).bind(campaign.id, row.siswa_id, phone, row.nama_lengkap))
  }
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100))
  await db.prepare(`
    UPDATE wa_campaigns
    SET total_enqueued = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(byPhone.size, campaign.id).run()

  const outboxRows = await db.prepare(`
    SELECT id, recipient_phone FROM wa_outbox WHERE campaign_id = ?
  `).bind(campaign.id).all<any>()
  const updateRecipientStatements = (outboxRows.results || []).map(row => db.prepare(`
    UPDATE wa_campaign_recipients
    SET outbox_id = ?, updated_at = datetime('now')
    WHERE campaign_id = ? AND recipient_phone = ?
  `).bind(row.id, campaign.id, row.recipient_phone))
  for (let i = 0; i < updateRecipientStatements.length; i += 100) await db.batch(updateRecipientStatements.slice(i, i + 100))

  return { campaignId: campaign.id, enqueued: byPhone.size, preview }
}

async function attendanceStillAlfa(db: D1Database, row: WaOutboxRow) {
  if (row.purpose !== WA_ALFA_PURPOSE) return true
  const siswaIds = parseJson<string[]>(row.siswa_ids, [])
  if (!row.attendance_date || siswaIds.length === 0) return false
  const result = await db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM absensi_siswa
    WHERE tanggal = ? AND status = 'ALFA'
      AND siswa_id IN (${siswaIds.map(() => '?').join(',')})
  `).bind(row.attendance_date, ...siswaIds).first<any>()
  return Number(result?.cnt || 0) > 0
}

async function acquireDailyLock(db: D1Database, row: WaOutboxRow) {
  if (row.purpose !== WA_ALFA_PURPOSE || !row.attendance_date) return true
  const result = await db.prepare(`
    INSERT OR IGNORE INTO wa_daily_locks (tanggal, recipient_phone, purpose, outbox_id)
    VALUES (?, ?, ?, ?)
  `).bind(row.attendance_date, row.recipient_phone, row.purpose, row.id).run() as D1MetaResult
  return Number(result.meta?.changes || 0) > 0
}

async function releaseDailyLock(db: D1Database, row: WaOutboxRow) {
  if (row.purpose !== WA_ALFA_PURPOSE || !row.attendance_date) return
  await db.prepare(`
    DELETE FROM wa_daily_locks
    WHERE tanggal = ? AND recipient_phone = ? AND purpose = ? AND outbox_id = ?
  `).bind(row.attendance_date, row.recipient_phone, row.purpose, row.id).run()
}

export async function processWhatsAppOutbox(db: D1Database, limit = 25) {
  await ensureWhatsAppTables(db)
  const rows = await db.prepare(`
    SELECT *
    FROM wa_outbox
    WHERE status = 'queued' AND scheduled_at <= datetime('now') AND retry_count < max_retry
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT ?
  `).bind(limit).all<WaOutboxRow>()

  const log: any[] = []
  for (const row of rows.results || []) {
    await db.prepare(`
      UPDATE wa_outbox SET status = 'sending', updated_at = datetime('now') WHERE id = ?
    `).bind(row.id).run()

    const stillAlfa = await attendanceStillAlfa(db, row)
    if (!stillAlfa) {
      await db.prepare(`
        UPDATE wa_outbox
        SET status = 'canceled', error_message = 'Status ALFA sudah tidak berlaku.', updated_at = datetime('now')
        WHERE id = ?
      `).bind(row.id).run()
      log.push({ id: row.id, status: 'canceled', reason: 'not_alfa' })
      continue
    }

    const locked = await acquireDailyLock(db, row)
    if (!locked) {
      await db.prepare(`
        UPDATE wa_outbox
        SET status = 'canceled', error_message = 'Nomor sudah mendapat notifikasi ALFA hari ini.', updated_at = datetime('now')
        WHERE id = ?
      `).bind(row.id).run()
      log.push({ id: row.id, status: 'canceled', reason: 'daily_lock' })
      continue
    }

    try {
      const providerMessageId = await sendViaConfiguredProvider(row)
      await db.prepare(`
        UPDATE wa_outbox
        SET status = 'sent', provider_message_id = ?, sent_at = datetime('now'), error_message = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(providerMessageId || null, row.id).run()
      if (row.campaign_id) {
        await db.prepare(`
          UPDATE wa_campaign_recipients
          SET status = 'sent', updated_at = datetime('now')
          WHERE outbox_id = ?
        `).bind(row.id).run()
      }
      log.push({ id: row.id, status: 'sent' })
    } catch (error: any) {
      await releaseDailyLock(db, row)
      const nextRetry = Number(row.retry_count || 0) + 1
      const nextStatus = nextRetry >= Number(row.max_retry || 3) ? 'failed' : 'queued'
      await db.prepare(`
        UPDATE wa_outbox
        SET status = ?, retry_count = ?, scheduled_at = datetime('now', '+5 minutes'), error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(nextStatus, nextRetry, String(error?.message || error), row.id).run()
      if (row.campaign_id && nextStatus === 'failed') {
        await db.prepare(`
          UPDATE wa_campaign_recipients
          SET status = 'failed', updated_at = datetime('now')
          WHERE outbox_id = ?
        `).bind(row.id).run()
      }
      log.push({ id: row.id, status: nextStatus, error: String(error?.message || error) })
    }
  }

  await db.prepare(`
    UPDATE wa_campaigns
    SET status = CASE
      WHEN total_enqueued > 0 AND NOT EXISTS (
        SELECT 1 FROM wa_outbox
        WHERE wa_outbox.campaign_id = wa_campaigns.id
          AND wa_outbox.status IN ('queued', 'sending')
      ) THEN 'completed'
      ELSE status
    END,
    updated_at = datetime('now')
    WHERE status IN ('queued', 'processing')
  `).run()

  return { processed: rows.results?.length || 0, log }
}

export async function updateWhatsAppMessageStatus(db: D1Database, providerMessageId: string, status: string, errorMessage?: string | null) {
  await ensureWhatsAppTables(db)
  const allowed = ['sent', 'delivered', 'read', 'failed']
  const nextStatus = allowed.includes(status) ? status : 'sent'
  await db.prepare(`
    UPDATE wa_outbox
    SET status = ?, error_message = COALESCE(?, error_message), updated_at = datetime('now')
    WHERE provider_message_id = ?
  `).bind(nextStatus, errorMessage || null, providerMessageId).run()
  await db.prepare(`
    UPDATE wa_campaign_recipients
    SET status = ?, updated_at = datetime('now')
    WHERE outbox_id IN (SELECT id FROM wa_outbox WHERE provider_message_id = ?)
  `).bind(nextStatus, providerMessageId).run()
}

export async function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null) {
  const { appSecret, provider } = await getWhatsAppConfig()
  if (provider === 'wablas') return true
  if (!appSecret) return true
  if (!signatureHeader?.startsWith('sha256=')) return false

  const signature = signatureHeader.slice('sha256='.length)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return hex === signature
}
