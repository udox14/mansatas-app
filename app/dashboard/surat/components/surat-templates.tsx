// Lokasi: app/dashboard/surat/components/surat-templates.tsx
// Print-safe templates. Inline CSS only. Font Times New Roman.
'use client'

import React from 'react'

export type PaperSize = 'A4' | 'F4'

export type PrintSettings = {
  paper: PaperSize
  margins: { top: number; right: number; bottom: number; left: number }
}

const FONT = '"Times New Roman", Times, serif'
const DOTS = '..............................'
const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper: 'A4',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
}

export function getPrintSettings(data?: any): PrintSettings {
  const raw = data?.print_settings || {}
  const margins = raw.margins || {}
  const read = (value: any, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }

  return {
    paper: raw.paper === 'F4' ? 'F4' : 'A4',
    margins: {
      top: read(margins.top, DEFAULT_PRINT_SETTINGS.margins.top),
      right: read(margins.right, DEFAULT_PRINT_SETTINGS.margins.right),
      bottom: read(margins.bottom, DEFAULT_PRINT_SETTINGS.margins.bottom),
      left: read(margins.left, DEFAULT_PRINT_SETTINGS.margins.left),
    },
  }
}

export function getPrintPageStyle(settings?: PrintSettings): string {
  const s = settings || DEFAULT_PRINT_SETTINGS
  const size = s.paper === 'F4' ? '215mm 330mm' : 'A4 portrait'
  return `
    @page { size: ${size}; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
      .surat-print-page { box-shadow: none !important; break-after: page; page-break-after: always; }
      .surat-print-page:last-child { break-after: auto; page-break-after: auto; }
    }
  `
}

export function formatTanggalIndo(dateStr?: string): string {
  if (!dateStr) return titik(18)
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr || titik(18)
    return `${d.getDate()} ${BULAN[d.getMonth() + 1]} ${d.getFullYear()}`
  } catch {
    return dateStr || titik(18)
  }
}

function titik(length = 30) {
  return '.'.repeat(length)
}

function text(value: any, fallback = DOTS): string {
  if (value === null || value === undefined) return fallback
  const str = String(value).trim()
  return str || fallback
}

function upper(value: any) {
  const v = text(value)
  return v === DOTS ? v : v.toUpperCase()
}

function gender(value: any) {
  const v = String(value || '').toLowerCase()
  if (v === 'p' || v.includes('perempuan')) return 'Perempuan'
  if (v === 'l' || v.includes('laki')) return 'Laki-laki'
  return DOTS
}

function kelas(s: any) {
  if (s?.tingkat && s?.nomor_kelas) return `${s.tingkat}.${s.nomor_kelas}${s.kelompok ? ` ${s.kelompok}` : ''}`
  if (s?.tingkat) return String(s.tingkat)
  return DOTS
}

function kelasSingkat(s: any) {
  if (s?.tingkat && s?.nomor_kelas) return `${s.tingkat}.${s.nomor_kelas}`
  if (s?.tingkat) return String(s.tingkat)
  return DOTS
}

function ttl(s: any) {
  if (!s?.tempat_lahir && !s?.tanggal_lahir) return DOTS
  if (s?.tanggal_lahir) return `${text(s.tempat_lahir, titik(12))}, ${formatTanggalIndo(s.tanggal_lahir)}`
  return text(s.tempat_lahir)
}

