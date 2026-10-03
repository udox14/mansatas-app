'use client'

type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  targetBytes?: number
  minQuality?: number
  initialQuality?: number
  watermarkText?: string
}

type PhotoMime = 'image/webp' | 'image/jpeg'
const MAX_PROCESSED_BYTES = 900 * 1024

async function encodeCanvas(canvas: HTMLCanvasElement, mime: PhotoMime, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pemrosesan foto terlalu lama. Ambil ulang foto lalu coba kirim lagi.')), 10_000)
    try {
      canvas.toBlob(blob => {
        clearTimeout(timer)
        if (!blob) return reject(new Error('Foto gagal dikompres. Ambil ulang foto lalu coba kirim lagi.'))
        resolve(blob)
      }, mime, quality)
    } catch (error) { clearTimeout(timer); reject(error) }
  })
}

async function canvasToPhotoFile(
  canvas: HTMLCanvasElement,
  originalName: string,
  quality: number,
  mime: PhotoMime,
): Promise<File> {
  let blob = await encodeCanvas(canvas, mime, quality)
  // Browser yang tidak mendukung encoder WebP mengembalikan PNG. PNG tidak
  // mengikuti parameter quality, sehingga harus mencoba encoder JPEG.
  if (mime === 'image/webp' && blob.type !== 'image/webp') blob = await encodeCanvas(canvas, 'image/jpeg', quality)
  if (blob.type !== 'image/webp' && blob.type !== 'image/jpeg') {
    throw new Error('Perangkat tidak dapat mengompres foto ke format yang didukung. Coba buka Agenda Guru melalui browser terbaru; materi tetap disimpan.')
  }
  const extension = blob.type === 'image/webp' ? '.webp' : '.jpg'
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'agenda'
  return new File([blob], baseName + extension, { type: blob.type })
}

export async function compressAgendaImage(
  file: File,
  {
    maxWidth = 1280,
    maxHeight = 1280,
    targetBytes = 220 * 1024,
    initialQuality = 0.68,
    minQuality = 0.22,
    watermarkText,
  }: CompressOptions = {}
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    const timer = setTimeout(() => {
      img.onload = null
      img.onerror = null
      URL.revokeObjectURL(url)
      reject(new Error('Foto terlalu lama dibaca. Materi tetap disimpan; ambil ulang foto.'))
    }, 15_000)

    img.onload = async () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      try {
      let width = img.naturalWidth || img.width
      let height = img.naturalHeight || img.height
      if (!width || !height) throw new Error('Ukuran foto tidak dapat dibaca. Materi tetap disimpan; ambil ulang foto.')
      const originalWidth = width
      const originalHeight = height
      const widthRatio = maxWidth / width
      const heightRatio = maxHeight / height
      const initialScale = Math.min(1, widthRatio, heightRatio)

      width = Math.max(1, Math.round(width * initialScale))
      height = Math.max(1, Math.round(height * initialScale))

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Perangkat gagal memproses foto. Materi tetap disimpan; ambil ulang foto.')

      let bestFile: File | null = null
      let quality = initialQuality
      let mime: PhotoMime = 'image/webp'
      const minLongEdge = Math.min(320, Math.max(width, height))

      while (true) {
        canvas.width = width
        canvas.height = height
        ctx.clearRect(0, 0, width, height)
        // JPEG tidak memiliki transparansi; berikan latar putih sebelum foto.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        if (watermarkText) {
          const fontSize = Math.max(12, Math.round(width * 0.024))
          ctx.save()
          ctx.font = `600 ${fontSize}px sans-serif`
          const barHeight = fontSize * 2
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
          ctx.fillRect(0, height - barHeight, width, barHeight)
          ctx.fillStyle = '#ffffff'
          ctx.textBaseline = 'middle'
          ctx.fillText(watermarkText, 12, height - barHeight / 2)
          ctx.restore()
        }

        const compressed = await canvasToPhotoFile(canvas, file.name, quality, mime)
        mime = compressed.type as PhotoMime

        if (!bestFile || compressed.size < bestFile.size) bestFile = compressed

        if (compressed.size <= Math.min(targetBytes, MAX_PROCESSED_BYTES)) {
          return resolve(compressed)
        }

        const canLowerQuality = quality > minQuality
        const canShrinkDimensions = Math.max(width, height) > minLongEdge

        if (canLowerQuality) {
          quality = Math.max(minQuality, quality - 0.08)
          continue
        }

        if (canShrinkDimensions) {
          const nextLongEdge = Math.max(minLongEdge, Math.floor(Math.max(width, height) * 0.82))
          const scale = nextLongEdge / Math.max(originalWidth, originalHeight)
          width = Math.max(1, Math.round(originalWidth * scale))
          height = Math.max(1, Math.round(originalHeight * scale))
          quality = Math.min(initialQuality, quality + 0.06)
          continue
        }

        if (bestFile.size > MAX_PROCESSED_BYTES) throw new Error('Foto belum dapat diperkecil untuk dikirim. Materi tetap disimpan; coba gunakan browser terbaru atau ambil foto dengan resolusi kamera lebih rendah.')
        return resolve(bestFile)
      }
      } catch (error) { reject(error) }
    }

    img.onerror = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      reject(new Error('Format foto tidak dapat dibaca oleh perangkat. Materi tetap disimpan; ambil ulang foto dalam format JPG.'))
    }

    img.src = url
  })
}
