// Lokasi: app/dashboard/tka/components/tka-print-templates.tsx
'use client'

import React from 'react'

export type TkaJumlahPrintRow = {
  mapel: string
  pilihan1: number
  pilihan2: number
  total: number
}

export type TkaSiswaPrintRow = {
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  kelas: string
  mapel_pilihan1: string
  mapel_pilihan2: string
}

export type TkaSiswaMapelPrintRow = {
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  kelas: string
}

export type TkaJumlahPrintData = {
  tahun_ajaran_label: string
  rows: TkaJumlahPrintRow[]
  total_p1: number
  total_p2: number
  total_all: number
}

export type TkaKelasPrintData = {
  group_label: string
  tahun_ajaran_label: string
  siswa: TkaSiswaPrintRow[]
  jumlah_l: number
  jumlah_p: number
}

export type TkaMapelPrintData = {
  group_label: string
  pilihan: 1 | 2
  tahun_ajaran_label: string
  siswa: TkaSiswaMapelPrintRow[]
}

const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '0.6pt solid #000'

const thStyle: React.CSSProperties = {
  border: BORDER,
  padding: '2pt 3pt',
  fontFamily: FONT,
  fontSize: '9pt',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.2,
  backgroundColor: '#fff',
}

const tdStyle: React.CSSProperties = {
  border: BORDER,
  padding: '1.5pt 3pt',
  fontFamily: FONT,
  fontSize: '9pt',
  verticalAlign: 'middle',
  lineHeight: 1.15,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

function KopSurat() {
  return (
    <div style={{ marginLeft: '-9mm', marginRight: '-9mm', marginBottom: '5pt' }}>
      <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

function TtdBlock() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: '10pt',
        fontFamily: FONT,
        fontSize: '12pt',
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: '8pt', color: '#555', fontStyle: 'italic', paddingBottom: '2pt' }}>
        Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
      <div style={{ textAlign: 'left', lineHeight: 1.6, paddingRight: '12pt' }}>
        <div>Tasikmalaya, .................................</div>
        <div>Panitia TKA,</div>
        <div style={{ marginTop: '44pt', fontWeight: 700, textDecoration: 'underline' }}>
          .................................
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 1. REKAP JUMLAH SISWA PER MAPEL (A4 portrait)
// ============================================================
interface JumlahProps {
  data: TkaJumlahPrintData
  pageBreak?: boolean
}

export const TkaRekapJumlahTemplate = React.forwardRef<HTMLDivElement, JumlahProps>(
  ({ data, pageBreak = false }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: '210mm',
          minHeight: '297mm',
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
        <KopSurat />

        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            REKAP JUMLAH SISWA PER MAPEL
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            MAPEL PILIHAN TKA TAHUN AJARAN {data.tahun_ajaran_label}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: FONT }}>
          <colgroup>
            <col style={{ width: '30pt' }} />
            <col />
            <col style={{ width: '75pt' }} />
            <col style={{ width: '75pt' }} />
            <col style={{ width: '55pt' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>No</th>
              <th style={thStyle}>Mata Pelajaran</th>
              <th style={thStyle}>Jumlah Pilihan 1</th>
              <th style={thStyle}>Jumlah Pilihan 2</th>
              <th style={thStyle}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.mapel} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={{ ...tdStyle, paddingLeft: '5pt' }}>{r.mapel}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{r.pilihan1}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{r.pilihan2}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
              </tr>
            ))}
            <tr style={{ height: '16pt', backgroundColor: '#eee' }}>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }} colSpan={2}>
                Jumlah Siswa
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{data.total_p1}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{data.total_p2}</td>
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{data.total_all}</td>
            </tr>
          </tbody>
        </table>

        <TtdBlock />
      </div>
    )
  }
)

TkaRekapJumlahTemplate.displayName = 'TkaRekapJumlahTemplate'

