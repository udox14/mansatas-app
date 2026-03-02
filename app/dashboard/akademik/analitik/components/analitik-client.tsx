'use client'

import { useState, useMemo, Fragment } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Medal, FileSpreadsheet, Loader2, TableProperties } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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

export function AnalitikClient({ dataSiswa, pengaturan }: { dataSiswa: SiswaData[], pengaturan: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [targetImport, setTargetImport] = useState('nilai_smt1')

  const mapelSNBP = pengaturan?.mapel_snbp || []
  const mapelSPAN = pengaturan?.mapel_span || []
  const bobotRapor = (pengaturan?.bobot_rapor || 60) / 100
  const bobotUM = (pengaturan?.bobot_um || 40) / 100

  // ==========================================
  // ENGINE PENGHITUNG (Ditambah Jumlah Total)
  // ==========================================
  const processedData = useMemo(() => {
    return dataSiswa.map(s => {
      const rekap = s.rekap_nilai_akademik || { nilai_smt1:{}, nilai_smt2:{}, nilai_smt3:{}, nilai_smt4:{}, nilai_smt5:{}, nilai_um:{} }
      
      const hitungNilai = (mapelPilihan: string[]) => {
        if (mapelPilihan.length === 0) return { rata2: 0, jumlah: 0 }
        let totalSeluruhMapel = 0 
        let jumlahMentahTotal = 0 
        
        mapelPilihan.forEach((mp: string) => {
          const n1 = Number(rekap.nilai_smt1[mp]) || 0
          const n2 = Number(rekap.nilai_smt2[mp]) || 0
          const n3 = Number(rekap.nilai_smt3[mp]) || 0
          const n4 = Number(rekap.nilai_smt4[mp]) || 0
          const n5 = Number(rekap.nilai_smt5[mp]) || 0
          
          jumlahMentahTotal += (n1 + n2 + n3 + n4 + n5)
          const rata2MapelIni = (n1 + n2 + n3 + n4 + n5) / 5
          totalSeluruhMapel += rata2MapelIni
        })
        
        return {
          rata2: totalSeluruhMapel / mapelPilihan.length,
          jumlah: jumlahMentahTotal
        }
      }

      const snbp = hitungNilai(mapelSNBP)
      const span = hitungNilai(mapelSPAN)
      
      let rataUM = 0
      if (mapelSNBP.length > 0) {
        let totUM = 0
        mapelSNBP.forEach((mp: string) => totUM += (Number(rekap.nilai_um[mp]) || 0))
        rataUM = totUM / mapelSNBP.length
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
        nilaiAkhir: parseFloat(nilaiAkhir.toFixed(2))
      }
    })
  }, [dataSiswa, mapelSNBP, mapelSPAN, bobotRapor, bobotUM])

  const rankedSnbp = [...processedData]
    .filter(s => s.kelas?.tingkat === 12)
    .sort((a, b) => b.rataSnbp - a.rataSnbp)

  const kuota40Persen = Math.floor(rankedSnbp.length * 0.4)
  const eligibleSnbpIds = new Set(rankedSnbp.slice(0, kuota40Persen).map(s => s.id))

  // ==========================================
  // HANDLER IMPORT RDM
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) {
          alert('Library pemroses Excel sedang dimuat. Silakan tunggu.')
          setIsImporting(false)
          return
        }
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        
        const result = await importNilaiDariExcel(jsonData, targetImport)
        if (result.error) alert(result.error)
        else alert(result.success)
      } catch (err) { alert('Gagal membaca Excel.') } 
      finally { setIsImporting(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  // ==========================================
  // HANDLER EXPORT EXCEL
  // ==========================================
  const exportToExcel = (tipe: 'SNBP' | 'SPAN' | 'IJAZAH' | 'DETAIL' | 'DETAIL_SPAN') => {
    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert('Library pembuat Excel sedang dimuat. Silakan tunggu.')
      return
    }

    let dataExport: any[] = []
    
    if (tipe === 'SNBP') {
      dataExport = rankedSnbp.map((s, index) => ({
        "Ranking": index + 1,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Jumlah Nilai": s.jumlahSnbp,
        "Rata-rata SNBP": s.rataSnbp,
        "Status SNBP": eligibleSnbpIds.has(s.id) ? "ELIGIBLE (Top 40%)" : "Reguler"
      }))
    } else if (tipe === 'SPAN') {
      const rankedSpan = [...processedData].filter(s => s.kelas?.tingkat === 12).sort((a, b) => b.rataSpan - a.rataSpan)
      dataExport = rankedSpan.map((s, index) => ({
        "Ranking SPAN": index + 1,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Jumlah Nilai SPAN": s.jumlahSpan,
        "Rata-rata SPAN": s.rataSpan
      }))
    } else if (tipe === 'IJAZAH') {
      const rankedIjazah = [...processedData].filter(s => s.kelas?.tingkat === 12).sort((a, b) => b.nilaiAkhir - a.nilaiAkhir)
      dataExport = rankedIjazah.map((s, index) => ({
        "Ranking Ijazah": index + 1,
        "NISN": s.nisn,
        "Nama Lengkap": s.nama_lengkap,
        "Kelas": s.namaKelas,
        "Rata-rata Rapot (5 SMT)": s.rataSnbp,
        "Nilai UM": s.rataUM,
        "Nilai Akhir Ijazah": s.nilaiAkhir
      }))
    } else if (tipe === 'DETAIL') {
      // EXPORT DETAIL SNBP
      dataExport = rankedSnbp.map((s, index) => {
        let row: any = {
          "Ranking SNBP": index + 1,
          "NISN": s.nisn,
          "Nama Lengkap": s.nama_lengkap,
          "Kelas": s.namaKelas,
          "Status SNBP": eligibleSnbpIds.has(s.id) ? "ELIGIBLE" : "Reguler",
          "JUMLAH NILAI": s.jumlahSnbp,
          "RATA-RATA TOTAL": s.rataSnbp
        }
        mapelSNBP.forEach((mp: string) => {
          row[`${mp} Smt 1`] = s.rekap_nilai_akademik?.nilai_smt1?.[mp] || 0
          row[`${mp} Smt 2`] = s.rekap_nilai_akademik?.nilai_smt2?.[mp] || 0
          row[`${mp} Smt 3`] = s.rekap_nilai_akademik?.nilai_smt3?.[mp] || 0
          row[`${mp} Smt 4`] = s.rekap_nilai_akademik?.nilai_smt4?.[mp] || 0
          row[`${mp} Smt 5`] = s.rekap_nilai_akademik?.nilai_smt5?.[mp] || 0
        })
        return row
      })
    } else if (tipe === 'DETAIL_SPAN') {
      // EXPORT DETAIL SPAN
      const rankedSpan = [...processedData].filter(s => s.kelas?.tingkat === 12).sort((a, b) => b.rataSpan - a.rataSpan)
      dataExport = rankedSpan.map((s, index) => {
        let row: any = {
          "Ranking SPAN": index + 1,
          "NISN": s.nisn,
          "Nama Lengkap": s.nama_lengkap,
          "Kelas": s.namaKelas,
          "JUMLAH NILAI": s.jumlahSpan,
          "RATA-RATA SPAN": s.rataSpan
        }
        mapelSPAN.forEach((mp: string) => {
          row[`${mp} Smt 1`] = s.rekap_nilai_akademik?.nilai_smt1?.[mp] || 0
          row[`${mp} Smt 2`] = s.rekap_nilai_akademik?.nilai_smt2?.[mp] || 0
          row[`${mp} Smt 3`] = s.rekap_nilai_akademik?.nilai_smt3?.[mp] || 0
          row[`${mp} Smt 4`] = s.rekap_nilai_akademik?.nilai_smt4?.[mp] || 0
          row[`${mp} Smt 5`] = s.rekap_nilai_akademik?.nilai_smt5?.[mp] || 0
        })
        return row
      })
    }

    const ws = XLSX.utils.json_to_sheet(dataExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Laporan_${tipe}`)
    XLSX.writeFile(wb, `MANSATAS_Laporan_${tipe}.xlsx`)
  }

  const displayData = rankedSnbp.filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm))
  const displayDataSpan = [...processedData].filter(s => s.kelas?.tingkat === 12).sort((a, b) => b.rataSpan - a.rataSpan).filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm))

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      <div className="space-y-6 mt-8">
        {/* TOOLBAR IMPORT & SEARCH */}
        <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari Nama / NISN Siswa..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2"><FileSpreadsheet className="h-4 w-4"/> Import Nilai RDM/UM</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import Nilai Akademik Siswa</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  Kolom Excel yang WAJIB ada hanya: <strong>NISN</strong>. <br/>
                  Sisanya adalah nama mata pelajaran (misal: Matematika, Biologi). <br/>
                  Sistem akan otomatis mencocokkan ke database.
                </div>
                <div>
                  <Label>Pilih Tujuan Import (Semester Berapa?)</Label>
                  <Select value={targetImport} onValueChange={setTargetImport}>
                    <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
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
                <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={isImporting} />
                {isImporting && <p className="text-sm text-emerald-600 flex items-center"><Loader2 className="animate-spin h-4 w-4 mr-2"/> Mengimport ratusan nilai...</p>}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* TABS UTAMA */}
        <Tabs defaultValue="detail" className="w-full bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3 flex justify-between items-center overflow-x-auto custom-scrollbar">
            <TabsList className="bg-transparent h-auto p-0 space-x-6 min-w-max">
              <TabsTrigger value="detail" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-600 data-[state=active]:border-b-2 border-emerald-600 rounded-none px-0 pb-2 pt-1 font-bold text-base flex items-center gap-2">
                <TableProperties className="h-4 w-4"/> Detail Rekap PDSS
              </TabsTrigger>
              <TabsTrigger value="detail_span" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 border-indigo-600 rounded-none px-0 pb-2 pt-1 font-bold text-base flex items-center gap-2">
                <TableProperties className="h-4 w-4"/> Detail Rekap SPAN
              </TabsTrigger>
              <TabsTrigger value="snbp" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-600 data-[state=active]:border-b-2 border-amber-600 rounded-none px-0 pb-2 pt-1 font-bold text-base">Kuota SNBP 40%</TabsTrigger>
              <TabsTrigger value="span" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-purple-600 data-[state=active]:border-b-2 border-purple-600 rounded-none px-0 pb-2 pt-1 font-bold text-base">Analitik SPAN</TabsTrigger>
              <TabsTrigger value="ijazah" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 border-blue-600 rounded-none px-0 pb-2 pt-1 font-bold text-base">Simulasi Ijazah</TabsTrigger>
            </TabsList>
          </div>

          {/* TAB: DETAIL SNBP (PDSS) */}
          <TabsContent value="detail" className="m-0">
            <div className="p-4 bg-emerald-50/50 flex justify-between items-center border-b">
              <p className="text-sm text-emerald-800">Menampilkan nilai mentah lengkap dengan Jumlah & Rata-rata sesuai urutan format PDSS (SNBP).</p>
              <Button onClick={() => exportToExcel('DETAIL')} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"><Download className="h-4 w-4"/> Export Format PDSS</Button>
            </div>
            
            <div className="h-[500px] overflow-auto custom-scrollbar relative">
              <Table className="min-w-max border-collapse">
                <TableHeader className="sticky top-0 z-20 shadow-sm bg-white">
                  <TableRow>
                    <TableHead rowSpan={2} className="min-w-[250px] border-r bg-slate-100 z-30 font-extrabold text-slate-700 left-0 sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Siswa & Kelas</TableHead>
                    <TableHead rowSpan={2} className="text-center border-r bg-emerald-50 font-extrabold text-emerald-800 px-4">Jumlah Total</TableHead>
                    <TableHead rowSpan={2} className="text-center border-r bg-blue-50 font-extrabold text-blue-800 px-4">Rata-rata</TableHead>
                    
                    {mapelSNBP.map((mp: string, idx: number) => (
                      <TableHead key={`head-${mp}`} colSpan={5} className="text-center border-r border-slate-300 font-bold bg-emerald-100/50 text-emerald-900 px-2 py-1">
                        {idx + 1}. {mp}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-slate-50">
                    {mapelSNBP.map((mp: string) => (
                      <Fragment key={`sub-${mp}`}>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S1</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S2</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S3</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S4</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px] border-r border-slate-300">S5</TableHead>
                      </Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((s) => (
                    <TableRow key={`raw-${s.id}`} className="hover:bg-slate-50">
                      <TableCell className="border-r left-0 sticky bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <div className="font-bold text-slate-700">{s.nama_lengkap}</div>
                        <div className="text-xs text-slate-500">{s.nisn} | {s.namaKelas}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold border-r bg-emerald-50/50 text-emerald-700">{s.jumlahSnbp}</TableCell>
                      <TableCell className="text-center font-mono font-bold border-r bg-blue-50/50 text-blue-700">{s.rataSnbp}</TableCell>
                      
                      {mapelSNBP.map((mp: string) => (
                        <Fragment key={`val-${s.id}-${mp}`}>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt1?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt2?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt3?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt4?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2 border-r border-slate-200 bg-slate-50/30">{s.rekap_nilai_akademik?.nilai_smt5?.[mp] || '-'}</TableCell>
                        </Fragment>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB BARU: DETAIL SPAN */}
          <TabsContent value="detail_span" className="m-0">
            <div className="p-4 bg-indigo-50/50 flex justify-between items-center border-b">
              <p className="text-sm text-indigo-800">Menampilkan nilai mentah lengkap dengan Jumlah & Rata-rata sesuai urutan format SPAN-PTKIN.</p>
              <Button onClick={() => exportToExcel('DETAIL_SPAN')} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"><Download className="h-4 w-4"/> Export Format SPAN</Button>
            </div>
            
            <div className="h-[500px] overflow-auto custom-scrollbar relative">
              <Table className="min-w-max border-collapse">
                <TableHeader className="sticky top-0 z-20 shadow-sm bg-white">
                  <TableRow>
                    <TableHead rowSpan={2} className="min-w-[250px] border-r bg-slate-100 z-30 font-extrabold text-slate-700 left-0 sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Siswa & Kelas</TableHead>
                    <TableHead rowSpan={2} className="text-center border-r bg-indigo-50 font-extrabold text-indigo-800 px-4">Jumlah Total</TableHead>
                    <TableHead rowSpan={2} className="text-center border-r bg-blue-50 font-extrabold text-blue-800 px-4">Rata-rata</TableHead>
                    
                    {mapelSPAN.map((mp: string, idx: number) => (
                      <TableHead key={`head-${mp}`} colSpan={5} className="text-center border-r border-slate-300 font-bold bg-indigo-100/50 text-indigo-900 px-2 py-1">
                        {idx + 1}. {mp}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-slate-50">
                    {mapelSPAN.map((mp: string) => (
                      <Fragment key={`sub-${mp}`}>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S1</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S2</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S3</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px]">S4</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 p-2 min-w-[40px] border-r border-slate-300">S5</TableHead>
                      </Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayDataSpan.map((s) => (
                    <TableRow key={`raw-span-${s.id}`} className="hover:bg-slate-50">
                      <TableCell className="border-r left-0 sticky bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <div className="font-bold text-slate-700">{s.nama_lengkap}</div>
                        <div className="text-xs text-slate-500">{s.nisn} | {s.namaKelas}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold border-r bg-indigo-50/50 text-indigo-700">{s.jumlahSpan}</TableCell>
                      <TableCell className="text-center font-mono font-bold border-r bg-blue-50/50 text-blue-700">{s.rataSpan}</TableCell>
                      
                      {mapelSPAN.map((mp: string) => (
                        <Fragment key={`val-span-${s.id}-${mp}`}>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt1?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt2?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt3?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2">{s.rekap_nilai_akademik?.nilai_smt4?.[mp] || '-'}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-slate-600 p-2 border-r border-slate-200 bg-slate-50/30">{s.rekap_nilai_akademik?.nilai_smt5?.[mp] || '-'}</TableCell>
                        </Fragment>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB SNBP */}
          <TabsContent value="snbp" className="m-0">
            <div className="p-4 bg-amber-50/50 flex justify-between items-center border-b">
              <p className="text-sm text-amber-800">Menampilkan Ranking Angkatan. Kuota 40% (<strong>{kuota40Persen} Siswa Teratas</strong>) ditandai Hijau Tebal.</p>
              <Button onClick={() => exportToExcel('SNBP')} size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-100 gap-2"><Download className="h-4 w-4"/> Export Rekap SNBP</Button>
            </div>
            <div className="h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Nama Siswa & Kelas</TableHead>
                    <TableHead className="text-center">Jumlah Nilai</TableHead>
                    <TableHead className="text-center">Rata-rata (5 Smt)</TableHead>
                    <TableHead className="text-center">Status Kelayakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((s, idx) => {
                    const isEligible = eligibleSnbpIds.has(s.id)
                    return (
                      <TableRow key={s.id} className={isEligible ? 'bg-amber-50/40' : ''}>
                        <TableCell className="text-center font-bold text-slate-500">{idx + 1}</TableCell>
                        <TableCell>
                          <div className={`font-bold ${isEligible ? 'text-amber-800' : 'text-slate-700'}`}>{s.nama_lengkap}</div>
                          <div className="text-xs text-slate-500">{s.nisn} | {s.namaKelas}</div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium text-slate-600">{s.jumlahSnbp}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-lg">{s.rataSnbp}</TableCell>
                        <TableCell className="text-center">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider border border-amber-200">
                              <Medal className="h-3 w-3"/> ELIGIBLE 40%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">Reguler</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB SPAN */}
          <TabsContent value="span" className="m-0">
             <div className="p-4 bg-purple-50/50 flex justify-between items-center border-b">
              <p className="text-sm text-purple-800">Menampilkan Ranking berdasarkan komponen mata pelajaran SPAN-PTKIN.</p>
              <Button onClick={() => exportToExcel('SPAN')} size="sm" variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-100 gap-2"><Download className="h-4 w-4"/> Export SPAN</Button>
            </div>
            <div className="h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Nama Siswa & Kelas</TableHead>
                    <TableHead className="text-center">Jumlah Nilai</TableHead>
                    <TableHead className="text-center bg-purple-50 text-purple-800">Rata-rata SPAN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayDataSpan.map((s, idx) => (
                    <TableRow key={`span-${s.id}`}>
                      <TableCell className="text-center font-bold text-slate-500">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-700">{s.nama_lengkap}</div>
                        <div className="text-xs text-slate-500">{s.nisn} | {s.namaKelas}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-medium text-slate-600">{s.jumlahSpan}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-lg text-purple-700 bg-purple-50/30">{s.rataSpan}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB IJAZAH */}
          <TabsContent value="ijazah" className="m-0">
             <div className="p-4 bg-blue-50/50 flex justify-between items-center border-b">
              <p className="text-sm text-blue-800">Formula: ({bobotRapor*100}% Rata-rata 5 Semester) + ({bobotUM*100}% Nilai Ujian Madrasah)</p>
              <Button onClick={() => exportToExcel('IJAZAH')} size="sm" variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-100 gap-2"><Download className="h-4 w-4"/> Export Ijazah</Button>
            </div>
            <div className="h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Nama Siswa & Kelas</TableHead>
                    <TableHead className="text-center">Rata2 Rapot ({bobotRapor*100}%)</TableHead>
                    <TableHead className="text-center">Nilai UM ({bobotUM*100}%)</TableHead>
                    <TableHead className="text-center bg-blue-50 text-blue-800">NILAI AKHIR IJAZAH</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...displayData].sort((a,b) => b.nilaiAkhir - a.nilaiAkhir).map((s) => (
                    <TableRow key={`ijz-${s.id}`}>
                      <TableCell>
                        <div className="font-bold text-slate-700">{s.nama_lengkap}</div>
                        <div className="text-xs text-slate-500">{s.namaKelas}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{s.rataSnbp}</TableCell>
                      <TableCell className="text-center font-mono">{s.rataUM}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-lg text-blue-700 bg-blue-50/30">{s.nilaiAkhir}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </>
  )
}