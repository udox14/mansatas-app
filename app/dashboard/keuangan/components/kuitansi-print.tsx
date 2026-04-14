'use client'

import { useRef, useState, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Printer, Settings2, Save } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

// ─── localStorage key ─────────────────────────────────────────────────────────
const LS_KEY_KOMITE  = 'keuangan_nama_petugas_komite'
const LS_KEY_KOPERASI = 'keuangan_nama_petugas_koperasi'

export function useNamaPerugas() {
  const [namaKomite, setNamaKomiteState]   = useState('Bendahara Komite')
  const [namaKoperasi, setNamaKoperasiState] = useState('Pengurus Koperasi')

  useEffect(() => {
    const k = localStorage.getItem(LS_KEY_KOMITE)
    const p = localStorage.getItem(LS_KEY_KOPERASI)
    if (k) setNamaKomiteState(k)
    if (p) setNamaKoperasiState(p)
  }, [])

  function setNamaKomite(v: string)  { setNamaKomiteState(v);  localStorage.setItem(LS_KEY_KOMITE, v) }
  function setNamaKoperasi(v: string) { setNamaKoperasiState(v); localStorage.setItem(LS_KEY_KOPERASI, v) }

  return { namaKomite, namaKoperasi, setNamaKomite, setNamaKoperasi }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KuitansiItem {
  label: string
  nominal: number
}

export interface KuitansiSisaTunggakan {
  label: string
  sisa: number
}

export interface KuitansiData {
  nomorKuitansi: string
  tanggal: string
  kategori: 'DSPT' | 'SPP' | 'Koperasi'
  namaSiswa: string
  nisn: string
  kelas: string
  namaPerugas: string
  metodeBayar: 'Tunai' | 'Transfer Bank'
  jumlahDiserahkan: number
  jumlahTagihan: number
  rincianBayar: KuitansiItem[]
  sisaTunggakan: KuitansiSisaTunggakan[]
  isLunas: boolean
}

// ─── Terbilang ────────────────────────────────────────────────────────────────

const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
]

function ucap(n: number): string {
  if (n === 0) return ''
  if (n < 20) return SATUAN[n]
  if (n < 100) {
    const puluhan = Math.floor(n / 10)
    const satuan = n % 10
    return (puluhan === 1 ? 'se' : SATUAN[puluhan]) + 'puluh' + (satuan ? ' ' + SATUAN[satuan] : '')
  }
  const ratus = Math.floor(n / 100)
  const sisa  = n % 100
  return (ratus === 1 ? 'se' : SATUAN[ratus]) + 'ratus' + (sisa ? ' ' + ucap(sisa) : '')
}

function terbilang(angka: number): string {
  if (angka === 0) return 'Nol'
  const groups = [
    { nilai: 1_000_000_000, label: 'miliar' },
    { nilai: 1_000_000,     label: 'juta' },
    { nilai: 1_000,         label: 'ribu' },
  ]
  let sisa = Math.round(angka)
  const parts: string[] = []
  for (const g of groups) {
    if (sisa >= g.nilai) {
      const qty = Math.floor(sisa / g.nilai)
      parts.push(g.nilai === 1_000 && qty === 1 ? 'seribu' : ucap(qty) + ' ' + g.label)
      sisa %= g.nilai
    }
  }
  if (sisa > 0) parts.push(ucap(sisa))
  const r = parts.join(' ').trim()
  return r.charAt(0).toUpperCase() + r.slice(1)
}

// ─── Shared print styles ──────────────────────────────────────────────────────