function ttlSlash(s: any) {
  if (!s?.tempat_lahir && !s?.tanggal_lahir) return DOTS
  if (!s?.tanggal_lahir) return text(s.tempat_lahir)
  const d = new Date(s.tanggal_lahir)
  const date = Number.isNaN(d.getTime()) ? s.tanggal_lahir : d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${text(s.tempat_lahir, titik(12))}, ${date}`
}

function alamatSiswa(s: any) {
  const parts: string[] = []
  if (s?.alamat_lengkap) parts.push(s.alamat_lengkap)
  if (s?.rt || s?.rw) parts.push(`Rt/Rw ${text(s.rt, '...')}/${text(s.rw, '...')}`)
  if (s?.desa_kelurahan) parts.push(`Ds. ${s.desa_kelurahan}`)
  if (s?.kecamatan) parts.push(`Kec. ${s.kecamatan}`)
  if (s?.kabupaten_kota) parts.push(s.kabupaten_kota)
  if (s?.provinsi) parts.push(s.provinsi)
  return parts.join(' ') || DOTS
}

function waliNama(s: any) {
  return text(s?.nama_ayah || s?.nama_ibu)
}

function waliPekerjaan(s: any) {
  return text(s?.pekerjaan_ayah || s?.pekerjaan_ibu)
}

function pejabat(data: any, key = 'kepala') {
  const p = data?.pejabat?.[key] || {}
  return {
    nama: text(p.nama_lengkap || p.nama),
    nip: text(p.nip),
    jabatan: text(p.jabatan_cetak || p.jabatan_struktural_nama || p.jabatan || p.nama_jabatan),
    pangkat: text(p.pangkat_golongan),
  }
}

function Page({ data, children, compact = false }: { data: any; children: React.ReactNode; compact?: boolean }) {
  const settings = getPrintSettings(data)
  const width = settings.paper === 'F4' ? '215mm' : '210mm'
  const height = settings.paper === 'F4' ? '330mm' : '297mm'
  const { top, right, bottom, left } = settings.margins

  return (
    <div
      className="surat-print-page"
      style={{
        width,
        minHeight: height,
        padding: `${top}mm ${right}mm ${bottom}mm ${left}mm`,
        fontFamily: FONT,
        fontSize: compact ? '10.5pt' : '12pt',
        color: '#000',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        lineHeight: compact ? 1.25 : 1.45,
        position: 'relative',
      }}
    >
      {children}
    </div>
  )
}

function KopSurat({ data, marginBottom = 7 }: { data: any; marginBottom?: number }) {
  const { margins } = getPrintSettings(data)
  return (
    <div style={{ marginLeft: `-${margins.left}mm`, marginRight: `-${margins.right}mm`, marginTop: `-${margins.top}mm`, marginBottom: `${marginBottom}mm` }}>
      <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '7mm' }}>
      <div style={{ fontSize: '14pt', fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>{children}</div>
    </div>
  )
}

function Nomor({ value }: { value: any }) {
  return <div style={{ textAlign: 'center', marginTop: '-6mm', marginBottom: '8mm' }}>Nomor : {text(value)}</div>
}

function P({ children, indent = false, style }: { children: React.ReactNode; indent?: boolean; style?: React.CSSProperties }) {
  return <p style={{ margin: '0 0 3mm', textAlign: 'justify', textIndent: indent ? '10mm' : 0, ...style }}>{children}</p>
}

function FieldRows({ rows, left = 0, labelWidth = 45, gap = 2 }: {
  rows: Array<[React.ReactNode, React.ReactNode]>
  left?: number
  labelWidth?: number
  gap?: number
}) {
  return (
    <table style={{ marginLeft: `${left}mm`, marginBottom: '4mm', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '12pt' }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i}>
            <td style={{ width: `${labelWidth}mm`, padding: `${gap / 2}mm 1.5mm`, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
            <td style={{ width: '4mm', padding: `${gap / 2}mm 1.5mm`, verticalAlign: 'top' }}>:</td>
            <td style={{ padding: `${gap / 2}mm 1.5mm`, verticalAlign: 'top' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SignatureBlock({ data, signer, label, align = 'right', date, place = 'Tasikmalaya', top = 9 }: {
  data: any
  signer?: any
  label?: string
  align?: 'left' | 'center' | 'right'
  date?: string
  place?: string
  top?: number
}) {
  const p = signer || pejabat(data, 'kepala')
  return (
    <div style={{ textAlign: align, marginTop: `${top}mm` }}>
      <div style={{ display: 'inline-block', minWidth: '62mm', textAlign: 'left' }}>
        <p style={{ margin: 0 }}>{place}, {text(date || data.tanggal_surat || formatTanggalIndo(data.tanggal_surat_raw))}</p>
        <p style={{ margin: '2mm 0 0' }}>{label || p.jabatan || 'Kepala,'}</p>
        <div style={{ height: '22mm' }} />
        <p style={{ margin: 0, fontWeight: 'bold' }}>{p.nama}</p>
        <p style={{ margin: 0 }}>NIP. {p.nip}</p>
      </div>
    </div>
  )
}

function pejabatRows(kepala: any) {
  return [
    ['N a m a', kepala.nama],
    ['NIP', kepala.nip],
    ['Jabatan', kepala.jabatan || 'Kepala MAN 1 Tasikmalaya'],
  ] as Array<[React.ReactNode, React.ReactNode]>
}

// ============================================================
// TEMPLATE BARU DARI FILE CONTOH
// ============================================================
export function TemplateKetAktif({ data }: { data: any }) {
  const s = data.siswa || {}
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT KETERANGAN SISWA AKTIF</Title>
      <Nomor value={data.nomor_surat} />
      <P>Yang bertanda tangan di bawah ini :</P>
      <FieldRows rows={pejabatRows(kepala)} left={8} labelWidth={30} />
      <P>menerangkan dengan bahwa siswa dibawah ini:</P>
      <FieldRows
        rows={[
          ['Nama', upper(s.nama_lengkap)],
          ['Tempat Tanggal Lahir', ttlSlash(s)],
          ['NISN', text(s.nisn)],
        ]}
        left={8}
        labelWidth={50}
      />
      <P>adalah benar siswa MAN 1 Tasikmalaya Kelas {kelasSingkat(s)} Tahun Pelajaran {text(data.tahun_pelajaran)}.</P>
      <P>Demikianlah keterangan ini kami buat untuk dipergunakan sebagaimana mestinya.</P>
      <SignatureBlock data={data} signer={kepala} label="K e p a l a," top={14} />
    </Page>
  )
}

export function TemplateKelakuanBaik({ data }: { data: any }) {
  const s = data.siswa || {}
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT KETERANGAN KELAKUAN BAIK</Title>
      <Nomor value={data.nomor_surat} />
      <P>Yang bertanda tangan di bawah ini :</P>
      <FieldRows rows={pejabatRows(kepala)} left={8} labelWidth={30} />
      <P>menerangkan dengan sesungguhnya bahwa :</P>
      <FieldRows
        rows={[
          ['N a m a', upper(s.nama_lengkap)],
          ['Tempat, Tgl. Lahir', ttlSlash(s)],
          ['NISN', text(s.nisn)],
          ['K e l a s', kelasSingkat(s)],
        ]}
        left={8}
        labelWidth={45}
      />
      <P>Sepanjang pengetahuan kami, siswa/i tersebut selama dalam pendidikan berakhlaq baik / berkelakuan baik dan tidak terlibat dalam penyalahgunaan obat-obatan terlarang / Narkoba.</P>
      <P>Demikian keterangan ini dibuat untuk diketahui dan dipergunakan sebagaimana mestinya.</P>
      <SignatureBlock data={data} signer={kepala} label="K e p a l a," top={12} />
    </Page>
  )
}

export function TemplateMutasiKeluar({ data }: { data: any }) {
  const s = data.siswa || {}
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT KETERANGAN PINDAH SISWA</Title>
      <Nomor value={data.nomor_surat} />
      <P>Yang bertanda tangan di bawah ini, Kepala Madrasah Aliyah Negeri 1 Tasikmalaya menerangkan :</P>
      <FieldRows
        rows={[
          ['N a m a', upper(s.nama_lengkap)],
          ['NIS / NISN', `${text(s.nis_lokal)}/${text(s.nisn)}`],
          ['Tanggal Lahir', ttl(s)],
          ['Jenis Kelamin', gender(s.jenis_kelamin)],
          ['Kelas / Jurusan', kelasSingkat(s)],
        ]}
        labelWidth={42}
      />
      <P>Sesuai permohonan pindah Orang Tua / Wali Siswa :</P>
      <FieldRows
        rows={[
          ['N a m a', waliNama(s)],
          ['Pekerjaan', waliPekerjaan(s)],
          ['Alamat', data.alamat_ortu || alamatSiswa(s)],
        ]}
        labelWidth={42}
      />
      <P>Telah mengajukan pindah belajar dari MAN 1 Tasikmalaya ke {text(data.sekolah_tujuan)} dengan alasan {text(data.alasan_pindah, 'Permohonan Orang Tua')}.</P>
      <P>Bersama ini kami sertakan : 1. Surat Permohonan pindah dari Orang Tua / Wali;</P>
      <P style={{ marginLeft: '44mm' }}>2. Raport</P>
      <SignatureBlock data={data} signer={kepala} label="K e p a l a," top={7} />
      <p style={{ marginTop: '10mm', fontSize: '11pt' }}>Catatan : Siswa yang sudah keluar/pindah dari MAN 1 Tasikmalaya tidak akan diterima lagi.</p>
    </Page>
  )
}

export function TemplateMutasiMasuk({ data }: { data: any }) {
  const s = data.siswa || {}
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT KETERANGAN TIDAK KEBERATAN</Title>
      <Nomor value={data.nomor_surat} />
      <P>Yang bertanda tangan dibawah ini, Kepala Madrasah Aliyah Negeri 1 Tasikmalaya, berdasarkan permohonan orangtua / wali dari :</P>
      <FieldRows
        rows={[
          ['N a m a', upper(data.nama_calon_siswa || s.nama_lengkap)],
          ['Tempat Tanggal Lahir', data.ttl_calon_siswa || ttl(s)],
          ['Kelas', data.kelas_tujuan || kelasSingkat(s)],
          ['Asal sekolah', data.asal_sekolah],
        ]}
        left={12}
        labelWidth={50}
      />
      <P>Untuk pindah belajar ke madrasah kami, pada prinsipnya kami tidak keberatan mengingat formasi siswa dan kelas yang ada.</P>
      <P>Demikianlah keterangan ini kami buat untuk dijadikan sebagai bahan pertimbangan.</P>
      <SignatureBlock data={data} signer={kepala} label="K E P A L A" top={16} />
    </Page>
  )
}

export function TemplatePenelitian({ data }: { data: any }) {
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>KETERANGAN TELAH MELAKSANAKAN PENELITIAN</Title>
      <Nomor value={data.nomor_surat} />
      <P>
        Berdasarkan surat dari {text(data.instansi_peneliti)} Nomor : {text(data.nomor_surat_pengantar)} tanggal {text(data.tanggal_surat_pengantar)}
        {' '}tentang {text(data.perihal_pengantar || data.jenis_penelitian, 'Permohonan Izin Penelitian')}, maka yang bertanda tangan dibawah ini,
        Kepala MAN 1 Tasikmalaya Kab. Tasikmalaya, dengan ini menerangkan bahwa :
      </P>
      <FieldRows
        rows={[
          ['N a m a', upper(data.nama_peneliti)],
          ['NIM', text(data.nim_peneliti)],
          [data.label_prodi || 'Jurusan/ Prodi', text(data.prodi_peneliti)],
        ]}
        left={8}
        labelWidth={42}
      />
      <P>
        Telah mengadakan {text(data.jenis_kegiatan, 'observasi/penelitian')} di MAN 1 Tasikmalaya tanggal {text(data.tanggal_penelitian)}
        {' '}dengan metode {text(data.metode_penelitian)} dalam rangka {text(data.tujuan_penelitian)}{data.judul_penelitian ? ` dengan judul penelitian "${data.judul_penelitian}".` : '.'}
      </P>
      <P>Demikian surat keterangan ini kami buat untuk dipergunakan oleh yang bersangkutan sebagaimana mestinya.</P>
      <SignatureBlock data={data} signer={kepala} label="K E P A L A" top={14} />
    </Page>
  )
}

export function TemplatePanggilanOrtu({ data }: { data: any }) {
  const s = data.siswa || {}
  const waka = pejabat(data, 'waka_kesiswaan')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <table style={{ width: '100%', marginBottom: '8mm', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '12pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '54%', verticalAlign: 'top' }}>
              <FieldRows
                rows={[
                  ['Nomor', text(data.nomor_surat)],
                  ['Lampiran', text(data.lampiran, '-')],
                  ['Perihal', text(data.perihal, 'Surat Panggilan')],
                ]}
                labelWidth={22}
              />
            </td>
            <td style={{ verticalAlign: 'top' }}>Tasikmalaya, {text(data.tanggal_surat || formatTanggalIndo(data.tanggal_surat_raw))}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginLeft: '78mm', marginBottom: '7mm' }}>
        <p style={{ margin: 0 }}>K e p a d a</p>
        <p style={{ margin: '1mm 0 0' }}>Yth. Bapak / Ibu Wali Murid</p>
        <p style={{ margin: '1mm 0 0' }}>a.n {text(data.nama_siswa_panggilan || s.nama_lengkap)}</p>
        <p style={{ margin: '1mm 0 0' }}>Kelas {kelasSingkat(s)}</p>
        <p style={{ margin: '5mm 0 0' }}>di</p>
        <p style={{ margin: '1mm 0 0 10mm' }}>T e m p a t</p>
      </div>
      <P>Assalamu'alaikum Wr. Wb.</P>
      <P>Salam sejahtera menyertai surat ini mudah-mudahan Bapak/Ibu Wali Siswa ada dalam keadaan sehat, serta selalu ada dalam lindungan, magfiroh dan inayah Alloh SWT. Aamiin.</P>
      <P>Selanjutnya untuk menjalin komunikasi yang baik antara Bapak/Ibu wali Siswa dengan pihak sekolah, dalam rangka tanggung jawab bersama untuk mendidik dan membimbing anak kita kearah yang lebih baik, maka dengan ini kami mengundang Bapak/Ibu Wali Siswa pada :</P>
      <FieldRows
        rows={[
          ['Hari/Tanggal', text(data.hari_tanggal)],
          ['Waktu', text(data.waktu)],
          ['Tempat', text(data.tempat)],
        ]}
        labelWidth={35}
      />
      <P>Mengingat pentingnya hal tersebut maka kami mengharapkan Bapak/ibu Wali untuk hadir tepat pada waktu yang telah ditentukan.</P>
      <P>Demikian surat ini kami sampaikan, atas perhatian Bapak/Ibu Wali kami ucapkan terimakasih.</P>
      <SignatureBlock data={data} signer={waka} label={waka.jabatan === DOTS ? 'Waka Kesiswaan' : waka.jabatan} top={10} />
    </Page>
  )
}

export function TemplateSPPD({ data }: { data: any }) {
  const pegawai = data.pegawai || {}
  const ppk = pejabat(data, 'kepala_tu')
  const kepala = pejabat(data, 'kepala')
  const base: React.CSSProperties = { fontSize: '10pt', lineHeight: 1.16 }
  const cell: React.CSSProperties = { border: '0.75pt solid #000', verticalAlign: 'top', padding: '0.8mm 1.5mm' }
  const noCell: React.CSSProperties = { ...cell, width: '9mm', textAlign: 'center' }
  const fieldCell: React.CSSProperties = { ...cell, width: '76mm' }
  const colonCell: React.CSSProperties = { ...cell, width: '5mm', textAlign: 'center', paddingLeft: 0, paddingRight: 0 }
  const dateCell: React.CSSProperties = { ...cell, width: '44mm' }
  const ketCell: React.CSSProperties = { ...cell, width: '34mm' }
  const sppdDate = text(data.tanggal_surat || formatTanggalIndo(data.tanggal_surat_raw || data.tanggal_berangkat))
  const ppkName = text(ppk.nama).toUpperCase()
  const kepalaName = text(kepala.nama).toUpperCase()
  const pengikutRows = buildPengikutRows(data.pengikut, data.daftar_pengikut)

  const tableRows: Array<[string, React.ReactNode, React.ReactNode]> = [
    ['1.', 'Pejabat Pembuat Komitmen', 'MAN 1 Tasikmalaya'],
    ['2.', 'Nama/NIP Pegawai yang melaksanakan perjalanan dinas', <><strong>{text(pegawai.nama_lengkap)}</strong><br />NIP. {text(pegawai.nip)}</>],
    ['3.', <><div>a. Pangkat dan Golongan</div><div>b. Jabatan/Instansi</div><div>c. Tingkat Biaya Perjalanan Dinas</div></>, <><div>{text(pegawai.pangkat_golongan)}</div><div>{text(pegawai.jabatan_cetak || pegawai.role)} / MAN 1 Tasikmalaya</div><div>{text(data.tingkat_biaya, 'Biasa')}</div></>],
    ['4.', 'Maksud Perjalanan Dinas', text(data.maksud_perjalanan)],
    ['5.', 'Alat Kendaraan yang dipergunakan', text(data.alat_angkut, 'Kendaraan Pribadi')],
    ['6.', <><div>a. Tempat berangkat</div><div>b. Tempat tujuan</div></>, <><div>{text(data.tempat_berangkat, 'Sukamanah')}</div><div>{text(data.tempat_tujuan)}</div></>],
    ['7.', <><div>a. Lamanya perjalanan Dinas</div><div>b. Tanggal berangkat</div><div>c. Tanggal harus kembali tiba di tempat baru *)</div></>, <><div>{text(data.lama_perjalanan, '1 (satu) Hari')}</div><div>{formatTanggalIndo(data.tanggal_berangkat)}</div><div>{data.tanggal_kembali ? formatTanggalIndo(data.tanggal_kembali) : titik(18)}</div></>],
    ['9.', <><div>a. Pembebanan anggaran</div><div>b. Instansi</div><div>c. Mata anggaran</div></>, <><div>{text(data.pembebanan_anggaran)}</div><div>{text(data.instansi_anggaran, 'MA Negeri 1 Tasikmalaya')}</div><div>{text(data.mata_anggaran)}</div></>],
    ['10.', 'Keterangan lain-lain', text(data.keterangan_lain)],
  ]

  return (
    <>
      <Page data={data} compact>
        <LampiranSPPD />
        <KopSuratSPPD />
        <p style={{ margin: '6mm 0 4mm', textAlign: 'center', ...base }}>Nomor : {text(data.nomor_surat)}</p>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10pt', marginBottom: '5mm' }}>SURAT PERJALANAN DINAS (SPD)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, border: '1.2pt solid #000', ...base }}>
          <colgroup>
            <col style={{ width: '9mm' }} />
            <col style={{ width: '76mm' }} />
            <col style={{ width: '5mm' }} />
            <col style={{ width: '44mm' }} />
            <col style={{ width: '34mm' }} />
          </colgroup>
          <tbody>
            {tableRows.slice(0, 7).map(([no, field, value], i) => (
              <tr key={i}>
                <td style={noCell}>{no}</td>
                <td style={fieldCell}>{field}</td>
                <td style={colonCell}>:</td>
                <td colSpan={2} style={cell}>{value}</td>
              </tr>
            ))}
            <tr>
              <td style={noCell}>8.</td>
              <td colSpan={2} style={{ ...fieldCell }}>
                <span>Pengikut :</span><span style={{ display: 'inline-block', width: '42mm', textAlign: 'center' }}>Nama</span>
              </td>
              <td style={{ ...dateCell, textAlign: 'center' }}>Tanggal lahir</td>
              <td style={{ ...ketCell, textAlign: 'center' }}>Keterangan</td>
            </tr>
            {pengikutRows.map(row => (
              <tr key={`pengikut-${row.no}`}>
                <td style={{ ...noCell, borderTop: 0, borderBottom: row.no === 5 ? undefined : 0 }} />
                <td colSpan={2} style={{ ...fieldCell, borderTop: 0, borderBottom: row.no === 5 ? undefined : 0 }}>{row.no}. {row.nama}</td>
                <td style={{ ...dateCell, borderTop: 0, borderBottom: row.no === 5 ? undefined : 0, textAlign: 'center' }}>{row.tanggal}</td>
                <td style={{ ...ketCell, borderTop: 0, borderBottom: row.no === 5 ? undefined : 0 }}>{row.ket}</td>
              </tr>
            ))}
            {tableRows.slice(7).map(([no, field, value], i) => (
              <tr key={`bottom-${i}`}>
                <td style={noCell}>{no}</td>
                <td style={fieldCell}>{field}</td>
                <td style={colonCell}>:</td>
                <td colSpan={2} style={cell}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '0.8mm 0 0 3mm', fontSize: '10pt', fontStyle: 'italic' }}>*) Coret yang tidak perlu</p>
        <div style={{ marginLeft: '101mm', marginTop: '2mm', ...base }}>
          <p style={{ margin: 0 }}>Dikeluarkan di&nbsp;&nbsp;&nbsp;&nbsp;: Tasikmalaya</p>
          <p style={{ margin: 0 }}>Tanggal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {sppdDate}</p>
          <div style={{ textAlign: 'left', marginTop: '3mm' }}>
            <p style={{ margin: 0 }}>PPK MAN 1 Tasikmalaya,</p>
            <div style={{ height: '17mm' }} />
            <p style={{ margin: 0, fontWeight: 'bold' }}>{ppkName}</p>
            <p style={{ margin: 0 }}>NIP. {ppk.nip}</p>
          </div>
        </div>
      </Page>

      <Page data={data} compact>
        <LampiranSPPD />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, border: '1.4pt double #000', ...base }}>
          <tbody>
            <tr style={{ height: '39mm' }}>
              <td style={{ ...cell, width: '50%' }} />
              <td style={{ ...cell, width: '50%' }}>
                <TravelFilled
                  no="I."
                  from={text(data.tempat_berangkat, 'Sukamanah')}
                  to={text(data.tempat_tujuan)}
                  date={formatTanggalIndo(data.tanggal_berangkat)}
                  signerName={kepalaName}
                  signerNip={text(kepala.nip)}
                />
              </td>
            </tr>
            {['II.', 'III.', 'IV.', 'V.'].map(no => (
              <tr key={no} style={{ height: '30mm' }}>
                <td style={{ ...cell, width: '50%' }}><TravelArriveBlank no={no} /></td>
                <td style={{ ...cell, width: '50%' }}><TravelDepartBlank /></td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cell, width: '50%', height: '40mm' }}>
                <div style={{ minHeight: '17mm' }}>
                  <TravelInfoRow no="VI." label="Tiba di" value={text(data.tempat_berangkat, 'Sukamanah')} />
                  <p style={{ margin: '0.7mm 0 0 11mm' }}>(Tempat kedudukan)</p>
                  <TravelInfoRow label="Pada Tanggal" value={titik(16)} />
                </div>
                <TravelSignature label="Pejabat Pembuat Komitmen," name={ppkName} nip={text(ppk.nip)} indent="11mm" spacer="11mm" />
              </td>
              <td style={{ ...cell, width: '50%', height: '40mm' }}>
                <div style={{ minHeight: '17mm', marginLeft: '11mm' }}>
                  <P style={{ margin: 0, textAlign: 'justify' }}>Telah diperiksa dengan keterangan bahwa perjalanan tersebut atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.</P>
                </div>
                <TravelSignature label="Pejabat Pembuat Komitmen," name={ppkName} nip={text(ppk.nip)} indent="11mm" spacer="11mm" />
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cell, height: '6mm' }}>VII.&nbsp;&nbsp;&nbsp;&nbsp;Catatan Lain-Lain :</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...cell, height: '18mm', paddingTop: '0.5mm' }}>
                <div>VIII.&nbsp;&nbsp;&nbsp;PERHATIAN :</div>
                <div style={{ paddingLeft: '11mm', textAlign: 'justify' }}>
                  PPK yang menerbitkan SPD pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba,
                  serta bendahara pengeluaran bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara apabila Negara menderita rugi
                  akibat kesalahan, kelalaian dan kealpaannya.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Page>
    </>
  )
}

function LampiranSPPD() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4mm', fontFamily: FONT, fontSize: '7pt', lineHeight: 1.06 }}>
      <div style={{ width: '58mm' }}>
        <div style={{ textAlign: 'right', marginBottom: '1mm' }}>LAMPIRAN I<br />PERATURAN&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MENTERI&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;KEUANGAN&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;REPUBLIK</div>
        <div>INDONESIA NOMOR : 113/PMK.05/2012</div>
        <div>TENTANG : PERJALANAN DINAS JABATAN DALAM NEGERI BAGI PEJABAT NEGARA, PEGAWAI NEGERI DAN PEGAWAI TIDAK TETAP.</div>
      </div>
    </div>
  )
}

function KopSuratSPPD() {
  return (
    <div style={{ marginBottom: 0 }}>
      <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

function buildPengikutRows(pengikut?: string, daftarPengikut?: any[]) {
  const selectedRows = (daftarPengikut || []).map((row, i) => ({
    no: i + 1,
    nama: text(row.nama || row.nama_lengkap, ''),
    tanggal: formatTanggalPendek(row.tanggal_lahir),
    ket: text(row.keterangan || row.jabatan || row.kelas, ''),
  }))
  const manualRows = pengikut?.trim()
    ? pengikut.split('\n').map((row, i) => {
      const separator = row.includes('|') ? '|' : ','
      const parts = row.split(separator).map(part => part.trim())
      return {
        no: selectedRows.length + i + 1,
        nama: parts[0] || '',
        tanggal: parts[1] || '',
        ket: parts[2] || '',
      }
    })
    : []
  const filledRows = [...selectedRows, ...manualRows].slice(0, 5)
  return [...filledRows, ...Array.from({ length: Math.max(0, 5 - filledRows.length) }, (_, i) => ({ no: filledRows.length + i + 1, nama: '', tanggal: '', ket: '' }))]
}

function formatTanggalPendek(value: any) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function TravelFilled({ no, from, to, date, signerName, signerNip }: { no: string; from: string; to: string; date: string; signerName: string; signerNip: string }) {
  return (
    <div>
      <div style={{ minHeight: '16mm' }}>
        <TravelInfoRow no={no} label="Berangkat dari" value={from} />
        <p style={{ margin: '0.7mm 0 0 11mm' }}>(Tempat kedudukan)</p>
        <TravelInfoRow label="Ke" value={to} />
        <TravelInfoRow label="Pada Tanggal" value={date} />
      </div>
      <TravelSignature label="K e p a l a," name={signerName} nip={signerNip} indent="11mm" spacer="12mm" />
    </div>
  )
}

function TravelArriveBlank({ no }: { no: string }) {
  return (
    <div>
      <div style={{ minHeight: '10mm' }}>
        <TravelInfoRow no={no} label="Tiba di" />
        <TravelInfoRow label="Pada Tanggal" />
        <TravelInfoBlankRow />
      </div>
      <TravelSignature label="K e p a l a," name={`( ${titik(66)} )`} nip="NIP." indent="11mm" spacer="8mm" bold={false} />
    </div>
  )
}

function TravelDepartBlank() {
  return (
    <div>
      <div style={{ minHeight: '10mm' }}>
        <TravelInfoRow label="Berangkat dari" />
        <TravelInfoRow label="Ke" />
        <TravelInfoRow label="Pada Tanggal" />
      </div>
      <TravelSignature label="K e p a l a," name={`( ${titik(66)} )`} nip="NIP." indent="11mm" spacer="8mm" bold={false} />
    </div>
  )
}

function TravelInfoRow({ no, label, value = '' }: { no?: string; label: string; value?: string }) {
  const noWidth = '11mm'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${noWidth} 27mm 4mm 1fr`, columnGap: 0, marginTop: no ? 0 : '0.7mm', alignItems: 'baseline' }}>
      <span>{no || ''}</span>
      <span>{label}</span>
      <span>:</span>
      <span>{value}</span>
    </div>
  )
}

