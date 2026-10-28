'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, Archive, Download, Loader2, Printer } from 'lucide-react'
import type { Pendaftar } from './pmb-client'
import { getExportData } from '../actions'
import { downloadBlobFile } from '@/lib/pdf/download'
import { pmbRegistrationStage } from '@/lib/pmb-contract'

const EXCEL_COLS = [
  { key: 'no_pendaftaran', label: 'No. Pendaftaran' },
  { key: 'nama_lengkap', label: 'Nama Lengkap' },
  { key: 'nisn', label: 'NISN' },
  { key: 'nik', label: 'NIK' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
  { key: 'tempat_lahir', label: 'Tempat Lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
  { key: 'jalur', label: 'Jalur' },
  { key: 'asal_sekolah', label: 'Asal Sekolah' },
  { key: 'npsn_sekolah', label: 'NPSN Sekolah' },
  { key: 'status_sekolah', label: 'Status Sekolah' },
  { key: 'no_telepon_ortu', label: 'No. Telp Orang Tua' },
  { key: 'nama_ayah', label: 'Nama Ayah' },
  { key: 'nama_ibu', label: 'Nama Ibu' },
  { key: 'agama', label: 'Agama' },
  { key: 'provinsi', label: 'Provinsi' },
  { key: 'kabupaten_kota', label: 'Kab/Kota' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'desa_kelurahan', label: 'Desa/Kelurahan' },
  { key: 'rt', label: 'RT' }, { key: 'rw', label: 'RW' }, { key: 'kode_pos', label: 'Kode Pos' },
  { key: 'alamat_lengkap', label: 'Alamat' },
  { key: 'pilihan_pesantren', label: 'Pilihan Pesantren' },
  { key: 'status_verifikasi', label: 'Status Verifikasi' },
  { key: 'status_kelulusan', label: 'Status Kelulusan' },
  { key: 'tanggal_tes', label: 'Tanggal Tes' },
  { key: 'sesi_tes', label: 'Sesi Tes' },
  { key: 'ruang_tes', label: 'Ruang Tes' },
  { key: 'daftar_ulang_status', label: 'Daftar Ulang' },
  { key: 'konfirmasi_daftar_ulang', label: 'Konfirmasi Daftar Ulang' },
  { key: 'daftar_ulang_hardcopy_status', label: 'Hardcopy Daftar Ulang' },
  { key: 'dspt_target', label: 'Target DSPT' }, { key: 'dspt_dibayar', label: 'DSPT Dibayar' },
  { key: 'dspt_diskon', label: 'DSPT Diskon' }, { key: 'dspt_status', label: 'Status DSPT' },
  { key: 'nilai_rapor_s1', label: 'Nilai Rapor S1' }, { key: 'nilai_rapor_s2', label: 'Nilai Rapor S2' },
  { key: 'nilai_rapor_s3', label: 'Nilai Rapor S3' }, { key: 'nilai_rapor_s4', label: 'Nilai Rapor S4' },
  { key: 'nilai_rapor_s5', label: 'Nilai Rapor S5' }, { key: 'avg_nilai_rapor', label: 'Rata-rata Rapor' },
  { key: 'created_at', label: 'Tgl Daftar' },
]

export function ExportPanel({ pendaftar, selectedIds, pengaturan, onFlash }: {
  pendaftar: Pendaftar[]
  selectedIds: string[]
  pengaturan: Record<string, string>
  onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [cols, setCols] = useState<Set<string>>(new Set(EXCEL_COLS.map((c) => c.key)))
  const [exporting, setExporting] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [printing, setPrinting] = useState(false)
  const years = Array.from(new Set(pendaftar.map(item => item.tahun_ajaran).filter(Boolean)))
  const [tahun, setTahun] = useState(pengaturan.tahun_pmb || years[0] || 'all')
  const [jalur, setJalur] = useState('all')
  const [gender, setGender] = useState('all')
  const [verifikasi, setVerifikasi] = useState('all')
  const [kelulusan, setKelulusan] = useState('all')
  const [konversi, setKonversi] = useState('all')
  const [daftarUlang, setDaftarUlang] = useState('all')
  const [dspt, setDspt] = useState('all')
  const [hardcopy, setHardcopy] = useState('all')
  const [jadwalStatus, setJadwalStatus] = useState('all')
  const filters = { tahun, jalur, gender, verifikasi, kelulusan, konversi, daftarUlang, dspt, hardcopy, jadwal: jadwalStatus, ids: selectedIds.length ? selectedIds : undefined }

  function toggleCol(key: string) {
    setCols((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleAll() {
    setCols((prev) => prev.size === EXCEL_COLS.length ? new Set() : new Set(EXCEL_COLS.map((c) => c.key)))
  }

  async function exportExcel() {
    if (!cols.size) { onFlash({ error: 'Pilih minimal 1 kolom' }); return }
    setExporting(true)
    try {
      const res = await getExportData(filters)
      if (res.error || !res.data.length) { onFlash({ error: res.error || 'Tidak ada data' }); return }
      const XLSX = await import('xlsx')
      const selectedCols = EXCEL_COLS.filter((c) => cols.has(c.key))
      const rows = res.data.map((p: any) => {
        const row: Record<string, any> = {}
        selectedCols.forEach((c) => {
          let val = p[c.key]
          if (c.key === 'status_verifikasi') {
            val = val === 1 ? 'Terverifikasi' : val === 0 ? 'Ditolak' : 'Menunggu'
          }
          row[c.label] = val ?? ''
        })
        return row
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      // Auto-width
      const colWidths = selectedCols.map((c) => ({ wch: Math.max(c.label.length, 14) }))
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      const tahunLabel = tahun === 'all' ? 'Semua-Tahun' : tahun
      XLSX.utils.book_append_sheet(wb, ws, `Data Pendaftar ${tahunLabel}`)
      XLSX.writeFile(wb, `Data_Pendaftar_PMB_${tahunLabel.replace('/', '-')}.xlsx`)
      onFlash({ success: `${rows.length} baris diekspor ke Excel` })
    } catch (e) {
      onFlash({ error: 'Gagal ekspor Excel' })
    } finally {
      setExporting(false)
    }
  }

  async function exportZip() {
    setZipping(true)
    try {
      const matchingIds = selectedIds.length ? selectedIds : pendaftar.filter(item =>
        (tahun === 'all' || item.tahun_ajaran === tahun) && (jalur === 'all' || item.jalur === jalur) &&
        (gender === 'all' || item.jenis_kelamin === gender) &&
        (verifikasi === 'all' || (verifikasi === 'pending' ? item.status_verifikasi === null : item.status_verifikasi === (verifikasi === 'ok' ? 1 : 0))) &&
        (kelulusan === 'all' || item.status_kelulusan === kelulusan) &&
        (konversi === 'all' || (konversi === 'sudah') === Boolean(item.siswa_id)) &&
        (daftarUlang === 'all' || pmbRegistrationStage(item).toLowerCase() === daftarUlang) &&
        (dspt === 'all' || (dspt === 'null' ? !item.dspt_id : item.dspt_status === dspt)) &&
        (hardcopy === 'all' || (hardcopy === 'sudah') === (item.daftar_ulang_hardcopy_status === 'DITERIMA')) &&
        (jadwalStatus === 'all' || (jadwalStatus === 'sudah') === Boolean(item.tanggal_tes))
      ).map(item => item.id)
      if (!matchingIds.length) { onFlash({ error: 'Tidak ada pendaftar sesuai filter.' }); return }
      const chunks = Array.from({ length: Math.ceil(matchingIds.length / 250) }, (_, index) => matchingIds.slice(index * 250, (index + 1) * 250))
      const tahunLabel = (tahun === 'all' ? 'Pilihan' : tahun).replace('/', '-')
      for (let index = 0; index < chunks.length; index++) {
        const res = await fetch(`/api/pmb/download-berkas?tahun=${encodeURIComponent(tahunLabel)}&ids=${encodeURIComponent(chunks[index].join(','))}`)
        if (!res.ok) { onFlash({ error: await res.text() || 'Gagal membuat ZIP' }); return }
        await downloadBlobFile(await res.blob(), `Berkas_PMB_${tahunLabel}_bagian-${index + 1}.zip`)
      }
      onFlash({ success: `${chunks.length} arsip ZIP berhasil diunduh` })
    } catch (e) {
      onFlash({ error: 'Gagal membuat ZIP' })
    } finally {
      setZipping(false)
    }
  }

  async function printPdf(type: 'kartu' | 'prestasi') {
    const matched = await getExportData(filters)
    if (matched.error) { onFlash({ error: matched.error }); return }
    const ids = matched.data.map((item: any) => item.id)
    if (!ids.length || ids.length > 250) { onFlash({ error: 'Pilih atau filter maksimal 250 pendaftar untuk satu PDF.' }); return }
    setPrinting(true)
    try {
      const response = await fetch(`/api/pmb/print?type=${type}&ids=${encodeURIComponent(ids.join(','))}`)
      if (!response.ok) { onFlash({ error: await response.text() }); return }
      await downloadBlobFile(await response.blob(), `PMB_${type}.pdf`)
      onFlash({ success: 'PDF berhasil dibuat.' })
    } finally { setPrinting(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800"><CardContent className="pt-4"><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Filter label="Tahun" value={tahun} set={setTahun} options={[['all','Semua Tahun'], ...years.map(value => [value,value] as [string,string])]} />
        <Filter label="Jalur" value={jalur} set={setJalur} options={[['all','Semua'],['REGULER','Reguler'],['PRESTASI','Prestasi']]} />
        <Filter label="Gender" value={gender} set={setGender} options={[['all','Semua'],['LAKI_LAKI','Laki-laki'],['PEREMPUAN','Perempuan']]} />
        <Filter label="Verifikasi" value={verifikasi} set={setVerifikasi} options={[['all','Semua'],['pending','Menunggu'],['ok','Terverifikasi'],['tolak','Ditolak']]} />
        <Filter label="Kelulusan" value={kelulusan} set={setKelulusan} options={[['all','Semua'],['PENDING','Pending'],['DITERIMA','Diterima'],['TIDAK DITERIMA','Tidak Diterima']]} />
        <Filter label="Konversi" value={konversi} set={setKonversi} options={[['all','Semua'],['sudah','Sudah jadi siswa'],['belum','Belum']]} />
        <Filter label="Daftar Ulang" value={daftarUlang} set={setDaftarUlang} options={[['all','Semua'],['belum_konfirmasi','Belum konfirmasi'],['menunggu_konversi','Menunggu konversi'],['menunggu_kasir','Menunggu kasir'],['selesai','Selesai']]} />
        <Filter label="DSPT" value={dspt} set={setDspt} options={[['all','Semua'],['null','Belum Diinput'],['belum_bayar','Belum Bayar'],['nyicil','Nyicil'],['lunas','Lunas']]} />
        <Filter label="Hardcopy" value={hardcopy} set={setHardcopy} options={[['all','Semua'],['sudah','Sudah diterima'],['belum','Belum']]} />
        <Filter label="Jadwal" value={jadwalStatus} set={setJadwalStatus} options={[['all','Semua'],['sudah','Sudah terjadwal'],['belum','Belum']]} />
      </div>{selectedIds.length > 0 && <p className="mt-2 text-xs text-blue-600">Export dibatasi ke {selectedIds.length} pendaftar terpilih.</p>}</CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Export Excel ── */}
      <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            Export Excel
          </CardTitle>
          <CardDescription>Pilih kolom yang ingin disertakan dalam file Excel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
            <Checkbox id="all-cols" checked={cols.size === EXCEL_COLS.length} onCheckedChange={toggleAll} />
            <Label htmlFor="all-cols" className="text-sm font-semibold cursor-pointer">Pilih Semua ({EXCEL_COLS.length} kolom)</Label>
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {EXCEL_COLS.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5">
                <Checkbox id={`col-${c.key}`} checked={cols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                <Label htmlFor={`col-${c.key}`} className="text-xs cursor-pointer leading-tight">{c.label}</Label>
              </div>
            ))}
          </div>
          <Button className="w-full rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={exportExcel} disabled={exporting || !cols.size}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download Excel ({pendaftar.length} baris)
          </Button>
        </CardContent>
      </Card>

      {/* ── Export ZIP Berkas ── */}
      <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            Export ZIP Berkas
          </CardTitle>
          <CardDescription>
            Unduh arsip ZIP berisi file asli (foto, KK, akta, dll.) dari Cloudflare R2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-semibold mb-1">Isi ZIP:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Folder per pendaftar: <code>{'{no_pendaftaran}_{nama}/'}</code></li>
              <li>File asli: foto, kk, akta, ktp_ortu, kelakuan_baik, rapor, sertifikat</li>
            </ul>
            <p className="text-xs mt-2 opacity-70">
              Proses download mungkin memerlukan waktu beberapa menit tergantung jumlah berkas.
            </p>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Total pendaftar</span><span className="font-semibold">{pendaftar.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Ada foto</span><span className="font-semibold">{pendaftar.filter((p: any) => (p as any).foto_url).length}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full rounded-lg" onClick={exportZip} disabled={zipping}>
            {zipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            Download ZIP
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-slate-200 shadow-sm dark:border-slate-800 md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Printer className="h-5 w-5 text-emerald-700 dark:text-emerald-400"/>Cetak Massal PDF</CardTitle><CardDescription>Gunakan data terpilih; jika tidak ada, gunakan filter tahun dan jalur.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button className="rounded-lg" disabled={printing} onClick={() => printPdf('kartu')}><Printer className="mr-2 h-4 w-4"/>Kartu Ujian</Button><Button className="rounded-lg" disabled={printing} variant="outline" onClick={() => printPdf('prestasi')}><Printer className="mr-2 h-4 w-4"/>Form Verifikasi Prestasi</Button></CardContent></Card>
    </div></div>
  )
}

function Filter({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: [string,string][] }) {
  return <label className="space-y-1 text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">{label}</span><select className="h-9 w-full rounded-lg border border-slate-200 bg-background px-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700" value={value} onChange={event => set(event.target.value)}>{options.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}
