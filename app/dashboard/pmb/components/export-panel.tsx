'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, Archive, Download, Loader2 } from 'lucide-react'
import type { Pendaftar } from './pmb-client'
import { getExportData } from '../actions'

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
  { key: 'alamat_lengkap', label: 'Alamat' },
  { key: 'pilihan_pesantren', label: 'Pilihan Pesantren' },
  { key: 'status_verifikasi', label: 'Status Verifikasi' },
  { key: 'status_kelulusan', label: 'Status Kelulusan' },
  { key: 'tanggal_tes', label: 'Tanggal Tes' },
  { key: 'sesi_tes', label: 'Sesi Tes' },
  { key: 'ruang_tes', label: 'Ruang Tes' },
  { key: 'daftar_ulang_status', label: 'Daftar Ulang' },
  { key: 'created_at', label: 'Tgl Daftar' },
]

export function ExportPanel({ pendaftar, pengaturan, onFlash }: {
  pendaftar: Pendaftar[]
  pengaturan: Record<string, string>
  onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [cols, setCols] = useState<Set<string>>(new Set(EXCEL_COLS.map((c) => c.key)))
  const [exporting, setExporting] = useState(false)
  const [zipping, setZipping] = useState(false)

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
      const res = await getExportData()
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
      const tahun = pengaturan.tahun_pmb || 'PMB'
      XLSX.utils.book_append_sheet(wb, ws, `Data Pendaftar ${tahun}`)
      XLSX.writeFile(wb, `Data_Pendaftar_PMB_${tahun.replace('/', '-')}.xlsx`)
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
      const tahun = (pengaturan.tahun_pmb || 'PMB').replace('/', '-')
      const res = await fetch(`/api/pmb/download-berkas?tahun=${encodeURIComponent(tahun)}`)
      if (!res.ok) {
        const msg = await res.text()
        onFlash({ error: msg || 'Gagal membuat ZIP' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Berkas_PMB_${tahun}.zip`
      a.click()
      URL.revokeObjectURL(url)
      onFlash({ success: 'ZIP berhasil diunduh' })
    } catch (e) {
      onFlash({ error: 'Gagal membuat ZIP' })
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Export Excel ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Export Excel
          </CardTitle>
          <CardDescription>Pilih kolom yang ingin disertakan dalam file Excel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
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
          <Button className="w-full" onClick={exportExcel} disabled={exporting || !cols.size}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download Excel ({pendaftar.length} baris)
          </Button>
        </CardContent>
      </Card>

      {/* ── Export ZIP Berkas ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-5 w-5 text-blue-600" />
            Export ZIP Berkas
          </CardTitle>
          <CardDescription>
            Unduh arsip ZIP berisi file asli (foto, KK, akta, dll.) dari Cloudflare R2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
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
          <Button variant="outline" className="w-full" onClick={exportZip} disabled={zipping}>
            {zipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            Download ZIP
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
