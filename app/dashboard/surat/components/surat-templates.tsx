// Lokasi: app/dashboard/surat/components/surat-templates.tsx
// Print-safe — NO Tailwind. Inline CSS only. Font Times New Roman. Ukuran F4 (215mm × 330mm).
'use client'

import React from 'react'

// ============================================================
// SHARED CONSTANTS
// ============================================================
const FONT = '"Times New Roman", Times, serif'
const PAGE_STYLE: React.CSSProperties = {
  width: '215mm',
  minHeight: '330mm',
  padding: '15mm 20mm 20mm 25mm',
  fontFamily: FONT,
  fontSize: '12pt',
  color: '#000',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  lineHeight: '1.5',
  position: 'relative',
}
const NPSN = '69886396'

// ============================================================
// HELPER: Format tanggal Indonesia
// ============================================================
const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export function formatTanggalIndo(dateStr?: string): string {
  if (!dateStr) return '.....................'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `${d.getDate()} ${BULAN[d.getMonth() + 1]} ${d.getFullYear()}`
  } catch { return dateStr }
}

function terbilangKelas(tingkat: number): string {
  const map: Record<number, string> = {
    10: 'X (Sepuluh)',
    11: 'XI (Sebelas)',
    12: 'XII (Dua Belas)',
  }
  return map[tingkat] || String(tingkat)
}

function formatAlamatSiswa(s: any): string {
  const parts: string[] = []
  if (s.alamat_lengkap) parts.push(s.alamat_lengkap)
  if (s.rt && s.rw) parts.push(`RT. ${s.rt}, RW. ${s.rw}`)
  if (s.desa_kelurahan) parts.push(`Kel. ${s.desa_kelurahan}`)
  if (s.kecamatan) parts.push(`Kec. ${s.kecamatan}`)
  if (s.kabupaten_kota) parts.push(s.kabupaten_kota)
  if (s.provinsi) parts.push(s.provinsi)
  if (s.kode_pos) parts.push(s.kode_pos)
  return parts.join(', ') || '......................................'
}

// ============================================================
// KOP SURAT COMPONENT (full-width, edge to edge)
// ============================================================
function KopSurat() {
  return (
    <div style={{ marginLeft: '-25mm', marginRight: '-20mm', marginBottom: '4mm', textAlign: 'center' }}>
      <img
        src="/kopsurat.png"
        alt="Kop Surat"
        style={{ width: '100%', display: 'block' }}
      />
    </div>
  )
}

// ============================================================
// SIGNATURE BLOCK
// ============================================================
function TandaTangan({ tempat, tanggal, jabatan, nama }: {
  tempat?: string; tanggal?: string; jabatan: string; nama: string
}) {
  return (
    <div style={{ textAlign: 'right', marginTop: '10mm' }}>
      <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '60mm' }}>
        <p>{tempat || 'Tasikmalaya'}, {tanggal || formatTanggalIndo(new Date().toISOString())}</p>
        <p>{jabatan},</p>
        <div style={{ height: '20mm' }} />
        <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{nama}</p>
      </div>
    </div>
  )
}

