// Unduh, simpan, dan buka PDF/lampiran pada Web maupun Capacitor Android.

type NativeFileSaverResult = {
  uri: string
  filename: string
  publicDownloads: boolean
}

type NativeFileSaverPlugin = {
  saveAndOpen(options: {
    data: string
    filename: string
    mimeType: string
  }): Promise<NativeFileSaverResult>
}

export const NATIVE_DOWNLOAD_EVENT = 'mansatas-native-download'

export type NativeDownloadEventDetail = {
  phase: 'start' | 'success' | 'error'
  filename?: string
  message?: string
}

function emitDownloadEvent(detail: NativeDownloadEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<NativeDownloadEventDetail>(NATIVE_DOWNLOAD_EVENT, { detail }))
}

async function withDownloadFeedback<T>(filename: string | undefined, task: () => Promise<T>): Promise<T> {
  emitDownloadEvent({ phase: 'start', filename })
  try {
    const result = await task()
    emitDownloadEvent({ phase: 'success', filename })
    return result
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unduhan gagal. Silakan coba lagi.'
    emitDownloadEvent({ phase: 'error', filename, message })
    throw cause
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function decodeHeaderFilename(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null

  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeHeaderFilename(encoded.trim().replace(/^"|"$/g, ''))

  const quoted = disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1]
  if (quoted) return quoted

  return disposition.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() || null
}

function extensionForMime(mimeType: string) {
  const normalized = mimeType.split(';')[0].trim().toLowerCase()
  const extensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }
  return extensions[normalized] || ''
}

function sanitizeFilename(raw: string, mimeType: string) {
  let name = raw
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim() || 'dokumen'
  if (!/\.[a-z0-9]{1,8}$/i.test(name)) name += extensionForMime(mimeType)
  return name.slice(-120)
}

async function fetchFile(
  fetchUrl: string,
  filename?: string,
  init?: RequestInit,
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const response = await fetch(fetchUrl, { credentials: 'include', ...init })
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Gagal mengambil/membuat file (${response.status})`)
  }

  const responseType = response.headers.get('content-type')?.toLowerCase() || ''
  if (responseType.includes('text/html')) {
    throw new Error('File tidak dapat diunduh. Sesi login mungkin telah berakhir; silakan masuk kembali.')
  }

  const blob = await response.blob()
  const mimeType =
    response.headers.get('content-type')?.split(';')[0] ||
    blob.type ||
    'application/octet-stream'
  const dispositionName = filenameFromDisposition(response.headers.get('content-disposition'))
  const urlName = new URL(fetchUrl, window.location.origin).pathname.split('/').pop()
  const resolvedName = sanitizeFilename(filename || dispositionName || urlName || 'dokumen', mimeType)

  return { blob, filename: resolvedName, mimeType }
}

export async function fetchPdfBlob(fetchUrl: string, init?: RequestInit): Promise<Blob> {
  return (await fetchFile(fetchUrl, undefined, init)).blob
}

export async function openPdfFromUrl(
  fetchUrl: string,
  filename?: string,
  init?: RequestInit,
): Promise<void> {
  return withDownloadFeedback(filename, async () => {
    // Mulai membaca blob URL sebelum dynamic import. Beberapa generator dokumen
    // mencabut object URL segera setelah klik; jika import didahulukan, URL sudah
    // hilang saat fetch dimulai dan Android hanya menampilkan "Failed to fetch".
    const file = await fetchFile(fetchUrl, filename, init)
    const { Capacitor, registerPlugin } = await import('@capacitor/core')

    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(file.blob)

      try {
        const FileSaver = registerPlugin<NativeFileSaverPlugin>('FileSaver')
        await FileSaver.saveAndOpen({
          data: base64,
          filename: file.filename,
          mimeType: file.mimeType,
        })
        return
      } catch (nativeError) {
        console.warn('[FileSaver] Gagal menyimpan ke Downloads, memakai share cache:', nativeError)
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const written = await Filesystem.writeFile({
          path: file.filename,
          data: base64,
          directory: Directory.Cache,
        })
        const { Share } = await import('@capacitor/share')
        await Share.share({
          title: file.filename,
          url: written.uri,
          dialogTitle: 'Buka, simpan, atau bagikan dokumen',
        })
        return
      }
    }

    const objectUrl = URL.createObjectURL(file.blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = file.filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  })
}

export async function downloadAndOpenNativeFile(url: string, filename?: string): Promise<void> {
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
  await openPdfFromUrl(fullUrl, filename)
}

export async function downloadBlobFile(blob: Blob, filename: string, mimeType?: string): Promise<void> {
  const resolvedMimeType = mimeType || blob.type || 'application/octet-stream'
  const resolvedFilename = sanitizeFilename(filename, resolvedMimeType)
  return withDownloadFeedback(resolvedFilename, async () => {
    const { Capacitor, registerPlugin } = await import('@capacitor/core')

    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(blob)
      try {
        const FileSaver = registerPlugin<NativeFileSaverPlugin>('FileSaver')
        await FileSaver.saveAndOpen({ data: base64, filename: resolvedFilename, mimeType: resolvedMimeType })
        return
      } catch (nativeError) {
        console.warn('[FileSaver] Gagal menyimpan file, memakai share cache:', nativeError)
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const written = await Filesystem.writeFile({ path: resolvedFilename, data: base64, directory: Directory.Cache })
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: resolvedFilename, url: written.uri, dialogTitle: 'Buka, simpan, atau bagikan dokumen' })
        return
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = resolvedFilename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  })
}
