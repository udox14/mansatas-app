import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { createZip } from '@/lib/zip'

export const dynamic = 'force-dynamic'

const PMB_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad']

const URL_FIELDS = [
  { field: 'foto_url', label: 'foto' },
  { field: 'scan_kk_url', label: 'kk' },
  { field: 'scan_akta_url', label: 'akta' },
  { field: 'scan_ktp_ortu_url', label: 'ktp_ortu' },
  { field: 'scan_kelakuan_baik_url', label: 'kelakuan_baik' },
  { field: 'scan_rapor_url', label: 'rapor' },
  { field: 'scan_sertifikat_prestasi_url', label: 'sertifikat' },
]

function urlToR2Key(url: string): string | null {
  const PREFIX = '/api/media/'
  const clean = url.split('?')[0]
  const idx = clean.indexOf(PREFIX)
  if (idx === -1) return null
  return clean.slice(idx + PREFIX.length)
}

function safeSeg(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40)
}

function extFrom(url: string) {
  const clean = url.split('?')[0]
  const lastDot = clean.lastIndexOf('.')
  const lastSlash = clean.lastIndexOf('/')
  if (lastDot > lastSlash) return clean.slice(lastDot)
  return ''
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.some((r) => PMB_ROLES.includes(r))) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const tahun = url.searchParams.get('tahun') || 'PMB'

  const { results: rows } = await db.prepare(
    'SELECT no_pendaftaran, nama_lengkap, foto_url, scan_kk_url, scan_akta_url, scan_ktp_ortu_url, scan_kelakuan_baik_url, scan_rapor_url, scan_sertifikat_prestasi_url FROM pmb_pendaftar ORDER BY no_pendaftaran'
  ).all<any>()

  if (!rows?.length) return new Response('Tidak ada data pendaftar', { status: 404 })

  const { env } = await getCloudflareContext({ async: true })
  const entries: { name: string; bytes: Uint8Array }[] = []

  for (const row of rows) {
    const folder = `${safeSeg(row.no_pendaftaran)}_${safeSeg(row.nama_lengkap)}`
    for (const { field, label } of URL_FIELDS) {
      const fileUrl = row[field]
      if (!fileUrl) continue
      const key = urlToR2Key(fileUrl)
      if (!key) continue
      const object = await env.R2.get(key)
      if (!object) continue
      const bytes = new Uint8Array(await object.arrayBuffer())
      const ext = extFrom(fileUrl)
      entries.push({ name: `${folder}/${label}${ext}`, bytes })
    }
  }

  if (entries.length === 0) return new Response('Tidak ada berkas tersimpan di R2', { status: 404 })

  const zip = createZip(entries)
  const filename = `Berkas_PMB_${safeSeg(tahun)}.zip`

  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