function TravelInfoBlankRow() {
  return <div style={{ height: '1em', marginTop: '0.7mm' }} />
}

function TravelSignature({ label, name, nip, indent = '0', spacer = '8mm', bold = true }: { label: string; name: string; nip: string; indent?: string; spacer?: string; bold?: boolean }) {
  const margin = `0 0 0 ${indent}`
  return (
    <div>
      <p style={{ margin }}>{label}</p>
      <div style={{ height: spacer }} />
      <p style={{ margin, fontWeight: bold ? 'bold' : 'normal' }}>{name}</p>
      <p style={{ margin }}>{nip.startsWith('NIP') ? nip : `NIP. ${nip}`}</p>
    </div>
  )
}

// ============================================================
// TEMPLATE LAMA YANG TETAP TERSEDIA
// ============================================================
export function TemplatePenerimaan({ data }: { data: any }) {
  const s = data.siswa || {}
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT KETERANGAN PENERIMAAN</Title>
      <Nomor value={data.nomor_surat} />
      <P>Yang bertanda tangan di bawah ini Kepala MAN 1 Tasikmalaya menerangkan bahwa :</P>
      <FieldRows
        rows={[
          ['Nama Siswa', upper(s.nama_lengkap)],
          ['Tempat Tanggal Lahir', ttl(s)],
          ['Kelas', kelas(s)],
          ['NISN', text(s.nisn)],
          ['Nama Orang Tua/Wali', waliNama(s)],
          ['Pekerjaan Orang Tua/Wali', waliPekerjaan(s)],
          ['Alamat Orang Tua/Wali', alamatSiswa(s)],
        ]}
        left={8}
        labelWidth={50}
      />
      <P>Telah diterima di MAN 1 Tasikmalaya pada tanggal {formatTanggalIndo(data.tanggal_terima)}.</P>
      <P>Demikian surat keterangan ini dibuat, untuk diketahui dan dipergunakan sebagaimana mestinya.</P>
      <SignatureBlock data={data} signer={kepala} label="Kepala MAN 1 Tasikmalaya," />
    </Page>
  )
}

