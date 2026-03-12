'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSpreadsheet, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importSiswaMassal } from '../actions'

export function ImportModalSiswa() {
  const [isOpen, setIsOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [{
      NISN: '0051234567', NIK: '3206012345678901', 'NAMA LENGKAP': 'Ahmad Fulan', 'JENIS KELAMIN': 'L',
      'TEMPAT LAHIR': 'Tasikmalaya', 'TANGGAL LAHIR': '2008-05-15', AGAMA: 'Islam',
      'ALAMAT LENGKAP (JL/ KP.)': 'Kp. Pasir Muncang', RT: '01', RW: '02',
      'DESA/KELURAHAN': 'Sukasukur', KECAMATAN: 'Cisayong', 'KAB./KOTA': 'Tasikmalaya',
      'No. KK': '3206019876543210', 'NOMOR WHATSAPP': '081234567890',
      PESANTREN: 'Pesantren Sukahideng',
      'NAMA AYAH': 'Budi', 'PEKERJAAN AYAH': 'Wiraswasta',
      'NAMA IBU': 'Siti', 'PEKERJAAN IBU': 'Ibu Rumah Tangga',
      KELAS_TINGKAT: 10, KELAS_KELOMPOK: 'MIPA', KELAS_NOMOR: '1'
    }]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa_Lengkap')
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-slate-200 rounded-md px-2.5">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Import PPDB</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
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

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <p className="text-xs text-slate-600">Download format Excel PPDB terlebih dahulu:</p>
            <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="h-7 text-xs gap-1.5 rounded-md bg-white ml-3 shrink-0">
              <Download className="h-3 w-3" /> Template
            </Button>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 space-y-1">
            <p className="font-semibold text-emerald-700">Smart Upsert aktif</p>
            <p className="text-emerald-700/80">Jika siswa sudah ada di database, sistem akan <strong>melengkapi data yang kosong</strong> tanpa menduplikasi.</p>
          </div>

          <Input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            disabled={isImporting}
            className="cursor-pointer file:cursor-pointer h-9 pt-1.5 text-xs rounded-md border-slate-200"
          />

          {isImporting && (
            <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-100 animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Membaca data biodata...
            </div>
          )}

          {importLogs.length > 0 && (
            <div className="border border-rose-200 rounded-lg overflow-hidden">
              <div className="bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Log Gagal Import ({importLogs.length} baris)
              </div>
              <ScrollArea className="h-28 bg-white p-3">
                {importLogs.map((log, i) => (
                  <div key={i} className="text-[11px] font-mono text-rose-600 mb-1">{log}</div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}