'use client'

type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  targetBytes?: number
  minQuality?: number
  initialQuality?: number
}

async function canvasToWebpFile(
  canvas: HTMLCanvasElement,
  originalName: string,
  quality: number
): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null)
      resolve(new File([blob], originalName.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }))
    }, 'image/webp', quality)
  })
}

export async function compressAgendaImage(
  file: File,
  {
    maxWidth = 1280,
    maxHeight = 1280,
    targetBytes = 220 * 1024,
    initialQuality = 0.68,
    minQuality = 0.22,
  }: CompressOptions = {}
): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      let width = img.width
      let height = img.height
      const widthRatio = maxWidth / width
      const heightRatio = maxHeight / height
      const initialScale = Math.min(1, widthRatio, heightRatio)

      width = Math.max(320, Math.round(width * initialScale))
      height = Math.max(320, Math.round(height * initialScale))

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file)

      let bestFile: File | null = null
      let quality = initialQuality

      while (true) {
        canvas.width = width
        canvas.height = height
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const compressed = await canvasToWebpFile(canvas, file.name, quality)
        if (!compressed) return resolve(bestFile || file)

        bestFile = compressed

        if (compressed.size <= targetBytes) {
          return resolve(compressed)
        }

        const canLowerQuality = quality > minQuality
        const canShrinkDimensions = width > 720 || height > 720

        if (canLowerQuality) {
          quality = Math.max(minQuality, quality - 0.08)
          continue
        }

        if (canShrinkDimensions) {
          width = Math.max(720, Math.round(width * 0.82))
          height = Math.max(720, Math.round(height * 0.82))
          quality = Math.min(initialQuality, quality + 0.06)
          continue
        }

        return resolve(bestFile)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}