export function TemplateIzinPesantren({ data }: { data: any }) {
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <HeaderSurat data={data} perihal={data.perihal || 'Permohonan Izin'} />
      <P><i>Assalamu'alaikum Wr. Wb.</i></P>
      <P indent>Salam silaturahmi teriring doa kami sampaikan semoga segala aktivitas Bapak/Ibu senantiasa berada dalam lindungan dan maghfiroh Allah SWT.</P>
      <P indent>Selanjutnya, sehubungan dengan {text(data.keperluan, 'akan dilaksanakannya kegiatan')}, kami memohon untuk memberikan izin kepada peserta didik kami sebagaimana terlampir di bawah ini:</P>
      <SimplePeopleTable rows={data.daftar_siswa || []} />
      <P>Untuk tidak mengikuti kegiatan pesantren, pada:</P>
      <FieldRows rows={[['Hari, tanggal', text(data.hari_tanggal)], ['Waktu', text(data.waktu)], ['Tempat', text(data.tempat, 'MAN 1 Tasikmalaya')]]} left={15} labelWidth={38} />
      <P indent>Besar harapan kami kiranya Bapak/Ibu dapat memberikan izin untuk pelaksanaan kegiatan tersebut. Demikian permohonan izin ini disampaikan. Atas segala perhatian dan kerjasamanya kami ucapkan terima kasih.</P>
      <P><i>Wassalamu'alaikum Wr. Wb.</i></P>
      <SignatureBlock data={data} signer={kepala} label="Kepala Madrasah," />
    </Page>
  )
}

