'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileSpreadsheet, Loader2, AlertCircle, Upload, Trash2, CheckCircle2, Info, UserCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { validateImportNilai, simpanImportNilai, resetNilaiKolom } from '../actions'
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

  // Verification states
  const [verificationList, setVerificationList] = useState<any[]>([])
  const [readyImportList, setReadyImportList] = useState<any[]>([])
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [manualSelections, setManualSelections] = useState<Record<string, string>>({})

  const executeFinalImport = async (rowsToImport: any[]) => {
    setIsImporting(true)
    setImportProgress({ current: 1, total: 1, fileName: 'Menyimpan Semua Data ke Database...' })
    const res = await simpanImportNilai(rowsToImport, targetImport)
    if (res.error) {
      alert(res.error)
    } else {
      setSuccessMessage(res.success || '')
      alert(res.success || 'Berhasil import')
      router.refresh()
    }
    setIsImporting(false)
    setImportProgress(null)
  }

  const handleSubmitVerification = async () => {
    const verifiedRows: any[] = []
    
    for (const v of verificationList) {
      const mapKey = v.rowId + v.fileName
      const selectedId = manualSelections[mapKey]
      if (selectedId && selectedId !== 'IGNORE') {
        verifiedRows.push({
          siswaId: selectedId,
          nilaiObj: v.nilaiObj
        })
      }
    }
    
    setIsVerifyDialogOpen(false)
    const finalData = [...readyImportList, ...verifiedRows]
    
    if (finalData.length === 0) {
      alert("Tidak ada data valid untuk disimpan setelah verifikasi.")
      return
    }
    
    await executeFinalImport(finalData)
  }

  // ---------- UPLOAD HANDLER ----------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsImporting(true)
    setImportLogs([])
    setSuccessMessage('')
    setVerificationList([])
    setReadyImportList([])
    setManualSelections({})

    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert('Library pemroses Excel sedang dimuat. Silakan tunggu beberapa saat lagi.')
      setIsImporting(false)
      setImportProgress(null)
      return
    }

    let allLogs: string[] = []
    let masterReady: any[] = []
    let masterVerify: any[] = []

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
          
          let obj: any = {}
          for (let col = 0; col < headers.length; col++) {
            if (rowData[col] !== undefined && rowData[col] !== null && String(rowData[col]).trim() !== '') {
              obj[headers[col]] = rowData[col]
            }
          }
          jsonData.push(obj)
        }

        const result = await validateImportNilai(jsonData, targetImport)
        if (result.error) {
          allLogs.push(`[${file.name}] Error: ${result.error}`)
        } else {
          masterReady = [...masterReady, ...(result.readyToImport || [])]
          
          if (result.needsVerification) {
            const mappedVerify = result.needsVerification.map((v: any) => ({ ...v, fileName: file.name }))
            masterVerify = [...masterVerify, ...mappedVerify]
          }
          
          if (result.errorLogs) {
            const mappedLogs = result.errorLogs.map((l: string) => `[${file.name}] ${l}`)
            allLogs = [...allLogs, ...mappedLogs]
          }
        }
      } catch (err: any) {
        allLogs.push(`[${file.name}] Gagal memproses: ${err.message}`)
      }
    }

    e.target.value = ''
    if (allLogs.length > 0) setImportLogs(allLogs)

    if (masterVerify.length > 0) {
      setReadyImportList(masterReady)
      setVerificationList(masterVerify)
      
      const initialSelections: Record<string, string> = {}
      masterVerify.forEach(v => {
        initialSelections[v.rowId + v.fileName] = 'IGNORE'
      })
      setManualSelections(initialSelections)
      
      setIsVerifyDialogOpen(true)
      setIsImporting(false) 
      setImportProgress(null)
    } else if (masterReady.length > 0) {
      await executeFinalImport(masterReady)
    } else {
      setIsImporting(false)
      setImportProgress(null)
      if (allLogs.length > 0) {
         alert("Proses selesai, namun tidak ada data valid yang bisa dimasukkan. Silakan cek log error.")
      } else {
         alert("Tidak ada data baru untuk diunggah.")
      }
    }
  }

  // ---------- RESET HANDLER ----------
  const handleReset = async () => {
    if (!resetTarget) return
    const label = SEMESTER_MAP[resetTarget as keyof typeof SEMESTER_MAP]
    if (!confirm(`TINDAKAN BERBAHAYA!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA NILAI ${label} yang ada di database dari seluruh kelas?\n\nKetik "HAPUS" untuk melanjutkan:`)) return
    
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

      {/* Manual Verification Dialog */}
      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-4 md:p-6 bg-slate-50 dark:bg-slate-950">
          <DialogHeader className="sm:text-center shrink-0">
            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mb-4">
              <UserCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl md:text-2xl">Perlu Verifikasi Manual</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Ditemukan {verificationList.length} siswa dengan NISN tidak cocok/kosong namun memiliki kemiripan nama. Pilih <strong>Abaikan</strong> jika tidak ada yang cocok.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto -mx-4 px-4 md:-mx-6 md:px-6 my-4 border-y border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-inner relative">
            <div className="space-y-4 py-4 pr-1">
              {verificationList.map((item, idx) => {
                const mapKey = item.rowId + item.fileName
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Nama Tertulis di Excel</p>
                        <p className="font-bold text-base text-slate-800 dark:text-slate-200 flex items-center gap-2">
                           {item.namaExcel}
                           <span className="text-xs font-normal px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">NISN: {item.nisnExcel || 'Kosong'}</span>
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 text-left md:text-right bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded inline-block">
                        File: <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px] inline-block align-bottom">{item.fileName}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30">
                      <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Apakah Siswa Ini yang Dimaksud?</Label>
                      <Select 
                        value={manualSelections[mapKey] || 'IGNORE'} 
                        onValueChange={val => setManualSelections(p => ({...p, [mapKey]: val}))}
                      >
                        <SelectTrigger className="w-full bg-white dark:bg-slate-950 border-emerald-200 dark:border-emerald-800/50 focus:ring-emerald-500 shadow-sm">
                          <SelectValue placeholder="Pilih yang cocok..." />
                        </SelectTrigger>
                        <SelectContent className="max-w-[calc(100vw-3rem)]">
                          <SelectItem value="IGNORE" className="text-rose-600 dark:text-rose-400 font-bold focuses:bg-rose-50 dark:focus:bg-rose-950/50">
                            ❌ BUKAN SEMUA — ABAIKAN BARIS INI
                          </SelectItem>
                          {item.suggestedMatches.map((m: any) => (
                            <SelectItem key={m.id} value={m.id} className="py-2.5 outline-none cursor-pointer">
                              <div className="flex flex-col items-start text-left">
                                <span className="font-semibold text-sm">{m.nama_lengkap}</span>
                                <span className="text-[10px] text-slate-500">
                                  Kelas {m.tingkat}-{m.nomor_kelas} {m.kelompok} • NISN Asli: {m.nisn}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 shrink-0">
             <div className="text-xs text-slate-500">
               {readyImportList.length > 0 && <span className="text-emerald-600 font-medium">+{readyImportList.length} otomatis siap diproses. </span>}
               Total Final: <strong>{readyImportList.length + Object.values(manualSelections).filter(v => v !== 'IGNORE').length} Data</strong>
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsVerifyDialogOpen(false)}>Batal & Tutup</Button>
              <Button className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmitVerification}>
                Terapkan & Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            <p>Kolom <strong>NISN</strong> (wajib) + kolom nama mata pelajaran sesuai database. Header 1 atau 2 baris (format RDM) otomatis terdeteksi. Bisa import banyak mata pelajaran dan file sekaligus.</p>
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
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Pilih / Seret File Excel (.xlsx / .xls)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleFileUpload}
              disabled={isImporting}
              className="h-9 text-xs rounded-lg file:mr-2 file:text-xs file:font-medium file:bg-emerald-50 dark:file:bg-emerald-950/50 file:text-emerald-700 dark:file:text-emerald-400 file:border-0 file:rounded file:px-2 file:py-1 cursor-pointer bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900"
            />
          </div>
        </div>

        {/* Progress */}
        {importProgress && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 bg-surface-2 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
            <span>Memproses {importProgress.current}/{importProgress.total}: <strong>{importProgress.fileName}</strong></span>
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Logs */}
        {importLogs.length > 0 && (
          <div className="border border-surface-2 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950/50">
            <div className="px-3 py-2 bg-surface-2 border-b flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                 <AlertCircle className="h-3 w-3 text-amber-500" />
                 <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Log Import/Error ({importLogs.length})</span>
              </div>
            </div>
            <ScrollArea className="max-h-40">
              <div className="px-3 py-2 space-y-0.5">
                {importLogs.map((log, i) => (
                  <p key={i} className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">{log}</p>
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
            <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Kosongkan Nilai Penuh</p>
              <p className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 font-medium leading-snug">Berbahaya! Tindakan ini akan mengosongkan satu kolom semester secara total di kolom database untuk <strong className="font-bold underline">seluruh kelas dan lintas angkatan</strong>. Data yang dihapus tidak bisa dikembalikan.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Select value={resetTarget} onValueChange={setResetTarget}>
              <SelectTrigger className="h-8 w-full sm:w-48 text-xs rounded-lg bg-white dark:bg-slate-950"><SelectValue placeholder="Pilih semester..." /></SelectTrigger>
              <SelectContent>
                {SEMESTER_KEYS.map(k => (
                  <SelectItem key={k} value={k} className="text-xs">{SEMESTER_MAP[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!resetTarget}
              className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950 w-full sm:w-auto">
              Reset Semua
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
