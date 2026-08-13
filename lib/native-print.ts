'use client'

type NativePrintPlugin = {
  printHtml(options: { html: string; jobName: string }): Promise<{ started: boolean }>
}

function documentHtml(doc: Document) {
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`
}

export async function printHtmlNative(html: string, jobName = 'Dokumen MANSATAS') {
  const { Capacitor, registerPlugin } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return false

  const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint')
  await NativePrint.printHtml({ html, jobName })
  return true
}

export async function printDocumentNative(doc: Document = document, jobName?: string) {
  return printHtmlNative(documentHtml(doc), jobName || doc.title || 'Dokumen MANSATAS')
}

export function createNativePrintWindow() {
  const printDocument = document.implementation.createHTMLDocument('Dokumen MANSATAS')
  let loadHandler: ((event: Event) => unknown) | null = null
  let closed = false
  let autoPrintScheduled = false

  // Dokumen akan dimuat ulang oleh WebView native, jadi pemanggil tidak perlu
  // menunggu gambar pada HTMLDocument lepas yang tidak memiliki browsing context.
  try {
    Object.defineProperty(printDocument, 'images', { configurable: true, get: () => [] })
  } catch {}

  const fakeWindow = {
    document: printDocument,
    closed: false,
    focus() {},
    close() {
      closed = true
      fakeWindow.closed = true
    },
    print() {
      if (closed) return
      void printDocumentNative(printDocument).catch((error) => {
        console.error('[NativePrint] Gagal mencetak:', error)
        window.alert('Gagal membuka dialog cetak Android.')
      })
    },
    addEventListener(type: string, listener: (event: Event) => unknown) {
      if (type !== 'load') return
      loadHandler = listener
      window.setTimeout(() => loadHandler?.(new Event('load')), 0)
    },
    removeEventListener() {},
    set onload(listener: ((event: Event) => unknown) | null) {
      loadHandler = listener
      if (listener) window.setTimeout(() => loadHandler?.(new Event('load')), 0)
    },
    get onload() {
      return loadHandler
    },
  }

  const originalDocumentClose = printDocument.close.bind(printDocument)
  printDocument.close = () => {
    originalDocumentClose()
    if (!autoPrintScheduled && /window\.print\s*\(/i.test(printDocument.documentElement.innerHTML)) {
      autoPrintScheduled = true
      window.setTimeout(() => fakeWindow.print(), 50)
    }
  }

  return fakeWindow as unknown as Window
}
