import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { getEkskulAnggotaReport, parseEkskulResidenceFilter } from '@/lib/ekskul-anggota-report'
import { buildEkskulAnggotaDocxBytes } from '@/lib/docx/ekskul-anggota-template'

export const dynamic = 'force-dynamic'

function safeFile(value: string) {
  return String(value || 'Daftar_Siswa_Ekstrakurikuler')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .slice(0, 100)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'ekstrakurikuler-master'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const scope = url.searchParams.get('scope')
  const ekskulId = url.searchParams.get('ekskulId')?.trim() || undefined
  const residence = parseEkskulResidenceFilter(url.searchParams.get('domisili'))

  if ((scope !== 'all' && scope !== 'single') || !residence) {
    return new Response('Parameter cetak tidak valid.', { status: 400 })
  }
  if (scope === 'single' && (!ekskulId || ekskulId.length > 100 || /[\u0000-\u001f]/.test(ekskulId))) {
    return new Response('Ekstrakurikuler wajib dipilih.', { status: 400 })
  }

  const report = await getEkskulAnggotaReport(db, { scope, ekskulId, residence })
  if (report.groups.length === 0) {
    return new Response('Tidak ada siswa yang sesuai dengan pengaturan cetak.', { status: 404 })
  }

  const letterheadResponse = await fetch(`${url.origin}/kopsurat.png`)
  if (!letterheadResponse.ok) {
    return new Response('Kop surat tidak dapat dimuat.', { status: 500 })
  }
  const bytes = buildEkskulAnggotaDocxBytes({
    ...report,
    letterheadPng: new Uint8Array(await letterheadResponse.arrayBuffer()),
  })

  const scopeName = scope === 'single' ? report.groups[0].ekskul_nama : 'Semua_Ekstrakurikuler'
  const filename = `Daftar_Siswa_${safeFile(scopeName)}.docx`
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
