import puppeteer from '@cloudflare/puppeteer'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { canViewKomitePengajuan, ensureKomitePengajuanSchema } from '@/lib/komite-pengajuan'
import { terbilang } from '@/lib/terbilang'

export const dynamic = 'force-dynamic'

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] || char))
}
function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID',{ style:'currency',currency:'IDR',maximumFractionDigits:0 }).format(value || 0)
}
function tanggal(value?: string | null) {
  if (!value) return '-'
  const normalized = value.includes(' ')
    ? `${value.replace(' ','T')}Z`
    : value.length === 10 ? `${value}T00:00:00Z` : value
  return new Intl.DateTimeFormat('id-ID',{ day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta' }).format(new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`))
}
function todayIso() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())
}
function absolute(url: string | null, origin: string) {
  return url ? (url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`) : ''
}

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

  const [reviewRows, detailRows] = await Promise.all([
    db.prepare(`SELECT * FROM komite_pengajuan_reviews
      WHERE pengajuan_id=? AND version_number=? AND action='setujui' ORDER BY created_at`).bind(id,row.current_version).all<any>(),
    db.prepare(`SELECT * FROM komite_pengajuan_rincian WHERE pengajuan_id=? ORDER BY urutan`).bind(id).all<any>(),
  ])
  const latest = new Map<string,any>()
  for (const review of reviewRows.results || []) latest.set(review.stage,review)
  if (!latest.get('bendahara') || !latest.get('ketua') || !latest.get('kepala')) return new Response('Data persetujuan SPB belum lengkap',{ status:409 })

  const rincian = (detailRows.results || []).length ? detailRows.results || [] : [{
    urutan: 1,
    uraian: row.uraian,
    penerima_penyedia: row.penerima_pembayaran || '-',
    jumlah: row.nominal,
  }]
  const total = rincian.reduce((sum: number, item: any) => sum + Number(item.jumlah || 0), 0) || Number(row.nominal || 0)
  const origin = new URL(request.url).origin
  const signer = (stage: string, label: string, title: string) => {
    const review = latest.get(stage)
    const signature = absolute(review.actor_signature_url,origin)
    return `<div class="sign">
      <div class="sign-label">${esc(label)}</div>
      <div class="sign-title">${esc(title)}</div>
      <div class="signature">${signature ? `<img src="${esc(signature)}" alt="">` : ''}</div>
      <strong>${esc(review.actor_name)}</strong>
      <small>${esc(tanggal(review.created_at))}${review.is_super_admin_bypass ? ' - Bypass Super Admin' : ''}</small>
    </div>`
  }
  const receiptDate = row.realisasi_status === 'sudah' ? row.realisasi_tanggal : todayIso()
  const receiptStatus = row.realisasi_status === 'sudah' ? 'REALISASI FINAL' : 'DRAFT - BELUM DIREALISASIKAN'
  const receiptText = row.realisasi_status === 'sudah'
    ? `Telah diterima dana ${esc(row.realisasi_metode || 'Tunai')} dari Bendahara Komite Sekolah sebesar <strong>${esc(rupiah(total))}</strong> (${esc(terbilang(total))} Rupiah) untuk keperluan pembayaran di atas pada tanggal ${esc(tanggal(row.realisasi_tanggal))}.`
    : `Telah disiapkan blanko tanda terima dana dari Bendahara Komite Sekolah sebesar <strong>${esc(rupiah(total))}</strong> (${esc(terbilang(total))} Rupiah) untuk keperluan pembayaran di atas. Halaman ini menjadi bukti final setelah realisasi pencairan dicatat dan ditandatangani.`

  const detailHtml = rincian.map((item: any, index: number) => `<tr>
    <td class="center">${index + 1}</td>
    <td>${esc(item.uraian)}</td>
    <td>${esc(item.penerima_penyedia)}</td>
    <td class="right">${esc(rupiah(Number(item.jumlah || 0)))}</td>
  </tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:10mm 14mm 12mm}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111;font-size:10pt;line-height:1.38;margin:0}
    .page{break-after:page;page-break-after:always;min-height:274mm;position:relative}
    .page:last-child{break-after:auto;page-break-after:auto}
    .kop{width:100%;max-height:30mm;object-fit:contain;margin-bottom:2mm}
    .rule{border-top:2px solid #111;border-bottom:1px solid #111;height:4px;margin-bottom:5mm}
    h1{text-align:center;font-size:14pt;text-decoration:underline;margin:0 0 1mm;text-transform:uppercase}
    h2{text-align:center;font-size:13pt;margin:0 0 6mm;text-transform:uppercase}
    .nomor{text-align:center;margin:0 0 5mm}
    .meta{width:100%;border-collapse:collapse;margin:0 0 4mm}
    .meta td{padding:1mm 0;vertical-align:top}
    .meta td:first-child{width:34mm;font-weight:700}
    .meta td:nth-child(2){width:4mm}
    .intro{margin:4mm 0}
    table.items{width:100%;border-collapse:collapse;margin:3mm 0 2mm}
    .items th,.items td{border:1px solid #111;padding:1.6mm;vertical-align:top}
    .items th{text-align:center;font-size:8.8pt;background:#f2f2f2}
    .items .center{text-align:center;width:10mm}
    .items .right{text-align:right;white-space:nowrap}
    .items .total-label{text-align:center;font-weight:700}
    .items .total-value{font-weight:700;text-align:right}
    .terbilang{border:1px solid #111;border-top:0;padding:1.7mm;font-style:italic}
    .checklist{margin-top:4mm;border:1px solid #bbb;padding:2.5mm}
    .checklist-title{font-weight:700;margin-bottom:1mm}
    .checks{display:grid;grid-template-columns:1fr 1fr;gap:1mm 5mm;font-size:9.2pt}
    .date-line{text-align:right;margin:5mm 0 0}
    .approval{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:6mm;page-break-inside:avoid}
    .sign{text-align:center;font-size:9pt}
    .sign-label{min-height:9mm}
    .sign-title{font-weight:700}
    .signature{height:18mm;display:flex;align-items:center;justify-content:center}
    .signature img{max-width:32mm;max-height:17mm;object-fit:contain}
    .sign strong{display:block;border-top:1px solid #111;padding-top:1mm}
    .sign small{display:block;color:#555;font-size:7.5pt;margin-top:1mm}
    .receipt-box{border:1px solid #111;padding:4mm;margin-top:4mm;min-height:36mm}
    .status{display:inline-block;border:1px solid #111;padding:1mm 2mm;font-size:8pt;font-weight:700;margin-bottom:3mm}
    .receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:18mm}
    .receipt-sign{text-align:center}
    .blank-sign{height:28mm}
    .receipt-sign strong{display:block;border-top:1px solid #111;padding-top:1mm}
    .footer{position:absolute;left:0;right:0;bottom:0;border-top:1px solid #aaa;padding-top:2mm;color:#666;font-size:7.5pt}
  </style></head><body>
  <section class="page">
    <img class="kop" src="${origin}/kopkomite.png" alt="Kop Komite"><div class="rule"></div>
    <h1>Surat Perintah Bayar</h1>
    <div class="nomor">Nomor: <strong>${esc(row.nomor_spb)}</strong></div>
    <table class="meta">
      <tr><td>Dari</td><td>:</td><td>Ketua Komite Sekolah</td></tr>
      <tr><td>Kepada</td><td>:</td><td>Bendahara Komite Sekolah</td></tr>
      <tr><td>Tahun Anggaran</td><td>:</td><td>${esc(row.tahun_anggaran || '-')}</td></tr>
      <tr><td>Kode RKAS/Program</td><td>:</td><td>${esc(row.kode_rkas_program || '-')}</td></tr>
    </table>
    <p class="intro">Harap dibayarkan sejumlah uang kepada penerima di bawah ini sesuai dengan perincian kebutuhan berikut:</p>
    <table class="items">
      <thead><tr><th>NO</th><th>URAIAN PEMBAYARAN/PENGADAAN</th><th>PENERIMA/PENYEDIA</th><th>JUMLAH (RP)</th></tr></thead>
      <tbody>${detailHtml}<tr><td colspan="3" class="total-label">TOTAL PEMBAYARAN</td><td class="total-value">${esc(rupiah(total))}</td></tr></tbody>
    </table>
    <div class="terbilang"><strong>Terbilang:</strong> ${esc(terbilang(total))} Rupiah</div>
    <div class="checklist">
      <div class="checklist-title">Dokumen Pendukung/Kelengkapan Verifikasi:</div>
      <div class="checks">
        <div>[x] Nota/Faktur Pembelian Asli</div>
        <div>[x] Proposal/Permohonan Dana Resmi</div>
        <div>[x] BAP (Berita Acara Penerimaan Barang/Jasa)/RAB</div>
        <div>[x] Daftar Hadir/Dokumentasi Kegiatan</div>
        <div>[x] Tanda Terima/Kwitansi Sementara</div>
      </div>
    </div>
    <div class="date-line">Tasikmalaya, ${esc(tanggal(row.approved_at))}</div>
    <div class="approval">
      ${signer('ketua','Diperintahkan/Disetujui Oleh,','Ketua Komite Sekolah')}
      ${signer('kepala','Mengetahui/Menyetujui,','Kepala Madrasah')}
      ${signer('bendahara','Diverifikasi/dibayarkan oleh,','Bendahara Komite')}
    </div>
    <div class="footer">Dokumen elektronik MANSATAS App - ID Pengajuan: ${esc(row.id)} - Versi: ${esc(row.current_version)}</div>
  </section>
  <section class="page">
    <img class="kop" src="${origin}/kopkomite.png" alt="Kop Komite"><div class="rule"></div>
    <h2>Bukti Tanda Terima/Realisasi Pencairan</h2>
    <span class="status">${esc(receiptStatus)}</span>
    <div class="receipt-box">
      <p>${receiptText}</p>
      <table class="meta">
        <tr><td>Nomor SPB</td><td>:</td><td>${esc(row.nomor_spb)}</td></tr>
        <tr><td>Judul Kegiatan</td><td>:</td><td>${esc(row.judul)}</td></tr>
        <tr><td>Penerima Dana/Penyedia</td><td>:</td><td>${esc(row.penerima_pembayaran || '-')}</td></tr>
        <tr><td>Metode</td><td>:</td><td>${esc(row.realisasi_status === 'sudah' ? row.realisasi_metode || '-' : 'Tunai/Transfer')}</td></tr>
        <tr><td>Tanggal</td><td>:</td><td>${esc(tanggal(receiptDate))}</td></tr>
      </table>
      ${row.realisasi_catatan ? `<p><strong>Catatan:</strong> ${esc(row.realisasi_catatan).replace(/\n/g,'<br>')}</p>` : ''}
    </div>
    <div class="receipt-grid">
      <div class="receipt-sign">
        <div>Diserahkan Oleh:</div>
        <div>Bendahara Komite</div>
        <div class="blank-sign"></div>
        <strong>${esc(row.realisasi_petugas || latest.get('bendahara')?.actor_name || 'Bendahara Komite')}</strong>
      </div>
      <div class="receipt-sign">
        <div>Penerima Dana/Penyedia:</div>
        <div>Penerima Pembayaran</div>
        <div class="blank-sign"></div>
        <strong>${esc(row.penerima_pembayaran || '(................................)')}</strong>
      </div>
    </div>
    <div class="footer">Halaman bukti tanda terima ini merupakan bagian dari SPB ${esc(row.nomor_spb)}.</div>
  </section>
  </body></html>`
  const { env } = await getCloudflareContext({ async:true })
  const browser = await puppeteer.launch(env.BROWSER as Parameters<typeof puppeteer.launch>[0])
  try {
    const page = await browser.newPage()
    await page.setContent(html,{ waitUntil:'networkidle0' })
    await page.evaluate(async () => { await (document as any).fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => undefined))) })
    const pdf = await page.pdf({ format:'A4',printBackground:true,preferCSSPageSize:true })
    const safeNumber = String(row.nomor_spb).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,80)
    return new Response(pdf as BodyInit,{ headers:{ 'Content-Type':'application/pdf','Content-Disposition':`inline; filename="SPB_${safeNumber}.pdf"`,'Cache-Control':'private, no-store' } })
  } finally { await browser.close() }
}