const PAGE_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    body { margin: 0; padding: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`

// ─── Cap LUNAS (shared) ───────────────────────────────────────────────────────

function CapLunas() {
  return (
    <div style={{
      position: 'absolute',
      top: '48%', left: '50%',
      transform: 'translate(-50%, -50%) rotate(-22deg)',
      border: '6px double #16a34a',
      borderRadius: '6px',
      padding: '6px 24px',
      color: '#16a34a',
      fontSize: '52pt',
      fontWeight: 900,
      fontFamily: '"Arial Black", Arial, sans-serif',
      letterSpacing: '8px',
      opacity: 0.16,
      pointerEvents: 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      lineHeight: 1,
    }}>
      LUNAS
    </div>
  )
}

// ─── Baris Keterangan (label : value) ────────────────────────────────────────

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td style={{ width: '38%', padding: '2.5px 0', color: '#555', fontSize: '10.5pt' }}>{label}</td>
      <td style={{ width: '4%',  padding: '2.5px 0', textAlign: 'center' }}>:</td>
      <td style={{ padding: '2.5px 0', fontWeight: bold ? 'bold' : 'normal', fontSize: '10.5pt' }}>{value}</td>
    </tr>
  )
}

// ─── Tabel Rincian (shared) ───────────────────────────────────────────────────

function TabelRincian({ items, headerColor = '#1a1a1a' }: { items: KuitansiItem[]; headerColor?: string }) {
  const total = items.reduce((s, i) => s + i.nominal, 0)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '7mm', fontSize: '10.5pt' }}>
      <thead>
        <tr style={{ backgroundColor: headerColor, color: '#fff' }}>
          <th style={{ padding: '5px 8px', textAlign: 'left', width: '6%' }}>No.</th>
          <th style={{ padding: '5px 8px', textAlign: 'left' }}>Uraian Pembayaran</th>
          <th style={{ padding: '5px 8px', textAlign: 'right', width: '28%' }}>Jumlah (Rp)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{i + 1}</td>
            <td style={{ padding: '5px 8px' }}>{item.label}</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
              {formatRupiah(item.nominal)}
            </td>
          </tr>
        ))}
        <tr style={{ borderTop: '2px solid #1a1a1a', backgroundColor: '#f5f5f5' }}>
          <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 'bold', textAlign: 'right' }}>
            TOTAL PEMBAYARAN INI
          </td>
          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {formatRupiah(total)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── Tabel Sisa Tunggakan (shared) ───────────────────────────────────────────

function TabelSisa({ items }: { items: KuitansiSisaTunggakan[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: '7mm' }}>
      <p style={{ fontSize: '10pt', color: '#555', marginBottom: '3px', fontStyle: 'italic' }}>
        Catatan — sisa tagihan yang belum terbayar:
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', border: '1px solid #ddd' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Item</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #ddd', width: '30%' }}>Sisa (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 8px' }}>{item.label}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#c0392b' }}>
                {formatRupiah(item.sisa)}
              </td>
            </tr>
          ))}
          <tr style={{ backgroundColor: '#fdf0ee', borderTop: '1px solid #ddd' }}>
            <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>Total Sisa Tunggakan</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', color: '#c0392b' }}>
              {formatRupiah(items.reduce((s, i) => s + i.sisa, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Blok Jumlah / Pembayaran / Kembalian (shared) ───────────────────────────

function BlokJumlah({ diserahkan, tagihan }: { diserahkan: number; tagihan: number }) {
  const kembalian = diserahkan - tagihan
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10mm' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '11pt', minWidth: '240px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 14px 3px 0', color: '#333', letterSpacing: '0.5px' }}>JUMLAH</td>
            <td style={{ padding: '3px 0', textAlign: 'center', width: '8px' }}>:</td>
            <td style={{ padding: '3px 0 3px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12pt' }}>
              {formatRupiah(diserahkan)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 14px 3px 0', color: '#333' }}>PEMBAYARAN</td>
            <td style={{ padding: '3px 0', textAlign: 'center' }}>:</td>
            <td style={{ padding: '3px 0 3px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
              {formatRupiah(tagihan)}
            </td>
          </tr>
          <tr style={{ borderTop: '1.5px solid #1a1a1a' }}>
            <td style={{ padding: '4px 14px 3px 0', fontWeight: 'bold', letterSpacing: '0.5px' }}>KEMBALI</td>
            <td style={{ padding: '4px 0', textAlign: 'center' }}>:</td>
            <td style={{
              padding: '4px 0 3px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold',
              color: kembalian > 0 ? '#16a34a' : '#1a1a1a',
            }}>
              {formatRupiah(kembalian > 0 ? kembalian : 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Blok Tanda Tangan (shared) ───────────────────────────────────────────────

function BlokTtd({
  tanggalFmt, namaSiswa, namaPerugas, jabatanPenerima,
}: { tanggalFmt: string; namaSiswa: string; namaPerugas: string; jabatanPenerima: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
      <tbody>
        <tr>
          <td style={{ width: '50%', textAlign: 'center', padding: '0 10mm' }}>
            <p style={{ margin: '0 0 28mm 0' }}>Penyetor / Siswa</p>
            <div style={{ borderBottom: '1px solid #1a1a1a', marginBottom: '5px' }} />
            <p style={{ margin: 0, fontWeight: 'bold' }}>( {namaSiswa} )</p>
          </td>
          <td style={{ width: '50%', textAlign: 'center', padding: '0 10mm' }}>
            <p style={{ margin: '0 0 3px 0' }}>Lahat, {tanggalFmt}</p>
            <p style={{ margin: '0 0 28mm 0' }}>{jabatanPenerima}</p>
            <div style={{ borderBottom: '1px solid #1a1a1a', marginBottom: '5px' }} />
            <p style={{ margin: 0, fontWeight: 'bold' }}>( {namaPerugas} )</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── Footer (shared) ──────────────────────────────────────────────────────────

function FooterDoc({ nomorKuitansi }: { nomorKuitansi: string }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTop: '1px solid #ccc', padding: '4px 18mm',
      fontSize: '8pt', color: '#aaa',
      display: 'flex', justifyContent: 'space-between',
    }}>
      <span>Dicetak: {new Date().toLocaleString('id-ID')}</span>
      <span>Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem</span>
      <span>{nomorKuitansi}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KUITANSI KOMITE  (DSPT & SPP)  — kop: kopkomite.png
// ═══════════════════════════════════════════════════════════════════════════════

function KuitansiKomiteContent({ data }: { data: KuitansiData }) {
  const tanggalFmt = new Date(data.tanggal).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', margin: '0 auto',
      backgroundColor: '#fff', fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt', color: '#1a1a1a', position: 'relative', boxSizing: 'border-box',
    }}>
      {/* Kop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kopkomite.png" alt="Kop Komite" style={{ width: '100%', display: 'block' }} />
      <div style={{ borderTop: '3px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', height: '4px' }} />

      <div style={{ padding: '14mm 18mm 24mm 18mm' }}>

        {/* Judul kanan atas */}
        <div style={{ textAlign: 'right', marginBottom: '10mm' }}>
          <div style={{ display: 'inline-block', borderBottom: '2.5px solid #1a1a1a', paddingBottom: '2px' }}>
            <p style={{ fontSize: '20pt', fontWeight: 'bold', letterSpacing: '3px', margin: 0 }}>
              BUKTI PEMBAYARAN
            </p>
          </div>
          <p style={{ fontSize: '10pt', color: '#666', marginTop: '4px' }}>
            Pembayaran {data.kategori} — Tahun Pelajaran 2024/2025
          </p>
        </div>

        {/* Info 2 kolom */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', width: '50%', paddingRight: '8mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <InfoRow label="Nama Siswa" value={data.namaSiswa} bold />
                    <InfoRow label="NISN"       value={data.nisn} />
                    <InfoRow label="Kelas"      value={data.kelas} />
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: 'top', width: '50%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <InfoRow label="No. Bukti" value={data.nomorKuitansi} bold />
                    <InfoRow label="Tanggal"   value={tanggalFmt} />
                    <InfoRow label="Metode"    value={data.metodeBayar} />
                    <InfoRow label="Petugas"   value={data.namaPerugas} />
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terbilang */}
        <div style={{
          border: '1px solid #bbb', borderRadius: '4px', padding: '6px 12px',
          marginBottom: '7mm', backgroundColor: '#fafafa', fontSize: '10pt',
        }}>
          <span style={{ color: '#555', marginRight: '6px' }}>Terbilang:</span>
          <strong style={{ fontStyle: 'italic' }}>{terbilang(data.jumlahTagihan)} Rupiah</strong>
        </div>

        {/* Rincian */}
        <TabelRincian items={data.rincianBayar} headerColor="#1a1a1a" />

        {/* Sisa tunggakan */}
        <TabelSisa items={data.sisaTunggakan} />

        {/* Jumlah / Kembalian */}
        <BlokJumlah diserahkan={data.jumlahDiserahkan} tagihan={data.jumlahTagihan} />

        {/* TTD */}
        <BlokTtd
          tanggalFmt={tanggalFmt}
          namaSiswa={data.namaSiswa}
          namaPerugas={data.namaPerugas}
          jabatanPenerima="Bendahara Komite"
        />

        {/* Cap Lunas */}
        {data.isLunas && <CapLunas />}
      </div>

      <FooterDoc nomorKuitansi={data.nomorKuitansi} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KUITANSI KOPERASI  — kop: kopkoperasi.png, aksen hijau tua
// ═══════════════════════════════════════════════════════════════════════════════

const KOPERASI_COLOR = '#166534'   // green-800

function KuitansiKoperasiContent({ data }: { data: KuitansiData }) {
  const tanggalFmt = new Date(data.tanggal).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', margin: '0 auto',
      backgroundColor: '#fff', fontFamily: '"Times New Roman", Times, serif',
      fontSize: '11pt', color: '#1a1a1a', position: 'relative', boxSizing: 'border-box',
    }}>
      {/* Kop Koperasi */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kopkoperasi.png" alt="Kop Koperasi" style={{ width: '100%', display: 'block' }} />
      <div style={{ borderTop: `3px solid ${KOPERASI_COLOR}`, borderBottom: `1px solid ${KOPERASI_COLOR}`, height: '4px' }} />

      <div style={{ padding: '12mm 18mm 24mm 18mm' }}>

        {/* Judul kanan atas — aksen hijau */}
        <div style={{ textAlign: 'right', marginBottom: '9mm' }}>
          <div style={{ display: 'inline-block', borderBottom: `2.5px solid ${KOPERASI_COLOR}`, paddingBottom: '2px' }}>
            <p style={{ fontSize: '20pt', fontWeight: 'bold', letterSpacing: '3px', margin: 0, color: KOPERASI_COLOR }}>
              BUKTI PEMBAYARAN
            </p>
          </div>
          <p style={{ fontSize: '10.5pt', fontWeight: 'bold', color: KOPERASI_COLOR, marginTop: '3px', letterSpacing: '1px' }}>
            KOPERASI MADRASAH
          </p>
          <p style={{ fontSize: '9.5pt', color: '#555', marginTop: '2px' }}>
            Perlengkapan Siswa Baru — Tahun Pelajaran 2024/2025
          </p>
        </div>

        {/* Info 2 kolom */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', width: '50%', paddingRight: '8mm' }}>
                {/* Kotak hijau muda di belakang info siswa */}
                <div style={{
                  backgroundColor: '#f0fdf4', border: `1px solid #bbf7d0`,
                  borderRadius: '4px', padding: '8px 10px',
                }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '9pt', fontWeight: 'bold', color: KOPERASI_COLOR, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Data Siswa
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <InfoRow label="Nama Siswa" value={data.namaSiswa} bold />
                      <InfoRow label="NISN"       value={data.nisn} />
                      <InfoRow label="Kelas"      value={data.kelas} />
                    </tbody>
                  </table>
                </div>
              </td>
              <td style={{ verticalAlign: 'top', width: '50%' }}>
                <div style={{
                  backgroundColor: '#f0fdf4', border: `1px solid #bbf7d0`,
                  borderRadius: '4px', padding: '8px 10px',
                }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '9pt', fontWeight: 'bold', color: KOPERASI_COLOR, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Data Transaksi
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <InfoRow label="No. Bukti" value={data.nomorKuitansi} bold />
                      <InfoRow label="Tanggal"   value={tanggalFmt} />
                      <InfoRow label="Metode"    value={data.metodeBayar} />
                      <InfoRow label="Petugas"   value={data.namaPerugas} />
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terbilang */}
        <div style={{
          border: `1px solid #bbf7d0`, borderRadius: '4px', padding: '6px 12px',
          marginBottom: '7mm', backgroundColor: '#f0fdf4', fontSize: '10pt',
        }}>
          <span style={{ color: KOPERASI_COLOR, fontWeight: 'bold', marginRight: '6px' }}>Terbilang:</span>
          <strong style={{ fontStyle: 'italic' }}>{terbilang(data.jumlahTagihan)} Rupiah</strong>
        </div>

        {/* Rincian — header hijau */}
        <TabelRincian items={data.rincianBayar} headerColor={KOPERASI_COLOR} />

        {/* Sisa tunggakan */}
        <TabelSisa items={data.sisaTunggakan} />

        {/* Jumlah / Kembalian */}
        <BlokJumlah diserahkan={data.jumlahDiserahkan} tagihan={data.jumlahTagihan} />

        {/* TTD */}
        <BlokTtd
          tanggalFmt={tanggalFmt}
          namaSiswa={data.namaSiswa}
          namaPerugas={data.namaPerugas}
          jabatanPenerima="Pengurus Koperasi"
        />

        {/* Cap Lunas */}
        {data.isLunas && <CapLunas />}
      </div>

      <FooterDoc nomorKuitansi={data.nomorKuitansi} />
    </div>
  )
}

