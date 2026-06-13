// Lokasi: app/api/pdf/nilai-harian/route.ts
// Generate PDF Rekap Nilai Harian via Cloudflare Browser Rendering (HTML→PDF).
// Output konsisten di hape (Capacitor webview) maupun desktop.
import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getRekapNilai } from '@/app/dashboard/nilai-harian/actions'
import { buildNilaiHarianHtml } from '@/lib/pdf/nilai-harian-template'

export const dynamic = 'force-dynamic'

function safeFile(value: string) {
  return String(value || 'rekap').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 80)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const penugasanId = url.searchParams.get('penugasanId') || ''
  const mapelNama = url.searchParams.get('mapel') || ''
  const kelasLabel = url.searchParams.get('kelas') || ''
  if (!penugasanId) return new Response('penugasanId wajib', { status: 400 })

  // getRekapNilai sudah cek kepemilikan guru — non-owner dapat headers kosong.
  const data = await getRekapNilai(penugasanId)
  if (!data.headers.length) return new Response('Data nilai tidak ditemukan', { status: 404 })

  const html = buildNilaiHarianHtml({
    mapelNama,
    kelasLabel,
    headers: data.headers,
    rows: data.rows,
    kopUrl: `${url.origin}/kopsurat.png`,
    baseUrl: url.origin,
  })

  const { env } = await getCloudflareContext({ async: true })
  const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => (document as any).fonts.ready) // pastikan @font-face termuat sebelum render
    const pdf = await page.pdf({
      width: '215mm',
      height: '330mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    const filename = `Rekap_${safeFile(mapelNama)}_${safeFile(kelasLabel)}.pdf`
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
