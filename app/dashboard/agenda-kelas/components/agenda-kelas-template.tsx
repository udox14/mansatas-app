'use client'

import React from 'react'
import type { AgendaKelasPageData } from '../actions'

const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '0.65pt solid #000'
const EMPTY = '..................................................'

type Props = {
  data: AgendaKelasPageData
  pageBreak?: boolean
}

function formatTanggal(date: string) {
  const d = new Date(date + 'T00:00:00')
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function Check({ active }: { active: boolean }) {
  return <span style={{ fontFamily: 'Arial, sans-serif', fontSize: '8pt' }}>{active ? 'V' : ''}</span>
}

export const AgendaKelasTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ data, pageBreak = false }, ref) => {
    const mid = Math.ceil(Math.max(data.absensiRows.length, 18) / 2)
    const leftRows = data.absensiRows.slice(0, mid)
    const rightRows = data.absensiRows.slice(mid)
    const rowCount = Math.max(18, leftRows.length, rightRows.length)

    return (
      <div
        ref={ref}
        style={{
          width: '330mm',
          height: '215mm',
          padding: '6mm 8mm 7mm 8mm',
          boxSizing: 'border-box',
          backgroundColor: '#fff',
          color: '#000',
          fontFamily: FONT,
          fontSize: '8.5pt',
          overflow: 'hidden',
          ...(pageBreak ? { pageBreakBefore: 'always' as const } : {}),
        }}
      >
        <div style={{ margin: '-6mm -8mm 3mm -8mm' }}>
          <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm', marginBottom: '2.5mm', fontSize: '10pt', fontWeight: 700 }}>
          <div>HARI : {data.hariNama || EMPTY}</div>
          <div>TANGGAL : {formatTanggal(data.tanggal)}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '52% 48%', gap: '3mm' }}>
          <div>
            <div style={sectionTitle}>AGENDA KELAS</div>
            <table style={tableStyle}>
              <colgroup>
                <col style={{ width: '9mm' }} />
                <col style={{ width: '35mm' }} />
                <col />
                <col style={{ width: '42mm' }} />
                <col style={{ width: '18mm' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thStyle}>JAM<br />KE</th>
                  <th style={thStyle}>MATA PELAJARAN</th>
                  <th style={thStyle}>POKOK<br />BAHASAN</th>
                  <th style={thStyle}>TUGAS</th>
                  <th style={thStyle}>PARAF<br />GURU</th>
                </tr>
              </thead>
              <tbody>
                {data.agendaRows.map(row => (
                  <tr key={row.jam_ke} style={{ height: '8.5mm' }}>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{row.jam_label}</td>
                    <td style={tdStyle}>{row.mapel_nama}</td>
                    <td style={tdStyle}>{row.pokok_bahasan}</td>
                    <td style={tdStyle}>{row.tugas}</td>
                    <td style={tdStyle} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={sectionTitle}>ABSENSI SISWA</div>
            <table style={tableStyle}>
              <colgroup>
                <col style={{ width: '8mm' }} />
                <col />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '18mm' }} />
                <col style={{ width: '8mm' }} />
                <col />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '6mm' }} />
                <col style={{ width: '18mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'NAMA', 'S', 'I', 'A', 'KET', 'NO', 'NAMA', 'S', 'I', 'A', 'KET'].map((label, index) => (
                    <th key={`${label}-${index}`} style={thStyle}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }).map((_, index) => {
                  const left = leftRows[index]
                  const right = rightRows[index]
                  return (
                    <tr key={index} style={{ height: '5.7mm' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{left?.no || ''}</td>
                      <td style={tdName}>{left?.nama || ''}</td>
                      <td style={tdCenter}><Check active={!!left?.sakit} /></td>
                      <td style={tdCenter}><Check active={!!left?.izin} /></td>
                      <td style={tdCenter}><Check active={!!left?.alfa} /></td>
                      <td style={tdSmall}>{left?.ket || ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{right?.no || ''}</td>
                      <td style={tdName}>{right?.nama || ''}</td>
                      <td style={tdCenter}><Check active={!!right?.sakit} /></td>
                      <td style={tdCenter}><Check active={!!right?.izin} /></td>
                      <td style={tdCenter}><Check active={!!right?.alfa} /></td>
                      <td style={tdSmall}>{right?.ket || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '48mm 1fr 58mm 64mm', gap: '5mm', marginTop: '3mm', alignItems: 'start' }}>
          <div style={{ fontSize: '9pt', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700 }}>REKAPITULASI KEGIATAN</div>
            <div>1. Terisi : {data.rekap.terisi} Jam</div>
            <div>2. Tugas : {data.rekap.tugas} Jam</div>
            <div>3. Kosong : {data.rekap.kosong} Jam</div>
          </div>

          <div />

          <div style={signatureBlock}>
            <div>KM Kelas {data.kelas.label},</div>
            <div style={{ marginTop: '17mm', fontWeight: 700, textDecoration: 'underline' }}>{data.kelas.km_nama}</div>
          </div>

          <div style={signatureBlock}>
            <div>Tasikmalaya, {EMPTY}</div>
            <div>Wali Kelas,</div>
            <div style={{ marginTop: '13mm', fontWeight: 700, textDecoration: 'underline' }}>{data.kelas.wali_kelas_nama}</div>
            <div>NIP. {data.kelas.wali_kelas_nip || ''}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '2mm', fontSize: '9pt' }}>
          <div style={{ textAlign: 'center', lineHeight: 1.45 }}>
            <div>Mengetahui :</div>
            <div>Kepala MAN 1 Tasikmalaya,</div>
            <div style={{ marginTop: '14mm', fontWeight: 700, textDecoration: 'underline' }}>{data.kepala.nama}</div>
            <div>NIP. {data.kepala.nip}</div>
          </div>
          <div />
        </div>
      </div>
    )
  }
)

AgendaKelasTemplate.displayName = 'AgendaKelasTemplate'

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: FONT,
}

const sectionTitle: React.CSSProperties = {
  border: BORDER,
  borderBottom: 0,
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '10pt',
  padding: '1mm 0',
}

const thStyle: React.CSSProperties = {
  border: BORDER,
  padding: '1mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '8pt',
  fontWeight: 700,
  lineHeight: 1.05,
}

const tdStyle: React.CSSProperties = {
  border: BORDER,
  padding: '0.8mm 1mm',
  verticalAlign: 'middle',
  fontSize: '8pt',
  lineHeight: 1.05,
  overflow: 'hidden',
}

const tdName: React.CSSProperties = {
  ...tdStyle,
  fontSize: '7.6pt',
  whiteSpace: 'nowrap',
  textOverflow: 'clip',
}

const tdSmall: React.CSSProperties = {
  ...tdStyle,
  fontSize: '6.7pt',
}

const tdCenter: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  padding: 0,
}

const signatureBlock: React.CSSProperties = {
  fontSize: '9pt',
  lineHeight: 1.45,
  textAlign: 'left',
}
