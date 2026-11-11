'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  RPPM_MAIN_TABLE_WIDTHS,
  RPPM_SIGNATURE_WIDTHS,
  rppmAttachmentPages,
  rppmKerangkaDetails,
} from '@/lib/rppm-attachment-layout'
import {
  getRppmTemplate,
  formatTanggalRppm,
  type RppmContent,
  type RppmPrintSettings,
  type RppmTemplateType,
} from '@/lib/rppm'
import type { RppmSigner } from '../actions'

const FONT = '"Times New Roman", Times, serif'
const EMPTY = '........................................'

export function RppmPrintDocument({
  templateType,
  content,
  settings,
  user,
  kepsek,
}: {
  templateType: RppmTemplateType
  content: RppmContent
  settings: RppmPrintSettings
  user: RppmSigner
  kepsek: RppmSigner | null
}) {
  const template = getRppmTemplate(templateType)
  const isPackage = content.format === 'paket-v1'
  const f4Width = isPackage ? '216mm' : '215mm'
  const pageSize = settings.paper === 'A4' ? { width: '210mm', minHeight: '297mm', css: 'A4 portrait' } : { width: f4Width, minHeight: '330mm', css: `${f4Width} 330mm` }
  const { top, right, bottom, left } = settings.margins
  const paperStyle: CSSProperties = {
    width: pageSize.width,
    minHeight: pageSize.minHeight,
    padding: `${top}mm ${right}mm ${bottom}mm ${left}mm`,
    boxSizing: 'border-box',
    background: '#fff',
    fontSize: '11pt',
    lineHeight: isPackage ? 1.125 : 1,
  }
  const formatText = (value: string) => isPackage ? <span style={{ whiteSpace: 'pre-wrap' }}>{text(value)}</span> : value

  return (
    <div style={{ color: '#000', background: '#fff', fontFamily: FONT }}>
      <style>{`
        .rppm-package td, .rppm-attachment td, .rppm-attachment th { border: .5pt solid #737373 !important; }
        .rppm-package td, .rppm-attachment td, .rppm-attachment th { padding: 1.6mm; vertical-align: top; overflow-wrap: anywhere; }
        .rppm-attachment h2, .rppm-attachment h3, .rppm-attachment .rppm-task { break-after: avoid; }
        .rppm-attachment h3 { margin: 3mm 0 1.5mm; font-size: 11.5pt; font-weight: bold; }
        .rppm-attachment p { margin: 0 0 1.75mm; white-space: pre-wrap; }
        .rppm-attachment table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 2mm; }
        .rppm-attachment th { background: #e7e5e4; text-align: left; }
        .rppm-attachment td p:last-child { margin-bottom: 0; }
        @media screen { .rppm-attachment { border-top: 1px solid #d6d3d1; } }
        @media print {
          @page { size: ${pageSize.css}; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .rppm-print-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .rppm-print-page:last-child { break-after: auto; page-break-after: auto; }
          .rppm-table tr { break-inside: avoid; page-break-inside: avoid; }
          .rppm-signature { break-inside: avoid; }
        }
      `}</style>
      <div
        className="rppm-print-page"
        style={paperStyle}
      >
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: isPackage ? '15pt' : '13pt', lineHeight: 1.15, marginBottom: isPackage ? '4.6mm' : '7mm' }}>
          {isPackage ? 'Rencana Pelaksanaan Pembelajaran Mendalam Berbasis Cinta' : <>
            <div>RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM</div>
            <div>BERBASIS CINTA</div>
          </>}
        </div>

        <table className={isPackage ? 'rppm-table rppm-package' : 'rppm-table'} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          {isPackage && <colgroup>{RPPM_MAIN_TABLE_WIDTHS.map(width => <col key={width} style={{ width: `${width}%` }} />)}</colgroup>}
          <tbody>
            <SectionRow letter="A" title="Spesifikasi" />
            <SpecRow no="1" label="Satuan Pendidikan" value={content.spesifikasi.satuan_pendidikan} />
            <SpecRow no="2" label="Mata Pelajaran" value={content.spesifikasi.mata_pelajaran} />
            <SpecRow no="3" label="Kelas / Semester" value={content.spesifikasi.kelas_semester} />
            <SpecRow no="4" label="Topik Pembelajaran" value={content.spesifikasi.topik_pembelajaran} />
            <SpecRow no="5" label="Alokasi Waktu" value={content.spesifikasi.alokasi_waktu} />
            {!isPackage && <GapRow />}

            <SectionRow letter="B" title="Identifikasi" />
            <FieldRow no="1" label="Asesmen pada Awal Pembelajaran (opsional)" value={formatText(content.identifikasi.asesmen_awal)} />
            <FieldRow no="2" label="Dimensi Profil Lulusan" value={<List items={content.identifikasi.dimensi_profil_lulusan} />} />
            <FieldRow no="3" label="Topik Panca Cinta" value={<List items={content.identifikasi.topik_panca_cinta} />} />
            <FieldRow no="4" label="Materi Integrasi KBC" value={formatText(content.identifikasi.materi_integrasi_kbc)} />

            <SectionRow letter="C" title="Desain Pembelajaran" />
            <FieldRow no="1" label="Tujuan Pembelajaran" value={formatText(content.desain_pembelajaran.tujuan_pembelajaran)} />
            <FieldRow
              no="2"
              label="Kerangka Pembelajaran"
              value={
                <>
                  <div><strong>Praktik Pedagogis Model Pembelajaran:</strong> {template.modelLabel}</div>
                  <div style={{ marginTop: '2mm' }}>{isPackage
                    ? formatText(rppmKerangkaDetails(content.desain_pembelajaran.kerangka_pembelajaran))
                    : <SmartText value={content.desain_pembelajaran.kerangka_pembelajaran} />}
                  </div>
                </>
              }
            />

            <SectionRow letter="D" title={`Pengalaman Belajar (Menggunakan Model ${template.modelLabel})`} />
            <FieldRow no="1" label="Kegiatan Awal (berkesadaran, bermakna, dan/atau menggembirakan)" value={<List items={content.pengalaman_belajar.kegiatan_awal} />} />
            {isPackage
              ? <SectionRow letter="2" title="Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)" fill="#f5f5f4" />
              : <FieldRow no="2" label="Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)" value="" />}
            <FieldRow no="" label="Memahami" value={<List items={content.pengalaman_belajar.kegiatan_inti.memahami} />} />
            <FieldRow no="" label="Mengaplikasi" value={<List items={content.pengalaman_belajar.kegiatan_inti.mengaplikasi} />} />
            <FieldRow no="" label="Merefleksi" value={<List items={content.pengalaman_belajar.kegiatan_inti.merefleksi} />} />
            <FieldRow no="3" label="Kegiatan Penutup (berkesadaran, bermakna, dan/atau menggembirakan)" value={<List items={content.pengalaman_belajar.kegiatan_penutup} />} />

            <SectionRow letter="E" title="Asesmen Pembelajaran" />
            <FieldRow no="1" label="Asesmen Proses" value={formatText(content.asesmen_pembelajaran.asesmen_proses)} />
            <FieldRow no="2" label="Asesmen Akhir" value={formatText(content.asesmen_pembelajaran.asesmen_akhir)} />
          </tbody>
        </table>

        <SignatureBlock user={user} kepsek={kepsek} content={content} />
      </div>
      {isPackage && content.lampiran && rppmAttachmentPages(content.lampiran, content.spesifikasi).map(page => (
        <section key={page.label} className="rppm-print-page rppm-attachment" style={paperStyle}>
          <p style={{ fontWeight: 700 }}>{page.label}</p>
          <h2 style={{ fontSize: '14pt', fontWeight: 700, marginBottom: '2mm' }}>{page.title}</h2>
          <p style={{ marginBottom: '4mm' }}>{page.meta}</p>
          {page.elements.map((element, index) => {
            switch (element.kind) {
              case 'text':
                return element.style === 'heading'
                  ? <h3 key={index}>{element.text}</h3>
                  : <p key={index} className={element.style === 'task' ? 'rppm-task' : undefined} style={element.style === 'task' ? { fontWeight: 700, marginTop: '2.3mm' } : undefined}>{element.text}</p>
              case 'list': {
                const Tag = element.ordered ? 'ol' : 'ul'
                return <Tag key={index} style={{ listStyleType: element.ordered ? 'decimal' : 'disc', paddingLeft: '5mm' }}>
                  {element.items.map((item, i) => <li key={i}>{item}</li>)}
                </Tag>
              }
              case 'table':
                return (
                  <table key={index}>
                    {element.widths && <colgroup>{element.widths.map(width => <col key={width} style={{ width: `${width}%` }} />)}</colgroup>}
                    <thead><tr>{element.headers.map((header, i) => <th key={i} scope="col">{header}</th>)}</tr></thead>
                    <tbody>{element.rows.map((row, i) => (
                      <tr key={i} style={{ height: element.minRowMm ? `${element.minRowMm}mm` : undefined }}>
                        {row.map((lines, column) => <td key={column}>{lines.map((line, j) => <p key={j}>{line || '\u00a0'}</p>)}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                )
              case 'answer':
                return <div key={index} aria-hidden="true" style={{ border: element.ruled ? undefined : '.5pt solid #737373' }}>{Array.from({ length: element.lines }, (_, i) => (
                  <div key={i} style={{ height: '7.2mm', borderBottom: element.ruled ? '.5pt solid #737373' : undefined }} />
                ))}</div>
            }
          })}
        </section>
      ))}
    </div>
  )
}

function SectionRow({ letter, title, fill = '#e7e5e4' }: { letter: string; title: string; fill?: string }) {
  return (
    <tr>
      <td style={cell({ width: '9mm', align: 'center', bold: true, fill })}>{letter}</td>
      <td colSpan={2} style={cell({ bold: true, fill })}>{title}</td>
    </tr>
  )
}

function FieldRow({ no, label, value }: { no: string; label: string; value: ReactNode }) {
  return (
    <tr>
      <td style={cell({ width: '9mm', align: 'center' })}>{no}</td>
      <td style={cell({ width: '48mm', bold: Boolean(no) })}>{label}</td>
      <td style={cell()}>{typeof value === 'string' ? <SmartText value={value} /> : value}</td>
    </tr>
  )
}

function SpecRow({ no, label, value }: { no: string; label: string; value: string }) {
  return (
    <tr>
      <td style={cell({ width: '9mm', align: 'center' })}>{no}</td>
      <td style={cell({ width: '48mm', bold: true })}>{label}</td>
      <td style={cell()}>{text(value)}</td>
    </tr>
  )
}

function GapRow() {
  return (
    <tr>
      <td colSpan={3} style={{ height: '8mm', border: 'none', padding: 0, background: '#fff' }} />
    </tr>
  )
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <span>{EMPTY}</span>
  return (
    <ol style={{ margin: 0, paddingLeft: '5mm' }}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} style={{ marginBottom: 0 }}>{item}</li>
      ))}
    </ol>
  )
}

