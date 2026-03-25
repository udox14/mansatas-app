// lib/tka/pdf-parser.ts
// Parser PDF hasil TKA — berjalan di browser via PDF.js CDN
// Zero server CPU, zero Workers CPU time

import type { PdfRowRaw } from './types'

export function initPdfJs() {
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
}

async function extractAllText(arrayBuffer: ArrayBuffer): Promise<{ str: string; x: number; y: number }[]> {
  const pdfjs = (window as any).pdfjsLib
  if (!pdfjs) throw new Error('PDF.js belum dimuat')

  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const items: { str: string; x: number; y: number }[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    for (const item of content.items as any[]) {
      if (item.str?.trim()) {
        items.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] })
      }
    }
  }
  return items
}

const MAPEL_KEYWORDS = [
  'Matematika Tingkat Lanjut',
  'Bahasa Indonesia Tingkat Lanjut',
  'Bahasa Inggris Tingkat Lanjut',
  'Fisika', 'Kimia', 'Biologi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Ekonomi', 'Geografi', 'Sosiologi', 'Sejarah', 'Antropologi',
  'Bahasa Arab', 'Bahasa Prancis', 'Bahasa Jerman',
  'Bahasa Jepang', 'Bahasa Mandarin', 'Bahasa Korea',
  'Projek Kreatif dan Kewirausahaan',
]

function detectMapel(text: string): string {
  const t = text.toUpperCase()
  for (const m of MAPEL_KEYWORDS) {
    // Match minimal 8 karakter pertama untuk toleransi pemotongan baris
    if (t.includes(m.toUpperCase().slice(0, 8))) return m
  }
  return text
}

function parseNilai(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

export async function parseTkaPdf(file: File): Promise<{ rows: PdfRowRaw[]; errors: string[] }> {
  const buf = await file.arrayBuffer()
  const allItems = await extractAllText(buf)

  // Kelompokkan per baris berdasarkan Y coordinate (toleransi 3pt)
  const rowMap = new Map<number, string[]>()
  for (const item of allItems) {
    const yKey = Math.round(item.y / 3) * 3
    if (!rowMap.has(yKey)) rowMap.set(yKey, [])
    rowMap.get(yKey)!.push(item.str)
  }

  // Sort top-to-bottom (Y descending di koordinat PDF)
  const sortedRows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells)

  const rows: PdfRowRaw[] = []
  const errors: string[] = []

  const noPesertaRe = /^T\d-\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d$/
  const nilaiRe = /^\d{1,3}[.,]\d{2}$/

  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i]
    const noPesertaIdx = row.findIndex(s => noPesertaRe.test(s))
    if (noPesertaIdx === -1) continue

    try {
      // Gabung baris ini + 2 baris berikutnya (mapel bisa multi-baris)
      const flat = [
        ...row,
        ...(sortedRows[i + 1] ?? []),
        ...(sortedRows[i + 2] ?? []),
      ]

      const nomor_peserta = flat[noPesertaIdx]

      // Ambil semua nilai numerik
      const nilaiValues = flat
        .filter(s => nilaiRe.test(s))
        .map(parseNilai)
        .filter((v): v is number => v !== null)

      if (nilaiValues.length < 3) {
        errors.push(`${nomor_peserta}: nilai wajib tidak lengkap`)
        continue
      }

      // Nama: token non-angka setelah NISN (10 digit) hingga sebelum nilai pertama
      const nisnIdx = flat.findIndex((s, idx) => idx > noPesertaIdx && /^\d{10}$/.test(s))
      const namaTokens: string[] = []
      const startIdx = nisnIdx > -1 ? nisnIdx + 1 : noPesertaIdx + 1
      for (let j = startIdx; j < flat.length; j++) {
        if (nilaiRe.test(flat[j])) break
        if (flat[j].length > 1 && !/^\d+$/.test(flat[j])) namaTokens.push(flat[j])
        if (namaTokens.length > 6) break // safeguard
      }
      const nama = namaTokens.join(' ').replace(/\s+/g, ' ').trim()

      if (!nama || nama.length < 2) {
        errors.push(`${nomor_peserta}: nama tidak terbaca`)
        continue
      }

      // Deteksi mapel pilihan
      const flatStr = flat.join(' ')
      const foundMapel: string[] = []
      for (const m of MAPEL_KEYWORDS) {
        if (flatStr.toUpperCase().includes(m.toUpperCase().slice(0, 8))) {
          if (!foundMapel.includes(m)) foundMapel.push(m)
          if (foundMapel.length === 2) break
        }
      }

      rows.push({
        nomor_peserta,
        nama,
        nilai_bind: nilaiValues[0] ?? null,
        nilai_mat:  nilaiValues[1] ?? null,
        nilai_bing: nilaiValues[2] ?? null,
        mapel_p1:   foundMapel[0] ?? '',
        nilai_p1:   nilaiValues[3] ?? null,
        mapel_p2:   foundMapel[1] ?? '',
        nilai_p2:   nilaiValues[4] ?? null,
      })
    } catch (e) {
      errors.push(`Error baris ${i}: ${String(e)}`)
    }
  }

  return { rows, errors }
}
