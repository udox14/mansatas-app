import { checkFeatureAccess } from '@/lib/features'
import { getKomiteFinancialReport, parseKomiteReportRequest, type KomiteExcelLayout } from '@/lib/komite-financial-report'
import { buildKomiteFinancialReportXlsx } from '@/lib/komite-financial-report-xlsx'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
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
    const layout = input.excelLayout as KomiteExcelLayout
    if (!['four_sheets', 'single_sheet', 'summary_bku'].includes(layout)) throw new Error('Layout Excel tidak valid.')
    const defaults = await getKomiteReportSettings()
    const report = await getKomiteFinancialReport(db, input, defaults)
    const workbook = buildKomiteFinancialReportXlsx(report, layout)
    return new Response(workbook as BodyInit, { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Laporan_Keuangan_Komite_${report.period}.xlsx"`,
      'Cache-Control': 'private, no-store',
    } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Gagal membuat laporan Excel.'
    return new Response(message, { status: 400 })
  }
}
