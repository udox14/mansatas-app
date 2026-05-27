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
    // 3. Absensi siswa maksimal menampilkan 20 siswa saja sesuai gambar (yang gak hadir doang yang tampil ya)
    const absensiList = data.absensiRows.slice(0, 20)

    return (
      <div
        ref={ref}
        style={{
          width: '330mm',
          height: '215mm',
          padding: '6mm 8mm 6mm 8mm',
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
        {/* KOP / HEADER TEXT BASED WITH logohitam.png ON THE LEFT */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3.5px double #000', paddingBottom: '1.5mm', marginBottom: '2.5mm' }}>
          <img src="/logohitam.png" alt="Logo" style={{ height: '17mm', width: 'auto', marginRight: '4mm' }} />
          <div style={{ flex: 1, textAlign: 'center', color: '#000' }}>
            <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.15 }}>KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 'bold', lineHeight: 1.15 }}>KANTOR KEMENTERIAN AGAMA KABUPATEN TASIKMALAYA</div>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', lineHeight: 1.2, margin: '0.3mm 0' }}>MADRASAH ALIYAH NEGERI 1 TASIKMALAYA</div>
            <div style={{ fontSize: '7.8pt', lineHeight: 1.15 }}>Jl. Pahlawan KHZ. Musthafa Sukamanah Desa Sukarapih Kec. Sukarame Kode Pos 46461</div>
            <div style={{ fontSize: '7.8pt', fontWeight: 'bold', lineHeight: 1.15 }}>website : www.man1tasikmalaya.sch.id email : manegerisukamanah@gmail.com</div>
          </div>
        </div>

        {/* HARI & TANGGAL SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '52% 48%', gap: '4mm', marginBottom: '2.5mm', fontSize: '9.5pt', fontWeight: 'bold' }}>
          <div>HARI : <span style={{ fontWeight: 'normal', borderBottom: '1px dotted #000', display: 'inline-block', width: '70%', paddingLeft: '2mm' }}>{data.hariNama || ''}&nbsp;</span></div>
          <div>TANGGAL : <span style={{ fontWeight: 'normal', borderBottom: '1px dotted #000', display: 'inline-block', width: '70%', paddingLeft: '2mm' }}>{data.tanggal ? formatTanggal(data.tanggal) : ''}&nbsp;</span></div>
        </div>

        {/* TABLES SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '52% 48%', gap: '4mm', marginBottom: '2mm' }}>
          {/* AGENDA KELAS TABLE */}
          <div>
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
                <tr>
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
                    <tr key={index} style={{ height: '7.9mm' }}>
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
                  <tr>
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
                      <tr key={index} style={{ height: '7.9mm' }}>
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
                  <tr>
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
                      <tr key={index} style={{ height: '7.9mm' }}>
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

        {/* FOOTER SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '32% 32% 36%', gap: '4mm', marginTop: '3mm', alignItems: 'start', fontSize: '8.5pt' }}>
          {/* Left Column (Rekapitulasi & Kepala) */}
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '9pt' }}>REKAPITULASI KEGIATAN</div>
            <table style={{ width: '100%', fontSize: '8.5pt', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '4mm', verticalAlign: 'top' }}>1.</td>
                  <td style={{ width: '12mm', verticalAlign: 'top' }}>Terisi</td>
                  <td style={{ width: '3mm', verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1mm' }}>{data.rekap.terisi !== undefined ? `${data.rekap.terisi} ` : ''}</td>
                  <td style={{ width: '8mm', verticalAlign: 'bottom', paddingLeft: '1mm' }}>Jam</td>
                </tr>
                <tr style={{ height: '0.8mm' }}><td colSpan={5} /></tr>
                <tr>
                  <td style={{ verticalAlign: 'top' }}>2.</td>
                  <td style={{ verticalAlign: 'top' }}>Tugas</td>
                  <td style={{ verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1mm' }}>{data.rekap.tugas !== undefined ? `${data.rekap.tugas} ` : ''}</td>
                  <td style={{ verticalAlign: 'bottom', paddingLeft: '1mm' }}>Jam</td>
                </tr>
                <tr style={{ height: '0.8mm' }}><td colSpan={5} /></tr>
                <tr>
                  <td style={{ verticalAlign: 'top' }}>3.</td>
                  <td style={{ verticalAlign: 'top' }}>Kosong</td>
                  <td style={{ verticalAlign: 'top', textAlign: 'center' }}>:</td>
                  <td style={{ borderBottom: '1px dotted #000', paddingLeft: '1mm' }}>{data.rekap.kosong !== undefined ? `${data.rekap.kosong} ` : ''}</td>
                  <td style={{ verticalAlign: 'bottom', paddingLeft: '1mm' }}>Jam</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '5mm', lineHeight: 1.3 }}>
              <div>Kepala MAN 1 Tasikmalaya,</div>
              <div style={{ height: '14mm' }} />
              <div style={{ fontWeight: 'bold' }}>{data.kepala.nama}</div>
              <div>NIP. {data.kepala.nip}</div>
            </div>
          </div>

          {/* Middle Column (Wali Kelas & Mengetahui) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: '4mm', fontStyle: 'normal' }}>Mengetahui :</div>
            <div style={{ lineHeight: 1.3 }}>
              <div>Wali Kelas,</div>
              <div style={{ height: '18mm' }} />
              <div>
                {data.kelas.wali_kelas_nama ? (
                  <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50mm', fontWeight: 'bold' }}>
                    {data.kelas.wali_kelas_nama}
                  </span>
                ) : (
                  <span>...........................................................</span>
                )}
              </div>
              <div style={{ marginTop: '1mm' }}>
                NIP. {data.kelas.wali_kelas_nip || '...........................................................'}
              </div>
            </div>
          </div>

          {/* Right Column (KM Kelas & Date) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: '4mm' }}>
            <div style={{ marginBottom: '1.5mm' }}>
              Tasikmalaya, <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', width: '35mm' }}>&nbsp;</span>
            </div>
            <div style={{ lineHeight: 1.3, width: '100%' }}>
              <div>KM Kelas <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', width: '25mm' }}>{data.kelas.label || ''}</span>,</div>
              <div style={{ height: '17mm' }} />
              <div>
                {data.kelas.km_nama ? (
                  <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50mm', fontWeight: 'bold' }}>
                    {data.kelas.km_nama}
                  </span>
                ) : (
                  <span>...........................................................</span>
                )}
              </div>
              <div style={{ marginTop: '1mm' }}>
                NIS. <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', width: '35mm' }}>&nbsp;</span>
              </div>
            </div>
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
  borderBottom: 0,
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '10.5pt',
  padding: '1mm 0',
  fontFamily: FONT,
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

