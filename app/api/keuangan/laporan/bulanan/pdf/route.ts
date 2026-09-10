import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkFeatureAccess } from '@/lib/features'
import { getKomiteFinancialReport, parseKomiteReportRequest } from '@/lib/komite-financial-report'
import { buildKomiteFinancialReportHtml } from '@/lib/komite-financial-report-pdf'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { renderPdfWithCache } from '@/lib/pdf-cache'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  const db = await getDB()
  if (!(await checkFeatureAccess(db, session.user.id, 'keuangan-laporan'))) return new Response('Forbidden', { status: 403 })
  try {
    const input = parseKomiteReportRequest(await request.json())
    const defaults = await getKomiteReportSettings()
    const report = await getKomiteFinancialReport(db, input, defaults)
    const html = buildKomiteFinancialReportHtml(report)
    const { env } = await getCloudflareContext({ async: true })
    const pdf = await renderPdfWithCache({
      route: 'komite-laporan-bulanan', html,
      render: async () => {
        const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
        try {
          const page = await browser.newPage()
          await page.setContent(html, { waitUntil: 'networkidle0' })
          await page.evaluate(async () => { await (document as any).fonts.ready })
          return await page.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true })
        } finally { await browser.close() }
      },
    })
    return new Response(pdf as BodyInit, { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Laporan_Keuangan_Komite_${report.period}.pdf"`,
      'Cache-Control': 'private, no-store',
    } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal membuat laporan PDF.'
    return new Response(message, { status: 400 })
  }
}
