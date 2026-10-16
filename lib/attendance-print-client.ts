'use client'

import { Capacitor } from '@capacitor/core'
import { printHtmlNative } from '@/lib/native-print'

/** Reserve the browser window during the click, before fetching report data. */
export function reserveAttendancePrintWindow(): Window | null {
  if (Capacitor.isNativePlatform()) return null
  const target = window.open('', '_blank')
  if (!target) throw new Error('Popup diblokir browser. Izinkan popup untuk mencetak.')
  target.document.title = 'Menyiapkan cetakan…'
  target.document.body.textContent = 'Menyiapkan cetakan…'
  return target
}

async function waitForImage(img: HTMLImageElement) {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      img.removeEventListener('load', loaded)
      img.removeEventListener('error', failed)
    }
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error('Gambar atau kop surat gagal dimuat. Silakan coba lagi.'))
    }
    const timeout = setTimeout(failed, 20000)
    img.addEventListener('load', loaded)
    img.addEventListener('error', failed)
    if (img.complete) {
      if (img.naturalWidth > 0) loaded()
      else failed()
    }
  })
}

export async function printAttendanceDocument(html: string, target: Window | null) {
  try {
    if (Capacitor.isNativePlatform()) {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      await Promise.all(Array.from(doc.images, async source => {
        const img = new Image()
        img.src = source.src
        await waitForImage(img)
      }))
      if (!await printHtmlNative(html, doc.title)) throw new Error('Dialog cetak tidak dapat dibuka.')
      return
    }
    if (!target || target.closed) throw new Error('Jendela cetak ditutup. Silakan klik Cetak kembali.')
    target.document.open()
    target.document.write(html)
    target.document.close()
    await Promise.all(Array.from(target.document.images, waitForImage))
    await target.document.fonts.ready
    if (target.closed) throw new Error('Jendela cetak ditutup. Silakan klik Cetak kembali.')
    target.focus()
    target.print()
  } catch (error) {
    target?.close()
    throw error
  }
}
