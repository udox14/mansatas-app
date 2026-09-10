import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const MM_TO_POINTS = 72 / 25.4

/** Menempelkan teks verifikasi pada margin bawah halaman PDF terakhir saja. */
export async function stampVerificationFooter(
  source: Uint8Array | ArrayBuffer,
  text: string,
  rightMarginMm: number,
): Promise<Uint8Array> {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source)
  const document = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = document.getPages()
  const lastPage = pages[pages.length - 1]
  if (!lastPage) return bytes

  const fontSize = 7
  const font = await document.embedFont(StandardFonts.Helvetica)
  const textWidth = font.widthOfTextAtSize(text, fontSize)
  const { width } = lastPage.getSize()

  lastPage.drawText(text, {
    x: Math.max(0, width - (rightMarginMm * MM_TO_POINTS) - textWidth),
    y: 5 * MM_TO_POINTS,
    size: fontSize,
    font,
    color: rgb(0.33, 0.33, 0.33),
  })

  return document.save()
}
