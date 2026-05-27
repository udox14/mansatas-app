'use client'

import React from 'react'
import type { AgendaKelasPageData } from '../actions'

const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '1px solid #000'

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
  return <span style={{ fontFamily: FONT, fontSize: '9pt', fontWeight: 'bold' }}>{active ? '✓' : ''}</span>
}

export const AgendaKelasTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ data, pageBreak = false }, ref) => {
    const absensiList = data.absensiRows.slice(0, 20)

    return (
      <div
        ref={ref}
        style={{
          width: '330mm',
          height: '215mm',
          padding: '10mm',
          boxSizing: 'border-box',
          backgroundColor: '#fff',
          color: '#000',
          fontFamily: FONT,
          fontSize: '8.5pt',
          overflow: 'hidden',
          position: 'relative',
          ...(pageBreak ? { pageBreakBefore: 'always' as const } : {}),
        }}
      >
        {/* 1. KOP / HEADER - CENTERED FLEX GROUP SO LOGO SITS ADJACENT TO TEXT */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '3.5px double #000', paddingBottom: '2.5mm', marginBottom: '3.5mm', height: '21mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5mm' }}>
            <img src="/logohitam.png" alt="Logo" style={{ height: '19mm', width: 'auto' }} />
            <div style={{ textAlign: 'center', color: '#000' }}>
              <div style={{ fontSize: '11.5pt', fontWeight: 'bold', lineHeight: 1.1 }}>KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 'bold', lineHeight: 1.1 }}>KANTOR KEMENTERIAN AGAMA KABUPATEN TASIKMALAYA</div>
              <div style={{ fontSize: '13.5pt', fontWeight: 'bold', lineHeight: 1.15, margin: '0.4mm 0' }}>MADRASAH ALIYAH NEGERI 1 TASIKMALAYA</div>
              <div style={{ fontSize: '8.2pt', lineHeight: 1.1 }}>Jl. Pahlawan KHZ. Musthafa Sukamanah Desa Sukarapih Kec. Sukarame Kode Pos 46461</div>
              <div style={{ fontSize: '8.2pt', fontWeight: 'bold', lineHeight: 1.1 }}>website : www.man1tasikmalaya.sch.id email : manegerisukamanah@gmail.com</div>
            </div>
          </div>
        </div>

        {/* HARI & TANGGAL SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '52% 48%', gap: '4mm', marginBottom: '3mm', fontSize: '9.5pt', fontWeight: 'bold' }}>
          <div>HARI : <span style={{ fontWeight: 'normal', borderBottom: '1px dotted #000', display: 'inline-block', width: '65%', paddingLeft: '2mm' }}>{data.hariNama || ''}&nbsp;</span></div>
          <div>TANGGAL : <span style={{ fontWeight: 'normal', borderBottom: '1px dotted #000', display: 'inline-block', width: '65%', paddingLeft: '2mm' }}>{data.tanggal ? formatTanggal(data.tanggal) : ''}&nbsp;</span></div>
        </div>

        {/* 6. TABLES SECTION - IDENTICAL ROW AND HEADER HEIGHTS */}
        <div style={{ display: 'grid', gridTemplateColumns: '52% 48%', gap: '4mm', marginBottom: '3.5mm' }}>
          {/* AGENDA KELAS TABLE */}
          <div>
            {/* 5. Gapped header box */}
            <div style={sectionTitle}>AGENDA KELAS</div>
            <table style={tableStyle}>
              <colgroup>
                <col style={{ width: '9mm' }} />
                <col style={{ width: '31mm' }} />
                <col style={{ width: '45mm' }} />
                <col style={{ width: '38mm' }} />
                <col style={{ width: '16mm' }} />
              </colgroup>
              <thead>
                <tr style={{ height: '9mm' }}>
                  <th style={thStyle}>JAM<br />KE</th>
                  <th style={thStyle}>MATA PELAJARAN</th>
                  <th style={thStyle}>POKOK<br />BAHASAN</th>
                  <th style={thStyle}>TUGAS</th>
                  <th style={thStyle}>PARAF<br />GURU</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, index) => {
                  const row = data.agendaRows[index]
                  return (
                    <tr key={index} style={{ height: '8.1mm' }}>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                      <td style={tdStyle}>{row?.mapel_nama || ''}</td>
                      <td style={tdStyle}>{row?.pokok_bahasan || ''}</td>
                      <td style={tdStyle}>{row?.tugas || ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{row?.paraf || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ABSENSI SISWA SECTION */}
          <div>
            {/* 5. Gapped header box */}
            <div style={sectionTitle}>ABSENSI SISWA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm' }}>
              {/* Left Sub-table (1-10) */}
              <table style={tableStyle}>
                <colgroup>
                  <col style={{ width: '8mm' }} />
                  <col />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '13mm' }} />
                </colgroup>
                <thead>
                  <tr style={{ height: '9mm' }}>
                    <th style={thStyle}>NO</th>
                    <th style={thStyle}>NAMA</th>
                    <th style={thStyle}>S</th>
                    <th style={thStyle}>I</th>
                    <th style={thStyle}>A</th>
                    <th style={thStyle}>KET</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => {
                    const row = absensiList[index]
                    return (
                      <tr key={index} style={{ height: '8.1mm' }}>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                        <td style={tdName}>{row?.nama || ''}</td>
                        <td style={tdCenter}>{row?.sakit ? <Check active={true} /> : ''}</td>
                        <td style={tdCenter}>{row?.izin ? <Check active={true} /> : ''}</td>
                        <td style={tdCenter}>{row?.alfa ? <Check active={true} /> : ''}</td>
                        <td style={tdSmall}>{row?.ket || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Right Sub-table (11-20) */}
              <table style={tableStyle}>
                <colgroup>
                  <col style={{ width: '8mm' }} />
                  <col />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '5mm' }} />
                  <col style={{ width: '13mm' }} />
                </colgroup>
                <thead>
                  <tr style={{ height: '9mm' }}>
                    <th style={thStyle}>NO</th>
                    <th style={thStyle}>NAMA</th>
                    <th style={thStyle}>S</th>
                    <th style={thStyle}>I</th>
                    <th style={thStyle}>A</th>
                    <th style={thStyle}>KET</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => {
                    const row = absensiList[index + 10]
                    return (
                      <tr key={index} style={{ height: '8.1mm' }}>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{index + 11}</td>
                        <td style={tdName}>{row?.nama || ''}</td>
                        <td style={tdCenter}>{row?.sakit ? <Check active={true} /> : ''}</td>
                        <td style={tdCenter}>{row?.izin ? <Check active={true} /> : ''}</td>
                        <td style={tdCenter}>{row?.alfa ? <Check active={true} /> : ''}</td>
                        <td style={tdSmall}>{row?.ket || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 1, 2, 3, 4, 5. PIXEL-PERFECT FOOTER GRID LAYOUT */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32% 32% 36%',
            gridTemplateRows: 'auto auto auto auto auto auto auto auto auto',
            gap: '0.6mm 0mm',
            marginTop: '3.5mm',
            fontSize: '8.5pt',
            fontFamily: FONT,
          }}
        >
          {/* Row 1 */}
          <div style={{ gridRow: 1, gridColumn: 1, fontWeight: 'bold', fontSize: '9pt' }}>
            REKAPITULASI KEGIATAN
          </div>
          <div style={{ gridRow: 1, gridColumn: 3, paddingLeft: '4mm' }}>
            Tasikmalaya, <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', width: '35mm' }}>&nbsp;</span>
          </div>

          {/* Row 2 */}
          <div style={{ gridRow: 2, gridColumn: 1 }}>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '4mm', verticalAlign: 'top' }}>1.</td>
                  <td style={{ width: '12mm', verticalAlign: 'top' }}>Terisi</td>
                  <td style={{ width: '3mm', verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1.5mm', width: '15mm', fontWeight: 'bold' }}>
                    {data.rekap.terisi !== undefined ? data.rekap.terisi : ''}
                  </td>
                  <td style={{ verticalAlign: 'bottom', paddingLeft: '1.5mm' }}>Jam</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ gridRow: 2, gridColumn: 3, paddingLeft: '4mm' }}>
            KM Kelas <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', width: '25mm' }}>{data.kelas.label || ''}</span>,
          </div>

          {/* Row 3 */}
          <div style={{ gridRow: 3, gridColumn: 1 }}>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '4mm', verticalAlign: 'top' }}>2.</td>
                  <td style={{ width: '12mm', verticalAlign: 'top' }}>Tugas</td>
                  <td style={{ width: '3mm', verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1.5mm', width: '15mm', fontWeight: 'bold' }}>
                    {data.rekap.tugas !== undefined ? data.rekap.tugas : ''}
                  </td>
                  <td style={{ verticalAlign: 'bottom', paddingLeft: '1.5mm' }}>Jam</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Row 4 */}
          <div style={{ gridRow: 4, gridColumn: 1 }}>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '4mm', verticalAlign: 'top' }}>3.</td>
                  <td style={{ width: '12mm', verticalAlign: 'top' }}>Kosong</td>
                  <td style={{ width: '3mm', verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1.5mm', width: '15mm', fontWeight: 'bold' }}>
                    {data.rekap.kosong !== undefined ? data.rekap.kosong : ''}
                  </td>
                  <td style={{ verticalAlign: 'bottom', paddingLeft: '1.5mm' }}>Jam</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Row 5 */}
          <div style={{ gridRow: 5, gridColumn: 2, paddingLeft: '6mm', marginTop: '1.5mm' }}>
            Mengetahui :
          </div>
          <div style={{ gridRow: 5, gridColumn: 3, paddingLeft: '4mm', marginTop: '1.5mm' }}>
            {data.kelas.km_nama ? (
              <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50mm', fontWeight: 'bold' }}>
                {data.kelas.km_nama}
              </span>
            ) : (
              <span>...........................................................</span>
            )}
          </div>

          {/* Row 6 */}
          <div style={{ gridRow: 6, gridColumn: 1, marginTop: '1mm' }}>
            Kepala MAN 1 Tasikmalaya,
          </div>
          <div style={{ gridRow: 6, gridColumn: 2, paddingLeft: '6mm', marginTop: '1mm' }}>
            Wali Kelas,
          </div>
          <div style={{ gridRow: 6, gridColumn: 3, paddingLeft: '4mm', marginTop: '1mm' }}>
            NIS
          </div>

          {/* Row 7 (Signature Spacer) */}
          <div style={{ gridRow: 7, gridColumn: '1 / span 3', height: '14mm' }} />

          {/* Row 8 */}
          <div style={{ gridRow: 8, gridColumn: 1, fontWeight: 'bold' }}>
            {data.kepala.nama}
          </div>
          <div style={{ gridRow: 8, gridColumn: 2, paddingLeft: '6mm' }}>
            {data.kelas.wali_kelas_nama ? (
              <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50mm', fontWeight: 'bold' }}>
                {data.kelas.wali_kelas_nama}
              </span>
            ) : (
              <span>...........................................................</span>
            )}
          </div>

          {/* Row 9 */}
          <div style={{ gridRow: 9, gridColumn: 1 }}>
            NIP. {data.kepala.nip}
          </div>
          <div style={{ gridRow: 9, gridColumn: 2, paddingLeft: '6mm' }}>
            NIP. {data.kelas.wali_kelas_nip || '...........................................................'}
          </div>
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
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '10.5pt',
  padding: '1mm 0',
  fontFamily: FONT,
  marginBottom: '2mm',
}

const thStyle: React.CSSProperties = {
  border: BORDER,
  padding: '0.8mm 0.5mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '8.5pt',
  fontWeight: 'bold',
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
  fontSize: '7.8pt',
  whiteSpace: 'nowrap',
  textOverflow: 'clip',
}

const tdSmall: React.CSSProperties = {
  ...tdStyle,
  fontSize: '7.2pt',
}

const tdCenter: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  padding: 0,
}