function SmartText({ value }: { value: string }) {
  const items = splitPoints(value)
  if (items.length <= 1) return <span>{text(value)}</span>
  return <List items={items} />
}

function SignatureBlock({ user, kepsek, content }: { user: RppmSigner; kepsek: RppmSigner | null; content: RppmContent }) {
  const isPackage = content.format === 'paket-v1'
  return (
    <div className="rppm-signature" style={{ display: 'flex', justifyContent: 'space-between', gap: isPackage ? undefined : '18mm', marginTop: isPackage ? '8mm' : '16mm', fontSize: '11pt' }}>
      <SignatureColumn
        title="Mengetahui,"
        position="Kepala MAN 1 Tasikmalaya"
        name={kepsek?.nama_lengkap || 'Kepala Madrasah Belum Diatur'}
        nip={kepsek?.nip || ''}
        width={isPackage ? `${RPPM_SIGNATURE_WIDTHS[0]}%` : '44%'}
      />
      <SignatureColumn
        title={content.spesifikasi.tanggal_ttd ? `Tasikmalaya, ${formatTanggalRppm(content.spesifikasi.tanggal_ttd)}` : 'Tasikmalaya, ................................'}
        position={user.jabatan_cetak || user.role || 'Guru'}
        name={user.nama_lengkap || 'Nama Guru Belum Diatur'}
        nip={user.nip || ''}
        width={isPackage ? `${RPPM_SIGNATURE_WIDTHS[2]}%` : '34%'}
      />
    </div>
  )
}

