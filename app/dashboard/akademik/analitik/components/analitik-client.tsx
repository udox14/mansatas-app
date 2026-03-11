// Lokasi: app/dashboard/akademik/analitik/components/analitik-client.tsx
'use client'

import { useState, useMemo } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, FileSpreadsheet, Loader2, Sparkles, AlertCircle, Filter } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { importNilaiDariExcel } from '../actions'

type SiswaData = {
  id: string
  nisn: string
  nama_lengkap: string
  kelas_id: string
  kelas: { tingkat: number, kelompok: string, nomor_kelas: string }
  rekap_nilai_akademik: {
    nilai_smt1: any, nilai_smt2: any, nilai_smt3: any, nilai_smt4: any, nilai_smt5: any, nilai_um: any
  } | null
}

const getShortMapel = (nama: string) => {
  const val = nama.toUpperCase().trim()
  if (val.includes('BAHASA INDONESIA')) return 'BIND'
  if (val.includes('BAHASA INGGRIS')) return 'BING'
  if (val.includes('MATEMATIKA')) return 'MTK'
  if (val.includes('PENDIDIKAN PANCASILA') || val === 'PPKN') return 'PP'
  if (val.includes("QUR'AN") || val.includes('QURAN')) return 'QH'
  if (val.includes('AKIDAH')) return 'AA'
  if (val.includes('SEJARAH KEBUDAYAAN')) return 'SKI'
  if (val.includes('FIKIH') || val.includes('FIQIH')) return 'FIK'
  if (val.includes('JASMANI') || val.includes('PJOK')) return 'PJOK'
  if (val.includes('PRAKARYA')) return 'PKWU'
  if (val.includes('SENI')) return 'SB'
  if (val.includes('BIOLOGI')) return 'BIO'
  if (val.includes('FISIKA')) return 'FIS'
  if (val.includes('KIMIA')) return 'KIM'
  if (val.includes('EKONOMI')) return 'EKO'
  if (val.includes('GEOGRAFI')) return 'GEO'
  if (val.includes('SOSIOLOGI')) return 'SOS'
  if (val.includes('SEJARAH')) return 'SEJ'
  if (val.includes('IPA TERPADU')) return 'IPAT'
  if (val.includes('IPS TERPADU')) return 'IPST'

  const words = val.split(' ').filter(w => w.length > 0)
  if (words.length === 1) return val.substring(0, 3) 
  return words.map(w => w[0]).join('').substring(0, 4) 
}

