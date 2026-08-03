import type {
  AgendaKelasPageData,
  AgendaKelasSignatureSettings,
} from '@/app/dashboard/agenda-kelas/actions'

export type AgendaKelasImageAsset = {
  data: Uint8Array
  contentType: 'image/png' | 'image/jpeg' | 'image/gif'
  extension: 'png' | 'jpeg' | 'gif'
  widthPx: number
  heightPx: number
}

export type AgendaKelasExportAssets = {
  logo: AgendaKelasImageAsset
  kepalaSignature: AgendaKelasImageAsset | null
  waliSignatures: Map<string, AgendaKelasImageAsset>
}

function assetTypeFromUrl(url: string, contentType: string | null) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (normalized === 'image/png') return { contentType: 'image/png' as const, extension: 'png' as const }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return { contentType: 'image/jpeg' as const, extension: 'jpeg' as const }
  if (normalized === 'image/gif') return { contentType: 'image/gif' as const, extension: 'gif' as const }

  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return { contentType: 'image/jpeg' as const, extension: 'jpeg' as const }
  if (clean.endsWith('.gif')) return { contentType: 'image/gif' as const, extension: 'gif' as const }
  return { contentType: 'image/png' as const, extension: 'png' as const }
}

async function loadAgendaKelasImage(url: string, label: string): Promise<AgendaKelasImageAsset> {
  const resolvedUrl = new URL(url, window.location.href).toString()
  const response = await fetch(resolvedUrl, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`${label} tidak dapat diambil (${response.status}).`)

  const type = assetTypeFromUrl(resolvedUrl, response.headers.get('content-type'))
  const data = new Uint8Array(await response.arrayBuffer())
  if (data.length === 0) throw new Error(`${label} kosong.`)

  const blob = new Blob([data], { type: type.contentType })
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(`${label} bukan gambar yang valid.`))
    })
    image.src = objectUrl
    if (typeof image.decode === 'function') await image.decode()
    else await loaded
    if (!image.naturalWidth || !image.naturalHeight) throw new Error(`${label} tidak memiliki ukuran gambar yang valid.`)
    return {
      data,
      contentType: type.contentType,
      extension: type.extension,
      widthPx: image.naturalWidth,
      heightPx: image.naturalHeight,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function loadAgendaKelasExportAssets(
  pages: AgendaKelasPageData[],
  signatureSettings: AgendaKelasSignatureSettings,
): Promise<AgendaKelasExportAssets> {
  const logo = await loadAgendaKelasImage('/logohitam.png', 'Logo madrasah')
  const kepalaUrl = signatureSettings.kepala.enabled
    ? pages.find(page => page.kepala.signature_url)?.kepala.signature_url || null
    : null
  const kepalaSignature = kepalaUrl
    ? await loadAgendaKelasImage(kepalaUrl, 'Tanda tangan Kepala Madrasah')
    : null

  const waliSignatures = new Map<string, AgendaKelasImageAsset>()
  if (signatureSettings.wali.enabled) {
    const classUrls = new Map<string, string>()
    for (const page of pages) {
      if (page.kelas.wali_kelas_signature_url) classUrls.set(page.kelas.id, page.kelas.wali_kelas_signature_url)
    }
    for (const [kelasId, url] of classUrls) {
      waliSignatures.set(kelasId, await loadAgendaKelasImage(url, `Tanda tangan Wali Kelas ${kelasId}`))
    }
  }

  return { logo, kepalaSignature, waliSignatures }
}
