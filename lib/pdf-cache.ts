// lib/pdf-cache.ts
// Cache hasil render PDF (Cloudflare Browser Rendering) di R2, keyed oleh hash
// SHA-256 dari HTML. HTML dibangun deterministik dari data — data berubah →
// hash berubah → render ulang. Data sama → hidangkan byte yang sudah ada tanpa
// perlu launch browser (hemat CPU/browser session yang mahal).
//
// Keamanan: bila browser gagal memuat gambar (kop/tanda tangan) maka PDF bisa
// berbeda; risiko rendah karena gambar disajikan immutable dari origin yang sama.
// Hanya PDF kecil (< 2 MB) yang di-cache untuk membatasi pertumbuhan storage.

import { getCloudflareContext } from '@opennextjs/cloudflare'

const MAX_CACHE_BYTES = 2 * 1024 * 1024

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function renderPdfWithCache(params: {
  route: string
  html: string
  render: () => Promise<Uint8Array | ArrayBuffer>
}): Promise<Uint8Array | ArrayBuffer> {
  const { env } = await getCloudflareContext({ async: true })
  const key = `pdf-cache/${params.route}/${await sha256Hex(params.html)}.pdf`

  const cached = await env.R2.get(key)
  if (cached) {
    const bytes = await cached.arrayBuffer()
    if (bytes.byteLength > 0 && bytes.byteLength <= MAX_CACHE_BYTES) {
      return bytes
    }
  }

  const pdf = await params.render()
  const byteLength = pdf instanceof Uint8Array ? pdf.byteLength : pdf.byteLength
  if (byteLength > 0 && byteLength <= MAX_CACHE_BYTES) {
    try {
      await env.R2.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' } })
    } catch {
      // non-fatal: gagal menyimpan cache tidak boleh menggagalkan respons
    }
  }
  return pdf
}
