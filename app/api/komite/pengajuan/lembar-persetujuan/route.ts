import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { parseBosSigner } from '@/lib/komite-approval-sheet'
import { canSubmitKomite } from '@/lib/komite-pengajuan'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'

const privateHeaders = { 'Cache-Control': 'private, no-store' }

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders })
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return value.replace(/[&<>"']/g, char => entities[char])
}

function signature(label: string, role: string, signer: { name: string; nip: string }) {
  return `<div class="sign">
    <div class="sign-label">${label}<br>${role}</div>
    <div class="signature"></div>
    <strong>${escapeHtml(signer.name)}</strong>
    <div class="nip">NIP. ${escapeHtml(signer.nip || '................................')}</div>
  </div>`
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return errorResponse('Sesi telah berakhir. Silakan masuk kembali.', 401)

    const db = await getDB()
    if (!(await canSubmitKomite(db, user.id))) {
      return errorResponse('Anda tidak memiliki izin untuk mencetak lembar persetujuan.', 403)
    }

    const treasurer = parseBosSigner(await request.json().catch(() => null))
    if (!treasurer) return errorResponse('Periksa nama dan NIP Bendahara BOS. NIP boleh kosong atau berisi hingga 18 angka.', 400)

    const principal = await db.prepare(`
      SELECT COALESCE(NULLIF(TRIM(u.nama_lengkap), ''), TRIM(u.name)) AS name, TRIM(u.nip) AS nip
      FROM "user" u
      WHERE u.role = 'kepsek' OR EXISTS (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'kepsek'
      )
      ORDER BY u.nama_lengkap ASC, u.id ASC
      LIMIT 1
    `).first<{ name: string | null; nip: string | null }>()
    if (!principal?.name || !principal.nip) {
      return errorResponse('Nama dan NIP Kepala Madrasah belum lengkap. Hubungi admin untuk melengkapi profil Kepala Madrasah sebelum mencetak.', 409)
    }

    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
    <title>Lembar Persetujuan Penggunaan Anggaran Komite</title>
    <style>
      @page { size: A4 portrait; margin: 10mm 14mm 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111; font: 12pt/1.38 Arial, sans-serif; }
      main { padding-top: 12mm; }
      h1 { margin: 0; text-align: center; font-size: 14pt; }
      .approval { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10mm; margin-top: 22mm; break-inside: avoid; }
      .sign { text-align: center; overflow-wrap: anywhere; }
      .sign-label { min-height: 11mm; }
      .signature { height: 25mm; }
      .sign strong { display: block; }
      .sign strong::before { content: ''; display: block; width: 52mm; max-width: 100%; margin: 0 auto 1mm; border-top: 1px solid #111; }
      .nip { margin-top: 1mm; }
      .notes { margin-top: 20mm; break-inside: avoid; }
      h2 { font-size: inherit; margin: 0; }
      .note-line { line-height: 9mm; letter-spacing: .9pt; white-space: nowrap; overflow: hidden; }
    </style></head><body><main>
      <h1>LEMBAR PERSETUJUAN<br>PENGGUNAAN ANGGARAN KOMITE<br>MAN 1 TASIKMALAYA</h1>
      <div class="approval">
        ${signature('Ajuan telah diverifikasi', 'Bendahara BOS', treasurer)}
        ${signature('Ajuan telah disetujui', 'Kepala Madrasah', { name: principal.name, nip: principal.nip })}
      </div>
      <section class="notes">
        <h2>Catatan</h2>
        ${`<div class="note-line" aria-hidden="true">${'.'.repeat(120)}</div>`.repeat(5)}
      </section>
    </main></body></html>`

    const { env } = await getCloudflareContext({ async: true })
    const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
      return new Response(pdf as BodyInit, {
        headers: {
          ...privateHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="Lembar_Persetujuan_Penggunaan_Anggaran_Komite.pdf"',
        },
      })
    } finally {
      await browser.close()
    }
  } catch {
    return errorResponse('Lembar persetujuan gagal dibuat. Silakan coba cetak kembali.', 503)
  }
}
