// Lokasi: app/dashboard/kelas/components/blanko-absensi-template.tsx
// Print-safe — NO Tailwind. Font Book Antiqua. Ukuran F4 (215mm × 330mm).
// Diukur piksel-per-piksel dari dokumen asli MAN 1 Tasikmalaya.
//
// Hasil pengukuran dari gambar (1214×2000px, F4):
//   Logo: 81pt × 72pt, margin-left dari content ~9mm
//   Gap logo→teks: ~32pt (11mm)
//   td logo cell: 113pt total (logo + gap)
//   Page margin: 9mm kiri-kanan, 8mm atas, 10mm bawah
//   Font nama: 10pt (base 7.5pt + 2pt)

import React from 'react'
import type { BlankAbsensiData } from '../actions-print'

interface Props {
  data: BlankAbsensiData
  tanggalCetak: string
  pageBreak?: boolean
}

const MIN_ROWS = 33
const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '0.6pt solid #000'

export const BlankoAbsensiTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ data, tanggalCetak, pageBreak = false }, ref) => {
    const { kelas, tahun_ajaran, siswa, jumlah_l, jumlah_p } = data
    const namaKelas = `${kelas.tingkat}.${kelas.nomor_kelas}`
    const TALabel = tahun_ajaran?.nama ?? '-'
    const jamKe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const emptyRows = Math.max(0, MIN_ROWS - siswa.length)

    return (
      <div
        ref={ref}
        style={{
          width: '215mm',
          minHeight: '330mm',
          // Margin: 9mm kiri-kanan (lebih kecil), 8mm atas, 10mm bawah
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

        {/* ════════════════════════════════════════════════════
            KOP SURAT
            Layout: [td logo=113pt] [td teks=auto, text-align:center]
            Logo img: 81pt × 72pt
            Logo tidak nempel ke tepi — td logo sudah termasuk gap ke teks (32pt)
        ════════════════════════════════════════════════════ */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '0',
          tableLayout: 'fixed',
        }}>
          <colgroup>
            {/* Kolom logo: 81pt logo + 32pt gap = 113pt */}
            <col style={{ width: '113pt' }} />
            {/* Kolom teks: sisa (~432pt untuk konten 195mm) */}
            <col />
          </colgroup>
          <tbody>
            <tr>
              {/* Logo — rata kiri dalam td, vertikal tengah */}
              <td style={{
                verticalAlign: 'middle',
                padding: 0,
                border: 'none',
                paddingLeft: '10pt',   /* logo mulai dari kiri content */
              }}>
                <img
                  src="/logokemenaghitam.png"
                  alt="Logo Kemenag"
                  style={{
                    width: '81pt',
                    height: '72pt',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </td>

              {/* Teks kop — rata tengah */}
              <td style={{
                verticalAlign: 'middle',
                textAlign: 'center',
                padding: 0,
                border: 'none',
                lineHeight: 1.35,
              }}>
                <div style={{ fontFamily: FONT, fontSize: '14pt', fontWeight: 700 }}>
                  KEMENTERIAN AGAMA REPUBLIK INDONESIA
                </div>
                <div style={{ fontFamily: FONT, fontSize: '14pt', fontWeight: 700 }}>
                  KANTOR KEMENTERIAN AGAMA KAB. TASIKMALAYA
                </div>
                <div style={{ fontFamily: FONT, fontSize: '14pt', fontWeight: 700, margin: '1pt 0' }}>
                  MADRASAH ALIYAH NEGERI 1 TASIKMALAYA
                </div>
                <div style={{ fontFamily: FONT, fontSize: '10pt', fontWeight: 'normal' }}>
                  Jalan Pahlawan KH. Zainal Musthafa Desa Sukarapih Kec. Sukarame Kab. Tasikmalaya
                </div>
                <div style={{ fontFamily: FONT, fontSize: '10pt', fontWeight: 'normal' }}>
                  website : www.man1tasikmalaya.sch.id &nbsp;&nbsp; email : manegerisukamanah@gmail.com
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Garis bawah kop: tebal atas + tipis bawah (persis seperti asli) */}
        <div style={{
          borderTop: '2.5pt solid #000',
          borderBottom: '1pt solid #000',
          marginTop: '4pt',
          marginBottom: '5pt',
          paddingBottom: '1.5pt',
        }} />

        {/* ════════════════════════════════════════════════════
            JUDUL
        ════════════════════════════════════════════════════ */}
        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            DAFTAR HADIR SISWA KELAS {namaKelas}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            TAHUN AJARAN {TALabel}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            TABEL ABSENSI
            Content width = 215 - 2×9 = 197mm = 558pt
            Urut:20 | NIS:43 | NISN:68 | Nama:auto | JK:20 | Jam×10:150 | S:25 | I:25 | A:25
            Fixed total = 376pt → Nama = 558 - 376 = 182pt (auto)
        ════════════════════════════════════════════════════ */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: FONT,
        }}>
          <colgroup>
            <col style={{ width: '20pt' }} />   {/* Urut */}
            <col style={{ width: '43pt' }} />   {/* NIS */}
            <col style={{ width: '68pt' }} />   {/* NISN */}
            <col />                             {/* Nama — auto */}
            <col style={{ width: '20pt' }} />   {/* JK */}
            {[...Array(10)].map((_, i) => (
              <col key={i} style={{ width: '15pt' }} />
            ))}
            <col style={{ width: '25pt' }} />   {/* S */}
            <col style={{ width: '25pt' }} />   {/* I */}
            <col style={{ width: '25pt' }} />   {/* A */}
          </colgroup>

          <thead>
            <tr>
              <th rowSpan={2} style={thStyle}>Urut</th>
              <th colSpan={2} style={thStyle}>Nomor</th>
              <th rowSpan={2} style={{ ...thStyle, textAlign: 'center', paddingLeft: '5pt' }}>N a m a</th>
              <th rowSpan={2} style={thStyle}>JK</th>
              <th colSpan={10} style={thStyle}>Kehadiran Jam Ke</th>
              <th colSpan={3} style={thStyle}>Absensi</th>
            </tr>
            <tr>
              <th style={thStyle}>NIS</th>
              <th style={thStyle}>NISN</th>
              {jamKe.map(j => (
                <th key={j} style={{ ...thStyle, fontSize: '7pt', padding: '1pt' }}>{j}</th>
              ))}
              <th style={{ ...thStyle, fontSize: '7pt' }}>S</th>
              <th style={{ ...thStyle, fontSize: '7pt' }}>I</th>
              <th style={{ ...thStyle, fontSize: '7pt' }}>A</th>
            </tr>
          </thead>

          <tbody>
            {/* Baris siswa */}
            {siswa.map(sw => (
              <tr key={sw.urut} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.urut}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.nis}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.nisn}</td>
                {/* Nama: font 10pt (8pt base + 2pt) */}
                <td style={{ ...tdStyle, fontSize: '10pt', paddingLeft: '5pt', paddingRight: '3pt' }}>
                  {sw.nama_lengkap}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.jenis_kelamin}</td>
                {jamKe.map(j => <td key={j} style={{ ...tdStyle, textAlign: 'center' }} />)}
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            ))}

            {/* Baris kosong pengisi sampai MIN_ROWS */}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`} style={{ height: '14pt' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{siswa.length + i + 1}</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
                {jamKe.map(j => <td key={j} style={tdStyle} />)}
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* ════════════════════════════════════════════════════
            REKAP L / P
        ════════════════════════════════════════════════════ */}
        <div style={{ marginTop: '5pt', fontFamily: FONT, fontSize: '10pt', paddingLeft: '2pt' }}>
          <span>L = &nbsp;{jumlah_l}</span>
          <span style={{ marginLeft: '32pt' }}>P = &nbsp;{jumlah_p}</span>
        </div>

        {/* ════════════════════════════════════════════════════
            FOOTER: tanggal cetak (kiri) + TTD Wali Kelas (kanan)
        ════════════════════════════════════════════════════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '10pt',
          fontFamily: FONT,
          fontSize: '12pt',
        }}>
          {/* Kiri: tanggal cetak */}
          <div style={{
            fontFamily: FONT,
            fontSize: '8pt',
            color: '#555',
            fontStyle: 'italic',
            paddingBottom: '2pt',
          }}>
            Dicetak pada: {tanggalCetak}
          </div>

          {/* Kanan: TTD Wali Kelas */}
          <div style={{ textAlign: 'left', lineHeight: 1.6, paddingRight: '12pt' }}>
            <div>Tasikmalaya, .................................</div>
            <div>Wali Kelas,</div>
            <div style={{ marginTop: '44pt', fontWeight: 700, textDecoration: 'underline' }}>
              {kelas.wali_kelas_nama}
            </div>
          </div>
        </div>

      </div>
    )
  }
)

BlankoAbsensiTemplate.displayName = 'BlankoAbsensiTemplate'

// ─── Shared cell styles ───────────────────────────────────────────────────────
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