export function TemplatePermohonan({ data }: { data: any }) {
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <HeaderSurat data={data} perihal={data.perihal || 'Permohonan'} />
      <P><i>Assalamu'alaikum Wr. Wb.</i></P>
      <P indent>{text(data.isi_surat, 'Sehubungan akan diadakannya kegiatan tersebut, kami memohon kiranya Bapak/Ibu berkenan memenuhi permohonan ini.')}</P>
      {(data.hari_tanggal || data.waktu || data.tempat) && (
        <FieldRows rows={[['Hari/Tanggal', text(data.hari_tanggal)], ['Waktu', text(data.waktu)], ['Tempat', text(data.tempat)]]} left={15} labelWidth={35} />
      )}
      {data.isi_tambahan && <P indent>{data.isi_tambahan}</P>}
      <P indent>Demikian permohonan ini kami sampaikan, atas perhatian dan partisipasinya kami ucapkan terima kasih.</P>
      <P><i>Wassalamu'alaikum Wr. Wb.</i></P>
      <SignatureBlock data={data} signer={kepala} label="Kepala Madrasah," />
    </Page>
  )
}

export function TemplateSuratTugas({ data }: { data: any }) {
  const kepala = pejabat(data, 'kepala')
  const daftarGuru: any[] = data.daftar_guru || []
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT TUGAS</Title>
      <Nomor value={data.nomor_surat} />
      {data.dasar_surat && <P indent>{data.dasar_surat}</P>}
      <P>Yang bertanda tangan di bawah ini :</P>
      <FieldRows rows={[['Nama', kepala.nama], ['Jabatan', kepala.jabatan || 'Kepala MAN 1 Tasikmalaya']]} left={8} labelWidth={35} />
      <P>Dengan ini menugaskan kepada :</P>
      <SimplePeopleTable rows={daftarGuru} />
      <P>untuk {text(data.tujuan_tugas, 'melaksanakan tugas')} yang dilaksanakan pada tanggal {text(data.tanggal_kegiatan)} bertempat di {text(data.tempat_kegiatan)}.</P>
      <P>Demikian surat tugas ini diberikan untuk dapat dilaksanakan dengan penuh tanggung jawab.</P>
      <SignatureBlock data={data} signer={kepala} label="Kepala Madrasah," />
    </Page>
  )
}

