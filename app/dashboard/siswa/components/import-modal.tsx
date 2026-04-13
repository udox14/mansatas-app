'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSpreadsheet, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importSiswaMassal } from '../actions'

export function ImportModalSiswa() {
  const [isOpen, setIsOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [xlsxReady, setXlsxReady] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library XLSX belum siap, coba beberapa detik lagi.')

    const data = [{
      'No Pendaftaran': '2024001',
      'Tanggal Daftar': '2024-06-01',
      'Tahun': '2024',
      'NISN': '0051234567',
      'Nama Peserta': 'Ahmad Fulan',
      'JK': 'L',
      'Tempat Lahir': 'Tasikmalaya',
      'Tanggal Lahir': '2008-05-15',
      'Agama': 'Islam',
      'NIK': '3206012345678901',
      'No KK': '3206019876543210',
      'No Registrasi Akta Lahir': '',
      'Kewarganegaraan': 'WNI',
      'Berkebutuhan Khusus': '',
      'Alamat': 'Kp. Pasir Muncang',
      'RT': '01',
      'RW': '02',
      'Dusun': 'Pasir Muncang',
      'Kelurahan': 'Sukasukur',
      'Kecamatan': 'Cisayong',
      'Kabupaten/Kota': 'Tasikmalaya',
      'Provinsi': 'Jawa Barat',
      'Kode Pos': '46154',
      'Tempat Tinggal': 'Bersama Orang Tua',
      'Moda Transportasi': 'Angkutan Umum',
      'No KKS': '',
      'Anak Ke': '1',
      'Penerima KPS/PKH': 'Tidak',
      'No KPS/PKH': '',
      'Penerima KIP': 'Tidak',
      'No KIP': '',
      'Nama Tertera Di KIP': '',
      'Terima Fisik Kartu KIP': '',
      'Hobi': 'Membaca',
      'Nama Ayah': 'Budi Santoso',
      'NIK Ayah': '',
      'Tempat Lahir Ayah': 'Tasikmalaya',
      'Tanggal Lahir Ayah': '1975-03-10',
      'Pendidikan Ayah': 'SLTA/Sederajat',
      'Pekerjaan Ayah': 'Wiraswasta',
      'Penghasilan Bulanan Ayah': '2000000',
      'Berkebutuhan Khusus Ayah': '',
      'No Hp Ayah': '081234567890',
      'Nama Ibu': 'Siti Aminah',
      'NIK Ibu': '',
      'Tempat Lahir Ibu': 'Garut',
      'Tanggal Lahir Ibu': '1978-07-20',
      'Pendidikan Ibu': 'SLTA/Sederajat',
      'Pekerjaan Ibu': 'Ibu Rumah Tangga',
      'Penghasilan Bulanan Ibu': '0',
      'Berkebutuhan Khusus Ibu': '',
      'No Hp Ibu': '',
      'Nama Wali': '',
      'NIK Wali': '',
      'Tempat Lahir Wali': '',
      'Tanggal Lahir Wali': '',
      'Pendidikan Wali': '',
      'Pekerjaan Wali': '',
      'Penghasilan Bulanan Wali': '',
      'No Hp Wali': '',
      'No Telepon Rumah': '',
      'Nomor HP': '081234567890',
      'Email': '',
      'Tinggi Badan': '155',
      'Berat Badan': '45',
      'Lingkar Kepala': '',
      'Jumlah Saudara Kandung': '2',
      'Asal Sekolah': 'SDN Sukasukur',
      'Akreditasi': 'B',
      'No UN': '',
      'No Seri Ijazah': '',
      'No Seri SKHU': '',
      'Tahun Lulus': '2024',
      'Sekolah Pilihan 2': '',
      'Jurusan Pilihan 1': 'KEAGAMAAN',
      'Jurusan Pilihan 2': '',
      'Latitude': '',
      'Longitude': '',
      'Radius': '',
      'Rentang Jarak': '',
      'Waktu Tempuh': '',
      'Jalur': 'Reguler',
      'Nilai Rapor': '',
      'Nilai US': '',
      'Nilai UN': '',
      'Nilai Rerata rapor semester': '',
      'Jumlah Nilai': '',
      'Nilai Jarak': '',
      'Nilai Prestasi': '',
      'Nilai Tes': '',
      'Nilai Wawancara': '',
      'Nilai Akhir': '',
      'Usia': '',
      'Status': 'aktif',
      'Status Hasil': 'Diterima',
      'Status Daftar Ulang': 'Sudah',
      'Catatan': '',
      'Keterangan': '',
      // Kolom khusus aplikasi (bukan bagian PPDB)
      'Pesantren': 'Non-Pesantren',
      'Asrama': '',
      'Kamar': '',
      'Tingkat Kelas': '7',
      'Kelompok Kelas': 'KEAGAMAAN',
      'Nomor Kelas': '1',
    }]

    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template_PPDB')
    XLSX.writeFile(wb, 'Template_Import_Siswa_PPDB.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true); setImportLogs([]); setPesan(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (!jsonData || jsonData.length === 0) {
          setPesan({ tipe: 'error', teks: 'File kosong atau format tidak dikenali.' })
          setIsImporting(false)
          e.target.value = ''
          return
        }

        const result = await importSiswaMassal(jsonData) as any
        if (result.error) setPesan({ tipe: 'error', teks: result.error })
        else setPesan({ tipe: 'sukses', teks: result.success })
        if (result.logs?.length > 0) setImportLogs(result.logs)
      } catch {
        setPesan({ tipe: 'error', teks: 'Gagal membaca file Excel.' })
      } finally {
        setIsImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <Script
        src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"
        strategy="lazyOnload"
        onLoad={() => setXlsxReady(true)}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-surface rounded-md px-2.5">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Import PPDB</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Import Biodata Siswa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {pesan && (
              <div className={`p-2.5 text-xs rounded-lg border flex items-start gap-2 ${pesan.tipe === 'error' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                {pesan.tipe === 'error' ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                {pesan.teks}
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-surface-2 border border-surface-2 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-300">Download format Excel PPDB terlebih dahulu:</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={!xlsxReady}
                className="h-7 text-xs gap-1.5 rounded-md bg-surface ml-3 shrink-0"
              >
                {xlsxReady
                  ? <><Download className="h-3 w-3" /> Template</>
                  : <><Loader2 className="h-3 w-3 animate-spin" /> Memuat...</>
                }
              </Button>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 space-y-1">
              <p className="font-semibold text-emerald-700">Smart Upsert aktif</p>
              <p className="text-emerald-700/80">Jika siswa sudah ada (cocok NISN atau nama), sistem akan <strong>melengkapi data</strong> tanpa duplikasi.</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800">
              <p className="font-semibold text-blue-700 mb-1">Tips import dari hasil export PPDB:</p>
              <p className="text-blue-700/80">File export PPDB bisa langsung digunakan. Kolom yang kosong diabaikan otomatis.</p>
            </div>

            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="cursor-pointer file:cursor-pointer h-9 pt-1.5 text-xs rounded-md border-surface"
            />

            {isImporting && (
              <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses data biodata...
              </div>
            )}

            {importLogs.length > 0 && (
              <div className="border border-rose-200 rounded-lg overflow-hidden">
                <div className="bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Log Gagal Import ({importLogs.length} baris)
                </div>
                <ScrollArea className="h-28 bg-surface p-3">
                  {importLogs.map((log, i) => (
                    <div key={i} className="text-[11px] font-mono text-rose-600 mb-1">{log}</div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}