function SignatureColumn({ title, position, name, nip, width }: { title: string; position: string; name: string; nip: string; width: string }) {
  return (
    <div style={{ width, textAlign: 'left' }}>
      <div style={{ minHeight: '5mm' }}>{title}</div>
      <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '22mm' }}>{position}</div>
      <div style={{ fontWeight: 700, textDecoration: 'underline', textTransform: 'uppercase' }}>{name}</div>
      <div>NIP. {nip || '................................'}</div>
    </div>
  )
}

function splitPoints(value: string) {
  const lines = value
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
  return lines.length > 1 ? lines : []
}

function text(value: string) {
  return value?.trim() || EMPTY
}

function cell(options?: { width?: string; align?: 'left' | 'center'; bold?: boolean; height?: string; fill?: string; borderLeft?: string; borderRight?: string }): CSSProperties {
  return {
    borderTop: '1px solid #000',
    borderBottom: '1px solid #000',
    borderLeft: options?.borderLeft || '1px solid #000',
    borderRight: options?.borderRight || '1px solid #000',
    backgroundColor: options?.fill,
    padding: '2.3mm 2mm',
    verticalAlign: 'top',
    width: options?.width,
    textAlign: options?.align || 'left',
    fontWeight: options?.bold ? 700 : 400,
    minHeight: options?.height,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}
