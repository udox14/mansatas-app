// Lokasi: app/dashboard/kelas/components/blanko-absensi-template.tsx
// Komponen ini di-render oleh react-to-print. Murni CSS print-safe, NO Tailwind.

import React from 'react'
import type { BlankAbsensiData } from '../actions-print'

interface BlankoAbsensiTemplateProps {
  data: BlankAbsensiData
  tanggalCetak: string
}

export const BlankoAbsensiTemplate = React.forwardRef<HTMLDivElement, BlankoAbsensiTemplateProps>(
  ({ data, tanggalCetak }, ref) => {
    const { kelas, tahun_ajaran, siswa, jumlah_l, jumlah_p } = data
    const namaKelas = `${kelas.tingkat}.${kelas.nomor_kelas}`
    const TALabel = tahun_ajaran ? `${tahun_ajaran.nama}` : '-'

    // F4 = 210mm x 330mm. Padding 10mm kiri-kanan, 8mm atas-bawah
    // Jam ke 1-10 + S, I, A = 13 kolom
    const jamKe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    return (
      <div ref={ref} style={styles.page}>
        {/* ===== KEMENTERIAN HEADER ===== */}
        <div style={styles.headerWrap}>
          <img
            src="/logokemenag.png"
            alt="Logo Kemenag"
            style={styles.logo}
          />
          <div style={styles.headerText}>
            <div style={styles.h1}>KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
            <div style={styles.h1}>KANTOR KEMENTERIAN AGAMA KAB. TASIKMALAYA</div>
            <div style={styles.h1bold}>MADRASAH ALIYAH NEGERI 1 TASIKMALAYA</div>
            <div style={styles.h2}>
              Jalan Pahlawan KH. Zainal Musthafa Desa Sukarapih Kec. Sukarame Kab. Tasikmalaya
            </div>
            <div style={styles.h2}>
              website : www.manegeri1tasikmalaya.sch.id &nbsp; email : manegerisukamanah@gmail.com
            </div>
          </div>
        </div>

        <div style={styles.headerLine} />

        {/* ===== JUDUL ===== */}
        <div style={styles.titleBlock}>
          <div style={styles.titleMain}>DAFTAR HADIR SISWA KELAS {namaKelas}</div>
          <div style={styles.titleSub}>TAHUN AJARAN {TALabel}</div>
        </div>

        {/* ===== TABEL ===== */}
        <table style={styles.table}>
          <thead>
            {/* Baris header atas: Nomor | Nama | JK | Kehadiran Jam Ke | Absensi */}
            <tr>
              <th rowSpan={2} style={{ ...styles.th, ...styles.thNomor, width: 28 }}>Urut</th>
              <th rowSpan={2} style={{ ...styles.th, ...styles.thNomor, width: 38 }}>NIS</th>
              <th rowSpan={2} style={{ ...styles.th, ...styles.thNomor, width: 64 }}>NISN</th>
              <th rowSpan={2} style={{ ...styles.th, width: 'auto', textAlign: 'left', paddingLeft: 6 }}>N a m a</th>
              <th rowSpan={2} style={{ ...styles.th, ...styles.thNomor, width: 22 }}>JK</th>
              <th colSpan={10} style={{ ...styles.th, ...styles.thCenter }}>Kehadiran Jam Ke</th>
              <th colSpan={3} style={{ ...styles.th, ...styles.thCenter }}>Absensi</th>
            </tr>
            <tr>
              {jamKe.map(j => (
                <th key={j} style={{ ...styles.th, ...styles.thJam }}>{j}</th>
              ))}
              <th style={{ ...styles.th, ...styles.thJam }}>S</th>
              <th style={{ ...styles.th, ...styles.thJam }}>I</th>
              <th style={{ ...styles.th, ...styles.thJam }}>A</th>
            </tr>
          </thead>
          <tbody>
            {siswa.map((s) => (
              <tr key={s.urut} style={styles.tr}>
                <td style={{ ...styles.td, ...styles.tdCenter }}>{s.urut}</td>
                <td style={{ ...styles.td, ...styles.tdCenter }}>{s.nis}</td>
                <td style={{ ...styles.td, ...styles.tdCenter }}>{s.nisn}</td>
                <td style={{ ...styles.td, paddingLeft: 6 }}>{s.nama_lengkap}</td>
                <td style={{ ...styles.td, ...styles.tdCenter }}>{s.jenis_kelamin}</td>
                {jamKe.map(j => (
                  <td key={j} style={{ ...styles.td, ...styles.tdCenter }}></td>
                ))}
                <td style={{ ...styles.td, ...styles.tdCenter }}></td>
                <td style={{ ...styles.td, ...styles.tdCenter }}></td>
                <td style={{ ...styles.td, ...styles.tdCenter }}></td>
              </tr>
            ))}

            {/* Baris kosong pengisi agar total minimal 33 baris (seperti format asli) */}
            {Array.from({ length: Math.max(0, 33 - siswa.length) }).map((_, i) => (
              <tr key={`empty-${i}`} style={styles.tr}>
                <td style={{ ...styles.td, ...styles.tdCenter }}>{siswa.length + i + 1 <= 33 ? siswa.length + i + 1 : ''}</td>
                <td style={styles.td}></td>
                <td style={styles.td}></td>
                <td style={styles.td}></td>
                <td style={styles.td}></td>
                {jamKe.map(j => <td key={j} style={styles.td}></td>)}
                <td style={styles.td}></td>
                <td style={styles.td}></td>
                <td style={styles.td}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ===== REKAPITULASI GENDER ===== */}
        <div style={styles.rekapRow}>
          <div style={styles.rekapItem}>L = {jumlah_l}</div>
          <div style={styles.rekapItem}>P = {jumlah_p}</div>
        </div>

        {/* ===== TANDA TANGAN ===== */}
        <div style={styles.ttdRow}>
          <div style={styles.ttdKiri}>
            <div style={styles.ttdLabel}>Dicetak pada: {tanggalCetak}</div>
          </div>
          <div style={styles.ttdKanan}>
            <div>Tasikmalaya, .................................</div>
            <div style={{ marginTop: 2 }}>Wali Kelas,</div>
            <div style={{ marginTop: 52, fontWeight: 700, textDecoration: 'underline' }}>
              {kelas.wali_kelas_nama}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

BlankoAbsensiTemplate.displayName = 'BlankoAbsensiTemplate'

// ─── Inline styles (print-safe, no Tailwind) ─────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    width: '210mm',
    minHeight: '330mm',
    padding: '8mm 10mm 10mm 10mm',
    fontFamily: 'Times New Roman, serif',
    fontSize: '8.5pt',
    color: '#000',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  headerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    textAlign: 'center',
    lineHeight: 1.35,
  },
  h1: {
    fontSize: '9.5pt',
    fontWeight: 'normal',
  },
  h1bold: {
    fontSize: '10.5pt',
    fontWeight: 700,
  },
  h2: {
    fontSize: '7.5pt',
    fontWeight: 'normal',
  },
  headerLine: {
    borderTop: '2.5px solid #000',
    borderBottom: '1px solid #000',
    margin: '4px 0 6px 0',
    paddingBottom: 1,
  },
  titleBlock: {
    textAlign: 'center',
    marginBottom: 6,
  },
  titleMain: {
    fontSize: '10pt',
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  titleSub: {
    fontSize: '9.5pt',
    fontWeight: 700,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  th: {
    border: '0.8px solid #000',
    padding: '3px 2px',
    fontSize: '7.5pt',
    fontWeight: 700,
    verticalAlign: 'middle',
    backgroundColor: '#fff',
    lineHeight: 1.2,
  },
  thNomor: {
    textAlign: 'center',
  },
  thCenter: {
    textAlign: 'center',
  },
  thJam: {
    textAlign: 'center',
    width: 16,
    padding: '2px 1px',
    fontSize: '7pt',
  },
  tr: {
    height: 18,
  },
  td: {
    border: '0.8px solid #000',
    padding: '1px 2px',
    fontSize: '7.5pt',
    verticalAlign: 'middle',
    lineHeight: 1.2,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  tdCenter: {
    textAlign: 'center',
  },
  rekapRow: {
    display: 'flex',
    gap: 24,
    marginTop: 6,
    paddingLeft: 2,
    fontSize: '8pt',
  },
  rekapItem: {
    fontWeight: 'normal',
  },
  ttdRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    fontSize: '8.5pt',
  },
  ttdKiri: {
    fontSize: '7.5pt',
    color: '#555',
    alignSelf: 'flex-end',
    paddingBottom: 2,
  },
  ttdLabel: {
    fontStyle: 'italic',
  },
  ttdKanan: {
    textAlign: 'center',
    lineHeight: 1.5,
    paddingRight: 20,
  },
}