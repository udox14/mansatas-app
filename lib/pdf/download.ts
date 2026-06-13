// Lokasi: lib/pdf/download.ts
// Buka/simpan PDF dari endpoint server. Jalan di web (tab baru) & Capacitor (share sheet).

function blobToBase64(blob: Blob): Promise<string> {
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

async function fetchPdfBlob(fetchUrl: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(fetchUrl, { credentials: 'include', ...init })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Gagal membuat PDF (${res.status})`)
  }
  return res.blob()
}

/**
 * Ambil PDF dari endpoint lalu buka.
 * - Native (Android APK): tulis ke cache → share sheet (user pilih viewer/simpan).
 * - Web/PWA: buka blob di tab baru.
 */
export async function openPdfFromUrl(fetchUrl: string, filename: string, init?: RequestInit): Promise<void> {
  const { Capacitor } = await import('@capacitor/core')
  const blob = await fetchPdfBlob(fetchUrl, init)

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob)
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: filename, url: written.uri })
    return
  }

  const objUrl = URL.createObjectURL(blob)
  window.open(objUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000)
}