// ============================================================
// 1. SURAT KETERANGAN PENERIMAAN
// ============================================================
export function TemplatePenerimaan({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>SURAT KETERANGAN PENERIMAAN</p>
        <p>Nomor: {data.nomor_surat}</p>
      </div>
      <p style={{ textIndent: '12mm', textAlign: 'justify' }}>
        Yang bertanda tangan di bawah ini Kepala MAN 1 Tasikmalaya menerangkan bahwa :
      </p>
      <table style={{ marginLeft: '12mm', marginTop: '4mm', marginBottom: '4mm', borderCollapse: 'collapse', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          {[
            ['1.', 'Nama Siswa', s.nama_lengkap],
            ['2.', 'Tempat Tanggal Lahir', `${s.tempat_lahir || '-'}, ${formatTanggalIndo(s.tanggal_lahir)}`],
            ['3.', 'Kelas', s.tingkat ? terbilangKelas(s.tingkat) : '-'],
            ['4.', 'N I S N', s.nisn],
            ['5.', 'NPSN', NPSN],
            ['6.', 'Nama Orang Tua/Wali', s.nama_ayah || s.nama_ibu || '-'],
            ['7.', 'Pekerjaan Orang Tua / Wali', s.pekerjaan_ayah || s.pekerjaan_ibu || '-'],
            ['8.', 'Alamat Orang Tua / Wali', formatAlamatSiswa(s)],
          ].map(([no, label, val], i) => (
            <tr key={i}>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{no}</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top' }}>:</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ textIndent: '12mm', textAlign: 'justify' }}>
        Telah diterima di MAN 1 Tasikmalaya pada tanggal {formatTanggalIndo(data.tanggal_terima)}.
      </p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginTop: '3mm' }}>
        Demikian surat keterangan ini dibuat, untuk diketahui dan dipergunakan sebagaimana mestinya.
      </p>
      <TandaTangan
        tanggal={data.tanggal_surat || formatTanggalIndo(data.tanggal_terima)}
        jabatan="Kepala MAN 1 Tasikmalaya"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 2. SPPD (satu lembar, kop surat, tabel bawah 2x2)
// ============================================================
export function TemplateSPPD({ data }: { data: any }) {
  const tdLabel: React.CSSProperties = { padding: '1.5mm 2mm', border: '0.5pt solid #000', verticalAlign: 'top', width: '5mm', fontSize: '10pt' }
  const tdField: React.CSSProperties = { padding: '1.5mm 2mm', border: '0.5pt solid #000', verticalAlign: 'top', width: '42%', fontSize: '10pt' }
  const tdVal: React.CSSProperties = { padding: '1.5mm 2mm', border: '0.5pt solid #000', verticalAlign: 'top', fontSize: '10pt' }
  const cellStyle: React.CSSProperties = { width: '50%', border: '0.5pt solid #000', padding: '2mm', verticalAlign: 'top', fontSize: '9pt' }

  return (
    <div style={{ ...PAGE_STYLE, fontSize: '10pt', padding: '12mm 20mm 12mm 25mm' }}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '11pt' }}>SURAT PERINTAH PERJALANAN DINAS (SPPD)</p>
        <p style={{ fontSize: '10pt' }}>Nomor : {data.nomor_surat}</p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
        <tbody>
          <tr>
            <td style={tdLabel}>1.</td>
            <td style={tdField}>Pejabat berwenang yang memberi perintah</td>
            <td style={tdVal}>Kepala MAN 1 Tasikmalaya</td>
          </tr>
          <tr>
            <td style={tdLabel}>2.</td>
            <td style={tdField}>Nama / NIP pegawai yang diperintahkan</td>
            <td style={tdVal}>{data.nama_pegawai || '-'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>3.</td>
            <td style={tdField}>
              <div>Pangkat dan golongan / Jabatan</div>
              <div>Gaji pokok / Tingkat</div>
            </td>
            <td style={tdVal}>
              <div>{data.jabatan_pegawai || '-'}</div>
              <div>- / -</div>
            </td>
          </tr>
          <tr>
            <td style={tdLabel}>4.</td>
            <td style={tdField}>Maksud perjalanan dinas</td>
            <td style={tdVal}>{data.maksud_perjalanan || '-'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>5.</td>
            <td style={tdField}>Alat angkutan yang digunakan</td>
            <td style={tdVal}>{data.alat_angkut || 'Darat'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>6.</td>
            <td style={tdField}>
              <div>Tempat berangkat</div>
              <div>Tempat tujuan</div>
            </td>
            <td style={tdVal}>
              <div>MAN 1 Tasikmalaya</div>
              <div>{data.tempat_tujuan || '-'}</div>
            </td>
          </tr>
          <tr>
            <td style={tdLabel}>7.</td>
            <td style={tdField}>
              <div>Lamanya perjalanan</div>
              <div>Tanggal berangkat</div>
              <div>Tanggal harus kembali</div>
            </td>
            <td style={tdVal}>
              <div>{data.lama_perjalanan || '1 hari'}</div>
              <div>{formatTanggalIndo(data.tanggal_berangkat)}</div>
              <div>{data.tanggal_kembali ? formatTanggalIndo(data.tanggal_kembali) : '-'}</div>
            </td>
          </tr>
          <tr>
            <td style={tdLabel}>8.</td>
            <td style={tdField}>Pengikut</td>
            <td style={tdVal}>{data.pengikut || '-'}</td>
          </tr>
          <tr>
            <td style={tdLabel}>9.</td>
            <td style={tdField}>Pembebanan anggaran</td>
            <td style={tdVal}>-</td>
          </tr>
          <tr>
            <td style={tdLabel}>10.</td>
            <td style={tdField}>Keterangan lain-lain</td>
            <td style={tdVal}>{data.keterangan || 'Surat perintah ini supaya dilaksanakan dengan penuh tanggung jawab'}</td>
          </tr>
        </tbody>
      </table>

      {/* Signature section */}
      <table style={{ width: '100%', marginTop: '3mm', fontFamily: FONT, borderCollapse: 'collapse', fontSize: '10pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              <p>Dikeluarkan di : Tasikmalaya</p>
              <p>Pada tanggal : {formatTanggalIndo(data.tanggal_berangkat)}</p>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'center' }}>
              <p>Kepala MAN 1 Tasikmalaya,</p>
              <div style={{ height: '14mm' }} />
              <p style={{ fontWeight: 'bold' }}>{data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}</p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tabel Tiba/Berangkat 2x2 */}
      <table style={{ width: '100%', marginTop: '3mm', fontFamily: FONT, borderCollapse: 'collapse', fontSize: '9pt' }}>
        <tbody>
          <tr>
            <td style={cellStyle}>
              <p>Tiba di: {data.tempat_tujuan || '..................'}</p>
              <p>Pada tanggal: .................</p>
              <p style={{ marginTop: '2mm' }}>Mengetahui, pihak lembaga:</p>
              <div style={{ height: '12mm' }} />
              <p>........................................</p>
              <p>NIP. ..................................</p>
            </td>
            <td style={cellStyle}>
              <p>Berangkat dari: MAN 1 Tasikmalaya</p>
              <p>Pada tanggal: {formatTanggalIndo(data.tanggal_berangkat)}</p>
              <p style={{ marginTop: '2mm' }}>Kepala MAN 1 Tasikmalaya,</p>
              <div style={{ height: '12mm' }} />
              <p style={{ fontWeight: 'bold' }}>{data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}</p>
            </td>
          </tr>
          <tr>
            <td style={cellStyle}>
              <p>Tiba kembali di: MAN 1 Tasikmalaya</p>
              <p>Pada tanggal: .................</p>
              <p style={{ marginTop: '2mm' }}>Kepala MAN 1 Tasikmalaya,</p>
              <div style={{ height: '12mm' }} />
              <p style={{ fontWeight: 'bold' }}>{data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}</p>
            </td>
            <td style={{ ...cellStyle, fontSize: '8.5pt' }}>
              <p>Telah diperiksa dengan keterangan bahwa perjalanan tersebut di atas benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.</p>
              <p style={{ marginTop: '2mm', textAlign: 'center' }}>Kepala MAN 1 Tasikmalaya,</p>
              <div style={{ height: '12mm' }} />
              <p style={{ fontWeight: 'bold', textAlign: 'center' }}>{data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// 3. SURAT IZIN KE PESANTREN (UNIVERSAL)
// ============================================================
export function TemplateIzinPesantren({ data }: { data: any }) {
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      {/* Header surat */}
      <table style={{ width: '100%', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr><td style={{ width: '18mm' }}>Nomor</td><td style={{ width: '3mm' }}>:</td><td>{data.nomor_surat}</td></tr>
          <tr><td>Lampiran</td><td>:</td><td>{data.lampiran || '-'}</td></tr>
          <tr><td>Perihal</td><td>:</td><td style={{ fontWeight: 'bold' }}>{data.perihal || 'Permohonan Izin'}</td></tr>
        </tbody>
      </table>
      <div style={{ marginBottom: '4mm' }}>
        <p>Kepada,</p>
        <p>Yth. {data.tujuan_surat || '......................................'}</p>
        <p style={{ marginLeft: '6mm' }}>di Tempat</p>
      </div>
      <p style={{ marginBottom: '3mm' }}><i>Assalamu&apos;alaikum Wr. Wb.</i></p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Salam silaturahmi teriring doa kami sampaikan semoga segala aktivitas Bapak/Ibu senantiasa berada dalam lindungan dan maghfiroh Allah SWT.
      </p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Selanjutnya, sehubungan dengan {data.keperluan || 'akan dilaksanakannya kegiatan'}, kami memohon untuk memberikan izin kepada peserta didik kami sebagaimana terlampir di bawah ini:
      </p>

      {data.daftar_siswa && data.daftar_siswa.length > 0 && (
        <table style={{ width: '90%', marginLeft: '12mm', borderCollapse: 'collapse', fontSize: '11pt', fontFamily: FONT, marginBottom: '4mm' }}>
          <thead>
            <tr>
              <th style={{ border: '0.5pt solid #000', padding: '1mm', textAlign: 'center', width: '8mm' }}>No</th>
              <th style={{ border: '0.5pt solid #000', padding: '1mm', textAlign: 'center' }}>Nama</th>
              <th style={{ border: '0.5pt solid #000', padding: '1mm', textAlign: 'center', width: '35mm' }}>Kelas</th>
            </tr>
          </thead>
          <tbody>
            {(data.daftar_siswa as any[]).map((s, i) => (
              <tr key={i}>
                <td style={{ border: '0.5pt solid #000', padding: '1mm', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ border: '0.5pt solid #000', padding: '1mm 2mm' }}>{s.nama}</td>
                <td style={{ border: '0.5pt solid #000', padding: '1mm 2mm', textAlign: 'center' }}>{s.kelas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '2mm' }}>
        Untuk tidak mengikuti kegiatan pesantren, pada:
      </p>

      <table style={{ marginLeft: '20mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr><td style={{ width: '40mm' }}>Hari, tanggal</td><td style={{ width: '3mm' }}>:</td><td>{data.hari_tanggal || '.....................'}</td></tr>
          <tr><td>Waktu</td><td>:</td><td>{data.waktu || '.....................'}</td></tr>
          <tr><td>Tempat</td><td>:</td><td>{data.tempat || 'MAN 1 Tasikmalaya'}</td></tr>
        </tbody>
      </table>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Besar harapan kami kiranya Bapak/Ibu dapat memberikan izin untuk pelaksanaan kegiatan tersebut. Demikian permohonan izin ini disampaikan. Atas segala perhatian dan kerjasamanya kami ucapkan terima kasih.
      </p>
      <p><i>Wassalamu&apos;alaikum Wr. Wb.</i></p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala Madrasah"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 4. SURAT KETERANGAN AKTIF
// ============================================================
export function TemplateKetAktif({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>SURAT KETERANGAN</p>
        <p>Nomor: {data.nomor_surat}</p>
      </div>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Yang bertanda tangan di bawah ini Kepala MAN 1 Tasikmalaya menerangkan bahwa :
      </p>
      <table style={{ marginLeft: '12mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          {[
            ['Nama', s.nama_lengkap],
            ['NISN', s.nisn],
            ['Tempat Tanggal Lahir', `${s.tempat_lahir || '-'}, ${formatTanggalIndo(s.tanggal_lahir)}`],
            ['Kelas', s.tingkat ? terbilangKelas(s.tingkat) : '-'],
            ['Alamat', formatAlamatSiswa(s)],
            ['Nama Orang Tua', s.nama_ayah || s.nama_ibu || '-'],
          ].map(([label, val], i) => (
            <tr key={i}>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', width: '45mm' }}>{label}</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', width: '3mm' }}>:</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ textIndent: '0mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Adalah benar sebagai peserta didik di MAN 1 Tasikmalaya dari tahun pelajaran {data.tahun_masuk || '....../......'} dan masih aktif belajar sampai sekarang.
      </p>
      <p style={{ textIndent: '0mm', textAlign: 'justify' }}>
        Demikian surat keterangan ini, untuk dapat digunakan sebagaimana mestinya.
      </p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala MAN 1 Tasikmalaya"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 5. SURAT PERMOHONAN (UNIVERSAL)
// ============================================================
export function TemplatePermohonan({ data }: { data: any }) {
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <table style={{ width: '100%', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr>
            <td style={{ width: '18mm' }}>Nomor</td><td style={{ width: '3mm' }}>:</td>
            <td>{data.nomor_surat}</td>
            <td rowSpan={3} style={{ verticalAlign: 'top', textAlign: 'right', width: '45%' }}>
              <p>Tasikmalaya, {data.tanggal_surat || formatTanggalIndo(new Date().toISOString())}</p>
              <p>Kepada:</p>
              <p>Yth. {data.tujuan_surat || '..............................'}</p>
              <p style={{ marginTop: '1mm' }}>di</p>
              <p style={{ marginLeft: '3mm' }}>Tempat</p>
            </td>
          </tr>
          <tr><td>Lampiran</td><td>:</td><td>{data.lampiran || '-'}</td></tr>
          <tr><td>Perihal</td><td>:</td><td style={{ fontWeight: 'bold' }}>{data.perihal || 'Permohonan'}</td></tr>
        </tbody>
      </table>
      <p style={{ marginBottom: '3mm' }}><i>Assalamu&apos;alaikum Wr. Wb.</i></p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        {data.isi_surat || 'Sehubungan akan diadakannya kegiatan tersebut, kami memohon kiranya Bapak/Ibu berkenan memenuhi permohonan ini.'}
      </p>
      {data.hari_tanggal && (
        <table style={{ marginLeft: '20mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
          <tbody>
            <tr><td style={{ width: '35mm' }}>Hari/Tanggal</td><td style={{ width: '3mm' }}>:</td><td>{data.hari_tanggal}</td></tr>
            {data.waktu && <tr><td>Waktu</td><td>:</td><td>{data.waktu}</td></tr>}
            {data.tempat && <tr><td>Tempat</td><td>:</td><td>{data.tempat}</td></tr>}
          </tbody>
        </table>
      )}
      {data.isi_tambahan && (
        <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>{data.isi_tambahan}</p>
      )}
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Demikian permohonan ini kami sampaikan, atas perhatian dan partisipasinya kami ucapkan terima kasih.
      </p>
      <p><i>Wassalamu&apos;alaikum Wr. Wb.</i></p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala Madrasah"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 6. SURAT TUGAS (UNIVERSAL)
// ============================================================
export function TemplateSuratTugas({ data }: { data: any }) {
  const daftarGuru: any[] = data.daftar_guru || []
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '5mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>SURAT TUGAS</p>
        <p>Nomor : {data.nomor_surat}</p>
      </div>
      {data.dasar_surat && (
        <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
          {data.dasar_surat}
        </p>
      )}
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Yang bertanda tangan di bawah ini :
      </p>
      <table style={{ marginLeft: '12mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr><td style={{ width: '45mm' }}>Nama</td><td style={{ width: '3mm' }}>:</td><td>{data.penandatangan || '-'}</td></tr>
          <tr><td>Jabatan</td><td>:</td><td>Kepala MAN 1 Tasikmalaya</td></tr>
        </tbody>
      </table>
      <p style={{ textIndent: '12mm', marginBottom: '3mm' }}>Dengan ini menugaskan kepada :</p>

      <table style={{ width: '90%', marginLeft: '12mm', borderCollapse: 'collapse', fontSize: '11pt', fontFamily: FONT, marginBottom: '4mm' }}>
        <thead>
          <tr>
            <th style={{ border: '0.5pt solid #000', padding: '2mm', textAlign: 'center', width: '8mm' }}>No</th>
            <th style={{ border: '0.5pt solid #000', padding: '2mm', textAlign: 'center' }}>Nama</th>
            <th style={{ border: '0.5pt solid #000', padding: '2mm', textAlign: 'center' }}>Jabatan</th>
          </tr>
        </thead>
        <tbody>
          {daftarGuru.map((g: any, i: number) => (
            <tr key={i}>
              <td style={{ border: '0.5pt solid #000', padding: '2mm', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '0.5pt solid #000', padding: '2mm' }}>{g.nama}</td>
              <td style={{ border: '0.5pt solid #000', padding: '2mm' }}>{g.jabatan}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ textIndent: '0mm', textAlign: 'justify', marginBottom: '3mm' }}>
        untuk {data.tujuan_tugas || 'melaksanakan tugas'} yang dilaksanakan pada tanggal {data.tanggal_kegiatan || '.....................'} bertempat di {data.tempat_kegiatan || '.....................'}.
      </p>
      <p style={{ textIndent: '0mm', textAlign: 'justify' }}>
        Demikian surat tugas ini diberikan untuk dapat dilaksanakan dengan penuh tanggung jawab.
      </p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala Madrasah"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 7. UNDANGAN RAPAT (UNIVERSAL)
// ============================================================
export function TemplateUndanganRapat({ data }: { data: any }) {
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <table style={{ width: '100%', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr>
            <td style={{ width: '18mm' }}>Nomor</td><td style={{ width: '3mm' }}>:</td>
            <td>{data.nomor_surat}</td>
            <td rowSpan={3} style={{ verticalAlign: 'top', textAlign: 'right', width: '45%' }}>
              <p>Tasikmalaya, {data.tanggal_surat || formatTanggalIndo(new Date().toISOString())}</p>
              <p>Kepada:</p>
              <p>Yth. {data.tujuan_surat || 'Pendidik dan Tenaga Kependidikan'}</p>
              <p>di</p>
              <p style={{ marginLeft: '3mm' }}>Tempat</p>
            </td>
          </tr>
          <tr><td>Lampiran</td><td>:</td><td>{data.lampiran || '-'}</td></tr>
          <tr><td>Perihal</td><td>:</td><td style={{ fontWeight: 'bold' }}>{data.perihal || 'Undangan Rapat'}</td></tr>
        </tbody>
      </table>
      <p style={{ marginBottom: '3mm' }}><i>Assalamu&apos;alaikum Wr. Wb.</i></p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        {data.isi_surat || 'Sehubungan akan dilaksanakannya kegiatan madrasah,'} dengan ini kami mengundang Bapak/Ibu untuk hadir pada kegiatan tersebut yang insya Allah akan dilaksanakan pada :
      </p>
      <table style={{ marginLeft: '20mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr><td style={{ width: '35mm' }}>Hari/Tanggal</td><td style={{ width: '3mm' }}>:</td><td>{data.hari_tanggal || '.....................'}</td></tr>
          <tr><td>Waktu</td><td>:</td><td>{data.waktu || '.....................'}</td></tr>
          <tr><td>Tempat</td><td>:</td><td>{data.tempat || 'MAN 1 Tasikmalaya'}</td></tr>
          <tr><td>Agenda</td><td>:</td><td>{data.agenda || '.....................'}</td></tr>
        </tbody>
      </table>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Mengingat pentingnya kegiatan tersebut, kami mohon Bapak/Ibu hadir tepat pada waktunya.
      </p>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Demikian, atas kehadiran Bapak/Ibu kami haturkan terima kasih.
      </p>
      <p><i>Wassalamu&apos;alaikum Wr. Wb.</i></p>
      {data.catatan && (
        <p style={{ marginTop: '3mm', fontSize: '10pt', fontStyle: 'italic' }}>Catatan: {data.catatan}</p>
      )}
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala Madrasah"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 8. SURAT KETERANGAN PINDAH
// ============================================================
export function TemplatePindah({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>SURAT KETERANGAN PINDAH</p>
        <p>Nomor: {data.nomor_surat}</p>
      </div>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Yang bertanda tangan di bawah ini Kepala MAN 1 Tasikmalaya menerangkan bahwa :
      </p>
      <table style={{ marginLeft: '12mm', marginBottom: '4mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          {[
            ['1', 'Nama Siswa', s.nama_lengkap],
            ['2', 'Tempat Tanggal Lahir', `${s.tempat_lahir || '-'}, ${formatTanggalIndo(s.tanggal_lahir)}`],
            ['3', 'Kelas', s.tingkat ? terbilangKelas(s.tingkat) : '-'],
            ['4', 'Nomor Induk Siswa', s.nis_lokal || '-'],
            ['5', 'N I S N', s.nisn],
            ['6', 'NPSN', NPSN],
            ['7', 'Nama Orang Tua/Wali', s.nama_ayah || s.nama_ibu || '-'],
            ['8', 'Pekerjaan Orang Tua / Wali', s.pekerjaan_ayah || s.pekerjaan_ibu || '-'],
            ['9', 'Alamat Orang Tua / Wali', formatAlamatSiswa(s)],
            ['10', 'Alasan Pindah', data.alasan_pindah || '-'],
            ['11', 'Sekolah Tujuan', data.sekolah_tujuan || '-'],
          ].map(([no, label, val], i) => (
            <tr key={i}>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', width: '5mm' }}>{no}</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', width: '50mm' }}>{label}</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', width: '3mm' }}>:</td>
              <td style={{ padding: '1mm 2mm', verticalAlign: 'top', ...(no === '11' ? { fontWeight: 'bold' } : {}) }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginLeft: '12mm', marginBottom: '4mm' }}>
        <p>Terlampir :</p>
        <p style={{ marginLeft: '6mm' }}>- Daftar Identitas Siswa</p>
        <p style={{ marginLeft: '6mm' }}>- Surat Keterangan Kelakuan Baik</p>
      </div>
      <p style={{ textIndent: '12mm', textAlign: 'justify' }}>
        Demikian, Surat Keterangan ini dibuat untuk diketahui dan dipergunakan sebagaimana mestinya.
      </p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala MAN 1 Tasikmalaya"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
  )
}

// ============================================================
// 9. SURAT PERNYATAAN (ORANG TUA)
// ============================================================
export function TemplatePernyataan({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <div style={PAGE_STYLE}>
      <div style={{ textAlign: 'center', marginBottom: '8mm', marginTop: '5mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '14pt', textDecoration: 'underline' }}>SURAT PERNYATAAN</p>
      </div>
      <p style={{ textIndent: '12mm', marginBottom: '4mm' }}>Yang bertanda tangan di bawah ini :</p>
      <table style={{ marginLeft: '12mm', marginBottom: '5mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr>
            <td style={{ padding: '1mm 2mm', width: '35mm', letterSpacing: '2pt' }}>Nama</td>
            <td style={{ padding: '1mm 2mm', width: '3mm' }}>:</td>
            <td style={{ padding: '1mm 2mm' }}>{data.nama_ortu || s.nama_ayah || s.nama_ibu || '-'}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm', letterSpacing: '2pt' }}>Alamat</td>
            <td style={{ padding: '1mm 2mm' }}>:</td>
            <td style={{ padding: '1mm 2mm' }}>{data.alamat_ortu || formatAlamatSiswa(s)}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm' }}>No. KTP</td>
            <td style={{ padding: '1mm 2mm' }}>:</td>
            <td style={{ padding: '1mm 2mm' }}>{data.no_ktp || s.nik_ayah || '.....................'}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginBottom: '4mm' }}>Selaku Orang tua / Wali murid dari :</p>
      <table style={{ marginLeft: '12mm', marginBottom: '5mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          <tr>
            <td style={{ padding: '1mm 2mm', width: '35mm', letterSpacing: '2pt' }}>Nama</td>
            <td style={{ padding: '1mm 2mm', width: '3mm' }}>:</td>
            <td style={{ padding: '1mm 2mm' }}>{s.nama_lengkap || '-'}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm', letterSpacing: '2pt' }}>Kelas</td>
            <td style={{ padding: '1mm 2mm' }}>:</td>
            <td style={{ padding: '1mm 2mm' }}>{s.tingkat ? terbilangKelas(s.tingkat) : '-'}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ textAlign: 'justify', marginBottom: '5mm' }}>
        Menyatakan bahwa sejak tahun pelajaran {data.tahun_pelajaran || '......./.......'} menarik (mengundurkan diri) siswa tersebut dari MAN 1 Tasikmalaya.
      </p>
      <p style={{ textAlign: 'justify' }}>
        Demikian surat pernyataan ini kami buat. Atas perhatian Bapak kami ucapkan terima kasih.
      </p>
      <div style={{ textAlign: 'right', marginTop: '10mm' }}>
        <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '60mm' }}>
          <p>Tasikmalaya, {data.tanggal_surat || formatTanggalIndo(new Date().toISOString())}</p>
          <p>Yang membuat pernyataan,</p>
          <div style={{ height: '20mm' }} />
          <p style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{data.nama_ortu || s.nama_ayah || s.nama_ibu || '.....................'}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 10. SURAT KELAKUAN BAIK
// ============================================================
export function TemplateKelakuanBaik({ data }: { data: any }) {
  const s = data.siswa || {}
  return (
    <div style={PAGE_STYLE}>
      <KopSurat />
      <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>SURAT KETERANGAN KELAKUAN BAIK</p>
        <p>Nomor: {data.nomor_surat}</p>
      </div>
      <p style={{ textIndent: '12mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Yang bertanda tangan di bawah ini Kepala MAN 1 Tasikmalaya menerangkan bahwa :
      </p>
      <table style={{ marginLeft: '12mm', marginBottom: '5mm', fontSize: '12pt', fontFamily: FONT }}>
        <tbody>
          {[
            ['Nama', s.nama_lengkap],
            ['NISN', s.nisn],
            ['Tempat Tanggal Lahir', `${s.tempat_lahir || '-'}, ${formatTanggalIndo(s.tanggal_lahir)}`],
            ['Kelas', s.tingkat ? terbilangKelas(s.tingkat) : '-'],
            ['NPSN', NPSN],
          ].map(([label, val], i) => (
            <tr key={i}>
              <td style={{ padding: '1mm 2mm', width: '45mm' }}>{label}</td>
              <td style={{ padding: '1mm 2mm', width: '3mm' }}>:</td>
              <td style={{ padding: '1mm 2mm' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ textIndent: '0mm', textAlign: 'justify', marginBottom: '3mm' }}>
        Peserta didik tersebut di atas selama belajar di MAN 1 Tasikmalaya berkelakuan <b>BAIK</b> dan tidak pernah terlibat dalam tindak kriminal maupun penggunaan narkotika.
      </p>
      <p style={{ textIndent: '0mm', textAlign: 'justify' }}>
        Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
      </p>
      <TandaTangan
        tanggal={data.tanggal_surat}
        jabatan="Kepala MAN 1 Tasikmalaya"
        nama={data.penandatangan || 'H. Eka Mulyana, S.Ag., M.Pd.I.'}
      />
    </div>
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
  pindah: TemplatePindah,
  pernyataan: TemplatePernyataan,
  kelakuan_baik: TemplateKelakuanBaik,
}
