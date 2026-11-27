import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  buildCashflowReceiptHtml,
  getPengajuanReceiptData,
  loadKomiteLetterhead,
  parseReceiptOptionsFromUrl,
} from '@/lib/cashflow-receipt'
import { getUserRoles } from '@/lib/features'
import { canViewKomitePengajuan, ensureKomitePengajuanSchema } from '@/lib/komite-pengajuan'
import { renderPdfWithCache } from '@/lib/pdf-cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const db = await getDB()
  await ensureKomitePengajuanSchema(db)

  const row = await db.prepare(`
    SELECT p.*, COALESCE(u.nama_lengkap, u.name, u.email) AS pengaju_name
    FROM komite_pengajuan p
    JOIN "user" u ON u.id = p.pengaju_id
    WHERE p.id = ?
  `).bind(id).first<any>()
  if (!row) return new Response('Not Found', { status: 404 })

  const roles = await getUserRoles(db, user.id)
  if (!(await canViewKomitePengajuan(db, user.id, row, roles))) {
    return new Response('Forbidden', { status: 403 })
  }

  const lookup = await getPengajuanReceiptData(db, row)
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

  const options = parseReceiptOptionsFromUrl(request.url, true)
  const html = buildCashflowReceiptHtml(lookup.data, letterhead, options)

  const pdf = await renderPdfWithCache({
    route: 'komite-kuitansi-spb',
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
      'Content-Disposition': `inline; filename="Kuitansi_SPB_${lookup.safeFilenamePart}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
