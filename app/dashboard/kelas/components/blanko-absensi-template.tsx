// Lokasi: app/dashboard/kelas/components/blanko-absensi-template.tsx
// Pure inline-CSS — NO Tailwind. Print-safe untuk F4 (215mm x 330mm).
// Font: Book Antiqua → Palatino Linotype → serif (fallback)

import React from 'react'
import type { BlankAbsensiData } from '../actions-print'

interface Props {
  data: BlankAbsensiData
  tanggalCetak: string
  /** Jika true, halaman ini bukan yang pertama — tambah page-break-before */
  pageBreak?: boolean
}

// Jumlah baris minimum di tabel (termasuk siswa + baris kosong)
const MIN_ROWS = 33

export const BlankoAbsensiTemplate = React.forwardRef<HTMLDivElement, Props>(
  ({ data, tanggalCetak, pageBreak = false }, ref) => {
    const { kelas, tahun_ajaran, siswa, jumlah_l, jumlah_p } = data
    const namaKelas = `${kelas.tingkat}.${kelas.nomor_kelas}`
    const TALabel = tahun_ajaran?.nama ?? '-'
    const jamKe = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    // Baris kosong pengisi agar total = MIN_ROWS
    const emptyRows = Math.max(0, MIN_ROWS - siswa.length)

    return (
      <div
        ref={ref}
        style={{
          ...s.page,
          ...(pageBreak ? { pageBreakBefore: 'always' } : {}),
        }}
      >
        {/* ══════════════════════════════════════════
            KOP SURAT
        ══════════════════════════════════════════ */}
        <div style={s.kop}>
          {/* Logo kiri */}
          <div style={s.logoWrap}>
            <img src="/logokemenaghitam.png" alt="Logo" style={s.logo} />
          </div>

          {/* Teks tengah */}
          <div style={s.kopTeks}>
            <div style={s.kopBaris1}>KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
            <div style={s.kopBaris1}>KANTOR KEMENTERIAN AGAMA KAB. TASIKMALAYA</div>
            <div style={s.kopBaris2}>MADRASAH ALIYAH NEGERI 1 TASIKMALAYA</div>
            <div style={s.kopBaris3}>
              Jalan Pahlawan KH. Zainal Musthafa Desa Sukarapih Kec. Sukarame Kab. Tasikmalaya
            </div>
            <div style={s.kopBaris3}>
              website : www.manegeri1tasikmalaya.sch.id &nbsp;&nbsp; email : manegerisukamanah@gmail.com
            </div>
          </div>
        </div>

        {/* Garis bawah kop: tebal di atas, tipis di bawah */}
        <div style={s.garisKop} />

        {/* ══════════════════════════════════════════
            JUDUL
        ══════════════════════════════════════════ */}
        <div style={s.judulWrap}>
          <div style={s.judulUtama}>DAFTAR HADIR SISWA KELAS {namaKelas}</div>
          <div style={s.judulSub}>TAHUN AJARAN {TALabel}</div>
        </div>

        {/* ══════════════════════════════════════════
            TABEL ABSENSI
        ══════════════════════════════════════════ */}
        <table style={s.tabel}>
          <colgroup>
            {/* Urut */}
            <col style={{ width: '22pt' }} />
            {/* NIS */}
            <col style={{ width: '38pt' }} />
            {/* NISN */}
            <col style={{ width: '62pt' }} />
            {/* Nama — lebar sisanya */}
            <col style={{ width: 'auto' }} />
            {/* JK */}
            <col style={{ width: '20pt' }} />
            {/* Jam 1-10: masing-masing 14pt */}
            {jamKe.map(j => <col key={j} style={{ width: '14pt' }} />)}
            {/* S, I, A: masing-masing 16pt */}
            <col style={{ width: '16pt' }} />
            <col style={{ width: '16pt' }} />
            <col style={{ width: '16pt' }} />
          </colgroup>

          <thead>
            {/* Baris 1: header grup */}
            <tr>
              <th rowSpan={2} style={{ ...s.th, ...s.thC, width: '22pt' }}>Urut</th>
              <th colSpan={2} style={{ ...s.th, ...s.thC }}>Nomor</th>
              <th rowSpan={2} style={{ ...s.th, textAlign: 'left', paddingLeft: '5pt' }}>N a m a</th>
              <th rowSpan={2} style={{ ...s.th, ...s.thC }}>JK</th>
              <th colSpan={10} style={{ ...s.th, ...s.thC }}>Kehadiran Jam Ke</th>
              <th colSpan={3} style={{ ...s.th, ...s.thC }}>Absensi</th>
            </tr>
            {/* Baris 2: sub-header */}
            <tr>
              <th style={{ ...s.th, ...s.thC }}>NIS</th>
              <th style={{ ...s.th, ...s.thC }}>NISN</th>
              {jamKe.map(j => <th key={j} style={{ ...s.th, ...s.thC, ...s.thJam }}>{j}</th>)}
              <th style={{ ...s.th, ...s.thC, ...s.thJam }}>S</th>
              <th style={{ ...s.th, ...s.thC, ...s.thJam }}>I</th>
              <th style={{ ...s.th, ...s.thC, ...s.thJam }}>A</th>
            </tr>
          </thead>

          <tbody>
            {/* Baris siswa */}
            {siswa.map(sw => (
              <tr key={sw.urut} style={s.tr}>
                <td style={{ ...s.td, ...s.tdC }}>{sw.urut}</td>
                <td style={{ ...s.td, ...s.tdC }}>{sw.nis}</td>
                <td style={{ ...s.td, ...s.tdC }}>{sw.nisn}</td>
                <td style={{ ...s.td, paddingLeft: '5pt', paddingRight: '3pt' }}>{sw.nama_lengkap}</td>
                <td style={{ ...s.td, ...s.tdC }}>{sw.jenis_kelamin}</td>
                {jamKe.map(j => <td key={j} style={{ ...s.td, ...s.tdC }} />)}
                <td style={{ ...s.td, ...s.tdC }} />
                <td style={{ ...s.td, ...s.tdC }} />
                <td style={{ ...s.td, ...s.tdC }} />
              </tr>
            ))}

            {/* Baris kosong pengisi */}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e-${i}`} style={s.tr}>
                <td style={{ ...s.td, ...s.tdC }}>{siswa.length + i + 1}</td>
                <td style={s.td} />
                <td style={s.td} />
                <td style={s.td} />
                <td style={s.td} />
                {jamKe.map(j => <td key={j} style={{ ...s.td }} />)}
                <td style={s.td} />
                <td style={s.td} />
                <td style={s.td} />
              </tr>
            ))}
          </tbody>
        </table>

        {/* ══════════════════════════════════════════
            REKAP GENDER
        ══════════════════════════════════════════ */}
        <div style={s.rekap}>
          <span>L = &nbsp;{jumlah_l}</span>
          <span style={{ marginLeft: '24pt' }}>P = &nbsp;{jumlah_p}</span>
        </div>

        {/* ══════════════════════════════════════════
            AREA TTD + FOOTER TANGGAL CETAK
        ══════════════════════════════════════════ */}
        <div style={s.bottomRow}>
          {/* Kiri: tanggal cetak */}
          <div style={s.tanggalCetak}>
            Dicetak pada: {tanggalCetak}
          </div>

          {/* Kanan: TTD Wali Kelas */}
          <div style={s.ttd}>
            <div>Tasikmalaya, .................................</div>
            <div style={{ marginTop: '2pt' }}>Wali Kelas,</div>
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

// ─── Styles ──────────────────────────────────────────────────────────────────
// Ukuran F4: 215mm x 330mm. Margin: 10mm kiri-kanan, 8mm atas, 10mm bawah.
// Font: Book Antiqua / Palatino Linotype / serif

const FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const BORDER = '0.75pt solid #000'

const s: Record<string, React.CSSProperties> = {
  page: {
    width: '215mm',
    minHeight: '330mm',
    padding: '7mm 10mm 8mm 10mm',
    fontFamily: FONT,
    fontSize: '8.5pt',
    color: '#000',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    position: 'relative',
  },

  // ── KOP ──
  kop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8pt',
    marginBottom: '3pt',
  },
  logoWrap: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52pt',
    height: '52pt',
  },
  logo: {
    width: '52pt',
    height: '52pt',
    objectFit: 'contain',
  },
  kopTeks: {
    flex: 1,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  kopBaris1: {
    fontFamily: FONT,
    fontSize: '9pt',
    fontWeight: 'normal',
  },
  kopBaris2: {
    fontFamily: FONT,
    fontSize: '11pt',
    fontWeight: 700,
    marginTop: '1pt',
    marginBottom: '1pt',
  },
  kopBaris3: {
    fontFamily: FONT,
    fontSize: '7.5pt',
    fontWeight: 'normal',
  },

  // Garis kop: border-top tebal 2.5pt, border-bottom tipis 0.75pt
  garisKop: {
    marginTop: '3pt',
    marginBottom: '4pt',
    borderTop: '2.5pt solid #000',
    borderBottom: '0.75pt solid #000',
    paddingBottom: '1.5pt',
  },

  // ── JUDUL ──
  judulWrap: {
    textAlign: 'center',
    marginBottom: '5pt',
    lineHeight: 1.4,
  },
  judulUtama: {
    fontFamily: FONT,
    fontSize: '10pt',
    fontWeight: 700,
    letterSpacing: '0.5pt',
  },
  judulSub: {
    fontFamily: FONT,
    fontSize: '9.5pt',
    fontWeight: 700,
  },

  // ── TABEL ──
  tabel: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  th: {
    border: BORDER,
    padding: '2pt 2pt',
    fontFamily: FONT,
    fontSize: '7.5pt',
    fontWeight: 700,
    verticalAlign: 'middle',
    lineHeight: 1.2,
    backgroundColor: '#fff',
  },
  thC: {
    textAlign: 'center',
  },
  thJam: {
    fontSize: '7pt',
    padding: '2pt 1pt',
  },
  tr: {
    height: '15pt',
  },
  td: {
    border: BORDER,
    padding: '1pt 2pt',
    fontFamily: FONT,
    fontSize: '7.5pt',
    verticalAlign: 'middle',
    lineHeight: 1.15,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  tdC: {
    textAlign: 'center',
  },

  // ── REKAP ──
  rekap: {
    marginTop: '5pt',
    fontFamily: FONT,
    fontSize: '8pt',
    paddingLeft: '2pt',
  },

  // ── BOTTOM ROW: tanggal cetak kiri, TTD kanan ──
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: '8pt',
    fontFamily: FONT,
    fontSize: '8.5pt',
  },
  tanggalCetak: {
    fontFamily: FONT,
    fontSize: '7pt',
    color: '#555',
    fontStyle: 'italic',
    alignSelf: 'flex-end',
    paddingBottom: '2pt',
  },
  ttd: {
    textAlign: 'center',
    lineHeight: 1.5,
    paddingRight: '10pt',
  },
}