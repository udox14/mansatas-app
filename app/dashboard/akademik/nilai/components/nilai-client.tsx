// app/dashboard/akademik/nilai/components/nilai-client.tsx
'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileSpreadsheet, Loader2, AlertCircle, Upload, Trash2, CheckCircle2, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { importNilaiDariExcel, resetNilaiKolom } from '../actions'
import { SEMESTER_MAP, SEMESTER_KEYS } from '../constants'
import { useRouter } from 'next/navigation'

export function NilaiClient() {
  const router = useRouter()
  const [isImporting, setIsImporting] = useState(false)
  const [targetImport, setTargetImport] = useState('nilai_smt1')
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; fileName: string } | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [resetTarget, setResetTarget] = useState('')

  // ---------- UPLOAD HANDLER (preserved from MANSATAS) ----------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsImporting(true)
    setImportLogs([])
    setSuccessMessage('')
    setImportProgress({ current: 0, total: files.length, fileName: 'Menyiapkan...' })

    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert('Library pemroses Excel sedang dimuat. Silakan tunggu beberapa saat lagi.')
      setIsImporting(false)
      setImportProgress(null)
      return
    }

    let allLogs: string[] = []
    let totalSuccess = 0

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]
      setImportProgress({ current: fileIndex + 1, total: files.length, fileName: file.name })

      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve(event.target?.result)
          reader.onerror = (err) => reject(err)
          reader.readAsBinaryString(file)
        })

        const workbook = XLSX.read(data, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]

        // Deteksi header NISN otomatis (support multi-row header RDM)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        let headerRowIndex = -1
        let nisnColIndex = -1

        for (let i = 0; i < rawData.length; i++) {
          if (Array.isArray(rawData[i])) {
            for (let j = 0; j < rawData[i].length; j++) {
              const cell = rawData[i][j]
              if (typeof cell === 'string' && cell.toUpperCase().trim() === 'NISN') {
                headerRowIndex = i
                nisnColIndex = j
                break
              }
            }
            if (headerRowIndex !== -1) break
          }
        }

        if (headerRowIndex === -1) {
          allLogs.push(`[${file.name}] Gagal: Kolom "NISN" tidak terdeteksi.`)
          continue
        }

        // Deteksi two-row header (umum di RDM)
        let isTwoRowHeader = false
        if (headerRowIndex + 1 < rawData.length) {
          const nextRow = rawData[headerRowIndex + 1]
          const nisnCellBelow = nextRow[nisnColIndex]
          if (nisnCellBelow === undefined || nisnCellBelow === null || String(nisnCellBelow).trim() === '') {
            isTwoRowHeader = true
          }
        }

        let headers: string[] = []
        const row1 = rawData[headerRowIndex] || []
        const row2 = isTwoRowHeader ? (rawData[headerRowIndex + 1] || []) : []
        const maxCols = Math.max(row1.length, row2.length)

        for (let col = 0; col < maxCols; col++) {
          let val1 = row1[col] ? String(row1[col]).trim() : ''
          let val2 = isTwoRowHeader && row2[col] ? String(row2[col]).trim() : ''
          let finalHeader = val2 || val1 || `KOLOM_${col}`
          finalHeader = finalHeader.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim()
          headers.push(finalHeader)
        }

        const dataStartIndex = isTwoRowHeader ? headerRowIndex + 2 : headerRowIndex + 1
        let jsonData: any[] = []

        for (let i = dataStartIndex; i < rawData.length; i++) {
          const rowData = rawData[i]
          if (!rowData || rowData.length === 0) continue
          if (rowData[nisnColIndex] === undefined || rowData[nisnColIndex] === null || String(rowData[nisnColIndex]).trim() === '') continue

          let obj: any = {}
          for (let col = 0; col < headers.length; col++) {
            if (rowData[col] !== undefined && rowData[col] !== null && String(rowData[col]).trim() !== '') {
              obj[headers[col]] = rowData[col]
            }
          }
          jsonData.push(obj)
        }

        const result = await importNilaiDariExcel(jsonData, targetImport)
        if (result.error) {
          allLogs.push(`[${file.name}] Error: ${result.error}`)
        } else {
          totalSuccess++
          if (result.logs && result.logs.length > 0) {
            const enrichedLogs = result.logs.map(log => {
              const match = log.match(/NISN:\s*(\d+)/i) || log.match(/NISN\s+(\d+)/i) || log.match(/NISN\s*(\d+)/i)
              if (match && match[1]) {
                const targetNisn = match[1]
                const rowData = jsonData.find(r => {
                  const k = Object.keys(r).find(key => key.toUpperCase().trim() === 'NISN')
                  return k && String(r[k]).trim() === targetNisn
                })
                if (rowData) {
                  const nameKey = Object.keys(rowData).find(key => {
                    const up = key.toUpperCase().trim()
                    return up === 'NAMA' || up === 'NAMA LENGKAP' || up === 'NAMA_LENGKAP'
                  })
                  const studentName = nameKey ? rowData[nameKey] : 'Nama Tidak Diketahui'
                  if (!log.toUpperCase().includes(studentName.toUpperCase())) {
                    return `[${file.name}] ${log.replace(targetNisn, `${targetNisn} - A.n: ${studentName}`)}`
                  }
                }
              }
              return `[${file.name}] ${log}`
            })
            allLogs = [...allLogs, ...enrichedLogs]
          }
        }
      } catch (err: any) {
        allLogs.push(`[${file.name}] Gagal memproses: ${err.message}`)
      }
    }

    setIsImporting(false)
    setImportProgress(null)
    
    // Reset input agar bisa upload file yang sama lagi
    e.target.value = ''

    if (totalSuccess > 0) {
      alert(`Berhasil memproses ${totalSuccess} file Excel dari RDM.`)
      setSuccessMessage(`${totalSuccess} dari ${files.length} file berhasil diimport.`)
      router.refresh()
    } else {
      alert(`Semua file gagal diproses. Silakan cek laporan tidak terekam (log import).`)
    }
    
    if (allLogs.length > 0) setImportLogs(allLogs)
  }
  // ---------- RESET HANDLER ----------
  const handleReset = async () => {
    if (!resetTarget) return
    const label = SEMESTER_MAP[resetTarget as keyof typeof SEMESTER_MAP]
    if (!confirm(`TINDAKAN BERBAHAYA!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA NILAI ${label} yang ada di database dari seluruh kelas?\n\nKetik "HAPUS" untuk melanjutkan:`)) return
    
    // Fallback prompt safety
    const check = prompt('Ketik "HAPUS" untuk mengonfirmasi reset:')
    if (check !== 'HAPUS') {
      alert('Konfirmasi dibatalkan.')
      return
    }

    const res = await resetNilaiKolom(resetTarget)
    if (res.error) alert(res.error)
    else { alert(res.success); router.refresh() }
    setResetTarget('')
  }

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="afterInteractive" />

      {/* Upload Panel */}
      <div className="rounded-lg border border-surface bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Import Nilai dari Excel / RDM</h3>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg px-4 py-3 flex gap-2.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-medium">Format Excel yang didukung:</p>
            <p>Kolom <strong>NISN</strong> (wajib) + kolom nama mata pelajaran sesuai database. Header 1 atau 2 baris (format RDM) otomatis terdeteksi. Bisa upload banyak file sekaligus.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="space-y-1.5 w-full sm:w-56">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Target Semester</Label>
            <Select value={targetImport} onValueChange={setTargetImport}>
              <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEMESTER_KEYS.map(k => (
                  <SelectItem key={k} value={k} className="text-xs">{SEMESTER_MAP[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 w-full">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">File Excel (.xlsx / .xls)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleFileUpload}
              disabled={isImporting}
              className="h-9 text-xs rounded-lg file:mr-2 file:text-xs file:font-medium file:bg-emerald-50 dark:file:bg-emerald-950/50 file:text-emerald-700 dark:file:text-emerald-400 file:border-0 file:rounded file:px-2 file:py-1"
            />
          </div>
        </div>

        {/* Progress */}
        {importProgress && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 bg-surface-2 px-3 py-2 rounded-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
            <span>Memproses file {importProgress.current}/{importProgress.total}: <strong>{importProgress.fileName}</strong></span>
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 dark:border-emerald-900/40">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Logs */}
        {importLogs.length > 0 && (
          <div className="border border-surface-2 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-surface-2 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Log Import ({importLogs.length})</span>
            </div>
            <ScrollArea className="max-h-40">
              <div className="px-3 py-2 space-y-0.5">
                {importLogs.map((log, i) => (
                  <p key={i} className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{log}</p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Reset Panel */}
      <div className="rounded-lg border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Trash2 className="h-4 w-4 text-rose-500" />
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Kosongkan Nilai Seluruh Siswa Lintas Angkatan</p>
              <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-medium leading-snug">Berbahaya! Tindakan ini akan mengosongkan satu kolom semester secara total di kolom database untuk <strong className="font-bold underline">seluruh kelas dan lintas angkatan</strong>. Gunakan HANYA jika Anda ingin mengimpor ulang dari awal jika terjadi kesalahan format sebelumnya. Data yang dihapus tidak bisa dikembalikan.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={resetTarget} onValueChange={setResetTarget}>
              <SelectTrigger className="h-8 w-48 text-xs rounded-lg"><SelectValue placeholder="Pilih semester..." /></SelectTrigger>
              <SelectContent>
                {SEMESTER_KEYS.map(k => (
                  <SelectItem key={k} value={k} className="text-xs">{SEMESTER_MAP[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!resetTarget}
              className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950">
              Reset
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
