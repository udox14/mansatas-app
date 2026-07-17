// Lokasi: app/api/pdf/ckh/route.ts
// Generate PDF Catatan Kinerja Harian via Cloudflare Browser Rendering.
// POST: render dari data on-screen (WYSIWYG) — rows/margin/paper bisa state lokal belum tersimpan.
import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { buildCkhHtml, type CkhPdfData } from '@/lib/pdf/ckh-template'

export const dynamic = 'force-dynamic'

const PAPER: Record<string, string> = {
  a4: '210mm 297mm',
  f4: '215mm 330mm',
}

type Body = Omit<CkhPdfData, 'paperCss'> & {
  paper?: string
  margins?: { top: number; right: number; bottom: number; left: number }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: Body
  try {
    body = await request.json()
  } catch {
    return new Response('Body tidak valid', { status: 400 })
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return new Response('Data CKH kosong', { status: 400 })
  }

  const paperCss = PAPER[body.paper || 'f4'] || PAPER.f4
  const m = body.margins || { top: 15, right: 12, bottom: 15, left: 12 }

  const html = buildCkhHtml({
    rows: body.rows,
    user: body.user,
    kepsek: body.kepsek,
    kepalaTu: body.kepalaTu,
    userRoles: body.userRoles || [],
    signatureSettings: body.signatureSettings,
    year: body.year,
    month: body.month,
    paperCss,
    baseUrl: new URL(request.url).origin,
  })

  const [w, h] = paperCss.split(' ')

  const { env } = await getCloudflareContext({ async: true })
  const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => (document as any).fonts.ready) // pastikan @font-face termuat sebelum render
    await page.evaluate(async () => {
      const images = Array.from(document.images)
      await Promise.all(images.map(image => {
        if (image.complete) return image.decode().catch(() => undefined)
        return new Promise<void>(resolve => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
      }))
    })
    const pdf = await page.pdf({
      width: w,
      height: h,
      printBackground: true,
      margin: {
        top: `${m.top}mm`,
        right: `${m.right}mm`,
        bottom: `${m.bottom}mm`,
        left: `${m.left}mm`,
      },
    })
    return new Response(pdf as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CKH_${body.year}_${String(body.month).padStart(2, '0')}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } finally {
    await browser.close()
  }
}
