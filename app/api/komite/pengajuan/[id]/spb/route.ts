import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { canViewKomitePengajuan, ensureKomitePengajuanSchema } from '@/lib/komite-pengajuan'

export const dynamic = 'force-dynamic'

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] || char))
}
function rupiah(value: number) { return new Intl.NumberFormat('id-ID',{ style:'currency',currency:'IDR',maximumFractionDigits:0 }).format(value || 0) }
function tanggal(value: string) { return new Intl.DateTimeFormat('id-ID',{ day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta' }).format(new Date(value.endsWith('Z') ? value : `${value.replace(' ','T')}Z`)) }
function absolute(url: string | null, origin: string) { return url ? (url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`) : '' }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized',{ status:401 })
  const { id } = await params
  const db = await getDB()
  await ensureKomitePengajuanSchema(db)
  const row = await db.prepare(`SELECT p.*,COALESCE(u.nama_lengkap,u.name,u.email) AS pengaju_name
    FROM komite_pengajuan p JOIN "user" u ON u.id=p.pengaju_id WHERE p.id=?`).bind(id).first<any>()
  if (!row) return new Response('Not Found',{ status:404 })
  if (row.status !== 'disetujui') return new Response('SPB belum tersedia',{ status:409 })
  const roles = await getUserRoles(db,user.id)
  if (!(await canViewKomitePengajuan(db,user.id,row,roles))) return new Response('Forbidden',{ status:403 })
  const reviews = await db.prepare(`SELECT * FROM komite_pengajuan_reviews
    WHERE pengajuan_id=? AND version_number=? AND action='setujui' ORDER BY created_at`).bind(id,row.current_version).all<any>()
  const latest = new Map<string,any>()
  for (const review of reviews.results || []) latest.set(review.stage,review)
  if (!latest.get('bendahara') || !latest.get('ketua') || !latest.get('kepala')) return new Response('Data persetujuan SPB belum lengkap',{ status:409 })
  const origin = new URL(request.url).origin
  const signer = (stage: string, title: string) => {
    const review = latest.get(stage)
    const signature = absolute(review.actor_signature_url,origin)
    return `<div class="sign"><div>${esc(title)}</div><div class="signature">${signature ? `<img src="${esc(signature)}" alt="">` : ''}</div><strong>${esc(review.actor_name)}</strong><small>Disetujui ${esc(tanggal(review.created_at))}${review.is_super_admin_bypass ? ' · Bypass Super Admin' : ''}</small></div>`
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:14mm 16mm 16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.5;margin:0}
    .kop{width:100%;max-height:31mm;object-fit:contain;margin-bottom:3mm}.line{border-top:2px solid #111;border-bottom:1px solid #111;height:4px;margin-bottom:8mm}
    h1{text-align:center;font-size:15pt;text-decoration:underline;margin:0} .nomor{text-align:center;margin:1mm 0 10mm}.intro{margin-bottom:4mm}
    table.data{width:100%;border-collapse:collapse;margin:3mm 0 8mm}.data td{vertical-align:top;padding:2mm 1mm}.data td:first-child{width:43mm;color:#333}.data td:nth-child(2){width:5mm}
    .amount{font-size:13pt;font-weight:700}.approval{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:17mm;page-break-inside:avoid}.sign{text-align:center;font-size:10pt}.signature{height:22mm;display:flex;align-items:center;justify-content:center}.signature img{max-width:35mm;max-height:21mm;object-fit:contain}.sign strong{display:block;border-top:1px solid #111;padding-top:1mm}.sign small{display:block;color:#555;font-size:7.5pt;margin-top:1mm}.footer{margin-top:12mm;border-top:1px solid #aaa;padding-top:2mm;color:#666;font-size:7.5pt}
  </style></head><body><img class="kop" src="${origin}/kopkomite.png" alt="Kop Komite"><div class="line"></div>
  <h1>SURAT PERINTAH BAYAR</h1><div class="nomor">Nomor: <strong>${esc(row.nomor_spb)}</strong></div>
  <p class="intro">Berdasarkan proposal kegiatan yang telah melalui pemeriksaan berjenjang, Komite Madrasah memerintahkan pembayaran dengan rincian sebagai berikut:</p>
  <table class="data"><tr><td>Judul kegiatan</td><td>:</td><td><strong>${esc(row.judul)}</strong></td></tr><tr><td>Pengaju</td><td>:</td><td>${esc(row.pengaju_name)}</td></tr><tr><td>Penerima pembayaran</td><td>:</td><td>${esc(row.penerima_pembayaran)}</td></tr><tr><td>Jumlah</td><td>:</td><td class="amount">${esc(rupiah(row.nominal))}</td></tr><tr><td>Uraian</td><td>:</td><td>${esc(row.uraian).replace(/\n/g,'<br>')}</td></tr><tr><td>Tanggal persetujuan</td><td>:</td><td>${esc(tanggal(row.approved_at))}</td></tr></table>
  <p>Surat Perintah Bayar ini diterbitkan untuk dipergunakan sebagaimana mestinya dan menjadi dasar pencairan dana Komite.</p>
  <div class="approval">${signer('bendahara','Bendahara Komite')}${signer('ketua','Ketua Komite')}${signer('kepala','Kepala Madrasah')}</div>
  <div class="footer">Dokumen ini diterbitkan secara elektronik oleh MANSATAS App. ID Pengajuan: ${esc(row.id)} · Versi dokumen: ${esc(row.current_version)}</div></body></html>`
  const { env } = await getCloudflareContext({ async:true })
  const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
  try {
    const page = await browser.newPage()
    await page.setContent(html,{ waitUntil:'networkidle0' })
    await page.evaluate(async () => { await (document as any).fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => undefined))) })
    const pdf = await page.pdf({ format:'A4',printBackground:true })
    const safeNumber = String(row.nomor_spb).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,80)
    return new Response(pdf as BodyInit,{ headers:{ 'Content-Type':'application/pdf','Content-Disposition':`inline; filename="SPB_${safeNumber}.pdf"`,'Cache-Control':'private, no-store' } })
  } finally { await browser.close() }
}
