'use client'

type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  targetBytes?: number
  minQuality?: number
  initialQuality?: number
  watermarkText?: string
}

async function canvasToWebpFile(
  canvas: HTMLCanvasElement,
  originalName: string,
  quality: number
): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pemrosesan foto terlalu lama. Ambil ulang foto lalu coba kirim lagi.')), 10_000)
    canvas.toBlob((blob) => {
      clearTimeout(timer)
      if (!blob) return reject(new Error('Foto gagal dikompres. Ambil ulang foto lalu coba kirim lagi.'))
      const extension = blob.type === 'image/webp' ? '.webp' : '.png'
      resolve(new File([blob], originalName.replace(/\.\w+$/, extension), { type: blob.type }))
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
      let width = img.width
      let height = img.height
      const widthRatio = maxWidth / width
      const heightRatio = maxHeight / height
      const initialScale = Math.min(1, widthRatio, heightRatio)

      width = Math.max(320, Math.round(width * initialScale))
      height = Math.max(320, Math.round(height * initialScale))

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Perangkat gagal memproses foto. Materi tetap disimpan; ambil ulang foto.')

      let bestFile: File | null = null
      let quality = initialQuality

      while (true) {
        canvas.width = width
        canvas.height = height
        ctx.clearRect(0, 0, width, height)
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

        const compressed = await canvasToWebpFile(canvas, file.name, quality)
        if (!compressed) throw new Error('Foto gagal dikompres. Ambil ulang foto.')

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

        if (bestFile.size > 900 * 1024) throw new Error('Foto masih terlalu besar setelah diproses. Materi tetap disimpan; ambil ulang foto.')
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
