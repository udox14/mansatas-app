import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { createZip } from '@/lib/zip'
import { monthLabel, safeFileSegment } from '@/lib/tpg'

export const dynamic = 'force-dynamic'

function parseIds(value: string | null) {
  return Array.from(new Set(String(value || '').split(',').map(id => id.trim()).filter(Boolean)))
}

function assertPeriod(year: number, month: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu')) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const year = Number(url.searchParams.get('year'))
  const month = Number(url.searchParams.get('month'))
  const ids = parseIds(url.searchParams.get('users'))
  if (!assertPeriod(year, month)) return new Response('Periode tidak valid', { status: 400 })
  if (ids.length === 0) return new Response('User belum dipilih', { status: 400 })

  const rows = await db.prepare(`
    SELECT s.user_id, s.r2_key, s.original_filename, COALESCE(u.nama_lengkap, u.name) as nama_lengkap
    FROM tpg_s36_uploads s
    JOIN "user" u ON u.id = s.user_id
    WHERE s.period_year = ?
      AND s.period_month = ?
      AND s.user_id IN (${ids.map(() => '?').join(',')})
    ORDER BY u.nama_lengkap ASC, u.name ASC
  `).bind(year, month, ...ids).all<{ user_id: string; r2_key: string; original_filename: string; nama_lengkap: string }>()

  const { env } = await getCloudflareContext({ async: true })
  const entries = []
  for (const row of rows.results || []) {
    const object = await env.R2.get(row.r2_key)
    if (!object) continue
    const bytes = new Uint8Array(await object.arrayBuffer())
    entries.push({
      name: `${safeFileSegment(row.nama_lengkap)}_S36_${String(month).padStart(2, '0')}_${year}.pdf`,
      bytes,
    })
  }

  if (entries.length === 0) return new Response('Tidak ada S36 yang bisa didownload.', { status: 404 })

  const zip = createZip(entries)
  const filename = `S36_${safeFileSegment(monthLabel(year, month))}.zip`
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
