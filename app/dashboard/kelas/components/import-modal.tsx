// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/components/import-modal.tsx
'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Loader2, Download } from 'lucide-react'
import { importKelasMassal } from '../actions'

export function ImportModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert('Library Excel sedang dimuat, mohon tunggu beberapa detik lalu coba lagi.')
      return
    }

    const templateData = [
      { TINGKAT: 10, KELOMPOK: 'MIPA', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: 'Budi Santoso, S.Pd' },
      { TINGKAT: 10, KELOMPOK: 'MIPA', NOMOR_KELAS: '2', KAPASITAS: 36, WALI_KELAS: '' },
      { TINGKAT: 11, KELOMPOK: 'SOSHUM', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: '' },
      { TINGKAT: 12, KELOMPOK: 'KEAGAMAAN', NOMOR_KELAS: 'A', KAPASITAS: 36, WALI_KELAS: '' }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Kelas")
    XLSX.writeFile(workbook, "Template_Import_Kelas_Lengkap.xlsx")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = event.target?.result
        const XLSX = (window as any).XLSX
        
        if (!XLSX) throw new Error('Library pemroses Excel belum siap. Silakan muat ulang halaman.')

        const workbook = XLSX.read(data, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const result = await importKelasMassal(jsonData)
        
        if (result.error) setMessage({ type: 'error', text: result.error })
        else if (result.success) {
          setMessage({ type: 'success', text: result.success })
          setTimeout(() => setIsOpen(false), 2000)
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Gagal memproses file Excel.' })
      } finally {
        setIsUploading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl h-11 px-5 shadow-sm">
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Import Data Kelas Massal</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-xl border bg-slate-50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-700">Belum punya format Excel?</div>
              <Button type="button" size="sm" variant="outline" onClick={handleDownloadTemplate} className="gap-2 bg-white rounded-lg">
                <Download className="h-4 w-4" /> Template
              </Button>
            </div>

            <div className="rounded-2xl bg-blue-50/80 border border-blue-100 p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2 text-blue-900">Format Kolom Excel:</p>
              <ul className="list-disc list-inside space-y-1.5 text-xs">
                <li><strong className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-blue-700">TINGKAT</strong> (10, 11, atau 12)</li>
                <li><strong className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-blue-700">KELOMPOK</strong> (MIPA / SOSHUM / KEAGAMAAN / UMUM)</li>
                <li><strong className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-blue-700">NOMOR_KELAS</strong> (Contoh: 1, 2, atau A)</li>
                <li><strong className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-blue-700">WALI_KELAS</strong> (Opsional. Tulis nama guru sesuai akunnya di aplikasi)</li>
              </ul>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer file:cursor-pointer h-12 pt-2.5 rounded-xl border-slate-300 focus:border-emerald-500"
              />
            </div>

            {isUploading && (
              <div className="flex items-center justify-center gap-2 p-3 text-sm text-emerald-600 bg-emerald-50 rounded-xl font-bold animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" /> Sedang memproses database...
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {message.text}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}