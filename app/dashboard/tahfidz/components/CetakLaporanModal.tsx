'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Printer, Loader2 } from 'lucide-react'
import { JUZ_DATA } from '../data/juz-data'
import { SURAH_LIST } from '../data/quran-data'
import { getDataLaporanSiswa, getDataLaporanKelas } from '../actions'

// ─── Types ───────────────────────────────────────────────────────────────────

export type CetakType = 'siswa' | 'kelas' | 'semua'

interface Props {
  isOpen: boolean
  onClose: () => void
  type: CetakType
  siswaId?: string
  siswaNama?: string
  kelasList: { id: string; label: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTgl(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function getTahunPelajaran() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

function getTanggalHariIni() {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  @page { size: A4; margin: 20mm 25mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; margin: 0; }
  img.kop { width: 100%; display: block; margin-bottom: 6pt; }
  hr.thick { border: none; border-top: 2pt solid #000; margin: 4pt 0; }
  hr.thin { border: none; border-top: 0.75pt solid #000; margin: 3pt 0 8pt; }
  h2 { text-align: center; font-size: 13pt; font-weight: bold; margin: 6pt 0 2pt; text-transform: uppercase; letter-spacing: 0.5pt; }
  .sub-judul { text-align: center; font-size: 11pt; margin: 2pt 0; }
  .info-block { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20pt; margin: 8pt 0 10pt; }
  .info-row { display: flex; gap: 0; margin: 2pt 0; font-size: 10.5pt; }
  .info-label { min-width: 100pt; }
  .info-sep { margin: 0 6pt; }
  .section-title { font-size: 11pt; font-weight: bold; margin: 12pt 0 5pt; border-bottom: 1pt solid #000; padding-bottom: 3pt; text-transform: uppercase; letter-spacing: 0.3pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 10pt; }
  th { background: #d9d9d9; border: 0.75pt solid #333; padding: 4pt 5pt; text-align: center; font-weight: bold; font-size: 10pt; }
  td { border: 0.75pt solid #444; padding: 3pt 5pt; vertical-align: middle; }
  td.c { text-align: center; }
  .juz-row td { background: #e8f5e9; font-weight: bold; font-size: 10.5pt; }
  .total-row td { background: #f0f0f0; font-weight: bold; }
  .tt-section { margin-top: 28pt; display: flex; justify-content: flex-end; }
  .tt-box { text-align: center; min-width: 160pt; }
  .tt-space { height: 52pt; }
  .tt-name { border-top: 0.75pt solid #000; padding-top: 3pt; font-weight: bold; display: inline-block; min-width: 140pt; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

// ─── HTML Generators ──────────────────────────────────────────────────────────

function wrapPrintDoc(title: string, body: string, baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <img class="kop" src="${baseUrl}/kopsurat.png" alt="Kop Surat" />
  <hr class="thick">
  ${body}
  <script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>
</body>
</html>`
}

function generateLaporanSiswa(
  data: NonNullable<Awaited<ReturnType<typeof getDataLaporanSiswa>>>,
  opts: { tandaTangan: boolean; namaGuru: string },
  baseUrl: string
): string {
  const { siswa, progress, riwayat } = data

  // Rekap hafalan — grouped by juz, only surahs with hafalan
  const juzHafalan = JUZ_DATA
    .map(jd => ({ juz: jd.juz, surahs: jd.surahList.filter(s => (progress[s.nomor]?.length || 0) > 0) }))
    .filter(j => j.surahs.length > 0)

  const totalAyat = Object.values(progress).reduce((s, a) => s + a.length, 0)
  const totalSurah = Object.values(progress).filter(a => a.length > 0).length

  let no = 1
  let rekapRows = ''
  for (const jd of juzHafalan) {
    const totalJuz = jd.surahs.reduce((s, sr) => s + (progress[sr.nomor]?.length || 0), 0)
    rekapRows += `<tr class="juz-row">
      <td colspan="3" style="padding-left:8pt">Juz ${jd.juz}</td>
      <td class="c">${totalJuz} ayat</td>
      <td class="c">—</td>
    </tr>`
    for (const s of jd.surahs) {
      const hafal = progress[s.nomor]?.length || 0
      rekapRows += `<tr>
        <td class="c">${no++}</td>
        <td>${s.namaLatin}</td>
        <td class="c" style="font-size:11pt">${s.nama}</td>
        <td class="c">${hafal} / ${s.jumlahAyat}</td>
        <td class="c">${hafal === s.jumlahAyat ? '✓' : ''}</td>
      </tr>`
    }
  }
  rekapRows += `<tr class="total-row">
    <td colspan="3" class="c">TOTAL KESELURUHAN</td>
    <td class="c">${totalAyat} Ayat dari ${totalSurah} Surah</td>
    <td></td>
  </tr>`

  // Riwayat setoran — chronological (oldest first)
  const riwayatAsc = [...riwayat].reverse()
  let riwayatRows = ''
  if (riwayatAsc.length === 0) {
    riwayatRows = `<tr><td colspan="6" class="c" style="padding:10pt;color:#666">Belum ada riwayat setoran tercatat</td></tr>`
  } else {
    riwayatAsc.forEach((r, i) => {
      const ayatBaru: number[] = (() => { try { return JSON.parse(r.ayat_baru) } catch { return [] } })()
      const sr = SURAH_LIST.find(s => s.nomor === r.surah_nomor)
      riwayatRows += `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${formatTgl(r.created_at)}</td>
        <td>${sr?.namaLatin || '-'} <span style="font-size:11pt">(${sr?.nama || '-'})</span></td>
        <td class="c">${r.juz}</td>
        <td class="c">${ayatBaru.length}</td>
        <td>${r.guru_nama || '-'}</td>
      </tr>`
    })
  }

  const ttSection = opts.tandaTangan ? `
    <div class="tt-section">
      <div class="tt-box">
        <p style="margin:0 0 3pt">${getTanggalHariIni()}</p>
        <p style="margin:0 0 3pt">Guru Tahfidz,</p>
        <div class="tt-space"></div>
        <span class="tt-name">${opts.namaGuru || '(______________________)'}</span>
      </div>
    </div>` : ''

  const body = `
    <h2>Laporan Hafalan Al-Quran</h2>
    <p class="sub-judul">Tahun Pelajaran ${getTahunPelajaran()}</p>
    <hr class="thin">
    <div class="info-block">
      <div>
        <div class="info-row"><span class="info-label">Nama Siswa</span><span class="info-sep">:</span><span>${siswa.nama_lengkap}</span></div>
        <div class="info-row"><span class="info-label">NISN</span><span class="info-sep">:</span><span>${siswa.nisn || '-'}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Kelas</span><span class="info-sep">:</span><span>${siswa.tingkat}-${siswa.nomor_kelas} ${siswa.kelompok}</span></div>
        <div class="info-row"><span class="info-label">Tanggal Cetak</span><span class="info-sep">:</span><span>${getTanggalHariIni()}</span></div>
      </div>
    </div>

    <p class="section-title">Rekap Hafalan</p>
    <table>
      <thead><tr>
        <th style="width:28pt">No</th>
        <th>Nama Surah</th>
        <th style="width:65pt">Nama Arab</th>
        <th style="width:75pt">Hafalan</th>
        <th style="width:32pt">Hafal</th>
      </tr></thead>
      <tbody>${rekapRows}</tbody>
    </table>

    <p class="section-title">Riwayat Setoran (Kronologis)</p>
    <table>
      <thead><tr>
        <th style="width:24pt">No</th>
        <th style="width:95pt">Tanggal</th>
        <th>Surah</th>
        <th style="width:32pt">Juz</th>
        <th style="width:55pt">Jml Ayat</th>
        <th style="width:90pt">Guru</th>
      </tr></thead>
      <tbody>${riwayatRows}</tbody>
    </table>
    ${ttSection}`

  return wrapPrintDoc(`Laporan Hafalan - ${siswa.nama_lengkap}`, body, baseUrl)
}

function generateLaporanRingkasan(
  data: Awaited<ReturnType<typeof getDataLaporanKelas>>,
  opts: { tandaTangan: boolean; namaGuru: string; urutan: 'nama' | 'hafalan'; type: CetakType },
  baseUrl: string
): string {
  const { siswaList, kelas } = data

  const sorted = [...siswaList].sort((a, b) =>
    opts.urutan === 'hafalan'
      ? b.totalAyat - a.totalAyat
      : a.nama_lengkap.localeCompare(b.nama_lengkap, 'id')
  )

  const getJuzList = (progress: Record<number, number[]>) =>
    JUZ_DATA
      .filter(jd => jd.surahList.some(s => (progress[s.nomor]?.length || 0) > 0))
      .map(j => `Juz ${j.juz}`)
      .join(', ') || '-'

  const isSemua = opts.type === 'semua'

  let rows = ''
  if (sorted.length === 0) {
    rows = `<tr><td colspan="${isSemua ? 6 : 5}" class="c" style="padding:12pt;color:#666">Tidak ada data siswa</td></tr>`
  } else {
    sorted.forEach((s, i) => {
      rows += `<tr>
        <td class="c">${i + 1}</td>
        <td>${s.nama_lengkap}</td>
        <td class="c">${s.nisn || '-'}</td>
        ${isSemua ? `<td class="c">${s.tingkat}-${s.nomor_kelas} ${s.kelompok}</td>` : ''}
        <td class="c">${s.totalAyat}</td>
        <td>${getJuzList(s.progress)}</td>
      </tr>`
    })
  }

  const judulSub = kelas
    ? `Kelas ${kelas.tingkat}-${kelas.nomor_kelas} ${kelas.kelompok}`
    : 'Seluruh Siswa Program Tahfidz'

  const ttSection = opts.tandaTangan ? `
    <div class="tt-section">
      <div class="tt-box">
        <p style="margin:0 0 3pt">${getTanggalHariIni()}</p>
        <p style="margin:0 0 3pt">Guru Tahfidz,</p>
        <div class="tt-space"></div>
        <span class="tt-name">${opts.namaGuru || '(______________________)'}</span>
      </div>
    </div>` : ''

  const body = `
    <h2>Rekapitulasi Hafalan Al-Quran</h2>
    <p class="sub-judul">${judulSub}</p>
    <p class="sub-judul">Tahun Pelajaran ${getTahunPelajaran()}</p>
    <hr class="thin">
    <div style="margin:0 0 8pt">
      <div class="info-row"><span class="info-label">Tanggal Cetak</span><span class="info-sep">:</span><span>${getTanggalHariIni()}</span></div>
      <div class="info-row"><span class="info-label">Jumlah Siswa</span><span class="info-sep">:</span><span>${siswaList.length} Siswa</span></div>
      <div class="info-row"><span class="info-label">Urutan</span><span class="info-sep">:</span><span>${opts.urutan === 'hafalan' ? 'Berdasarkan Jumlah Hafalan Terbanyak' : 'Berdasarkan Nama (A–Z)'}</span></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:28pt">No</th>
        <th>Nama Siswa</th>
        <th style="width:80pt">NISN</th>
        ${isSemua ? `<th style="width:90pt">Kelas</th>` : ''}
        <th style="width:65pt">Total Ayat</th>
        <th>Juz yang Dihafalkan</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${ttSection}`

  return wrapPrintDoc(`Rekap Hafalan - ${judulSub}`, body, baseUrl)
}

// ─── Modal Component ──────────────────────────────────────────────────────────

export function CetakLaporanModal({ isOpen, onClose, type, siswaId, siswaNama, kelasList }: Props) {
  const [tandaTangan, setTandaTangan] = useState(true)
  const [namaGuru, setNamaGuru] = useState('')
  const [urutan, setUrutan] = useState<'nama' | 'hafalan'>('nama')
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const judulModal =
    type === 'siswa' ? `Laporan Siswa: ${siswaNama || ''}` :
    type === 'kelas' ? 'Laporan Per Kelas' :
    'Laporan Seluruh Siswa'

  const handleCetak = async () => {
    setIsLoading(true)
    setError('')
    try {
      const baseUrl = window.location.origin
      let html = ''

      if (type === 'siswa') {
        if (!siswaId) { setError('Pilih siswa terlebih dahulu.'); setIsLoading(false); return }
        const data = await getDataLaporanSiswa(siswaId)
        if (!data) { setError('Data siswa tidak ditemukan.'); setIsLoading(false); return }
        html = generateLaporanSiswa(data, { tandaTangan, namaGuru }, baseUrl)
      } else {
        const kelasId = type === 'kelas' ? (selectedKelasId || undefined) : undefined
        const data = await getDataLaporanKelas(kelasId)
        html = generateLaporanRingkasan(data, { tandaTangan, namaGuru, urutan, type }, baseUrl)
      }

      const pw = window.open('', '_blank', 'width=850,height=950')
      if (pw) {
        pw.document.open()
        pw.document.write(html)
        pw.document.close()
      }
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Terjadi kesalahan.')
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-emerald-600" />
            {judulModal}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pilih Kelas — hanya untuk type=kelas */}
          {type === 'kelas' && (
            <div className="space-y-1.5">
              <Label>Kelas</Label>
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {kelasList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedKelasId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Kosongkan untuk semua kelas tahfidz.</p>
              )}
            </div>
          )}

          {/* Urutan — untuk kelas & semua */}
          {type !== 'siswa' && (
            <div className="space-y-1.5">
              <Label>Urutan Siswa</Label>
              <Select value={urutan} onValueChange={(v) => setUrutan(v as 'nama' | 'hafalan')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nama">Nama (A–Z)</SelectItem>
                  <SelectItem value="hafalan">Hafalan Terbanyak (Peringkat)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tanda Tangan */}
          <div
            className="flex items-center justify-between rounded-lg border p-3 cursor-pointer"
            onClick={() => setTandaTangan(v => !v)}
          >
            <div>
              <p className="text-sm font-medium">Tanda Tangan Guru Tahfidz</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tampilkan kolom tanda tangan di laporan</p>
            </div>
            <Checkbox checked={tandaTangan} onCheckedChange={(v) => setTandaTangan(Boolean(v))} />
          </div>

          {tandaTangan && (
            <div className="space-y-1.5">
              <Label>Nama Guru Tahfidz</Label>
              <Input
                placeholder="Kosongkan untuk garis kosong"
                value={namaGuru}
                onChange={e => setNamaGuru(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Batal</Button>
          <Button
            onClick={handleCetak}
            disabled={isLoading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <><Printer className="h-4 w-4" /> Cetak</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
