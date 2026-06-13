// Lokasi: app/dashboard/sp/components/sp-templates.tsx
// Template cetak Surat Peringatan (SP1/SP2/SP3). Inline CSS, Times New Roman.
// Memakai ulang primitif layout dari surat-templates.tsx.
'use client'

import React from 'react'
import {
  Page,
  KopSurat,
  Title,
  Nomor,
  P,
  FieldRows,
  SignatureBlock,
  pejabat,
  formatTanggalIndo,
} from '../../surat/components/surat-templates'
import type { SpLevel } from '../constants'
import { SP_LEVEL_SHORT } from '../constants'

const DOTS = '..............................'

function text(value: any, fallback = DOTS): string {
  if (value === null || value === undefined) return fallback
  const str = String(value).trim()
  return str || fallback
}

function upper(value: any) {
  const v = text(value)
  return v === DOTS ? v : v.toUpperCase()
}

function kelasSingkat(s: any) {
  if (s?.tingkat && s?.nomor_kelas) return `${s.tingkat}.${s.nomor_kelas}`
  if (s?.tingkat) return String(s.tingkat)
  return DOTS
}

function ttlSlash(s: any) {
  if (!s?.tempat_lahir && !s?.tanggal_lahir) return DOTS
  if (!s?.tanggal_lahir) return text(s.tempat_lahir)
  const d = new Date(s.tanggal_lahir)
  const date = Number.isNaN(d.getTime())
    ? s.tanggal_lahir
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${text(s.tempat_lahir, '............')}, ${date}`
}

// ============================================================
// TEMPLATE SURAT PERINGATAN
// NOTE: isi paragraf masih placeholder — sesuaikan dgn format final dari user.
// ============================================================
export function TemplateSP({ data }: { data: any }) {
  const s = data.siswa || {}
  const level: SpLevel = (data.level as SpLevel) || 'sp1'
  const kepala = pejabat(data, 'kepala')
  const wali = waliNama(s)

  return (
    <Page data={data}>
      <KopSurat data={data} />
      <Title>{`SURAT PERINGATAN (${SP_LEVEL_SHORT[level]})`}</Title>
      <Nomor value={data.nomor_surat} />

      <P>Yang bertanda tangan di bawah ini, Kepala MAN 1 Tasikmalaya, dengan ini memberikan peringatan kepada:</P>

      <FieldRows
        rows={[
          ['Nama', upper(s.nama_lengkap)],
          ['Tempat, Tanggal Lahir', ttlSlash(s)],
          ['NISN', text(s.nisn)],
          ['Kelas', kelasSingkat(s)],
          ['Nama Orang Tua/Wali', text(wali)],
        ]}
        left={8}
        labelWidth={55}
      />

      <P indent>
        Berdasarkan akumulasi poin pelanggaran tata tertib madrasah yang bersangkutan telah mencapai{' '}
        <b>{text(data.total_poin, '...')}</b> poin, maka madrasah menetapkan <b>{SP_LEVEL_SHORT[level]}</b> kepada siswa
        tersebut di atas.
      </P>

      {data.alasan ? (
        <P indent>Catatan/alasan: {text(data.alasan)}</P>
      ) : null}

      <P indent>
        Demikian surat peringatan ini dibuat agar yang bersangkutan beserta orang tua/wali dapat memperhatikan dan
        melakukan pembinaan sebagaimana mestinya. Apabila tidak ada perubahan, madrasah berhak mengambil tindakan lebih
        lanjut sesuai ketentuan yang berlaku.
      </P>

      <div style={{ height: '4mm' }} />

      <SignatureBlock
        data={data}
        signer={kepala}
        label="Kepala Madrasah,"
        date={data.tanggal_surat || formatTanggalIndo(data.tanggal_surat_raw)}
        top={10}
      />
    </Page>
  )
}

function waliNama(s: any) {
  return text(s?.nama_ayah || s?.nama_ibu)
}

export default TemplateSP
