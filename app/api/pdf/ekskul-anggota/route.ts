import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { getEkskulAnggotaReport, parseEkskulResidenceFilter } from '@/lib/ekskul-anggota-report'
import { buildEkskulAnggotaHtml } from '@/lib/pdf/ekskul-anggota-template'
import { renderPdfWithCache } from '@/lib/pdf-cache'

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

  const html = buildEkskulAnggotaHtml({
    ...report,
    kopUrl: `${url.origin}/kopsurat.png`,
    baseUrl: url.origin,
  })

  const pdf = await renderPdfWithCache({
    route: 'ekskul-anggota',
    html,
    render: async () => {
      const { env } = await getCloudflareContext({ async: true })
      const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
      try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        await page.evaluate(() => (document as { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
        return await page.pdf({
          width: '215mm',
          height: '330mm',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        })
      } finally {
        await browser.close()
      }
    },
  })

  const scopeName = scope === 'single' ? report.groups[0].ekskul_nama : 'Semua_Ekstrakurikuler'
  const filename = `Daftar_Siswa_${safeFile(scopeName)}.pdf`
  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
