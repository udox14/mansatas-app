import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getTeacherAttendanceReport } from '@/app/dashboard/kehadiran/report-actions'
import { buildTeacherAttendanceHtml } from '@/lib/pdf/absensi-guru-template'

export const dynamic = 'force-dynamic'

function safeFile(value: string) {
  return String(value || 'rekap').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 80)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const startDate = url.searchParams.get('startDate') || ''
  const endDate = url.searchParams.get('endDate') || ''
  const penugasanId = url.searchParams.get('penugasanId') || null
  const report = await getTeacherAttendanceReport({ startDate, endDate, penugasanId })
  if (report.error) return new Response(report.error, { status: report.error === 'Unauthorized' ? 401 : 400 })
  if (report.sessions.length === 0) return new Response('Belum ada sesi absensi pada periode ini.', { status: 404 })

  const html = buildTeacherAttendanceHtml({
    report,
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
      width: '330mm',
      height: '215mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    const scope = report.assignments.find(item => item.id === report.selected_penugasan_id)
    const filename = `Rekap_Absensi_${safeFile(scope ? `${scope.mapel_nama}_${scope.kelas_label}` : report.guru?.nama_lengkap || 'Guru')}_${startDate}_${endDate}.pdf`
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
