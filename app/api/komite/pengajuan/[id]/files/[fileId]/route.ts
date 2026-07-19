import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { canViewKomitePengajuan, ensureKomitePengajuanSchema } from '@/lib/komite-pengajuan'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { id, fileId } = await params
  const db = await getDB()
  await ensureKomitePengajuanSchema(db)
  const row = await db.prepare(`
    SELECT p.id,p.pengaju_id,p.status,f.r2_key,f.original_filename,f.mime_type
    FROM komite_pengajuan_files f
    JOIN komite_pengajuan_versions v ON v.id=f.version_id
    JOIN komite_pengajuan p ON p.id=v.pengajuan_id
    WHERE p.id=? AND f.id=? LIMIT 1
  `).bind(id,fileId).first<any>()
  if (!row) return new Response('Not Found', { status: 404 })
  const roles = await getUserRoles(db,user.id)
  if (!(await canViewKomitePengajuan(db,user.id,row,roles))) return new Response('Forbidden', { status: 403 })
  const { env } = await getCloudflareContext({ async: true })
  const object = await env.R2.get(row.r2_key)
  if (!object) return new Response('Not Found', { status: 404 })
  const filename = String(row.original_filename || 'dokumen.pdf').replace(/["\r\n]/g,'_')
  return new Response(await object.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
