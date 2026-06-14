'use client'

import { useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Loader2, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importEkskulMassal } from '../actions'

export function ImportEkskulModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library Excel sedang dimuat, coba lagi sebentar.')
    const data = [
      { NAMA: 'Pramuka', MODE_NILAI: 'huruf', DESKRIPSI: 'Wajib kelas 10' },
      { NAMA: 'Futsal', MODE_NILAI: 'angka', DESKRIPSI: '' },
      { NAMA: 'PMR', MODE_NILAI: 'huruf', DESKRIPSI: '' },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Ekskul')
    XLSX.writeFile(wb, 'Template_Import_Ekstrakurikuler.xlsx')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMessage(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) throw new Error('Library pemroses Excel belum siap.')
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws)
        const res = await importEkskulMassal(json)
        if (res.error) setMessage({ type: 'error', text: res.error })
        else {
          setMessage({ type: 'success', text: res.success || 'Berhasil.' })
          router.refresh()
          setTimeout(() => onClose(), 1600)
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Gagal memproses file Excel.' })
      } finally {
        setUploading(false)
        e.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Import Ekstrakurikuler
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {message && (
              <div className={`p-2.5 text-xs rounded-lg border flex items-start gap-2 ${message.type === 'error' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100'}`}>
                {message.type === 'error' ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                {message.text}
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border rounded-lg">
              <p className="text-xs text-slate-600 dark:text-slate-400">Belum punya format Excel?</p>
              <Button type="button" size="sm" variant="outline" onClick={downloadTemplate} className="h-7 text-xs gap-1.5 ml-3 shrink-0">
                <Download className="h-3 w-3" /> Template
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3 rounded-lg text-xs space-y-1.5">
              <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Format Kolom:</p>
              {[
                ['NAMA', 'Nama ekskul (wajib)'],
                ['MODE_NILAI', 'angka / huruf (default angka)'],
                ['DESKRIPSI', 'Keterangan (opsional)'],
              ].map(([col, desc]) => (
                <div key={col} className="flex items-baseline gap-2">
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-400 font-mono shrink-0">{col}</code>
                  <span className="text-blue-700/70 dark:text-blue-400/70">{desc}</span>
                </div>
              ))}
            </div>

            <Input
              type="file" accept=".xlsx, .xls" onChange={handleUpload} disabled={uploading}
              className="cursor-pointer file:cursor-pointer h-9 pt-1.5 text-xs rounded-md"
            />

            {uploading && (
              <div className="flex items-center justify-center gap-2 p-2.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
