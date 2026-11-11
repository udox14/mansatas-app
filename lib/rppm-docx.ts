import {
  formatTanggalRppm,
  getRppmTemplate,
  type RppmContent,
  type RppmPrintSettings,
  type RppmTemplateType,
} from '@/lib/rppm'
import type { RppmSigner } from '@/app/dashboard/rppm-generator/actions'
import {
  RPPM_MAIN_TABLE_WIDTHS,
  RPPM_SIGNATURE_WIDTHS,
  rppmAttachmentPages,
  rppmKerangkaDetails,
} from './rppm-attachment-layout'

const EMPTY = '........................................'

type ZipEntry = {
  name: string
  content: Uint8Array
}

export function buildRppmDocxBlob(
  templateType: RppmTemplateType,
  content: RppmContent,
  settings: RppmPrintSettings,
  user: RppmSigner,
  kepsek: RppmSigner | null,
) {
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', content: encodeXml(contentTypesXml()) },
    { name: '_rels/.rels', content: encodeXml(rootRelsXml()) },
    { name: 'word/_rels/document.xml.rels', content: encodeXml(documentRelsXml(content.format === 'paket-v1')) },
    { name: 'word/styles.xml', content: encodeXml(stylesXml(content.format === 'paket-v1')) },
    { name: 'word/document.xml', content: encodeXml(documentXml(templateType, content, settings, user, kepsek)) },
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

function documentXml(
  templateType: RppmTemplateType,
  content: RppmContent,
  settings: RppmPrintSettings,
  user: RppmSigner,
  kepsek: RppmSigner | null,
) {
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
  const isPackage = content.format === 'paket-v1'
  const availableWidth = page.width - margins.left - margins.right
  const widths = isPackage ? columnWidths(availableWidth, RPPM_MAIN_TABLE_WIDTHS) : [510, 2700, 6540]
  const section = (letter: string, title: string) => sectionRow(letter, title, widths, isPackage)
  const field = (no: string, label: string, value: string, keep = false) => {
    const inner = isPackage
      ? (value.trim() || EMPTY).split('\n').map(line => packageParagraph(line, {
        after: 45,
        indent: /^\d+[.)]\s/.test(line),
        keep,
      })).join('')
      : multilineParagraphs(value)
    return fieldRowInner(no, label, inner, widths, isPackage, keep)
  }
  const kerangka = content.desain_pembelajaran.kerangka_pembelajaran
  const borderSize = isPackage ? 4 : 8
  const borderColor = isPackage ? '737373' : '000000'
  const border = (side: string) => `<w:${side} w:val="single" w:sz="${borderSize}" w:space="0" w:color="${borderColor}"/>`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${isPackage
      ? packageParagraph('Rencana Pelaksanaan Pembelajaran Mendalam Berbasis Cinta', { style: 'Title', center: true, keep: true, after: 260 })
      : paragraph('RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM', { align: 'center', bold: true, size: 26 })
        + paragraph('BERBASIS CINTA', { align: 'center', bold: true, size: 26, after: 220 })}
    <w:tbl>
      <w:tblPr>
        ${isPackage ? `<w:tblW w:w="${availableWidth}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>'}
        <w:tblBorders>
          ${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}
        </w:tblBorders>
        ${isPackage ? '<w:tblLayout w:type="fixed"/>' : ''}
      </w:tblPr>
      ${tableGrid(widths)}
      ${section('A', 'Spesifikasi')}
      ${field('1', 'Satuan Pendidikan', content.spesifikasi.satuan_pendidikan)}
      ${field('2', 'Mata Pelajaran', content.spesifikasi.mata_pelajaran)}
      ${field('3', 'Kelas / Semester', content.spesifikasi.kelas_semester)}
      ${field('4', 'Topik Pembelajaran', content.spesifikasi.topik_pembelajaran)}
      ${field('5', 'Alokasi Waktu', content.spesifikasi.alokasi_waktu)}
      ${isPackage ? '' : gapRow()}
      ${section('B', 'Identifikasi')}
      ${field('1', 'Asesmen pada Awal Pembelajaran (opsional)', content.identifikasi.asesmen_awal)}
      ${field('2', 'Dimensi Profil Lulusan', listText(content.identifikasi.dimensi_profil_lulusan))}
      ${field('3', 'Topik Panca Cinta', listText(content.identifikasi.topik_panca_cinta))}
      ${field('4', 'Materi Integrasi KBC', content.identifikasi.materi_integrasi_kbc)}
      ${section('C', 'Desain Pembelajaran')}
      ${field('1', 'Tujuan Pembelajaran', content.desain_pembelajaran.tujuan_pembelajaran)}
      ${fieldRowInner(
        '2',
        'Kerangka Pembelajaran',
        isPackage
          ? packageParagraph(`Praktik Pedagogis Model Pembelajaran: ${template.modelLabel}`, { bold: true, after: 65 })
            + bodyParagraphs(rppmKerangkaDetails(kerangka), { after: 45 })
          : paragraph(`Praktik Pedagogis Model Pembelajaran: ${template.modelLabel}`, { bold: true }) + smartParagraphs(kerangka),
        widths,
        isPackage,
      )}
      ${section('D', `Pengalaman Belajar (Menggunakan Model ${template.modelLabel})`)}
      ${field('1', 'Kegiatan Awal (berkesadaran, bermakna, dan/atau menggembirakan)', listText(content.pengalaman_belajar.kegiatan_awal))}
      ${isPackage
        ? sectionRow('2', 'Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)', widths, true, 'F5F5F4')
        : field('2', 'Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)', '')}
      ${field('', 'Memahami', listText(content.pengalaman_belajar.kegiatan_inti.memahami))}
      ${field('', 'Mengaplikasi', listText(content.pengalaman_belajar.kegiatan_inti.mengaplikasi))}
      ${field('', 'Merefleksi', listText(content.pengalaman_belajar.kegiatan_inti.merefleksi))}
      ${field('3', 'Kegiatan Penutup (berkesadaran, bermakna, dan/atau menggembirakan)', listText(content.pengalaman_belajar.kegiatan_penutup))}
      ${section('E', 'Asesmen Pembelajaran')}
      ${field('1', 'Asesmen Proses', content.asesmen_pembelajaran.asesmen_proses)}
      ${field('2', 'Asesmen Akhir', content.asesmen_pembelajaran.asesmen_akhir, isPackage)}
    </w:tbl>
    ${signatureTable(content, user, kepsek, isPackage ? columnWidths(availableWidth, RPPM_SIGNATURE_WIDTHS) : undefined)}
    ${isPackage && content.lampiran ? attachmentXml(content.lampiran, content.spesifikasi, availableWidth) : ''}
    <w:sectPr>
      <w:pgSz w:w="${page.width}" w:h="${page.height}"/>
      <w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

function sectionRow(letter: string, title: string, [number, label, value]: number[], isPackage: boolean, fill = 'E7E5E4') {
  const marker = isPackage ? packageParagraph(letter, { bold: true, center: true, keep: true }) : paragraph(letter, { bold: true, align: 'center' })
  const heading = isPackage ? packageParagraph(title, { bold: true, keep: true }) : paragraph(title, { bold: true })
  return `<w:tr>${isPackage ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${cell(marker, number, undefined, fill, undefined, isPackage)}${cell(heading, label + value, 2, fill, undefined, isPackage)}</w:tr>`
}

function fieldRowInner(no: string, label: string, inner: string, [number, labelWidth, value]: number[], isPackage: boolean, keep = false) {
  const marker = isPackage ? packageParagraph(no, { center: true, keep }) : paragraph(no, { align: 'center' })
  const name = isPackage ? packageParagraph(label, { bold: Boolean(no), keep }) : paragraph(label, { bold: Boolean(no) })
  return `<w:tr>${isPackage ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${cell(marker, number, undefined, undefined, undefined, isPackage)}${cell(name, labelWidth, undefined, undefined, undefined, isPackage)}${cell(inner, value, undefined, undefined, undefined, isPackage)}</w:tr>`
}

function gapRow() {
  return `<w:tr>${cell(paragraph(''), 9750, 3, undefined, { top: 'nil', left: 'nil', bottom: 'nil', right: 'nil' })}</w:tr>`
}

function cell(inner: string, width: number, gridSpan?: number, fill?: string, borders?: Partial<Record<'top' | 'left' | 'bottom' | 'right', 'single' | 'nil'>>, isPackage = false) {
  const border = (side: 'top' | 'left' | 'bottom' | 'right') => {
    const val = borders?.[side] || 'single'
    return `<w:${side} w:val="${val}"${val === 'single' ? (isPackage ? ' w:sz="4" w:space="0" w:color="737373"' : ' w:sz="10" w:space="0" w:color="000000"') : ''}/>`
  }
  const shading = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''

  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : ''}
      ${isPackage ? '' : shading}
      <w:tcBorders>${border('top')}${border('left')}${border('bottom')}${border('right')}</w:tcBorders>
      ${isPackage ? shading : ''}
      <w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>
      <w:vAlign w:val="top"/>
    </w:tcPr>
    ${inner}
  </w:tc>`
}

function signatureTable(content: RppmContent, user: RppmSigner, kepsek: RppmSigner | null, packageWidths?: number[]) {
  const noBorders = { top: 'nil', left: 'nil', bottom: 'nil', right: 'nil' } as const
  const widths = packageWidths ?? [4300, 1900, 3700]
  const [principalWidth, spacerWidth, teacherWidth] = widths
  const width = widths.reduce((total, column) => total + column, 0)
  return `<w:p><w:pPr>${packageWidths ? '<w:keepNext/>' : ''}<w:spacing w:before="360" w:after="0"/></w:pPr></w:p>
  <w:tbl>
    <w:tblPr>
      ${packageWidths ? `<w:tblW w:w="${width}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>'}
      <w:tblBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/>
      </w:tblBorders>
      ${packageWidths ? '<w:tblLayout w:type="fixed"/>' : ''}
    </w:tblPr>
    ${tableGrid(widths)}
    <w:tr>
      ${packageWidths ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}
      ${signatureCell('Mengetahui,', 'Kepala MAN 1 Tasikmalaya', kepsek?.nama_lengkap || 'Kepala Madrasah Belum Diatur', kepsek?.nip || '', principalWidth)}
      ${cell(paragraph(''), spacerWidth, undefined, undefined, noBorders)}
      ${signatureCell(content.spesifikasi.tanggal_ttd ? `Tasikmalaya, ${formatTanggalRppm(content.spesifikasi.tanggal_ttd)}` : 'Tasikmalaya, ................................', user.jabatan_cetak || user.role || 'Guru', user.nama_lengkap || 'Nama Guru Belum Diatur', user.nip || '', teacherWidth)}
    </w:tr>
  </w:tbl>`
}

function columnWidths(total: number, percentages: number[]) {
  const widths = percentages.map(percent => Math.floor(total * percent / 100))
  widths[widths.length - 1] += total - widths.reduce((sum, width) => sum + width, 0)
  return widths
}

function tableGrid(widths: number[]) {
  return `<w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`
}

type PackageParagraphOptions = {
  style?: 'Title' | 'Heading1' | 'Heading2'
  bold?: boolean
  center?: boolean
  keep?: boolean
  newPage?: boolean
  before?: number
  after?: number
  indent?: boolean
}

function packageParagraph(value: string, options: PackageParagraphOptions = {}) {
  return `<w:p><w:pPr>
    ${options.style ? `<w:pStyle w:val="${options.style}"/>` : ''}
    ${options.keep ? '<w:keepNext/>' : ''}
    ${options.newPage ? '<w:pageBreakBefore/>' : ''}
    <w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}" w:line="270" w:lineRule="auto"/>
    ${options.indent ? '<w:ind w:left="300" w:hanging="260"/>' : ''}
    ${options.center ? '<w:jc w:val="center"/>' : ''}
  </w:pPr><w:r>${options.bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
}

function bodyParagraphs(value: string, options: PackageParagraphOptions) {
  return value.split(/\r?\n/).map(line => packageParagraph(line, options)).join('')
}

function attachmentTable(headers: string[], rows: string[][][], width: number, percents?: number[], minRowMm?: number) {
  const widths = columnWidths(width, percents ?? headers.map(() => 100 / headers.length))
  const header = headers.map((title, index) => cell(bodyParagraphs(title, { bold: true, keep: true }), widths[index], undefined, 'E7E5E4', undefined, true))
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>
    ${tableGrid(widths)}
    <w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${header.join('')}</w:tr>
    ${rows.map(row => {
      const height = minRowMm ? `<w:trHeight w:val="${mmToTwip(minRowMm)}" w:hRule="atLeast"/>` : ''
      return `<w:tr><w:trPr><w:cantSplit/>${height}</w:trPr>${row.map((lines, index) => cell(
        lines.map(line => bodyParagraphs(line, { after: 50 })).join(''),
        widths[index], undefined, undefined, undefined, true,
      )).join('')}</w:tr>`
    }).join('')}
  </w:tbl>`
}

function attachmentXml(attachments: NonNullable<RppmContent['lampiran']>, spec: RppmContent['spesifikasi'], width: number) {
  const pages = rppmAttachmentPages(attachments, spec).map(page => [
    packageParagraph(page.label, { bold: true, newPage: true, keep: true, after: 75 }),
    packageParagraph(page.title, { style: 'Heading1', keep: true, after: 120 }),
    packageParagraph(page.meta, { keep: true, after: 225 }),
    ...page.elements.map(element => {
      switch (element.kind) {
        case 'text':
          return bodyParagraphs(element.text, element.style === 'heading'
            ? { style: 'Heading2', keep: true, before: 170, after: 75 }
            : { bold: element.style === 'task', keep: element.style === 'task', before: element.style === 'task' ? 130 : 0, after: 100 })
        case 'list':
          return element.items.map((item, index) => bodyParagraphs(
            `${element.ordered ? `${index + 1}.` : '•'} ${item}`, { indent: true, after: 65 },
          )).join('')
        case 'table':
          return attachmentTable(element.headers, element.rows, width, element.widths, element.minRowMm)
        case 'answer': {
          const line = 'w:val="single" w:sz="4" w:space="1" w:color="737373"'
          const borders = element.ruled
            ? `<w:pBdr><w:bottom ${line}/><w:between ${line}/></w:pBdr>`
            : `<w:pBdr><w:top ${line}/><w:left ${line}/><w:bottom ${line}/><w:right ${line}/></w:pBdr>`
          return Array.from({ length: element.lines }, () =>
            `<w:p><w:pPr>${borders}<w:spacing w:line="410" w:lineRule="exact"/></w:pPr></w:p>`,
          ).join('')
        }
      }
    }),
  ].join('')).join('')
  // Word needs a paragraph after the final table. A one-point mark avoids a blank page.
  return pages + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'
}

function signatureCell(title: string, position: string, name: string, nip: string, width: number) {
  const noBorders = { top: 'nil', left: 'nil', bottom: 'nil', right: 'nil' } as const
  return cell(
    paragraph(title) +
      paragraph(position.toUpperCase(), { bold: true, after: 900 }) +
      paragraph(name.toUpperCase(), { bold: true }) +
      paragraph(`NIP. ${nip || '................................'}`),
    width,
    undefined,
    undefined,
    noBorders,
  )
}

function multilineParagraphs(value: string) {
  const text = value.trim() || EMPTY
  return smartParagraphs(text)
}

function smartParagraphs(value: string) {
  const text = value.trim() || EMPTY
  const points = splitPoints(text)
  if (points.length > 1) return points.map((line, index) => paragraph(`${index + 1}. ${line}`)).join('')
  return text.split('\n').map(line => paragraph(line)).join('')
}

function paragraph(value: string, options?: { bold?: boolean; align?: 'left' | 'center'; size?: number; after?: number }) {
  return `<w:p>
    <w:pPr>
      ${options?.align && options.align !== 'left' ? `<w:jc w:val="${options.align}"/>` : ''}
      <w:spacing w:after="${options?.after ?? 0}" w:line="240" w:lineRule="auto"/>
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

function splitPoints(value: string) {
  const lines = value
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
  return lines.length > 1 ? lines : []
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

function documentRelsXml(isPackage: boolean) {
  if (!isPackage) return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(isPackage: boolean) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  ${isPackage ? [
    ['Title', 'Title', 30],
    ['Heading1', 'heading 1', 28, 0],
    ['Heading2', 'heading 2', 23, 1],
  ].map(([id, label, size, level]) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${label}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>
    ${level === undefined ? '' : `<w:pPr><w:outlineLvl w:val="${level}"/></w:pPr>`}
    <w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`,
  ).join('') : ''}
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
    // JSON strings may contain escaped control characters that XML 1.0 rejects.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
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