export function TemplateUndanganRapat({ data }: { data: any }) {
  const kepala = pejabat(data, 'kepala')
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <HeaderSurat data={data} perihal={data.perihal || 'Undangan Rapat'} tujuan={data.tujuan_surat || 'Pendidik dan Tenaga Kependidikan'} />
      <P><i>Assalamu'alaikum Wr. Wb.</i></P>
      <P indent>{text(data.isi_surat, 'Sehubungan akan dilaksanakannya kegiatan madrasah,')} dengan ini kami mengundang Bapak/Ibu untuk hadir pada kegiatan tersebut yang insya Allah akan dilaksanakan pada :</P>
      <FieldRows rows={[['Hari/Tanggal', text(data.hari_tanggal)], ['Waktu', text(data.waktu)], ['Tempat', text(data.tempat, 'MAN 1 Tasikmalaya')], ['Agenda', text(data.agenda)]]} left={15} labelWidth={35} />
      <P indent>Mengingat pentingnya kegiatan tersebut, kami mohon Bapak/Ibu hadir tepat pada waktunya.</P>
      <P indent>Demikian, atas kehadiran Bapak/Ibu kami haturkan terima kasih.</P>
      <P><i>Wassalamu'alaikum Wr. Wb.</i></P>
      {data.catatan && <p style={{ marginTop: '3mm', fontSize: '10pt', fontStyle: 'italic' }}>Catatan: {data.catatan}</p>}
      <SignatureBlock data={data} signer={kepala} label="Kepala Madrasah," />
    </Page>
  )
}