// ─── Pilih content berdasarkan kategori ──────────────────────────────────────

function KuitansiContent({ data }: { data: KuitansiData }) {
  if (data.kategori === 'Koperasi') return <KuitansiKoperasiContent data={data} />
  return <KuitansiKomiteContent data={data} />
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Modal Pengaturan Nama Petugas
// ═══════════════════════════════════════════════════════════════════════════════

export function NamaPerugasSettingModal() {
  const { namaKomite, namaKoperasi, setNamaKomite, setNamaKoperasi } = useNamaPerugas()
  const [open, setOpen] = useState(false)
  const [formKomite, setFormKomite]   = useState(namaKomite)
  const [formKoperasi, setFormKoperasi] = useState(namaKoperasi)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setNamaKomite(formKomite.trim() || 'Bendahara Komite')
    setNamaKoperasi(formKoperasi.trim() || 'Pengurus Koperasi')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <Button
        size="sm" variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={() => { setFormKomite(namaKomite); setFormKoperasi(namaKoperasi); setOpen(true) }}
      >
        <Settings2 className="h-3.5 w-3.5" /> Nama Petugas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Pengaturan Nama Petugas Kuitansi</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nama Bendahara Komite</Label>
              <Input
                value={formKomite}
                onChange={e => setFormKomite(e.target.value)}
                placeholder="Nama Bendahara Komite"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-slate-400">Tampil di kuitansi DSPT dan SPP</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nama Pengurus Koperasi</Label>
              <Input
                value={formKoperasi}
                onChange={e => setFormKoperasi(e.target.value)}
                placeholder="Nama Pengurus Koperasi"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-slate-400">Tampil di kuitansi Koperasi</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button size="sm" className="flex-1 h-9 text-sm gap-1.5" onClick={handleSave}>
                {saved ? '✓ Tersimpan' : <><Save className="h-3.5 w-3.5" /> Simpan</>}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Disimpan di browser ini (lokal). Berlaku langsung untuk kuitansi berikutnya.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KuitansiModal  (preview + cetak)
// ═══════════════════════════════════════════════════════════════════════════════

interface KuitansiModalProps {
  data: KuitansiData | null
  open: boolean
  onClose: () => void
}

export function KuitansiModal({ data, open, onClose }: KuitansiModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data ? `Kuitansi-${data.nomorKuitansi}` : 'Kuitansi',
    pageStyle: PAGE_STYLE,
  })

  if (!data) return null

  const isKoperasi = data.kategori === 'Koperasi'
  const accentCls  = isKoperasi ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-4xl h-[92vh] p-0 rounded-xl overflow-hidden flex flex-col">
        <DialogHeader className={`px-5 py-3 border-b flex-shrink-0 ${accentCls}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-sm font-semibold">
                Preview Kuitansi {data.kategori}
              </DialogTitle>
              <span className="text-[11px] font-mono text-slate-400">{data.nomorKuitansi}</span>
            </div>
            <div className="flex gap-2">
              <NamaPerugasSettingModal />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClose}>
                Tutup
              </Button>
              <Button
                size="sm"
                className={`h-8 text-xs gap-1.5 ${isKoperasi ? 'bg-green-700 hover:bg-green-800' : ''}`}
                onClick={() => handlePrint()}
              >
                <Printer className="h-3.5 w-3.5" /> Cetak A4
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 bg-slate-200 dark:bg-slate-900 min-h-full flex justify-center">
            <div style={{
              boxShadow: '0 6px 32px rgba(0,0,0,0.22)',
              borderRadius: '2px',
              overflow: 'hidden',
              maxWidth: '210mm',
              width: '100%',
            }}>
              <div ref={printRef}>
                <KuitansiContent data={data} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
