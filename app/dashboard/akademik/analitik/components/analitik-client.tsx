// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/analitik/components/analitik-client.tsx
'use client'

import { useState, useMemo, Fragment } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, FileSpreadsheet, Loader2, TableProperties, Sparkles, AlertCircle, Filter, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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

// HELPER: Pembuat Kode Mapel Otomatis untuk tampilan tabel agar hemat ruang
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
  
  // STATE IMPORT MASSAL
  const [isImporting, setIsImporting] = useState(false)
  const [targetImport, setTargetImport] = useState('nilai_smt1')
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [importProgress, setImportProgress] = useState<{current: number, total: number, fileName: string} | null>(null)

  // STATE FILTER LAZY LOAD & PAGINATION
  const [filterKelas, setFilterKelas] = useState('NONE')
  const [filterSemester, setFilterSemester] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const mapelSNBP = pengaturan?.mapel_snbp || []
  const mapelSPAN = pengaturan?.mapel_span || []
  const bobotRapor = (pengaturan?.bobot_rapor || 60) / 100
  const bobotUM = (pengaturan?.bobot_um || 40) / 100

  // ==========================================
  // DAFTAR KELAS DINAMIS (Dari Data Siswa)
  // ==========================================
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

  // ==========================================
  // ENGINE PENGHITUNG CERDAS & GLOBAL RANKING
  // ==========================================
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
        
        const rata2 = jumlahPembagi > 0 ? totalNilai / jumlahPembagi : 0
        return { rata2, jumlah: totalNilai }
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

  // ==========================================
  // FILTERING UNTUK TAMPILAN
  // ==========================================
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

  // ==========================================
  // HANDLER IMPORT RDM (DENGAN NAMA LOG ENRICHMENT)
  // ==========================================
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
            
            // SULAP LOG ENRICHMENT: Mencari Nama Siswa di jsonData berdasarkan NISN dari log error server
            const enrichedLogs = result.logs.map(log => {
              // Cari pola seperti "NISN: 007123" atau "NISN 007123"
              const match = log.match(/NISN:\s*(\d+)/i) || log.match(/NISN\s+(\d+)/i) || log.match(/NISN\s*(\d+)/i)
              
              if (match && match[1]) {
                const targetNisn = match[1]
                
                // Cari data mentah anak ini di Excel
                const rowData = jsonData.find(r => {
                  const k = Object.keys(r).find(key => key.toUpperCase().trim() === 'NISN')
                  return k && String(r[k]).trim() === targetNisn
                })
                
                if (rowData) {
                  // Cari kolom nama (entah itu 'Nama', 'NAMA', 'Nama Lengkap')
                  const nameKey = Object.keys(rowData).find(key => {
                    const up = key.toUpperCase().trim()
                    return up === 'NAMA' || up === 'NAMA LENGKAP' || up === 'NAMA_LENGKAP'
                  })
                  
                  const studentName = nameKey ? rowData[nameKey] : 'Nama Tidak Diketahui'
                  
                  // Jika log dari server belum mengandung namanya, kita sisipkan!
                  if (!log.toUpperCase().includes(studentName.toUpperCase())) {
                    return `[${file.name}] ${log.replace(targetNisn, `${targetNisn} - A.n: ${studentName}`)}`
                  }
                }
              }
              // Fallback default
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
      alert(`🎉 Selesai! Berhasil memproses ${totalSuccess} file Excel dari RDM.`)
    } else {
      alert(`Semua file gagal diproses. Silakan cek laporan tidak terekam.`)
    }
    
    if (allLogs.length > 0) setImportLogs(allLogs)
  }

  // ==========================================
  // HANDLER EXPORT EXCEL (MERGE HEADER CANGGIH)
  // ==========================================
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
      const mapelTujuan = isSnbp ? mapelSNBP : mapelSPAN

      const wsData: any[][] = []
      const merges: any[] = []

      // --- ROW 1: Header Utama (Merge Horizontal ke Kanan) ---
      const baseHeaders = ["Rank", "NISN", "Nama Lengkap", "Kelas", isSnbp ? "Status Kelayakan" : "Status", "Jumlah Nilai", "Rata-rata"]
      const row1 = [...baseHeaders]
      let currentCol = baseHeaders.length

      ;[1, 2, 3, 4, 5].forEach(smt => {
        row1.push(`Semester ${smt}`)
        // Tambahkan cell kosong untuk mengakomodasi lebar mapel
        for (let i = 1; i < mapelTujuan.length; i++) row1.push("")
        // Aturan Merge: Mulai kolom currentCol sampai sejauh jumlah mapel
        merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + mapelTujuan.length - 1 } })
        currentCol += mapelTujuan.length
      })
      wsData.push(row1)

      // --- ROW 2: Header Anak (Nama Mapel / Base Headers Turun) ---
      const row2 = Array(baseHeaders.length).fill("")
      // Merge base headers secara vertikal ke bawah
      for (let i = 0; i < baseHeaders.length; i++) {
        merges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } })
      }

      ;[1, 2, 3, 4, 5].forEach(() => {
        mapelTujuan.forEach((mp: string) => row2.push(mp)) 
      })
      wsData.push(row2)

      // --- DATA SISWA ---
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
          mapelTujuan.forEach((mp: string) => {
            rowData.push(s.rekap_nilai_akademik?.[`nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik]?.[mp] || 0)
          })
        })
        wsData.push(rowData)
      })

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!merges'] = merges // Eksekusi penyatuan cell
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Format_${tipe}`)
      XLSX.writeFile(wb, `MANSATAS_PDSS_${tipe}.xlsx`)
    }
  }

  const PaginationFooter = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 bg-white rounded-b-3xl border-t border-slate-200/60 gap-4 text-sm mt-0 shadow-sm relative z-10">
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-500 font-medium">
        <span>Tampilkan</span>
        <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
          <SelectTrigger className="h-10 w-[80px] bg-slate-50 rounded-xl border-slate-200 font-bold text-slate-700 focus:ring-emerald-500"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <span>dari <strong className="text-slate-800">{finalFilteredData.length}</strong> siswa</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
          Prev
        </Button>
        <div className="flex items-center justify-center min-w-[3rem] font-bold text-slate-700 bg-slate-50 h-10 px-3 rounded-xl border border-slate-200">
          {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages || 1}
        </div>
        <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
          Next
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      <div className="space-y-6 mt-8">
        
        {/* TOOLBAR FILTER & SEARCH */}
        <div className="flex flex-col lg:flex-row justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 rounded-3xl shadow-sm border border-slate-200/60">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row gap-3 w-full lg:w-auto">
            {/* Filter Kelas */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Pilih Kelas</Label>
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className={`h-11 w-full lg:w-[180px] rounded-xl font-semibold transition-all ${filterKelas === 'NONE' ? 'bg-amber-50 border-amber-200 text-amber-700 ring-2 ring-amber-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="NONE" disabled className="text-slate-400 italic">-- Pilih Kelas --</SelectItem>
                  <SelectItem value="ALL" className="font-bold text-indigo-600">Tampilkan Semua (Berat)</SelectItem>
                  {kelasUnik.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Semester (Hanya muncul jika Tab adalah Detail) */}
            {(activeTab === 'detail' || activeTab === 'detail_span') && (
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Filter Semester</Label>
                <Select value={filterSemester} onValueChange={setFilterSemester}>
                  <SelectTrigger className="h-11 w-full lg:w-[160px] rounded-xl bg-slate-50 font-semibold border-slate-200 text-slate-800">
                    <SelectValue placeholder="Semua Semester" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL" className="font-bold text-indigo-600">Semua Smt</SelectItem>
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
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
               <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Cari Siswa</Label>
               <div className="relative w-full lg:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Nama / NISN..." className="pl-10 h-11 rounded-xl bg-slate-50 focus:border-emerald-500 shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} disabled={filterKelas === 'NONE'} />
              </div>
            </div>
          </div>

          <div className="flex items-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 h-11 px-5 rounded-xl gap-2 shadow-md w-full lg:w-auto">
                  <FileSpreadsheet className="h-4 w-4"/> Import Nilai (Batch)
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl rounded-3xl">
                <DialogHeader><DialogTitle className="text-xl font-bold">Import Nilai Akademik Siswa</DialogTitle></DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="bg-blue-50/50 p-4 rounded-2xl text-sm text-blue-800 border border-blue-100/50">
                    <p className="font-bold mb-1">Upload Banyak File Sekaligus!</p>
                    Anda bisa memilih puluhan file Excel RDM (misal: semua kelas 10) sekaligus. Sistem akan memprosesnya satu per satu untuk mencegah lag.
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold text-slate-600">File nilai tersebut untuk semester berapa?</Label>
                    <Select value={targetImport} onValueChange={setTargetImport}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="nilai_smt1">Semester 1</SelectItem>
                        <SelectItem value="nilai_smt2">Semester 2</SelectItem>
                        <SelectItem value="nilai_smt3">Semester 3</SelectItem>
                        <SelectItem value="nilai_smt4">Semester 4</SelectItem>
                        <SelectItem value="nilai_smt5">Semester 5</SelectItem>
                        <SelectItem value="nilai_um">Ujian Madrasah (UM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      multiple 
                      onChange={handleFileUpload} 
                      disabled={isImporting} 
                      className="h-12 pt-2.5 rounded-xl border-slate-300 focus:border-emerald-500 cursor-pointer file:cursor-pointer" 
                    />
                  </div>
                  
                  {/* PROGRESS BAR ANIMASI */}
                  {isImporting && importProgress && (
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                          <Loader2 className="animate-spin h-4 w-4" /> Memproses File...
                        </span>
                        <span className="text-sm font-black text-emerald-600">{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="w-full bg-emerald-200/50 rounded-full h-2 mb-2 overflow-hidden shadow-inner">
                        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
                      </div>
                      <p className="text-xs font-mono text-emerald-700 truncate">Membaca: {importProgress.fileName}</p>
                    </div>
                  )}

                  {importLogs.length > 0 && (
                    <div className="mt-4 border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5"/> Laporan Data Tidak Terekam:
                      </div>
                      <ScrollArea className="h-48 bg-white p-4 text-xs font-mono text-rose-600 leading-relaxed">
                        {importLogs.map((log, i) => (
                          <div key={i} className="mb-2 border-b border-rose-50 pb-2 flex items-start gap-2">
                            <span className="shrink-0 text-rose-400 font-bold">•</span>
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

        {/* TABS UTAMA MODERN */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex justify-between items-center overflow-x-auto custom-scrollbar">
            <TabsList className="bg-transparent h-auto p-0 space-x-8 min-w-max">
              <TabsTrigger value="detail" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-600 data-[state=active]:border-b-2 border-amber-600 rounded-none px-0 pb-3 pt-1 font-bold text-base flex items-center gap-2 hover:text-amber-600 transition-colors text-slate-500">
                <TableProperties className="h-5 w-5"/> Detail Rekap PDSS
              </TabsTrigger>
              <TabsTrigger value="detail_span" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 border-indigo-600 rounded-none px-0 pb-3 pt-1 font-bold text-base flex items-center gap-2 hover:text-indigo-600 transition-colors text-slate-500">
                <TableProperties className="h-5 w-5"/> Detail Rekap SPAN
              </TabsTrigger>
              <TabsTrigger value="snbp" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-600 data-[state=active]:border-b-2 border-emerald-600 rounded-none px-0 pb-3 pt-1 font-bold text-base hover:text-emerald-600 transition-colors text-slate-500">
                Kuota SNBP 40%
              </TabsTrigger>
              <TabsTrigger value="span" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-purple-600 data-[state=active]:border-b-2 border-purple-600 rounded-none px-0 pb-3 pt-1 font-bold text-base hover:text-purple-600 transition-colors text-slate-500">
                Analitik SPAN
              </TabsTrigger>
              <TabsTrigger value="ijazah" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 border-blue-600 rounded-none px-0 pb-3 pt-1 font-bold text-base hover:text-blue-600 transition-colors text-slate-500">
                Simulasi Ijazah
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 relative">
            {filterKelas === 'NONE' ? (
              <div className="h-[500px] flex flex-col items-center justify-center text-slate-400 bg-white">
                <Filter className="h-12 w-12 mb-4 opacity-30 text-amber-500" />
                <p className="font-bold text-slate-600 text-lg">Pilih Kelas Terlebih Dahulu</p>
                <p className="text-sm mt-1 max-w-md text-center">Silakan pilih kelas di kolom filter atas untuk menampilkan data nilai. Ini mencegah komputer Anda menjadi *lag* saat membuka ribuan data.</p>
              </div>
            ) : finalFilteredData.length === 0 ? (
               <div className="h-[500px] flex flex-col items-center justify-center text-slate-400 bg-white">
                <Search className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium text-slate-500">Tidak ada siswa yang cocok dengan filter.</p>
              </div>
            ) : (
              <>
                {/* TAB: DETAIL SNBP (PDSS) - FULLY HTML NATIVE UNTUK STICKY */}
                <TabsContent value="detail" className="m-0">
                  <div className="p-5 bg-gradient-to-r from-amber-50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-amber-100">
                    <p className="text-sm text-amber-800 font-medium">Menampilkan nilai mentah sesuai format PDSS (Dikumpulkan per Semester).</p>
                    <Button onClick={() => exportToExcel('DETAIL')} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl gap-2 shadow-md border-0"><Download className="h-4 w-4"/> Export Format PDSS</Button>
                  </div>
                  
                  <div className="h-[500px] overflow-auto custom-scrollbar bg-white relative">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                      <thead className="sticky top-0 z-40 shadow-md ring-1 ring-slate-200">
                        <tr className="bg-slate-100">
                          <th rowSpan={2} className="sticky left-0 z-50 bg-slate-100 border-r border-b border-slate-300 p-4 text-left font-extrabold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[250px]">Rank / Nama Siswa</th>
                          <th rowSpan={2} className="text-center border-r border-b border-slate-300 bg-emerald-100 font-extrabold text-emerald-900 px-5">Jml Total</th>
                          <th rowSpan={2} className="text-center border-r border-b border-slate-300 bg-blue-100 font-extrabold text-blue-900 px-5">Rata-rata</th>
                          
                          {arraySemester.map(smt => (
                            <th key={`h-snbp-smt-${smt}`} colSpan={mapelSNBP.length} className="text-center border-r border-b border-slate-300 font-extrabold bg-amber-200 text-amber-900 px-4 py-2">
                              Semester {smt}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-amber-50">
                          {arraySemester.map(smt => (
                            mapelSNBP.map((mp: string) => (
                              <th key={`sub-snbp-${smt}-${mp}`} className="text-center text-[10px] font-bold text-slate-700 p-2 border-b border-r border-slate-300 min-w-[55px]">
                                <span title={mp} className="cursor-help border-b border-slate-400 border-dashed pb-0.5">{getShortMapel(mp)}</span>
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((s) => (
                          <tr key={`raw-${s.id}`} className="group hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 z-30 bg-white group-hover:bg-slate-50 border-r border-b border-slate-200 p-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-400 text-sm w-5">{s.rankSnbp}.</span>
                                <div>
                                  <div className="font-bold text-slate-800 leading-tight">{s.nama_lengkap}</div>
                                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">NISN: {s.nisn} <span className="mx-1 text-slate-300">|</span> <span className="text-amber-600">{s.namaKelas}</span></div>
                                </div>
                              </div>
                            </td>
                            <td className="text-center font-mono font-bold border-r border-b border-slate-200 bg-emerald-50/50 group-hover:bg-emerald-100/50 text-emerald-700">{s.jumlahSnbp}</td>
                            <td className="text-center font-mono font-bold border-r border-b border-slate-200 bg-blue-50/50 group-hover:bg-blue-100/50 text-blue-700">{s.rataSnbp}</td>
                            
                            {arraySemester.map(smt => (
                              mapelSNBP.map((mp: string) => {
                                const key = `nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik
                                const val = s.rekap_nilai_akademik?.[key]?.[mp]
                                return (
                                  <td key={`val-${s.id}-${smt}-${mp}`} className="text-center font-mono text-sm text-slate-700 p-2 border-r border-b border-slate-200">
                                    {val || '-'}
                                  </td>
                                )
                              })
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* TAB: DETAIL SPAN */}
                <TabsContent value="detail_span" className="m-0">
                  <div className="p-5 bg-gradient-to-r from-indigo-50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-100">
                    <p className="text-sm text-indigo-800 font-medium">Menampilkan nilai mentah SPAN-PTKIN (Dikelompokan per Semester).</p>
                    <Button onClick={() => exportToExcel('DETAIL_SPAN')} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl gap-2 shadow-md border-0"><Download className="h-4 w-4"/> Export Format SPAN</Button>
                  </div>
                  
                  <div className="h-[500px] overflow-auto custom-scrollbar bg-white relative">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                      <thead className="sticky top-0 z-40 shadow-md ring-1 ring-slate-200">
                        <tr className="bg-slate-100">
                          <th rowSpan={2} className="sticky left-0 z-50 bg-slate-100 border-r border-b border-slate-300 p-4 text-left font-extrabold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[250px]">Rank / Nama Siswa</th>
                          <th rowSpan={2} className="text-center border-r border-b border-slate-300 bg-emerald-100 font-extrabold text-emerald-900 px-5">Jml Total</th>
                          <th rowSpan={2} className="text-center border-r border-b border-slate-300 bg-blue-100 font-extrabold text-blue-900 px-5">Rata-rata</th>
                          
                          {arraySemester.map(smt => (
                            <th key={`h-span-smt-${smt}`} colSpan={mapelSPAN.length} className="text-center border-r border-b border-slate-300 font-extrabold bg-indigo-200 text-indigo-900 px-4 py-2">
                              Semester {smt}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-indigo-50">
                          {arraySemester.map(smt => (
                            mapelSPAN.map((mp: string) => (
                              <th key={`sub-span-${smt}-${mp}`} className="text-center text-[10px] font-bold text-slate-700 p-2 border-b border-r border-slate-300 min-w-[55px]">
                                <span title={mp} className="cursor-help border-b border-slate-400 border-dashed pb-0.5">{getShortMapel(mp)}</span>
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((s) => (
                          <tr key={`raw-span-${s.id}`} className="group hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 z-30 bg-white group-hover:bg-slate-50 border-r border-b border-slate-200 p-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-400 text-sm w-5">{s.rankSpan}.</span>
                                <div>
                                  <div className="font-bold text-slate-800 leading-tight">{s.nama_lengkap}</div>
                                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">NISN: {s.nisn} <span className="mx-1 text-slate-300">|</span> <span className="text-indigo-600">{s.namaKelas}</span></div>
                                </div>
                              </div>
                            </td>
                            <td className="text-center font-mono font-bold border-r border-b border-slate-200 bg-emerald-50/50 group-hover:bg-emerald-100/50 text-emerald-700">{s.jumlahSpan}</td>
                            <td className="text-center font-mono font-bold border-r border-b border-slate-200 bg-blue-50/50 group-hover:bg-blue-100/50 text-blue-700">{s.rataSpan}</td>
                            
                            {arraySemester.map(smt => (
                              mapelSPAN.map((mp: string) => {
                                const key = `nilai_smt${smt}` as keyof typeof s.rekap_nilai_akademik
                                const val = s.rekap_nilai_akademik?.[key]?.[mp]
                                return (
                                  <td key={`val-span-${s.id}-${smt}-${mp}`} className="text-center font-mono text-sm text-slate-700 p-2 border-r border-b border-slate-200">
                                    {val || '-'}
                                  </td>
                                )
                              })
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* TAB SNBP */}
                <TabsContent value="snbp" className="m-0">
                  <div className="p-5 bg-gradient-to-r from-emerald-50/50 to-white flex justify-between items-center border-b border-emerald-100">
                    <p className="text-sm text-emerald-800 font-medium">Ranking Global Angkatan. Kuota 40% (<strong className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-900">{kuota40Persen} Siswa Teratas</strong>) ditandai Hijau Tebal.</p>
                    <Button onClick={() => exportToExcel('SNBP')} variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-xl gap-2 shadow-sm bg-white"><Download className="h-4 w-4"/> Export Rekap SNBP</Button>
                  </div>
                  <div className="h-[500px] overflow-auto custom-scrollbar bg-white relative">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                      <thead className="sticky top-0 z-40 shadow-sm bg-slate-100 ring-1 ring-slate-200">
                        <tr>
                          <th className="w-20 text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Rank Global</th>
                          <th className="font-extrabold text-slate-800 p-4 border-b border-slate-300 text-left">Nama Siswa & Kelas</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Jumlah Nilai</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Rata-rata (5 Smt)</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Status Kelayakan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((s) => {
                          const isEligible = eligibleSnbpIds.has(s.id)
                          return (
                            <tr key={`snbp-${s.id}`} className={`border-b border-slate-100 transition-colors ${isEligible ? 'bg-gradient-to-r from-emerald-50/60 to-transparent' : 'hover:bg-slate-50/50'}`}>
                              <td className="text-center font-black text-slate-700 text-lg p-4">{s.rankSnbp}</td>
                              <td className="p-4">
                                <div className={`font-bold ${isEligible ? 'text-emerald-900' : 'text-slate-800'}`}>{s.nama_lengkap}</div>
                                <div className="text-xs font-medium text-slate-500 mt-0.5">{s.nisn} <span className="mx-1 text-slate-300">|</span> <span className="text-emerald-600 font-bold">{s.namaKelas}</span></div>
                              </td>
                              <td className="text-center font-mono font-medium text-slate-600 text-base p-4">{s.jumlahSnbp}</td>
                              <td className={`text-center font-mono font-bold text-lg p-4 ${isEligible ? 'text-emerald-700' : 'text-slate-700'}`}>{s.rataSnbp}</td>
                              <td className="text-center p-4">
                                {isEligible ? (
                                  <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wider shadow-sm shadow-emerald-200">
                                    <Sparkles className="h-3.5 w-3.5"/> ELIGIBLE 40%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full">Reguler</span>
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
                <TabsContent value="span" className="m-0">
                   <div className="p-5 bg-gradient-to-r from-purple-50 to-white flex justify-between items-center border-b border-purple-100">
                    <p className="text-sm text-purple-800 font-medium">Ranking Global berdasarkan komponen mata pelajaran SPAN-PTKIN.</p>
                    <Button onClick={() => exportToExcel('SPAN')} variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-100 rounded-xl gap-2 shadow-sm bg-white"><Download className="h-4 w-4"/> Export Rekap SPAN</Button>
                  </div>
                  <div className="h-[500px] overflow-auto custom-scrollbar bg-white relative">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                      <thead className="sticky top-0 z-40 shadow-sm bg-slate-100 ring-1 ring-slate-200">
                        <tr>
                          <th className="w-20 text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Rank Global</th>
                          <th className="font-extrabold text-slate-800 p-4 border-b border-slate-300 text-left">Nama Siswa & Kelas</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Jumlah Nilai</th>
                          <th className="text-center bg-purple-200 font-extrabold text-purple-900 p-4 border-b border-slate-300">Rata-rata SPAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((s) => (
                          <tr key={`span-rk-${s.id}`} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                            <td className="text-center font-black text-slate-700 text-lg p-4">{s.rankSpan}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-800">{s.nama_lengkap}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{s.nisn} <span className="mx-1 text-slate-300">|</span> <span className="text-purple-600 font-bold">{s.namaKelas}</span></div>
                            </td>
                            <td className="text-center font-mono font-medium text-slate-600 text-base p-4">{s.jumlahSpan}</td>
                            <td className="text-center font-mono font-black text-xl text-purple-700 bg-purple-50/30 p-4">{s.rataSpan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* TAB IJAZAH */}
                <TabsContent value="ijazah" className="m-0">
                   <div className="p-5 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center border-b border-blue-100">
                    <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                      <span className="bg-white px-2 py-1 rounded-md shadow-sm border border-blue-200 text-xs font-bold text-blue-600">Formula Ijazah</span>
                      ({bobotRapor*100}% Rata-rata 5 SMT) + ({bobotUM*100}% Nilai Ujian Madrasah)
                    </p>
                    <Button onClick={() => exportToExcel('IJAZAH')} variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-100 rounded-xl gap-2 shadow-sm bg-white"><Download className="h-4 w-4"/> Export Simulasi Ijazah</Button>
                  </div>
                  <div className="h-[500px] overflow-auto custom-scrollbar bg-white relative">
                    <table className="w-full border-collapse text-sm whitespace-nowrap">
                      <thead className="sticky top-0 z-40 shadow-sm bg-slate-100 ring-1 ring-slate-200">
                        <tr>
                          <th className="w-20 text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Rank Global</th>
                          <th className="font-extrabold text-slate-800 p-4 border-b border-slate-300 text-left">Nama Siswa & Kelas</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Rata2 Rapot ({bobotRapor*100}%)</th>
                          <th className="text-center font-extrabold text-slate-800 p-4 border-b border-slate-300">Nilai UM ({bobotUM*100}%)</th>
                          <th className="text-center bg-blue-200 font-extrabold text-blue-900 p-4 border-b border-slate-300">NILAI AKHIR IJAZAH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((s) => (
                          <tr key={`ijz-rk-${s.id}`} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                            <td className="text-center font-black text-slate-700 text-lg p-4">{s.rankIjazah}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-800">{s.nama_lengkap}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{s.nisn} <span className="mx-1 text-slate-300">|</span> <span className="text-blue-600 font-bold">{s.namaKelas}</span></div>
                            </td>
                            <td className="text-center font-mono text-base text-slate-600 font-bold p-4">{s.rataSnbp}</td>
                            <td className="text-center font-mono text-base text-slate-600 font-bold p-4">{s.rataUM}</td>
                            <td className="text-center font-mono font-black text-xl text-blue-700 bg-blue-50/30 p-4">{s.nilaiAkhir}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                
                {/* FOOTER PAGINATION UNTUK SEMUA TAB */}
                <PaginationFooter />
              </>
            )}
          </div>

        </Tabs>
      </div>
    </>
  )
}