export function TemplatePernyataan({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>SURAT PERNYATAAN</Title>
      <P>Yang bertanda tangan di bawah ini :</P>
      <FieldRows rows={[['Nama', text(data.nama_ortu || s.nama_ayah || s.nama_ibu)], ['Alamat', data.alamat_ortu || alamatSiswa(s)], ['No. KTP', text(data.no_ktp || s.nik_ayah)]]} left={8} labelWidth={35} />
      <P>Selaku Orang tua / Wali murid dari :</P>
      <FieldRows rows={[['Nama', upper(s.nama_lengkap)], ['Kelas', kelas(s)]]} left={8} labelWidth={35} />
      <P>Menyatakan bahwa sejak tahun pelajaran {text(data.tahun_pelajaran)} menarik (mengundurkan diri) siswa tersebut dari MAN 1 Tasikmalaya.</P>
      <P>Demikian surat pernyataan ini kami buat. Atas perhatian Bapak kami ucapkan terima kasih.</P>
      <SignatureBlock data={data} signer={{ nama: text(data.nama_ortu || s.nama_ayah || s.nama_ibu), nip: '', jabatan: 'Yang membuat pernyataan,' }} label="Yang membuat pernyataan," />
    </Page>
  )
}

function HeaderSurat({ data, perihal, tujuan }: { data: any; perihal: string; tujuan?: string }) {
  return (
    <table style={{ width: '100%', marginBottom: '8mm', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '12pt' }}>
      <tbody>
        <tr>
          <td style={{ width: '50%', verticalAlign: 'top' }}>
            <FieldRows rows={[['Nomor', text(data.nomor_surat)], ['Lampiran', text(data.lampiran, '-')], ['Perihal', perihal]]} labelWidth={22} />
          </td>
          <td style={{ verticalAlign: 'top', textAlign: 'left' }}>
            <p style={{ margin: 0 }}>Tasikmalaya, {text(data.tanggal_surat || formatTanggalIndo(data.tanggal_surat_raw))}</p>
            <p style={{ margin: '4mm 0 0' }}>Kepada:</p>
            <p style={{ margin: 0 }}>Yth. {text(tujuan || data.tujuan_surat)}</p>
            <p style={{ margin: '2mm 0 0 10mm' }}>di Tempat</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function SimplePeopleTable({ rows }: { rows: any[] }) {
  if (!rows?.length) return null
  return (
    <table style={{ width: '90%', margin: '0 0 4mm 8mm', borderCollapse: 'collapse', fontFamily: FONT, fontSize: '11pt' }}>
      <thead>
        <tr>
          <th style={{ border: '0.5pt solid #000', padding: '1mm', width: '10mm' }}>No</th>
          <th style={{ border: '0.5pt solid #000', padding: '1mm' }}>Nama</th>
          <th style={{ border: '0.5pt solid #000', padding: '1mm', width: '42mm' }}>Keterangan</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td style={{ border: '0.5pt solid #000', padding: '1mm', textAlign: 'center' }}>{i + 1}</td>
            <td style={{ border: '0.5pt solid #000', padding: '1mm 2mm' }}>{text(row.nama || row.nama_lengkap)}</td>
            <td style={{ border: '0.5pt solid #000', padding: '1mm 2mm', textAlign: 'center' }}>{text(row.jabatan || row.kelas || row.sub)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ============================================================
// TEMPLATE REGISTRY
// ============================================================
export const TEMPLATE_MAP: Record<string, React.FC<{ data: any }>> = {
  penerimaan: TemplatePenerimaan,
  sppd: TemplateSPPD,
  izin_pesantren: TemplateIzinPesantren,
  ket_aktif: TemplateKetAktif,
  permohonan: TemplatePermohonan,
  surat_tugas: TemplateSuratTugas,
  undangan_rapat: TemplateUndanganRapat,
  pindah: TemplateMutasiKeluar,
  mutasi_keluar: TemplateMutasiKeluar,
  mutasi_masuk: TemplateMutasiMasuk,
  pernyataan: TemplatePernyataan,
  kelakuan_baik: TemplateKelakuanBaik,
  penelitian: TemplatePenelitian,
  panggilan_ortu: TemplatePanggilanOrtu,
}
