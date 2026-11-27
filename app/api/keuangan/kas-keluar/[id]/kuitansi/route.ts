import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  buildCashflowReceiptHtml,
  getCashflowExpenseReceiptData,
  loadKomiteLetterhead,
  parseReceiptOptionsFromUrl,
} from '@/lib/cashflow-receipt'
import { checkFeatureCrudAccess } from '@/lib/features'
import { renderPdfWithCache } from '@/lib/pdf-cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = await getDB()
  if (!(await checkFeatureCrudAccess(db, user.id, 'keuangan-kas-keluar', 'read'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const { id } = await params
  const lookup = await getCashflowExpenseReceiptData(db, id)
  if (!lookup.ok) {
    return new Response(lookup.message, {
      status: lookup.status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const { env } = await getCloudflareContext({ async: true })
  let letterhead: string
  try {
    letterhead = await loadKomiteLetterhead(request.url, env.STATIC_ASSETS)
  } catch {
    return new Response('Kop Komite tidak dapat dimuat. Silakan coba cetak kembali.', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const options = parseReceiptOptionsFromUrl(request.url, lookup.data.items.length > 1)
  const html = buildCashflowReceiptHtml(lookup.data, letterhead, options)

  const pdf = await renderPdfWithCache({
    route: 'keuangan-kuitansi-pengeluaran',
    html,
    render: async () => {
      const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
      try {
        const page = await browser.newPage()
        await page.setContent(html)
        await page.waitForNetworkIdle()
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all(Array.from(document.images).map(image => image.decode()))
        })
        return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
      } finally {
        await browser.close()
      }
    },
  })

  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Kuitansi_${lookup.safeFilenamePart}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
