import {
  getRppmTemplate,
  type RppmContent,
  type RppmPrintSettings,
  type RppmTemplateType,
} from '@/lib/rppm'

const EMPTY = '........................................'

type ZipEntry = {
  name: string
  content: Uint8Array
}

export function buildRppmDocxBlob(templateType: RppmTemplateType, content: RppmContent, settings: RppmPrintSettings) {
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', content: encodeXml(contentTypesXml()) },
    { name: '_rels/.rels', content: encodeXml(rootRelsXml()) },
    { name: 'word/_rels/document.xml.rels', content: encodeXml(documentRelsXml()) },
    { name: 'word/styles.xml', content: encodeXml(stylesXml()) },
    { name: 'word/document.xml', content: encodeXml(documentXml(templateType, content, settings)) },
  ]

  return new Blob([buildZip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export function buildRppmDocxFilename(content: RppmContent) {
  const topic = content.spesifikasi.topik_pembelajaran || 'RPPM'
  const mapel = content.spesifikasi.mata_pelajaran || 'Mapel'
  const kelas = content.spesifikasi.kelas_semester || 'Kelas'
  return `${sanitizeFilename(`RPPM ${mapel} ${kelas} ${topic}`)}.docx`
}

function documentXml(templateType: RppmTemplateType, content: RppmContent, settings: RppmPrintSettings) {
  const template = getRppmTemplate(templateType)
  const page = settings.paper === 'A4'
    ? { width: 11906, height: 16838 }
    : { width: 12242, height: 18711 }
  const margins = {
    top: mmToTwip(settings.margins.top),
    right: mmToTwip(settings.margins.right),
    bottom: mmToTwip(settings.margins.bottom),
    left: mmToTwip(settings.margins.left),
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph('RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM', { align: 'center', bold: true, size: 26 })}
    ${paragraph('BERBASIS CINTA', { align: 'center', bold: true, size: 26, after: 220 })}
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid><w:gridCol w:w="510"/><w:gridCol w:w="2700"/><w:gridCol w:w="6540"/></w:tblGrid>
      ${sectionRow('A', 'Spesifikasi')}
      ${fieldRow('1', 'Satuan Pendidikan', content.spesifikasi.satuan_pendidikan)}
      ${fieldRow('2', 'Mata Pelajaran', content.spesifikasi.mata_pelajaran)}
      ${fieldRow('3', 'Kelas / Semester', content.spesifikasi.kelas_semester)}
      ${fieldRow('4', 'Topik Pembelajaran', content.spesifikasi.topik_pembelajaran)}
      ${fieldRow('5', 'Alokasi Waktu', content.spesifikasi.alokasi_waktu)}
      ${spacerRow()}
      ${sectionRow('B', 'Identifikasi')}
      ${fieldRow('1', 'Asesmen pada Awal Pembelajaran (opsional)', content.identifikasi.asesmen_awal)}
      ${fieldRow('2', 'Dimensi Profil Lulusan', listText(content.identifikasi.dimensi_profil_lulusan))}
      ${fieldRow('3', 'Topik Panca Cinta', listText(content.identifikasi.topik_panca_cinta))}
      ${fieldRow('4', 'Materi Integrasi KBC', content.identifikasi.materi_integrasi_kbc)}
      ${sectionRow('C', 'Desain Pembelajaran')}
      ${fieldRow('1', 'Tujuan Pembelajaran', content.desain_pembelajaran.tujuan_pembelajaran)}
      ${fieldRow('2', 'Kerangka Pembelajaran', `Praktik Pedagogis Model Pembelajaran: ${template.modelLabel}\n${content.desain_pembelajaran.kerangka_pembelajaran}`)}
      ${sectionRow('D', `Pengalaman Belajar (Menggunakan Model ${template.modelLabel})`)}
      ${fieldRow('1', 'Kegiatan Awal (berkesadaran, bermakna, dan/atau menggembirakan)', listText(content.pengalaman_belajar.kegiatan_awal))}
      ${fieldRow('2', 'Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)', '')}
      ${fieldRow('', 'Memahami', listText(content.pengalaman_belajar.kegiatan_inti.memahami))}
      ${fieldRow('', 'Mengaplikasi', listText(content.pengalaman_belajar.kegiatan_inti.mengaplikasi))}
      ${fieldRow('', 'Merefleksi', listText(content.pengalaman_belajar.kegiatan_inti.merefleksi))}
      ${fieldRow('3', 'Kegiatan Penutup (berkesadaran, bermakna, dan/atau menggembirakan)', listText(content.pengalaman_belajar.kegiatan_penutup))}
      ${sectionRow('E', 'Asesmen Pembelajaran')}
      ${fieldRow('1', 'Asesmen Proses', content.asesmen_pembelajaran.asesmen_proses)}
      ${fieldRow('2', 'Asesmen Akhir', content.asesmen_pembelajaran.asesmen_akhir)}
    </w:tbl>
    <w:sectPr>
      <w:pgSz w:w="${page.width}" w:h="${page.height}"/>
      <w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function sectionRow(letter: string, title: string) {
  return `<w:tr>${cell(paragraph(letter, { bold: true, align: 'center' }), 510)}${cell(paragraph(title, { bold: true }), 9240, 2)}</w:tr>`
}

function fieldRow(no: string, label: string, value: string) {
  return `<w:tr>${cell(paragraph(no, { align: 'center' }), 510)}${cell(paragraph(label, { bold: Boolean(no) }), 2700)}${cell(multilineParagraphs(value), 6540)}</w:tr>`
}

function spacerRow() {
  return `<w:tr>${cell(paragraph(''), 510)}${cell(paragraph(''), 2700)}${cell(paragraph(''), 6540)}</w:tr>`
}

function cell(inner: string, width: number, gridSpan?: number) {
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : ''}
      <w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>
      <w:vAlign w:val="top"/>
    </w:tcPr>
    ${inner}
  </w:tc>`
}

function multilineParagraphs(value: string) {
  const text = value.trim() || EMPTY
  return text.split('\n').map(line => paragraph(line)).join('')
}

function paragraph(value: string, options?: { bold?: boolean; align?: 'left' | 'center'; size?: number; after?: number }) {
  return `<w:p>
    <w:pPr>
      ${options?.align && options.align !== 'left' ? `<w:jc w:val="${options.align}"/>` : ''}
      <w:spacing w:after="${options?.after ?? 80}" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="${options?.size ?? 22}"/>
        ${options?.bold ? '<w:b/>' : ''}
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(value)}</w:t>
    </w:r>
  </w:p>`
}

function listText(items: string[]) {
  if (items.length === 0) return ''
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n')
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr>
  </w:style>
</w:styles>`
}

function buildZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.content)
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.content.length),
      u32(entry.content.length),
      u16(name.length),
      u16(0),
      name,
      entry.content,
    ])
    localParts.push(local)

    centralParts.push(concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.content.length),
      u32(entry.content.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]))
    offset += local.length
  }

  const central = concat(centralParts)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])

  return concat([...localParts, central, end])
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u16(value: number) {
  const out = new Uint8Array(2)
  const view = new DataView(out.buffer)
  view.setUint16(0, value, true)
  return out
}

function u32(value: number) {
  const out = new Uint8Array(4)
  const view = new DataView(out.buffer)
  view.setUint32(0, value >>> 0, true)
  return out
}

function encodeXml(value: string) {
  return new TextEncoder().encode(value)
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mmToTwip(value: number) {
  return Math.round(value * 56.692913)
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || 'RPPM'
}
