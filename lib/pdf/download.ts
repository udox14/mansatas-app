// Lokasi: lib/pdf/download.ts
// Buka/simpan PDF & lampiran file dari endpoint server.
// Mendukung Web (tab baru / blob) & Capacitor Native (Save to cache -> Open/Share Sheet Native).

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result) // buang prefix data:...;base64,
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function fetchPdfBlob(fetchUrl: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(fetchUrl, { credentials: 'include', ...init })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Gagal mengambil/membuat file (${res.status})`)
  }
  return res.blob()
}

/**
 * Mengambil file/PDF dari URL lalu membukanya di Android/Web.
 * - Native (Android APK): download -> simpan ke Directory.Cache -> tampilkan Share/Open Dialog Native.
 * - Web/PWA: buka blob/link di tab baru.
 */
export async function openPdfFromUrl(fetchUrl: string, filename?: string, init?: RequestInit): Promise<void> {
  const { Capacitor } = await import('@capacitor/core')
  
  // Ambil nama file dari URL jika tidak dispesifikasi
  const safeFilename = filename || fetchUrl.split('/').pop()?.split('?')[0] || 'dokumen.pdf'

  if (Capacitor.isNativePlatform()) {
    try {
      const blob = await fetchPdfBlob(fetchUrl, init)
      const base64 = await blobToBase64(blob)
      const { Filesystem, Directory } = await import('@capacitor/filesystem')

      const written = await Filesystem.writeFile({
        path: safeFilename,
        data: base64,
        directory: Directory.Cache,
      })

      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: safeFilename,
        url: written.uri,
        dialogTitle: 'Buka atau Cetak Dokumen PDF',
      })
      return
    } catch (err) {
      console.warn('[PDF Native] Gagal via Filesystem/Share, mencoba Browser:', err)
      const { Browser } = await import('@capacitor/browser')
      const fullUrl = fetchUrl.startsWith('/') ? `${window.location.origin}${fetchUrl}` : fetchUrl
      await Browser.open({ url: fullUrl })
      return
    }
  }

  // Web Browser Fallback
  const blob = await fetchPdfBlob(fetchUrl, init)
  const objUrl = URL.createObjectURL(blob)
  window.open(objUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000)
}

/**
 * Helper serbaguna untuk mendownload dan membuka lampiran (PDF/Gambar/Doc) dari link mana pun di APK
 */
export async function downloadAndOpenNativeFile(url: string, filename?: string): Promise<void> {
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
  await openPdfFromUrl(fullUrl, filename)
}
