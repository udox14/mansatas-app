'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  getRppmTemplate,
  type RppmContent,
  type RppmPrintSettings,
  type RppmTemplateType,
} from '@/lib/rppm'

const FONT = '"Times New Roman", Times, serif'
const EMPTY = '........................................'

export function RppmPrintDocument({
  templateType,
  content,
  settings,
}: {
  templateType: RppmTemplateType
  content: RppmContent
  settings: RppmPrintSettings
}) {
  const template = getRppmTemplate(templateType)
  const pageSize = settings.paper === 'A4' ? { width: '210mm', minHeight: '297mm', css: 'A4 portrait' } : { width: '215mm', minHeight: '330mm', css: '215mm 330mm' }
  const { top, right, bottom, left } = settings.margins

  return (
    <div style={{ color: '#000', background: '#fff', fontFamily: FONT }}>
      <style>{`
        @media print {
          @page { size: ${pageSize.css}; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .rppm-print-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .rppm-print-page:last-child { break-after: auto; page-break-after: auto; }
          .rppm-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div
        className="rppm-print-page"
        style={{
          width: pageSize.width,
          minHeight: pageSize.minHeight,
          padding: `${top}mm ${right}mm ${bottom}mm ${left}mm`,
          boxSizing: 'border-box',
          background: '#fff',
          fontSize: '11pt',
          lineHeight: 1.25,
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', lineHeight: 1.15, marginBottom: '7mm' }}>
          <div>RENCANA PELAKSANAAN PEMBELAJARAN MENDALAM</div>
          <div>BERBASIS CINTA</div>
        </div>

        <table className="rppm-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <SectionRow letter="A" title="Spesifikasi" />
            <FieldRow no="1" label="Satuan Pendidikan" value={content.spesifikasi.satuan_pendidikan} />
            <FieldRow no="2" label="Mata Pelajaran" value={content.spesifikasi.mata_pelajaran} />
            <FieldRow no="3" label="Kelas / Semester" value={content.spesifikasi.kelas_semester} />
            <FieldRow no="4" label="Topik Pembelajaran" value={content.spesifikasi.topik_pembelajaran} />
            <FieldRow no="5" label="Alokasi Waktu" value={content.spesifikasi.alokasi_waktu} />
            <SpacerRow />

            <SectionRow letter="B" title="Identifikasi" />
            <FieldRow no="1" label="Asesmen pada Awal Pembelajaran (opsional)" value={content.identifikasi.asesmen_awal} />
            <FieldRow no="2" label="Dimensi Profil Lulusan" value={<List items={content.identifikasi.dimensi_profil_lulusan} />} />
            <FieldRow no="3" label="Topik Panca Cinta" value={<List items={content.identifikasi.topik_panca_cinta} />} />
            <FieldRow no="4" label="Materi Integrasi KBC" value={content.identifikasi.materi_integrasi_kbc} />

            <SectionRow letter="C" title="Desain Pembelajaran" />
            <FieldRow no="1" label="Tujuan Pembelajaran" value={content.desain_pembelajaran.tujuan_pembelajaran} />
            <FieldRow
              no="2"
              label="Kerangka Pembelajaran"
              value={
                <>
                  <div><strong>Praktik Pedagogis Model Pembelajaran:</strong> {template.modelLabel}</div>
                  <div style={{ marginTop: '2mm' }}>{text(content.desain_pembelajaran.kerangka_pembelajaran)}</div>
                </>
              }
            />

            <SectionRow letter="D" title={`Pengalaman Belajar (Menggunakan Model ${template.modelLabel})`} />
            <FieldRow no="1" label="Kegiatan Awal (berkesadaran, bermakna, dan/atau menggembirakan)" value={<List items={content.pengalaman_belajar.kegiatan_awal} />} />
            <FieldRow no="2" label="Kegiatan Inti (berkesadaran, bermakna, dan/atau menggembirakan)" value="" />
            <FieldRow no="" label="Memahami" value={<List items={content.pengalaman_belajar.kegiatan_inti.memahami} />} />
            <FieldRow no="" label="Mengaplikasi" value={<List items={content.pengalaman_belajar.kegiatan_inti.mengaplikasi} />} />
            <FieldRow no="" label="Merefleksi" value={<List items={content.pengalaman_belajar.kegiatan_inti.merefleksi} />} />
            <FieldRow no="3" label="Kegiatan Penutup (berkesadaran, bermakna, dan/atau menggembirakan)" value={<List items={content.pengalaman_belajar.kegiatan_penutup} />} />

            <SectionRow letter="E" title="Asesmen Pembelajaran" />
            <FieldRow no="1" label="Asesmen Proses" value={content.asesmen_pembelajaran.asesmen_proses} />
            <FieldRow no="2" label="Asesmen Akhir" value={content.asesmen_pembelajaran.asesmen_akhir} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionRow({ letter, title }: { letter: string; title: string }) {
  return (
    <tr>
      <td style={cell({ width: '9mm', align: 'center', bold: true })}>{letter}</td>
      <td colSpan={2} style={cell({ bold: true })}>{title}</td>
    </tr>
  )
}

function FieldRow({ no, label, value }: { no: string; label: string; value: ReactNode }) {
  return (
    <tr>
      <td style={cell({ width: '9mm', align: 'center' })}>{no}</td>
      <td style={cell({ width: '48mm', bold: Boolean(no) })}>{label}</td>
      <td style={cell()}>{typeof value === 'string' ? text(value) : value}</td>
    </tr>
  )
}

function SpacerRow() {
  return (
    <tr>
      <td style={cell({ height: '6mm' })} />
      <td style={cell({ height: '6mm' })} />
      <td style={cell({ height: '6mm' })} />
    </tr>
  )
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <span>{EMPTY}</span>
  return (
    <ol style={{ margin: 0, paddingLeft: '5mm' }}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} style={{ marginBottom: '1.5mm' }}>{item}</li>
      ))}
    </ol>
  )
}

function text(value: string) {
  return value?.trim() || EMPTY
}

function cell(options?: { width?: string; align?: 'left' | 'center'; bold?: boolean; height?: string }): CSSProperties {
  return {
    border: '1px solid #000',
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
