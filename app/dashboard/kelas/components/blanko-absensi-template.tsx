// Lokasi: app/dashboard/kelas/components/blanko-absensi-template.tsx
// Print-safe — NO Tailwind. Font Book Antiqua. Ukuran F4 (215mm × 330mm).
// Diukur piksel-per-piksel dari dokumen asli MAN 1 Tasikmalaya.

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
          padding: '8mm 11mm 10mm 11mm',
          fontFamily: FONT,
          fontSize: '8pt',
          color: '#000',
          backgroundColor: '#fff',
          boxSizing: 'border-box',
          position: 'relative',
          ...(pageBreak ? { pageBreakBefore: 'always' as const } : {}),
        }}
      >

        {/* ════════════════════════════════════════════
            KOP SURAT
            Logo kiri (~25mm), teks rata tengah di sisa ruang
        ════════════════════════════════════════════ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <tbody>
            <tr>
              {/* Logo: 25mm × 25mm, sejajar vertikal tengah */}
              <td style={{ width: '71pt', verticalAlign: 'middle', padding: 0, border: 'none' }}>
                <img
                  src="/logokemenaghitam.png"
                  alt="Logo Kemenag"
                  style={{
                    width: '64pt',
                    height: '64pt',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </td>

              {/* Teks kop: semua rata tengah */}
              <td style={{ verticalAlign: 'middle', textAlign: 'center', padding: 0, border: 'none', lineHeight: 1.35 }}>
                {/* Baris 1 */}
                <div style={{ fontFamily: FONT, fontSize: '10pt', fontWeight: 'normal' }}>
                  KEMENTERIAN AGAMA REPUBLIK INDONESIA
                </div>
                {/* Baris 2 */}
                <div style={{ fontFamily: FONT, fontSize: '10pt', fontWeight: 'normal' }}>
                  KANTOR KEMENTERIAN AGAMA KAB. TASIKMALAYA
                </div>
                {/* Baris 3 — bold & lebih besar */}
                <div style={{ fontFamily: FONT, fontSize: '13pt', fontWeight: 700, marginTop: '1pt', marginBottom: '1pt' }}>
                  MADRASAH ALIYAH NEGERI 1 TASIKMALAYA
                </div>
                {/* Baris 4 — alamat kecil */}
                <div style={{ fontFamily: FONT, fontSize: '7.5pt', fontWeight: 'normal' }}>
                  Jalan Pahlawan KH. Zainal Musthafa Desa Sukarapih Kec. Sukarame Kab. Tasikmalaya
                </div>
                {/* Baris 5 — website/email */}
                <div style={{ fontFamily: FONT, fontSize: '7.5pt', fontWeight: 'normal' }}>
                  website : www.manegeri1tasikmalaya.sch.id &nbsp;&nbsp; email : manegerisukamanah@gmail.com
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Garis bawah kop: tebal atas + tipis bawah */}
        <div style={{
          borderTop: '2.5pt solid #000',
          borderBottom: '1pt solid #000',
          marginTop: '4pt',
          marginBottom: '5pt',
          paddingBottom: '1.5pt',
        }} />

        {/* ════════════════════════════════════════════
            JUDUL
        ════════════════════════════════════════════ */}
        <div style={{ textAlign: 'center', marginBottom: '5pt', lineHeight: 1.4 }}>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3pt' }}>
            DAFTAR HADIR SISWA KELAS {namaKelas}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>
            TAHUN AJARAN {TALabel}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            TABEL ABSENSI
            Lebar total content: 215 - 22mm margin = 193mm = 547pt
            Urut:20 | NIS:43 | NISN:68 | Nama:auto | JK:20 | Jam×10:150 | S:25 | I:25 | A:25
            Fixed: 20+43+68+20+150+75 = 376pt → Nama = 547-376 = 171pt ≈ auto
        ════════════════════════════════════════════ */}
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
            <col />                             {/* Nama — auto (sisa lebar) */}
            <col style={{ width: '20pt' }} />   {/* JK */}
            {[...Array(10)].map((_, i) => (
              <col key={i} style={{ width: '15pt' }} />  /* Jam 1–10 */
            ))}
            <col style={{ width: '25pt' }} />   {/* S */}
            <col style={{ width: '25pt' }} />   {/* I */}
            <col style={{ width: '25pt' }} />   {/* A */}
          </colgroup>

          <thead>
            {/* Header baris 1 */}
            <tr>
              <th rowSpan={2} style={thStyle}>Urut</th>
              <th colSpan={2} style={thStyle}>Nomor</th>
              <th rowSpan={2} style={{ ...thStyle, textAlign: 'left', paddingLeft: '5pt' }}>N a m a</th>
              <th rowSpan={2} style={thStyle}>JK</th>
              <th colSpan={10} style={thStyle}>Kehadiran Jam Ke</th>
              <th colSpan={3} style={thStyle}>Absensi</th>
            </tr>
            {/* Header baris 2 */}
            <tr>
              <th style={thStyle}>NIS</th>
              <th style={thStyle}>NISN</th>
              {jamKe.map(j => <th key={j} style={{ ...thStyle, fontSize: '7pt', padding: '1pt' }}>{j}</th>)}
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
                <td style={{ ...tdStyle, paddingLeft: '5pt', paddingRight: '3pt' }}>{sw.nama_lengkap}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{sw.jenis_kelamin}</td>
                {jamKe.map(j => <td key={j} style={{ ...tdStyle, textAlign: 'center' }} />)}
                <td style={{ ...tdStyle }} />
                <td style={{ ...tdStyle }} />
                <td style={{ ...tdStyle }} />
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

        {/* ════════════════════════════════════════════
            REKAP L / P
        ════════════════════════════════════════════ */}
        <div style={{ marginTop: '5pt', fontFamily: FONT, fontSize: '8pt', paddingLeft: '2pt' }}>
          <span>L = &nbsp;{jumlah_l}</span>
          <span style={{ marginLeft: '32pt' }}>P = &nbsp;{jumlah_p}</span>
        </div>

        {/* ════════════════════════════════════════════
            FOOTER: tanggal cetak (kiri) + TTD Wali Kelas (kanan)
        ════════════════════════════════════════════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '10pt',
          fontFamily: FONT,
          fontSize: '8.5pt',
        }}>
          {/* Kiri: tanggal cetak */}
          <div style={{
            fontFamily: FONT,
            fontSize: '7pt',
            color: '#555',
            fontStyle: 'italic',
            paddingBottom: '2pt',
          }}>
            Dicetak pada: {tanggalCetak}
          </div>

          {/* Kanan: TTD */}
          <div style={{ textAlign: 'center', lineHeight: 1.6, paddingRight: '12pt' }}>
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
  fontSize: '7.5pt',
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
  fontSize: '7.5pt',
  verticalAlign: 'middle',
  lineHeight: 1.15,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}