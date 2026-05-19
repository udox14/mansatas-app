'use client'

import React from 'react'

export type PenjurusanPrintRow = {
  urut: number
  nis: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  tiket_jurusan: string
}

export type PenjurusanPrintData = {
  kelas_lama: string
  tahun_ajaran_label: string
  siswa: PenjurusanPrintRow[]
  jumlah_l: number
  jumlah_p: number
}

interface Props {
  data: PenjurusanPrintData
  tanggalCetak: string
  pageBreak?: boolean
}

const MIN_ROWS = 33
const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '0.6pt solid #000'

export const BlankoPenjurusanTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ data, tanggalCetak, pageBreak = false }, ref) => {
    const emptyRows = Math.max(0, MIN_ROWS - data.siswa.length)

    return (
      <div
        ref={ref}
        style={{
          width: '215mm',
          minHeight: '330mm',
          padding: '8mm 9mm 10mm 9mm',
          fontFamily: FONT,
          fontSize: '8pt',
          color: '#000',
          backgroundColor: '#fff',
          boxSizing: 'border-box',
          position: 'relative',
          ...(pageBreak ? { pageBreakBefore: 'always' as const } : {}),
        }}
      >
        <div style={{ marginLeft: '-9mm', marginRight: '-9mm', marginBottom: '5pt' }}>
          <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block' }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            DAFTAR TIKET JURUSAN SISWA KELAS {data.kelas_lama}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            TAHUN AJARAN {data.tahun_ajaran_label}
          </div>
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: FONT,
        }}>
          <colgroup>
            <col style={{ width: '20pt' }} />
            <col style={{ width: '43pt' }} />
            <col style={{ width: '68pt' }} />
            <col />
            <col style={{ width: '20pt' }} />
            <col style={{ width: '105pt' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={thStyle}>Urut</th>
              <th colSpan={2} style={thStyle}>Nomor</th>
              <th rowSpan={2} style={{ ...thStyle, textAlign: 'center', paddingLeft: '5pt' }}>N a m a</th>
              <th rowSpan={2} style={thStyle}>JK</th>
              <th rowSpan={2} style={thStyle}>Tiket Jurusan</th>
            </tr>
            <tr>
              <th style={thStyle}>NIS</th>
              <th style={thStyle}>NISN</th>
            </tr>
          </thead>
          <tbody>
            {data.siswa.map(sw => (
              <tr key={sw.urut} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.urut}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.nis}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.nisn}</td>
                <td style={{ ...tdStyle, fontSize: '10pt', paddingLeft: '5pt', paddingRight: '3pt' }}>{sw.nama_lengkap}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.jenis_kelamin}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{sw.tiket_jurusan}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{data.siswa.length + i + 1}</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '5pt', fontFamily: FONT, fontSize: '10pt', paddingLeft: '2pt' }}>
          <span>L = &nbsp;{data.jumlah_l}</span>
          <span style={{ marginLeft: '32pt' }}>P = &nbsp;{data.jumlah_p}</span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '10pt',
          fontFamily: FONT,
          fontSize: '12pt',
        }}>
          <div style={{ fontFamily: FONT, fontSize: '8pt', color: '#555', fontStyle: 'italic', paddingBottom: '2pt' }}>
            Dicetak pada: {tanggalCetak}
          </div>
          <div style={{ textAlign: 'left', lineHeight: 1.6, paddingRight: '12pt' }}>
            <div>Tasikmalaya, .................................</div>
            <div>Panitia Penjurusan,</div>
            <div style={{ marginTop: '44pt', fontWeight: 700, textDecoration: 'underline' }}>
              .................................
            </div>
          </div>
        </div>
      </div>
    )
  }
)

BlankoPenjurusanTemplate.displayName = 'BlankoPenjurusanTemplate'

const thStyle: React.CSSProperties = {
  border: BORDER,
  padding: '2pt 2pt',
  fontFamily: FONT,
  fontSize: '10pt',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.2,
  backgroundColor: '#fff',
}

const tdStyle: React.CSSProperties = {
  border: BORDER,
  padding: '1pt 2pt',
  fontFamily: FONT,
  fontSize: '10pt',
  verticalAlign: 'middle',
  lineHeight: 1.15,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}
