// Lokasi: app/api/pdf/ekskul-kehadiran/route.ts
// Generate PDF Laporan Kehadiran Ekstrakurikuler per bulan via Cloudflare Browser Rendering.
import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { getLaporanKehadiran } from '@/app/dashboard/ekstrakurikuler/master/actions'
import { buildEkskulKehadiranHtml } from '@/lib/pdf/ekskul-kehadiran-template'

export const dynamic = 'force-dynamic'

function safeFile(value: string) {
  return String(value || 'laporan').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 80)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = await getDB()
  // Akses: pembina (fitur ekstrakurikuler) atau admin (master) boleh cetak
  const ok = (await checkFeatureAccess(db, user.id, 'ekstrakurikuler'))
    || (await checkFeatureAccess(db, user.id, 'ekstrakurikuler-master'))
  if (!ok) return new Response('Forbidden', { status: 403 })

  const url = new URL(request.url)
  const ekskulId = url.searchParams.get('ekskulId') || ''
  const bulan = url.searchParams.get('bulan') || ''
  if (!ekskulId || !/^\d{4}-\d{2}$/.test(bulan)) return new Response('Parameter tidak valid', { status: 400 })

  const data = await getLaporanKehadiran(ekskulId, bulan)
  if (!data) return new Response('Data tidak ditemukan', { status: 404 })

  const html = buildEkskulKehadiranHtml({
    ...data,
    kopUrl: `${url.origin}/kopsurat.png`,
    baseUrl: url.origin,
  })

  const { env } = await getCloudflareContext({ async: true })
  const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => (document as any).fonts.ready)
    const pdf = await page.pdf({
      width: '330mm',   // F4 landscape
      height: '215mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    const filename = `Kehadiran_${safeFile(data.ekskul_nama)}_${bulan}.pdf`
    return new Response(pdf as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } finally {
    await browser.close()
  }
}
