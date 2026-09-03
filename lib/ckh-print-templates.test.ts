import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildCkhDocxBytes } from './docx/ckh-template'
import { buildCkhHtml } from './pdf/ckh-template'

const baseData = {
  rows: [{
    id: 'row-1',
    tanggal: '2026-08-20',
    kegiatan_bulanan: 'Melaksanakan proses pembelajaran',
    catatan_harian: 'Mengajar Matematika: "Persamaan kuadrat" di kelas 10-1 A',
    vol: 1,
    satuan: 'Kegiatan',
  }],
  user: {
    nama_lengkap: 'Guru Pengampu',
    nip: '199001012020121001',
    pangkat_golongan: 'III/a',
    jabatan_cetak: 'Guru Ahli Pertama',
    role: 'guru',
    signature_url: '/signature.png',
  },
  kepsek: { nama_lengkap: 'Kepala Madrasah', nip: '197001012000121001' },
  kepalaTu: null,
  userRoles: ['guru'],
  signatureSettings: {
    signature_enabled: 1,
    signature_x_mm: 14,
    signature_y_mm: 12,
    signature_width_mm: 38,
  },
  year: 2026,
  month: 8,
}

describe('CKH print templates', () => {
  it('memakai lebar 48 mm untuk Kegiatan Bulanan pada PDF', () => {
    const html = buildCkhHtml({
      ...baseData,
      paperCss: '215mm 330mm',
      baseUrl: 'https://app.mansatas.test',
    })

    expect(html).toContain('width:48mm">KEGIATAN BULANAN')
  })

  it('menahan tanda tangan Word relatif terhadap blok guru di kanan', async () => {
    const bytes = await buildCkhDocxBytes({
      ...baseData,
      paper: 'f4',
      margins: { top: 15, right: 12, bottom: 15, left: 12 },
      signatureImage: {
        data: new Uint8Array([137, 80, 78, 71]),
        contentType: 'image/png',
        widthPx: 400,
        heightPx: 120,
      },
    })
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')!.async('string')

    expect(xml).toContain('<w:gridCol w:w="2721"/>')
    const horizontalPosition = xml.match(/<wp:positionH relativeFrom="column"><wp:posOffset>(\d+)<\/wp:posOffset>/)
    expect(Number(horizontalPosition?.[1])).toBeGreaterThan(4_000_000)
    expect(xml.indexOf('<wp:positionH relativeFrom="column">')).toBeLessThan(xml.indexOf('Tasikmalaya, 20 Agustus 2026'))
  })

  it('menyertakan tanda tangan kepala madrasah pada PDF ketika diaktifkan', () => {
    const htmlWithKepala = buildCkhHtml({
      ...baseData,
      kepsek: {
        nama_lengkap: 'Kepala Madrasah',
        nip: '197001012000121001',
      },
      ckhKepalaSignatureUrl: '/ckh-kepsek-sig.png',
      kepalaSignatureSettings: {
        signature_enabled: 1,
        signature_x_mm: 10,
        signature_y_mm: 15,
        signature_width_mm: 40,
      },
      paperCss: '215mm 330mm',
      baseUrl: 'https://app.mansatas.test',
    })

    expect(htmlWithKepala).toContain('https://app.mansatas.test/ckh-kepsek-sig.png')
    expect(htmlWithKepala).toContain('left:10mm;top:15mm;width:40mm')

    const htmlWithoutKepala = buildCkhHtml({
      ...baseData,
      kepsek: {
        nama_lengkap: 'Kepala Madrasah',
        nip: '197001012000121001',
      },
      ckhKepalaSignatureUrl: '/ckh-kepsek-sig.png',
      kepalaSignatureSettings: {
        signature_enabled: 0,
        signature_x_mm: 10,
        signature_y_mm: 15,
        signature_width_mm: 40,
      },
      paperCss: '215mm 330mm',
      baseUrl: 'https://app.mansatas.test',
    })

    expect(htmlWithoutKepala).not.toContain('https://app.mansatas.test/ckh-kepsek-sig.png')
  })

  it('menyertakan tanda tangan kepala madrasah pada Word (.docx) ketika diaktifkan', async () => {
    const bytes = await buildCkhDocxBytes({
      ...baseData,
      paper: 'f4',
      margins: { top: 15, right: 12, bottom: 15, left: 12 },
      signatureImage: {
        data: new Uint8Array([137, 80, 78, 71]),
        contentType: 'image/png',
        widthPx: 400,
        heightPx: 120,
      },
      kepalaSignatureSettings: {
        signature_enabled: 1,
        signature_x_mm: 8,
        signature_y_mm: 10,
        signature_width_mm: 35,
      },
      kepalaSignatureImage: {
        data: new Uint8Array([137, 80, 78, 71]),
        contentType: 'image/png',
        widthPx: 300,
        heightPx: 100,
      },
    })
    const zip = await JSZip.loadAsync(bytes)
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('string')
    const docXml = await zip.file('word/document.xml')!.async('string')

    expect(relsXml).toContain('Id="rIdSignature"')
    expect(relsXml).toContain('Id="rIdKepalaSignature"')
    expect(docXml).toContain('r:embed="rIdKepalaSignature"')
    expect(docXml).toContain('r:embed="rIdSignature"')
  })
})