// ============================================================
// 2. REKAP PER KELAS (A4 landscape) — satu halaman per kelas
// ============================================================
interface KelasProps {
  data: TkaKelasPrintData
  pageBreak?: boolean
}

export const TkaRekapKelasTemplate = React.forwardRef<HTMLDivElement, KelasProps>(
  ({ data, pageBreak = false }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: '297mm',
          minHeight: '210mm',
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
        <KopSurat />

        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            REKAP MAPEL PILIHAN SISWA KELAS {data.group_label}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            TES KEMAMPUAN AKADEMIK (TKA) TAHUN AJARAN {data.tahun_ajaran_label}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: FONT }}>
          <colgroup>
            <col style={{ width: '28pt' }} />
            <col style={{ width: '70pt' }} />
            <col />
            <col style={{ width: '30pt' }} />
            <col style={{ width: '70pt' }} />
            <col style={{ width: '115pt' }} />
            <col style={{ width: '115pt' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>No</th>
              <th style={thStyle}>NISN</th>
              <th style={thStyle}>Nama Siswa</th>
              <th style={thStyle}>JK</th>
              <th style={thStyle}>Kelas</th>
              <th style={thStyle}>Mapel Pilihan 1</th>
              <th style={thStyle}>Mapel Pilihan 2</th>
            </tr>
          </thead>
          <tbody>
            {data.siswa.map((s, i) => (
              <tr key={`${s.nisn}-${i}`} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.nisn}</td>
                <td style={{ ...tdStyle, fontSize: '9.5pt', paddingLeft: '5pt' }}>{s.nama_lengkap}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.jenis_kelamin}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.kelas}</td>
                <td style={{ ...tdStyle, paddingLeft: '5pt' }}>{s.mapel_pilihan1}</td>
                <td style={{ ...tdStyle, paddingLeft: '5pt' }}>{s.mapel_pilihan2}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '5pt', fontFamily: FONT, fontSize: '10pt', paddingLeft: '2pt' }}>
          <span>L = &nbsp;{data.jumlah_l}</span>
          <span style={{ marginLeft: '32pt' }}>P = &nbsp;{data.jumlah_p}</span>
          <span style={{ marginLeft: '32pt' }}>Jumlah = &nbsp;{data.siswa.length}</span>
        </div>

        <TtdBlock />
      </div>
    )
  }
)

TkaRekapKelasTemplate.displayName = 'TkaRekapKelasTemplate'

// ============================================================
// 3. REKAP PER MAPEL (A4 landscape) — header nama mapel
// ============================================================
interface MapelProps {
  data: TkaMapelPrintData
  pageBreak?: boolean
}

export const TkaRekapMapelTemplate = React.forwardRef<HTMLDivElement, MapelProps>(
  ({ data, pageBreak = false }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: '297mm',
          minHeight: '210mm',
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
        <KopSurat />

        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            MAPEL PILIHAN TKA : {data.group_label.toUpperCase()}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            PILIHAN {data.pilihan} · TES KEMAMPUAN AKADEMIK (TKA) TAHUN AJARAN {data.tahun_ajaran_label}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: FONT }}>
          <colgroup>
            <col style={{ width: '30pt' }} />
            <col style={{ width: '80pt' }} />
            <col />
            <col style={{ width: '32pt' }} />
            <col style={{ width: '80pt' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>No</th>
              <th style={thStyle}>NISN</th>
              <th style={thStyle}>Nama Siswa</th>
              <th style={thStyle}>JK</th>
              <th style={thStyle}>Kelas</th>
            </tr>
          </thead>
          <tbody>
            {data.siswa.map((s, i) => (
              <tr key={`${s.nisn}-${i}`} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.nisn}</td>
                <td style={{ ...tdStyle, fontSize: '9.5pt', paddingLeft: '5pt' }}>{s.nama_lengkap}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.jenis_kelamin}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{s.kelas}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <TtdBlock />
      </div>
    )
  }
)

TkaRekapMapelTemplate.displayName = 'TkaRekapMapelTemplate'
