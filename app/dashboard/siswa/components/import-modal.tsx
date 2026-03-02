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
  const [pesan, setPesan] = useState<{tipe: 'sukses'|'error', teks: string} | null>(null)

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NISN: '0051234567', NAMA_LENGKAP: 'Ahmad Fulan', NIS_LOKAL: '1001', JK: 'L', TEMPAT_TINGGAL: 'Pesantren Sukahideng', KELAS_TINGKAT: 10, KELAS_KELOMPOK: 'MIPA', KELAS_NOMOR: '1' },
      { NISN: '0051234568', NAMA_LENGKAP: 'Siti Aminah', NIS_LOKAL: '1002', JK: 'P', TEMPAT_TINGGAL: 'Non-Pesantren', KELAS_TINGKAT: 11, KELAS_KELOMPOK: 'SOSHUM', KELAS_NOMOR: '2' }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data_Siswa")
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx")
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
        
        if (result.logs && result.logs.length > 0) setImportLogs(result.logs)
      } catch (err: any) {
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
        <Button variant="outline" className="gap-2 h-11 px-5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all flex-1 sm:flex-none">
          <FileSpreadsheet className="h-4 w-4" /> Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl rounded-2xl">
        <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">Import Data Siswa Massal</DialogTitle></DialogHeader>
        <div className="space-y-5 py-2">
          {pesan && (
            <div className={`p-3 text-sm font-medium rounded-xl border flex items-start gap-2 ${pesan.tipe === 'error' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
              {pesan.tipe === 'error' ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0"/> : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0"/>}
              {pesan.teks}
            </div>
          )}

          <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-sm font-medium text-slate-600">Gunakan format template Excel resmi:</p>
            <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="gap-2 rounded-lg bg-white border-slate-200 hover:bg-slate-100"><Download className="h-4 w-4"/> Template</Button>
          </div>
          
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-sm space-y-2 text-emerald-800">
            <p className="font-bold text-emerald-700">Kolom Wajib:</p>
            <p className="font-mono text-xs">NISN, NAMA_LENGKAP</p>
            <p className="font-bold text-emerald-700 mt-2">Kolom Opsional (Otomatis Masuk Kelas):</p>
            <p className="font-mono text-xs">KELAS_TINGKAT (10/11/12), KELAS_KELOMPOK (MIPA/dll), KELAS_NOMOR (1/2)</p>
          </div>

          <div className="relative group">
            <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isImporting} className="cursor-pointer file:cursor-pointer h-12 pt-2.5 rounded-xl border-slate-300 focus:border-emerald-500" />
          </div>
          
          {isImporting && <div className="flex items-center justify-center p-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 animate-pulse"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Memproses ribuan data siswa...</div>}
          
          {importLogs.length > 0 && (
            <div className="mt-4 border border-rose-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Log Gagal Import:</div>
              <ScrollArea className="h-32 bg-white p-4 text-xs font-mono text-rose-600 leading-relaxed">
                {importLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}