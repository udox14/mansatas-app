'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Loader2, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importKelasMassal } from '../actions'

export function ImportModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleDownloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library Excel sedang dimuat, coba lagi sebentar.')
    const templateData = [
      { TINGKAT: 10, KELOMPOK: 'UMUM', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: 'Budi Santoso, S.Pd' },
      { TINGKAT: 11, KELOMPOK: 'MIPA-F', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: '' },
      { TINGKAT: 11, KELOMPOK: 'SOSHUM', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: '' },
      { TINGKAT: 12, KELOMPOK: 'KEAGAMAAN', NOMOR_KELAS: '1', KAPASITAS: 36, WALI_KELAS: '' }
    ]
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Kelas')
    XLSX.writeFile(wb, 'Template_Import_Kelas.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true); setMessage(null)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) throw new Error('Library pemroses Excel belum siap.')
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        const result = await importKelasMassal(jsonData)
        if (result.error) setMessage({ type: 'error', text: result.error })
        else if (result.success) { setMessage({ type: 'success', text: result.success }); setTimeout(() => setIsOpen(false), 2000) }
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
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-surface rounded-md px-3">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Import Excel
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Import Data Kelas Massal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {message && (
              <div className={`p-2.5 text-xs rounded-lg border flex items-start gap-2 ${message.type === 'error' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100'}`}>
                {message.type === 'error' ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                {message.text}
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-surface-2 border border-surface-2 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Belum punya format Excel?</p>
              <Button type="button" size="sm" variant="outline" onClick={handleDownloadTemplate} className="h-7 text-xs gap-1.5 rounded-md bg-surface ml-3 shrink-0">
                <Download className="h-3 w-3" /> Template
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800 space-y-1.5">
              <p className="font-semibold text-blue-700 mb-1">Format Kolom Excel:</p>
              {[
                ['TINGKAT', '10, 11, atau 12'],
                ['KELOMPOK', 'MIPA-F / MIPA-M / SOSHUM / KEAGAMAAN / UMUM'],
                ['NOMOR_KELAS', 'Contoh: 1, 2, atau A'],
                ['WALI_KELAS', 'Nama guru (opsional)'],
              ].map(([col, desc]) => (
                <div key={col} className="flex items-baseline gap-2">
                  <code className="bg-surface px-1.5 py-0.5 rounded border border-blue-100 text-blue-700 font-mono shrink-0">{col}</code>
                  <span className="text-blue-700/70">{desc}</span>
                </div>
              ))}
            </div>

            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="cursor-pointer file:cursor-pointer h-9 pt-1.5 text-xs rounded-md border-surface"
            />

            {isUploading && (
              <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses database...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}