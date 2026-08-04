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
  if (normalized === 'image/png') return { contentType: 'image/png' as const, extension: 'png' as const, convertToPng: false }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return { contentType: 'image/jpeg' as const, extension: 'jpeg' as const, convertToPng: false }
  if (normalized === 'image/gif') return { contentType: 'image/gif' as const, extension: 'gif' as const, convertToPng: false }

  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return { contentType: 'image/png' as const, extension: 'png' as const, convertToPng: false }
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return { contentType: 'image/jpeg' as const, extension: 'jpeg' as const, convertToPng: false }
  if (clean.endsWith('.gif')) return { contentType: 'image/gif' as const, extension: 'gif' as const, convertToPng: false }
  return { contentType: 'image/png' as const, extension: 'png' as const, convertToPng: true }
}

async function loadAgendaKelasImage(url: string, label: string): Promise<AgendaKelasImageAsset> {
  const resolvedUrl = new URL(url, window.location.href).toString()
  const response = await fetch(resolvedUrl, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`${label} tidak dapat diambil (${response.status}).`)

  const type = assetTypeFromUrl(resolvedUrl, response.headers.get('content-type'))
  const sourceBlob = await response.blob()
  const data = new Uint8Array(await sourceBlob.arrayBuffer())
  if (data.length === 0) throw new Error(`${label} kosong.`)

  const objectUrl = URL.createObjectURL(sourceBlob)
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

    let outputData = data
    let outputType = type
    if (type.convertToPng) {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error(`${label} tidak dapat dikonversi ke PNG.`)
      context.drawImage(image, 0, 0)
      const converted = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`${label} tidak dapat dikonversi ke PNG.`)), 'image/png')
      })
      outputData = new Uint8Array(await converted.arrayBuffer())
      outputType = { contentType: 'image/png', extension: 'png', convertToPng: false }
    }

    return {
      data: outputData,
      contentType: outputType.contentType,
      extension: outputType.extension,
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