export function AnalitikClient({ dataSiswa, pengaturan }: { dataSiswa: SiswaData[], pengaturan: any }) {
  const [activeTab, setActiveTab] = useState('detail')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [isImporting, setIsImporting] = useState(false)
  const [targetImport, setTargetImport] = useState('nilai_smt1')
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [importProgress, setImportProgress] = useState<{current: number, total: number, fileName: string} | null>(null)

  const [filterKelas, setFilterKelas] = useState('NONE')
  const [filterSemester, setFilterSemester] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const mapelSNBP = pengaturan?.mapel_snbp || []
  const mapelSPAN = pengaturan?.mapel_span || []
  const bobotRapor = (pengaturan?.bobot_rapor || 60) / 100
  const bobotUM = (pengaturan?.bobot_um || 40) / 100

  const kelasUnik = useMemo(() => {
    const map = new Map()
    dataSiswa.forEach(s => {
      if (s.kelas) {
        const label = `${s.kelas.tingkat}-${s.kelas.nomor_kelas} ${s.kelas.kelompok !== 'UMUM' ? s.kelas.kelompok : ''}`.trim()
        map.set(s.kelas_id, label)
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' }))
  }, [dataSiswa])

  useMemo(() => { setCurrentPage(1) }, [filterKelas, searchTerm, activeTab, itemsPerPage])

  const processedData = useMemo(() => {
    const calculated = dataSiswa.map(s => {
      const rekap = s.rekap_nilai_akademik || { nilai_smt1:{}, nilai_smt2:{}, nilai_smt3:{}, nilai_smt4:{}, nilai_smt5:{}, nilai_um:{} }
      
      const hitungNilai = (mapelPilihan: string[]) => {
        if (mapelPilihan.length === 0) return { rata2: 0, jumlah: 0 }
        let totalNilai = 0 
        let jumlahPembagi = 0 
        mapelPilihan.forEach((mp: string) => {
          [rekap.nilai_smt1, rekap.nilai_smt2, rekap.nilai_smt3, rekap.nilai_smt4, rekap.nilai_smt5].forEach(smt => {
            const val = Number(smt?.[mp])
            if (val && val > 0) {
              totalNilai += val
              jumlahPembagi += 1
            }
          })
        })
        return { rata2: jumlahPembagi > 0 ? totalNilai / jumlahPembagi : 0, jumlah: totalNilai }
      }

      const snbp = hitungNilai(mapelSNBP)
      const span = hitungNilai(mapelSPAN)
      
      let rataUM = 0
      if (mapelSNBP.length > 0) {
        let totUM = 0
        let pembagiUM = 0
        mapelSNBP.forEach((mp: string) => {
          const val = Number(rekap.nilai_um?.[mp])
          if (val && val > 0) {
            totUM += val
            pembagiUM += 1
          }
        })
        rataUM = pembagiUM > 0 ? totUM / pembagiUM : 0
      }

      const nilaiAkhir = (snbp.rata2 * bobotRapor) + (rataUM * bobotUM)

      return {
        ...s,
        namaKelas: s.kelas ? `${s.kelas.tingkat}-${s.kelas.nomor_kelas} ${s.kelas.kelompok!=='UMUM'?s.kelas.kelompok:''}` : 'Belum Ada',
        rataSnbp: parseFloat(snbp.rata2.toFixed(2)),
        jumlahSnbp: snbp.jumlah,
        rataSpan: parseFloat(span.rata2.toFixed(2)),
        jumlahSpan: span.jumlah,
        rataUM: parseFloat(rataUM.toFixed(2)),
        nilaiAkhir: parseFloat(nilaiAkhir.toFixed(2)),
        rankSnbp: 0, rankSpan: 0, rankIjazah: 0
      }
    })

    const sortedSnbp = [...calculated].sort((a, b) => b.rataSnbp - a.rataSnbp)
    sortedSnbp.forEach((s, idx) => { const obj = calculated.find(x => x.id === s.id); if (obj) obj.rankSnbp = idx + 1; })

    const sortedSpan = [...calculated].sort((a, b) => b.rataSpan - a.rataSpan)
    sortedSpan.forEach((s, idx) => { const obj = calculated.find(x => x.id === s.id); if (obj) obj.rankSpan = idx + 1; })

    const sortedIjazah = [...calculated].sort((a, b) => b.nilaiAkhir - a.nilaiAkhir)
    sortedIjazah.forEach((s, idx) => { const obj = calculated.find(x => x.id === s.id); if (obj) obj.rankIjazah = idx + 1; })

    return calculated
  }, [dataSiswa, mapelSNBP, mapelSPAN, bobotRapor, bobotUM])

  const kuota40Persen = Math.floor(processedData.length * 0.4)
  const eligibleSnbpIds = new Set([...processedData].sort((a,b) => b.rataSnbp - a.rataSnbp).slice(0, kuota40Persen).map(s => s.id))

  const finalFilteredData = useMemo(() => {
    if (filterKelas === 'NONE') return []

    let data = processedData
    if (filterKelas !== 'ALL') {
      data = data.filter(s => s.kelas_id === filterKelas)
    }
    if (searchTerm) {
      data = data.filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm))
    }

    if (activeTab === 'span' || activeTab === 'detail_span') data = data.sort((a, b) => a.rankSpan - b.rankSpan)
    else if (activeTab === 'ijazah') data = data.sort((a, b) => a.rankIjazah - b.rankIjazah)
    else data = data.sort((a, b) => a.rankSnbp - b.rankSnbp)

    return data
  }, [processedData, filterKelas, searchTerm, activeTab])

  const totalPages = Math.ceil(finalFilteredData.length / itemsPerPage)
  const paginatedData = finalFilteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const arraySemester = filterSemester === 'ALL' ? [1, 2, 3, 4, 5] : [parseInt(filterSemester)]

  // DYNAMIC COLUMNS LOGIC
  const activeMapelSNBPPerSmt = useMemo(() => {
    const result: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    if (!finalFilteredData.length) return result
    ;[1, 2, 3, 4, 5].forEach(smt => {
      result[smt] = mapelSNBP.filter((mp: string) =>
        finalFilteredData.some(s => {
          const val = s.rekap_nilai_akademik?.[`nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik]?.[mp]
          return val !== undefined && val !== null && val !== 0 && val !== ''
        })
      )
    })
    return result
  }, [finalFilteredData, mapelSNBP])

  const activeMapelSPANPerSmt = useMemo(() => {
    const result: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    if (!finalFilteredData.length) return result
    ;[1, 2, 3, 4, 5].forEach(smt => {
      result[smt] = mapelSPAN.filter((mp: string) =>
        finalFilteredData.some(s => {
          const val = s.rekap_nilai_akademik?.[`nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik]?.[mp]
          return val !== undefined && val !== null && val !== 0 && val !== ''
        })
      )
    })
    return result
  }, [finalFilteredData, mapelSPAN])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsImporting(true)
    setImportLogs([])
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

      } catch (err) { 
        allLogs.push(`[${file.name}] Gagal membaca struktur/format Excel.`) 
      }
    } 

    setIsImporting(false)
    setImportProgress(null)
    e.target.value = ''

    if (totalSuccess > 0) {
      alert(`Berhasil memproses ${totalSuccess} file Excel dari RDM.`)
    } else {
      alert(`Semua file gagal diproses. Silakan cek laporan tidak terekam.`)
    }
    
    if (allLogs.length > 0) setImportLogs(allLogs)
  }

  const exportToExcel = (tipe: 'SNBP' | 'SPAN' | 'IJAZAH' | 'DETAIL' | 'DETAIL_SPAN') => {
    const XLSX = (window as any).XLSX
    if (!XLSX) { alert('Library pembuat Excel sedang dimuat. Silakan tunggu.'); return }

    let exportSource = [...processedData]
    if (filterKelas !== 'ALL' && filterKelas !== 'NONE') {
      exportSource = exportSource.filter(s => s.kelas_id === filterKelas)
    }
    
    if (tipe === 'SNBP') {
      exportSource.sort((a, b) => a.rankSnbp - b.rankSnbp)
      const dataExport = exportSource.map(s => ({
        "Ranking Global": s.rankSnbp,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Jumlah Nilai": s.jumlahSnbp,
        "Rata-rata SNBP": s.rataSnbp,
        "Status SNBP": eligibleSnbpIds.has(s.id) ? "ELIGIBLE (Top 40%)" : "Reguler"
      }))
      const ws = XLSX.utils.json_to_sheet(dataExport)
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Laporan_${tipe}`)
      XLSX.writeFile(wb, `MANSATAS_Laporan_${tipe}.xlsx`)

    } else if (tipe === 'SPAN') {
      exportSource.sort((a, b) => a.rankSpan - b.rankSpan)
      const dataExport = exportSource.map(s => ({
        "Ranking Global SPAN": s.rankSpan,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Jumlah Nilai SPAN": s.jumlahSpan,
        "Rata-rata SPAN": s.rataSpan
      }))
      const ws = XLSX.utils.json_to_sheet(dataExport)
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Laporan_${tipe}`)
      XLSX.writeFile(wb, `MANSATAS_Laporan_${tipe}.xlsx`)

    } else if (tipe === 'IJAZAH') {
      exportSource.sort((a, b) => a.rankIjazah - b.rankIjazah)
      const dataExport = exportSource.map(s => ({
        "Ranking Global Ijazah": s.rankIjazah,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Rata-rata Rapot (5 SMT)": s.rataSnbp,
        "Nilai UM": s.rataUM,
        "Nilai Akhir Ijazah": s.nilaiAkhir
      }))
      const ws = XLSX.utils.json_to_sheet(dataExport)
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Laporan_${tipe}`)
      XLSX.writeFile(wb, `MANSATAS_Laporan_${tipe}.xlsx`)

    } else if (tipe === 'DETAIL' || tipe === 'DETAIL_SPAN') {
      const isSnbp = tipe === 'DETAIL'
      exportSource.sort((a, b) => isSnbp ? (a.rankSnbp - b.rankSnbp) : (a.rankSpan - b.rankSpan))
      const activeMapelObj = isSnbp ? activeMapelSNBPPerSmt : activeMapelSPANPerSmt

      const wsData: any[][] = []
      const merges: any[] = []

      const baseHeaders = ["Rank", "NISN", "Nama Lengkap", "Kelas", isSnbp ? "Status Kelayakan" : "Status", "Jumlah Nilai", "Rata-rata"]
      const row1 = [...baseHeaders]
      let currentCol = baseHeaders.length

      ;[1, 2, 3, 4, 5].forEach(smt => {
        row1.push(`Semester ${smt}`)
        const mapels = activeMapelObj[smt]
        const colSpan = Math.max(1, mapels.length)

        for (let i = 1; i < colSpan; i++) row1.push("")
        merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + colSpan - 1 } })
        currentCol += colSpan
      })
      wsData.push(row1)

      const row2 = Array(baseHeaders.length).fill("")
      for (let i = 0; i < baseHeaders.length; i++) {
        merges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } })
      }

      ;[1, 2, 3, 4, 5].forEach(smt => {
        const mapels = activeMapelObj[smt]
        if (mapels.length === 0) row2.push("-")
        else mapels.forEach((mp: string) => row2.push(mp)) 
      })
      wsData.push(row2)

      exportSource.forEach(s => {
        const statusStr = isSnbp ? (eligibleSnbpIds.has(s.id) ? "ELIGIBLE" : "Reguler") : "-"
        const rowData = [
          isSnbp ? s.rankSnbp : s.rankSpan, 
          s.nisn, 
          s.nama_lengkap, 
          s.namaKelas, 
          statusStr, 
          isSnbp ? s.jumlahSnbp : s.jumlahSpan, 
          isSnbp ? s.rataSnbp : s.rataSpan
        ]
        
        ;[1, 2, 3, 4, 5].forEach(smt => {
          const mapels = activeMapelObj[smt]
          if (mapels.length === 0) {
             rowData.push("-")
          } else {
             mapels.forEach((mp: string) => {
               rowData.push(s.rekap_nilai_akademik?.[`nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik]?.[mp] || 0)
             })
          }
        })
        wsData.push(rowData)
      })

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!merges'] = merges
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Format_${tipe}`)
      XLSX.writeFile(wb, `MANSATAS_PDSS_${tipe}.xlsx`)
    }
  }

  const PaginationFooter = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Tampilkan</span>
        <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <span>dari <strong>{finalFilteredData.length}</strong> entri</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
          Sebelumnya
        </Button>
        <div className="text-sm font-medium px-2">
          {currentPage} / {totalPages || 1}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0}>
          Selanjutnya
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* TOOLBAR FILTER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-background p-4 rounded-lg border shadow-sm">
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Filter Kelas */}
          <div className="space-y-1.5 w-full sm:w-40">
            <Label className="text-xs text-muted-foreground">Pilih Kelas</Label>
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className={`h-9 w-full ${filterKelas === 'NONE' ? 'ring-1 ring-destructive border-transparent' : ''}`}>
                <SelectValue placeholder="Pilih Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE" disabled>-- Pilih Kelas --</SelectItem>
                <SelectItem value="ALL" className="font-semibold text-primary">Tampilkan Semua</SelectItem>
                {kelasUnik.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Semester */}
          {(activeTab === 'detail' || activeTab === 'detail_span') && (
            <div className="space-y-1.5 w-full sm:w-36">
              <Label className="text-xs text-muted-foreground">Pilih Semester</Label>
              <Select value={filterSemester} onValueChange={setFilterSemester}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Semua Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Smt</SelectItem>
                  <SelectItem value="1">Semester 1</SelectItem>
                  <SelectItem value="2">Semester 2</SelectItem>
                  <SelectItem value="3">Semester 3</SelectItem>
                  <SelectItem value="4">Semester 4</SelectItem>
                  <SelectItem value="5">Semester 5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search */}
          <div className="space-y-1.5 w-full sm:w-56">
            <Label className="text-xs text-muted-foreground">Cari Data</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nama / NISN..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} disabled={filterKelas === 'NONE'} />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full md:w-auto mt-2 md:mt-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full md:w-auto gap-2">
                <FileSpreadsheet className="h-4 w-4"/> Import Excel (Batch)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Import Nilai Siswa</DialogTitle>
                <DialogDescription>
                  Unggah banyak file Excel RDM sekaligus. Sistem otomatis mendeteksi kolom mapel.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Target Semester</Label>
                  <Select value={targetImport} onValueChange={setTargetImport}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nilai_smt1">Semester 1</SelectItem>
                      <SelectItem value="nilai_smt2">Semester 2</SelectItem>
                      <SelectItem value="nilai_smt3">Semester 3</SelectItem>
                      <SelectItem value="nilai_smt4">Semester 4</SelectItem>
                      <SelectItem value="nilai_smt5">Semester 5</SelectItem>
                      <SelectItem value="nilai_um">Ujian Madrasah (UM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>File Excel (.xlsx)</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    multiple 
                    onChange={handleFileUpload} 
                    disabled={isImporting} 
                    className="cursor-pointer file:cursor-pointer" 
                  />
                </div>
                
                {isImporting && importProgress && (
                  <div className="p-3 rounded-md border bg-muted/50 space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin h-4 w-4" /> Memproses...
                      </span>
                      <span>{importProgress.current} / {importProgress.total}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-1.5 transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{importProgress.fileName}</p>
                  </div>
                )}

                {importLogs.length > 0 && (
                  <div className="rounded-md border border-destructive/20 overflow-hidden">
                    <div className="bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4"/> Laporan Kesalahan:
                    </div>
                    <ScrollArea className="h-32 bg-muted/30 p-3 text-xs text-muted-foreground font-mono">
                      {importLogs.map((log, i) => (
                        <div key={i} className="mb-1.5 flex items-start gap-1.5">
                          <span className="text-destructive">•</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TABS UTAMA */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full bg-background rounded-lg border shadow-sm">
        <div className="border-b px-2 pt-2">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="bg-transparent h-10 p-0">
              <TabsTrigger value="detail" className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2 font-medium">
                Detail PDSS
              </TabsTrigger>
              <TabsTrigger value="detail_span" className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2 font-medium">
                Detail SPAN
              </TabsTrigger>
              <TabsTrigger value="snbp" className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2 font-medium">
                Kuota SNBP 40%
              </TabsTrigger>
              <TabsTrigger value="span" className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2 font-medium">
                Ranking SPAN
              </TabsTrigger>
              <TabsTrigger value="ijazah" className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2 font-medium">
                Simulasi Ijazah
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        <div className="relative">
          {filterKelas === 'NONE' ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <Filter className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">Pilih Kelas Terlebih Dahulu</p>
              <p className="text-xs mt-1 max-w-xs text-center">Gunakan filter di atas untuk menampilkan data nilai guna menjaga performa perangkat Anda.</p>
            </div>
          ) : finalFilteredData.length === 0 ? (
             <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Tidak ada data siswa ditemukan.</p>
            </div>
          ) : (
            <>
              {/* TAB: DETAIL SNBP (PDSS) */}
              <TabsContent value="detail" className="m-0 focus-visible:outline-none">
                <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                  <p className="text-xs text-muted-foreground hidden sm:block">Format mentah PDSS per Semester.</p>
                  <Button size="sm" variant="outline" onClick={() => exportToExcel('DETAIL')} className="gap-2 ml-auto h-8 text-xs">
                    <Download className="h-3 w-3"/> Export PDSS
                  </Button>
                </div>
                
                <div className="overflow-auto custom-scrollbar relative max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr>
                        <th rowSpan={2} className="sticky left-0 z-50 bg-muted/90 p-3 font-semibold min-w-[200px] shadow-[1px_0_0_0_hsl(var(--border))]">Rank / Siswa</th>
                        <th rowSpan={2} className="text-center p-2 font-semibold border-l">Jumlah</th>
                        <th rowSpan={2} className="text-center p-2 font-semibold border-x">Rata-rata</th>
                        
                        {arraySemester.map(smt => {
                          const activeMapels = activeMapelSNBPPerSmt[smt]
                          const colSpan = Math.max(1, activeMapels.length)
                          return (
                            <th key={`h-snbp-smt-${smt}`} colSpan={colSpan} className="text-center border-r p-2 font-semibold text-xs uppercase tracking-wider">
                              SMT {smt}
                            </th>
                          )
                        })}
                      </tr>
                      <tr className="text-xs border-t">
                        {arraySemester.map(smt => {
                          const activeMapels = activeMapelSNBPPerSmt[smt]
                          if (activeMapels.length === 0) {
                            return <th key={`sub-snbp-${smt}-empty`} className="text-center p-2 border-r font-normal text-muted-foreground">-</th>
                          }
                          return activeMapels.map((mp: string) => (
                            <th key={`sub-snbp-${smt}-${mp}`} className="text-center p-2 border-r font-medium min-w-[60px]">
                              <span title={mp} className="cursor-help border-b border-dashed border-muted-foreground/50">{getShortMapel(mp)}</span>
                            </th>
                          ))
                        })}
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedData.map((s) => (
                        <tr key={`raw-${s.id}`} className="border-b transition-colors hover:bg-muted/50">
                          <td className="sticky left-0 z-30 bg-background group-hover:bg-muted/50 p-3 shadow-[1px_0_0_0_hsl(var(--border))]">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-muted-foreground text-xs w-4">{s.rankSnbp}.</span>
                              <div>
                                <div className="font-medium">{s.nama_lengkap}</div>
                                <div className="text-[11px] text-muted-foreground">{s.nisn} • {s.namaKelas}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center p-2 border-l font-mono text-xs">{s.jumlahSnbp}</td>
                          <td className="text-center p-2 border-x font-mono font-medium text-xs bg-muted/20">{s.rataSnbp}</td>
                          
                          {arraySemester.map(smt => {
                            const activeMapels = activeMapelSNBPPerSmt[smt]
                            if (activeMapels.length === 0) {
                              return <td key={`val-${s.id}-${smt}-empty`} className="text-center text-muted-foreground/50 p-2 border-r">-</td>
                            }
                            return activeMapels.map((mp: string) => {
                              const key = `nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik
                              const val = s.rekap_nilai_akademik?.[key]?.[mp]
                              return (
                                <td key={`val-${s.id}-${smt}-${mp}`} className="text-center font-mono text-xs p-2 border-r">
                                  {val || '-'}
                                </td>
                              )
                            })
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* TAB: DETAIL SPAN */}
              <TabsContent value="detail_span" className="m-0 focus-visible:outline-none">
                <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                  <p className="text-xs text-muted-foreground hidden sm:block">Format mentah SPAN per Semester.</p>
                  <Button size="sm" variant="outline" onClick={() => exportToExcel('DETAIL_SPAN')} className="gap-2 ml-auto h-8 text-xs">
                    <Download className="h-3 w-3"/> Export SPAN
                  </Button>
                </div>
                
                <div className="overflow-auto custom-scrollbar relative max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr>
                        <th rowSpan={2} className="sticky left-0 z-50 bg-muted/90 p-3 font-semibold min-w-[200px] shadow-[1px_0_0_0_hsl(var(--border))]">Rank / Siswa</th>
                        <th rowSpan={2} className="text-center p-2 font-semibold border-l">Jumlah</th>
                        <th rowSpan={2} className="text-center p-2 font-semibold border-x">Rata-rata</th>
                        
                        {arraySemester.map(smt => {
                          const activeMapels = activeMapelSPANPerSmt[smt]
                          const colSpan = Math.max(1, activeMapels.length)
                          return (
                            <th key={`h-span-smt-${smt}`} colSpan={colSpan} className="text-center border-r p-2 font-semibold text-xs uppercase tracking-wider">
                              SMT {smt}
                            </th>
                          )
                        })}
                      </tr>
                      <tr className="text-xs border-t">
                        {arraySemester.map(smt => {
                          const activeMapels = activeMapelSPANPerSmt[smt]
                          if (activeMapels.length === 0) {
                            return <th key={`sub-span-${smt}-empty`} className="text-center p-2 border-r font-normal text-muted-foreground">-</th>
                          }
                          return activeMapels.map((mp: string) => (
                            <th key={`sub-span-${smt}-${mp}`} className="text-center p-2 border-r font-medium min-w-[60px]">
                              <span title={mp} className="cursor-help border-b border-dashed border-muted-foreground/50">{getShortMapel(mp)}</span>
                            </th>
                          ))
                        })}
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedData.map((s) => (
                        <tr key={`raw-span-${s.id}`} className="border-b transition-colors hover:bg-muted/50">
                          <td className="sticky left-0 z-30 bg-background group-hover:bg-muted/50 p-3 shadow-[1px_0_0_0_hsl(var(--border))]">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-muted-foreground text-xs w-4">{s.rankSpan}.</span>
                              <div>
                                <div className="font-medium">{s.nama_lengkap}</div>
                                <div className="text-[11px] text-muted-foreground">{s.nisn} • {s.namaKelas}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center p-2 border-l font-mono text-xs">{s.jumlahSpan}</td>
                          <td className="text-center p-2 border-x font-mono font-medium text-xs bg-muted/20">{s.rataSpan}</td>
                          
                          {arraySemester.map(smt => {
                            const activeMapels = activeMapelSPANPerSmt[smt]
                            if (activeMapels.length === 0) {
                              return <td key={`val-span-${s.id}-${smt}-empty`} className="text-center text-muted-foreground/50 p-2 border-r">-</td>
                            }
                            return activeMapels.map((mp: string) => {
                              const key = `nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik
                              const val = s.rekap_nilai_akademik?.[key]?.[mp]
                              return (
                                <td key={`val-span-${s.id}-${smt}-${mp}`} className="text-center font-mono text-xs p-2 border-r">
                                  {val || '-'}
                                </td>
                              )
                            })
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* TAB SNBP */}
              <TabsContent value="snbp" className="m-0 focus-visible:outline-none">
                <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                  <p className="text-xs text-muted-foreground hidden sm:block">Kuota 40% (<strong className="text-foreground">{kuota40Persen} Teratas</strong>).</p>
                  <Button size="sm" variant="outline" onClick={() => exportToExcel('SNBP')} className="gap-2 ml-auto h-8 text-xs">
                    <Download className="h-3 w-3"/> Export Rank SNBP
                  </Button>
                </div>
                <div className="overflow-auto custom-scrollbar max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="w-16 text-center p-3 font-semibold">Rank</th>
                        <th className="p-3 font-semibold">Siswa</th>
                        <th className="text-center p-3 font-semibold">Jumlah</th>
                        <th className="text-center p-3 font-semibold">Rata-rata</th>
                        <th className="text-center p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedData.map((s) => {
                        const isEligible = eligibleSnbpIds.has(s.id)
                        return (
                          <tr key={`snbp-${s.id}`} className={`border-b transition-colors hover:bg-muted/50 ${isEligible ? 'bg-primary/5' : ''}`}>
                            <td className="text-center font-semibold text-muted-foreground p-3">{s.rankSnbp}</td>
                            <td className="p-3">
                              <div className="font-medium">{s.nama_lengkap}</div>
                              <div className="text-[11px] text-muted-foreground">{s.nisn} • {s.namaKelas}</div>
                            </td>
                            <td className="text-center font-mono text-xs p-3">{s.jumlahSnbp}</td>
                            <td className={`text-center font-mono font-medium p-3 ${isEligible ? 'text-primary' : ''}`}>{s.rataSnbp}</td>
                            <td className="text-center p-3">
                              {isEligible ? (
                                <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide">
                                  <Sparkles className="h-3 w-3"/> ELIGIBLE
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px] font-medium px-2.5 py-0.5 border rounded-full">Reguler</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* TAB SPAN */}
              <TabsContent value="span" className="m-0 focus-visible:outline-none">
                 <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                  <p className="text-xs text-muted-foreground hidden sm:block">Ranking Global berdasar mapel SPAN-PTKIN.</p>
                  <Button size="sm" variant="outline" onClick={() => exportToExcel('SPAN')} className="gap-2 ml-auto h-8 text-xs">
                    <Download className="h-3 w-3"/> Export Rank SPAN
                  </Button>
                </div>
                <div className="overflow-auto custom-scrollbar max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="w-16 text-center p-3 font-semibold">Rank</th>
                        <th className="p-3 font-semibold">Siswa</th>
                        <th className="text-center p-3 font-semibold">Jumlah</th>
                        <th className="text-center p-3 font-semibold">Rata-rata SPAN</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedData.map((s) => (
                        <tr key={`span-rk-${s.id}`} className="border-b transition-colors hover:bg-muted/50">
                          <td className="text-center font-semibold text-muted-foreground p-3">{s.rankSpan}</td>
                          <td className="p-3">
                            <div className="font-medium">{s.nama_lengkap}</div>
                            <div className="text-[11px] text-muted-foreground">{s.nisn} • {s.namaKelas}</div>
                          </td>
                          <td className="text-center font-mono text-xs p-3">{s.jumlahSpan}</td>
                          <td className="text-center font-mono font-medium p-3 bg-muted/20">{s.rataSpan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* TAB IJAZAH */}
              <TabsContent value="ijazah" className="m-0 focus-visible:outline-none">
                 <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    Format: ({bobotRapor*100}% Rata SMT) + ({bobotUM*100}% Nilai UM)
                  </p>
                  <Button size="sm" variant="outline" onClick={() => exportToExcel('IJAZAH')} className="gap-2 ml-auto h-8 text-xs">
                    <Download className="h-3 w-3"/> Export Ijazah
                  </Button>
                </div>
                <div className="overflow-auto custom-scrollbar max-h-[500px]">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="w-16 text-center p-3 font-semibold">Rank</th>
                        <th className="p-3 font-semibold">Siswa</th>
                        <th className="text-center p-3 font-semibold">Rapor ({bobotRapor*100}%)</th>
                        <th className="text-center p-3 font-semibold">UM ({bobotUM*100}%)</th>
                        <th className="text-center p-3 font-semibold text-primary">NILAI AKHIR</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {paginatedData.map((s) => (
                        <tr key={`ijz-rk-${s.id}`} className="border-b transition-colors hover:bg-muted/50">
                          <td className="text-center font-semibold text-muted-foreground p-3">{s.rankIjazah}</td>
                          <td className="p-3">
                            <div className="font-medium">{s.nama_lengkap}</div>
                            <div className="text-[11px] text-muted-foreground">{s.nisn} • {s.namaKelas}</div>
                          </td>
                          <td className="text-center font-mono text-xs p-3">{s.rataSnbp}</td>
                          <td className="text-center font-mono text-xs p-3">{s.rataUM}</td>
                          <td className="text-center font-mono font-bold p-3 text-primary bg-primary/5">{s.nilaiAkhir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              {/* FOOTER PAGINATION */}
              <PaginationFooter />
            </>
          )}
        </div>
      </Tabs>
    </div>
  )
}