import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser, isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureCrudAccess } from '@/lib/features'

export const dynamic = 'force-dynamic'

function safe(value: unknown) { return String(value ?? '-').replace(/[\r\n]+/g, ' ').slice(0, 100) }

export async function GET(request: Request) {
  if (await isCurrentUserPlayReviewer()) return new Response('Private document is hidden in reviewer mode.', { status: 403 })
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const db = await getDB()
  if (!(await checkFeatureCrudAccess(db, user.id, 'pmb', 'read'))) return new Response('Forbidden', { status: 403 })
  const url = new URL(request.url)
  const type = url.searchParams.get('type') === 'prestasi' ? 'prestasi' : 'kartu'
  const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean)
  if (!ids.length || ids.length > 250) return new Response('Pilih 1–250 pendaftar', { status: 400 })
  const rows = (await db.prepare(`SELECT * FROM pmb_pendaftar WHERE id IN (${ids.map(() => '?').join(',')}) ${type === 'prestasi' ? "AND jalur='PRESTASI'" : ''} ORDER BY no_pendaftaran`).bind(...ids).all<any>()).results || []
  if (!rows.length) return new Response('Tidak ada data sesuai jenis dokumen', { status: 404 })
  const settingsRows = await db.prepare('SELECT key,value FROM pmb_pengaturan').all<{key:string;value:string}>()
  const settings = Object.fromEntries((settingsRows.results || []).map(row => [row.key,row.value]))
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (const row of rows) {
    const page = pdf.addPage([595.28, 841.89])
    page.drawText('MADRASAH ALIYAH NEGERI 1 TASIKMALAYA', { x: 70, y: 795, size: 15, font: bold })
    page.drawText(type === 'kartu' ? 'KARTU PESERTA TES PMB' : 'FORMULIR VERIFIKASI JALUR PRESTASI', { x: 105, y: 765, size: 14, font: bold, color: rgb(0.05,0.25,0.35) })
    const fields: [string, unknown][] = type === 'kartu' ? [
      ['Nomor Pendaftaran', row.no_pendaftaran], ['Nama', row.nama_lengkap], ['NISN', row.nisn], ['Asal Sekolah', row.asal_sekolah],
      ['Jalur', row.jalur], ['Tanggal Tes', row.tanggal_tes], ['Sesi', row.sesi_tes], ['Ruang', row.ruang_tes],
    ] : [
      ['Nomor Pendaftaran', row.no_pendaftaran], ['Nama', row.nama_lengkap], ['NISN', row.nisn], ['Asal Sekolah', row.asal_sekolah],
      ['Nilai S1 / Peringkat', `${safe(row.nilai_rapor_s1)} / ${safe(row.peringkat_rapor_s1)}`], ['Nilai S2 / Peringkat', `${safe(row.nilai_rapor_s2)} / ${safe(row.peringkat_rapor_s2)}`],
      ['Nilai S3 / Peringkat', `${safe(row.nilai_rapor_s3)} / ${safe(row.peringkat_rapor_s3)}`], ['Nilai S4 / Peringkat', `${safe(row.nilai_rapor_s4)} / ${safe(row.peringkat_rapor_s4)}`],
      ['Nilai S5 / Peringkat', `${safe(row.nilai_rapor_s5)} / ${safe(row.peringkat_rapor_s5)}`], ['Rata-rata', row.avg_nilai_rapor],
    ]
    let y = 710
    for (const [label,value] of fields) { page.drawText(label, { x: 70, y, size: 11, font: regular }); page.drawText(`: ${safe(value)}`, { x: 220, y, size: 11, font: bold }); y -= 30 }
    if (type === 'prestasi') {
      page.drawText('Catatan verifikator:', { x: 70, y: y - 5, size: 11, font: bold })
      for (let line = 0; line < 5; line++) page.drawLine({ start: { x: 70, y: y - 30 - line * 32 }, end: { x: 525, y: y - 30 - line * 32 }, thickness: 0.5 })
    }
    page.drawText(`${settings.jadwal_cetak_tsk || ''}`, { x: 390, y: 150, size: 10, font: regular })
    page.drawText(settings.nama_ketua_pmb || settings.nama_kepala_madrasah || 'Panitia PMB', { x: 350, y: 90, size: 10, font: bold })
    page.drawText(settings.nip_ketua_pmb || settings.nip_kepala_madrasah || '', { x: 350, y: 75, size: 9, font: regular })
  }
  const bytes = await pdf.save()
  const responseBytes = new Uint8Array(bytes.length)
  responseBytes.set(bytes)
  return new Response(new Blob([responseBytes], { type: 'application/pdf' }), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="PMB_${type}_${Date.now()}.pdf"`, 'Cache-Control': 'no-store' } })
}
