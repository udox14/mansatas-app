// Lokasi: app/api/pdf/ckh/route.ts
// Generate PDF Catatan Kinerja Harian via Cloudflare Browser Rendering.
// POST: render dari data on-screen (WYSIWYG) — rows/margin/paper bisa state lokal belum tersimpan.
import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { getSystemSetting, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { buildCkhHtml, type CkhPdfData } from '@/lib/pdf/ckh-template'
import { renderPdfWithCache } from '@/lib/pdf-cache'
import { createSignedMediaUrl } from '@/lib/media-security'
import { formatCkhDocumentVerification } from '@/lib/ckh-document-verification'
import { stampVerificationFooter } from '@/lib/pdf/verification-footer'

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

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const isSuperAdmin = roles.includes('super_admin')
  const documentId = String(body.documentId || '').trim()
  const ckhDocument = documentId
    ? await db.prepare('SELECT id, user_id, year, month FROM ckh_documents WHERE id = ?')
      .bind(documentId)
      .first<{ id: string; user_id: string; year: number; month: number }>()
    : null
  if (!ckhDocument || (!isSuperAdmin && ckhDocument.user_id !== user.id)) {
    return new Response('Dokumen CKH tidak ditemukan', { status: 404 })
  }
  if (ckhDocument.year !== body.year || ckhDocument.month !== body.month) {
    return new Response('Periode dokumen CKH tidak sesuai', { status: 400 })
  }

  const { env } = await getCloudflareContext({ async: true })

  // Tanda tangan kepala madrasah khusus Super Admin
  const allowKepalaSig = isSuperAdmin && Boolean(body.kepalaSignatureSettings?.signature_enabled)
  let rawKepalaSig: string | null = null
  if (allowKepalaSig) {
    rawKepalaSig = body.ckhKepalaSignatureUrl || (await getSystemSetting(SYSTEM_SETTING_KEYS.ckhKepalaSignatureUrl, '')) || null
  }
  const signedKepalaSigUrl = rawKepalaSig
    ? await createSignedMediaUrl(rawKepalaSig, 'browser-rendering:ckh', env.MEDIA_SIGNING_SECRET || '')
    : null

  const signedSignatureUrl = await createSignedMediaUrl(
    body.user.signature_url,
    'browser-rendering:ckh',
    env.MEDIA_SIGNING_SECRET || ''
  )
  const html = buildCkhHtml({
    documentId: ckhDocument.id,
    rows: body.rows,
    user: { ...body.user, signature_url: signedSignatureUrl },
    kepsek: body.kepsek,
    kepalaTu: body.kepalaTu,
    userRoles: body.userRoles || [],
    signatureSettings: body.signatureSettings,
    kepalaSignatureSettings: allowKepalaSig ? body.kepalaSignatureSettings : undefined,
    ckhKepalaSignatureUrl: signedKepalaSigUrl,
    year: body.year,
    month: body.month,
    paperCss,
    baseUrl: new URL(request.url).origin,
  })

  const [w, h] = paperCss.split(' ')

  const pdf = await renderPdfWithCache({
    route: 'ckh',
    html,
    render: async () => {
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
        const renderedPdf = await page.pdf({
          width: w,
          height: h,
          printBackground: true,
          margin: {
            top: `${m.top}mm`,
            right: `${m.right}mm`,
            bottom: `${Math.max(m.bottom, 10)}mm`,
            left: `${m.left}mm`,
          },
        })
        return stampVerificationFooter(
          renderedPdf,
          formatCkhDocumentVerification(ckhDocument.id),
          m.right,
        )
      } finally {
        await browser.close()
      }
    },
  })
  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="CKH_${body.year}_${String(body.month).padStart(2, '0')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
