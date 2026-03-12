// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/components/tab-penjurusan.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Play, Save, CheckCircle2, ArrowRight, Filter, Ticket, CloudLightning, AlertCircle, Search } from 'lucide-react'
import { simpanPlottingMassal, setDraftPenjurusanMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string, kelas_lama: string, minat_jurusan?: string | null }
type KelasType = { id: string, nama: string, kelompok: string, kapasitas: number, jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string, nama_lengkap: string, jk: string, kelas_lama: string, kelas_id: string, kelas_nama: string }

export function TabPenjurusan({ 
  siswaList, 
  kelasList,
  daftarJurusan = [] 
}: { 
  siswaList: SiswaType[], 
  kelasList: KelasType[],
  daftarJurusan?: string[]
}) {
  
  // State Data Penjurusan (Data di layar yang bisa diutak-atik sebelum disimpan)
  const [penjurusan, setPenjurusan] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    siswaList.forEach(s => { 
      if (s.minat_jurusan) {
        let val = s.minat_jurusan
        if (val === 'AGM') val = 'KEAGAMAAN'
        if (val === 'SOS') val = 'SOSHUM'
        init[s.id] = val
      } 
    })
    return init
  })

  useEffect(() => {
    const init: Record<string, string> = {}
    siswaList.forEach(s => { 
      if (s.minat_jurusan) {
        let val = s.minat_jurusan
        if (val === 'AGM') val = 'KEAGAMAAN'
        if (val === 'SOS') val = 'SOSHUM'
        init[s.id] = val
      } 
    })
    setPenjurusan(init)
  }, [siswaList])
  
  const hasUnsavedChanges = useMemo(() => {
    for (const siswa of siswaList) {
      let dbVal = siswa.minat_jurusan || null
      if (dbVal === 'AGM') dbVal = 'KEAGAMAAN'
      if (dbVal === 'SOS') dbVal = 'SOSHUM'
        
      const currentVal = penjurusan[siswa.id] || null
      if (dbVal !== currentVal) return true
    }
    return false
  }, [siswaList, penjurusan])

  // LAZY LOAD STATE & FILTER
  const [filterKelas, setFilterKelas] = useState('NONE')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSiswa, setSearchSiswa] = useState('') // STATE PENCARIAN
  
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasRunSimulation, setHasRunSimulation] = useState(false) 
  
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSavingPermanent, setIsSavingPermanent] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  const opsiJurusanDinamis = useMemo(() => daftarJurusan.filter(j => j !== 'UMUM'), [daftarJurusan])
  
  const kelasLamaUnik = useMemo(() => 
    Array.from(new Set(siswaList.map(s => s.kelas_lama)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), 
  [siswaList])

  // PERBAIKAN: Mengurutkan daftar wadah kelas menggunakan Natural Sort agar urut dari 11-1, 11-2 dst
  const sortedKelasList = useMemo(() => {
    return [...kelasList].sort((a, b) => a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' }))
  }, [kelasList])
  
  const plottedSiswaIds = useMemo(() => new Set(simulasiResult.map(r => r.siswa_id)), [simulasiResult])

  // LOGIKA LAZY LOAD & FILTERING
  const displayedSiswa = useMemo(() => {
    // Jika kelas belum dipilih, kosongkan array agar UI sangat ringan
    if (filterKelas === 'NONE') return []

    return siswaList.filter(s => {
      const matchKelas = filterKelas === 'ALL' || s.kelas_lama === filterKelas
      
      const isSet = !!penjurusan[s.id]
      const isPlotted = plottedSiswaIds.has(s.id)
      const failedPlot = hasRunSimulation && isSet && !isPlotted

      let matchStatus = true
      if (filterStatus === 'UNSET') matchStatus = !isSet
      if (filterStatus === 'SET') matchStatus = isSet
      if (filterStatus === 'PLOTTED') matchStatus = isPlotted
      if (filterStatus === 'FAILED') matchStatus = failedPlot

      const matchSearch = s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()) || s.nisn.includes(searchSiswa)

      return matchKelas && matchStatus && matchSearch
    })
  }, [siswaList, filterKelas, filterStatus, penjurusan, plottedSiswaIds, hasRunSimulation, searchSiswa])

  const handleToggleKelas = (id: string) => setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const handleSimpanDraftMassal = async () => {
    setIsSavingDraft(true)
    setSaveStatus('Menyimpan ke Cloud...')
    
    const payload = Object.entries(penjurusan).map(([id, minat_jurusan]) => ({ id, minat_jurusan }))

    siswaList.forEach(s => {
      if (s.minat_jurusan && !penjurusan[s.id]) {
        payload.push({ id: s.id, minat_jurusan: '' })
      }
    })

    const res = await setDraftPenjurusanMassal(payload) as { error?: string, success?: boolean }
    if (res.error) {
      alert(res.error)
      setSaveStatus('')
    } else {
      setSaveStatus('Tersimpan ☁️')
      setTimeout(() => setSaveStatus(''), 2000)
    }
    setIsSavingDraft(false)
  }

  const jalankanSimulasi = () => {
    if (hasUnsavedChanges) {
      alert("Harap tekan tombol 'SIMPAN TIKET JURUSAN' terlebih dahulu sebelum menjalankan simulasi!")
      return
    }

    setIsSimulating(true)
    setHasRunSimulation(false)
    setSimulasiResult([])
    setSuccessMsg('')
    
    setTimeout(() => {
      let hasil: HasilPlottingType[] = []
      let sisaSiswa = 0
      let errorMessage = ''

      // Menggunakan sortedKelasList untuk pembagian yang lebih natural
      const targetKelas = sortedKelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))

      const distributeGroup = (siswaGroup: SiswaType[], kelompok: string) => {
        const wadah = targetKelas.filter(k => k.kelompok === kelompok)
        if (siswaGroup.length > 0 && wadah.length === 0) {
          errorMessage += `\n- Kelas tujuan jurusan ${kelompok} belum dipilih!`
          sisaSiswa += siswaGroup.length; return
        }

        let kelasIndex = 0
        for (const siswa of siswaGroup) {
          let assigned = false
          let attempts = 0
          while (attempts < wadah.length) {
            let target = wadah[kelasIndex]
            if (target.sisa_kuota > 0) {
              hasil.push({ siswa_id: siswa.id, nama_lengkap: siswa.nama_lengkap, jk: siswa.jenis_kelamin, kelas_lama: siswa.kelas_lama, kelas_id: target.id, kelas_nama: target.nama })
              target.sisa_kuota--
              assigned = true
              kelasIndex = (kelasIndex + 1) % wadah.length
              break
            }
            kelasIndex = (kelasIndex + 1) % wadah.length
            attempts++
          }
          if (!assigned) sisaSiswa++
        }
      }

      const siswaSiapPlot = siswaList.filter(s => !!penjurusan[s.id])
      if (siswaSiapPlot.length === 0) {
        alert("Belum ada satupun siswa yang diberikan tiket penjurusan."); setIsSimulating(false); return
      }

      const kelompokUnik = Array.from(new Set(siswaSiapPlot.map(s => penjurusan[s.id])))
      kelompokUnik.forEach(kelompok => {
        const siswaKelompokIni = siswaSiapPlot.filter(s => penjurusan[s.id] === kelompok)
        const siswaL = siswaKelompokIni.filter(s => s.jenis_kelamin === 'L').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        const siswaP = siswaKelompokIni.filter(s => s.jenis_kelamin === 'P').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        distributeGroup(siswaL, kelompok)
        distributeGroup(siswaP, kelompok)
      })

      if (sisaSiswa > 0) alert(`PERINGATAN! Ada ${sisaSiswa} siswa gagal di-plot. Pastikan kapasitas mencukupi dan kelas dicentang.${errorMessage}`)
      
      setSimulasiResult(hasil)
      setHasRunSimulation(true)
      setIsSimulating(false)
    }, 600)
  }

  const simpanPermanen = async () => {
    if (simulasiResult.length === 0) return
    setIsSavingPermanent(true)
    const payload = simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id }))
    const res = await simpanPlottingMassal(payload)
    if (res.error) alert(res.error)
    else { 
      setSuccessMsg(res.success!)
      setSimulasiResult([])
      setPenjurusan({}) 
      setHasRunSimulation(false)
    }
    setIsSavingPermanent(false)
  }

  if (siswaList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Semua Terploting!</h3>
        <p className="text-slate-500 mt-2">Tidak ada data siswa kelas 10 yang perlu dijuruskan.</p>
      </div>
    )
  }

  const jumlahSiapPlot = Object.keys(penjurusan).length;
  const siswaTertahan = siswaList.length - jumlahSiapPlot;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      
      {/* ================= PANEL KIRI ================= */}
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><Ticket className="h-5 w-5"/></div>
                1. Tetapkan Tiket Jurusan
              </h3>
              <p className="text-sm text-slate-500 mt-1">Pilih kelas asal terlebih dahulu untuk mulai menjuruskan siswa.</p>
            </div>
            
            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
               {saveStatus && (
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1 border border-emerald-200 shadow-sm">
                  <CloudLightning className="h-3.5 w-3.5"/> {saveStatus}
                </span>
               )}
               
               <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 min-w-[80px] shadow-sm">
                    <span className="text-lg font-black text-emerald-700 leading-none">{jumlahSiapPlot}</span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Siap Plot</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 min-w-[80px] shadow-sm">
                    <span className="text-lg font-black text-rose-700 leading-none">{siswaTertahan}</span>
                    <span className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Belum Diset</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama siswa atau NISN..."
                value={searchSiswa}
                onChange={e => setSearchSiswa(e.target.value)}
                className="pl-9 h-10 rounded-lg bg-white border-slate-200 focus:border-indigo-500 shadow-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filter Kelas Asal</Label>
                <Select value={filterKelas} onValueChange={setFilterKelas}>
                  <SelectTrigger className={`h-10 rounded-lg transition-colors ${filterKelas === 'NONE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-100' : 'bg-white'}`}>
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="NONE" disabled className="text-slate-400 italic">-- Pilih Kelas --</SelectItem>
                    <SelectItem value="ALL" className="font-bold text-indigo-600">Tampilkan Semua (Berat)</SelectItem>
                    {kelasLamaUnik.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Tiket & Preview</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 rounded-lg bg-white"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="UNSET" className="text-rose-600 font-medium">1. Belum Diset</SelectItem>
                    <SelectItem value="SET" className="text-blue-600 font-medium">2. Sudah Diset</SelectItem>
                    {hasRunSimulation && (
                      <>
                        <SelectItem value="PLOTTED" className="text-emerald-600 font-bold bg-emerald-50/50">✓ Berhasil Masuk Preview</SelectItem>
                        <SelectItem value="FAILED" className="text-rose-600 font-bold bg-rose-50/50">⚠️ Gagal Plot / Penuh</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${hasUnsavedChanges ? 'max-h-20 mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
            <Button onClick={handleSimpanDraftMassal} disabled={isSavingDraft} className="w-full h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 gap-2 text-base animate-pulse">
              {isSavingDraft ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} 
              SIMPAN TIKET JURUSAN KE CLOUD
            </Button>
          </div>

          <ScrollArea className="h-[490px] border border-slate-200 rounded-lg bg-white shadow-inner relative">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                <TableRow>
                  <TableHead className="font-bold text-slate-600 pl-5">Siswa & Kelas Asal</TableHead>
                  <TableHead className="text-right font-bold text-slate-600 px-4 min-w-[260px]">Pilih Tiket Jurusan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterKelas === 'NONE' ? (
                   <TableRow>
                     <TableCell colSpan={2} className="h-48 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                          <Filter className="h-10 w-10 mb-3 opacity-50" />
                          <p className="font-medium text-slate-500">Pilih <strong className="text-indigo-600">Filter Kelas Asal</strong> di atas</p>
                          <p className="text-sm mt-1">Untuk mencegah lag, data ditampilkan per kelas.</p>
                        </div>
                     </TableCell>
                   </TableRow>
                ) : displayedSiswa.length === 0 ? (
                   <TableRow><TableCell colSpan={2} className="text-center h-32 text-slate-500">Tidak ada siswa yang cocok dengan filter.</TableCell></TableRow>
                ) : displayedSiswa.map(s => {
                  const hasTicket = !!penjurusan[s.id]
                  const isPlotted = plottedSiswaIds.has(s.id)
                  const failedPlot = hasRunSimulation && hasTicket && !isPlotted

                  return (
                    <TableRow key={s.id} className={`${failedPlot ? 'bg-rose-50/60' : isPlotted ? 'bg-emerald-50/30' : penjurusan[s.id] ? 'bg-indigo-50/10' : 'hover:bg-slate-50'} transition-colors`}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2">
                          <div className={`font-bold ${failedPlot ? 'text-rose-800' : 'text-slate-800'} line-clamp-1`}>{s.nama_lengkap}</div>
                          {isPlotted && <span title="Berhasil masuk preview"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /></span>}
                          {failedPlot && <span title="Gagal masuk kelas (kapasitas penuh/kelas tidak dipilih)"><AlertCircle className="h-4 w-4 text-rose-500 shrink-0" /></span>}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Dari: <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{s.kelas_lama}</span></div>
                      </TableCell>
                      <TableCell className="text-right px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-0.5">
                          {opsiJurusanDinamis.map(jur => {
                            const isActive = penjurusan[s.id] === jur
                            let label = jur
                            if(jur === 'SOSHUM') label = 'SOS'
                            if(jur === 'KEAGAMAAN') label = 'AGM'
                            if(jur.length > 8) label = jur.substring(0, 6) + '..'

                            return (
                              <button
                                key={jur}
                                onClick={() => {
                                  setPenjurusan(prev => {
                                    const newVal = {...prev}
                                    if (newVal[s.id] === jur) delete newVal[s.id] 
                                    else newVal[s.id] = jur 
                                    return newVal
                                  })
                                }}
                                title={jur}
                                className={`px-2.5 py-1.5 text-[9px] sm:text-[10px] font-bold rounded-lg transition-all border shadow-sm truncate max-w-[85px] shrink-0 ${
                                  isActive 
                                    ? 'bg-indigo-600 text-white border-indigo-700 scale-105' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                }`}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      {/* ================= PANEL KANAN ================= */}
      <div className="space-y-6 flex flex-col">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
          <h3 className="font-bold text-slate-800 mb-1.5 text-lg">2. Pilih Wadah Kelas 11</h3>
          <p className="text-sm text-slate-500 mb-3">Centang kelas 11 yang akan digunakan sebagai tempat pendaratan penjurusan.</p>
          
          <ScrollArea className="h-[250px] border border-slate-200 rounded-lg p-4 bg-slate-50 shadow-inner mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* MENGGUNAKAN SORTED KELAS LIST AGAR NATURAL SORT */}
              {sortedKelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-slate-100">
                    <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull} />
                    <Label htmlFor={`p-${k.id}`} className={`text-sm font-semibold cursor-pointer flex-1 flex justify-between ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} 
                      <span className="text-xs font-bold opacity-70 bg-slate-100 px-2 py-0.5 rounded">{k.jumlah_siswa}/{k.kapasitas}</span>
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          
          <Button 
            onClick={jalankanSimulasi} 
            disabled={isSimulating || selectedKelasIds.length === 0 || Object.keys(penjurusan).length === 0}
            className="w-full h-12 rounded-lg gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md transition-all text-base"
          >
            {isSimulating ? <Loader2 className="animate-spin h-5 w-5" /> : <Play className="h-5 w-5" />}
            Jalankan Algo Penjurusan
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">3. Preview Sebaran Kelas 11</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Siswa telah diurutkan & disebar rata (L/P).</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSavingPermanent} className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-lg shadow-md w-full sm:w-auto">
                {isSavingPermanent ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Simpan Permanen
              </Button>
            )}
          </div>
          
          <div className="flex-1 p-0 relative bg-white">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-emerald-50/80 backdrop-blur-sm z-20">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3 animate-in zoom-in" />
                <h2 className="text-lg font-bold text-emerald-900 tracking-tight">Penjurusan Berhasil!</h2>
                <p className="text-emerald-700 mt-2 font-medium">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-3"><Filter className="h-8 w-8 text-slate-300" /></div>
                <p className="font-medium text-slate-500">Belum ada simulasi.</p>
              </div>
            ) : (
              <ScrollArea className="h-full absolute inset-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="font-bold text-slate-600 pl-6">Nama Siswa</TableHead>
                      <TableHead className="text-center font-bold text-slate-600">Lama</TableHead>
                      <TableHead className="text-center"></TableHead>
                      <TableHead className="text-right font-bold text-slate-600 pr-6">Tujuan (11)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((res) => (
                      <TableRow key={res.siswa_id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-slate-800 pl-6">
                          {res.nama_lengkap} <span className="text-slate-400 text-[10px] font-black ml-1 bg-slate-100 px-1.5 py-0.5 rounded">{res.jk}</span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-rose-600 font-bold">{res.kelas_lama}</TableCell>
                        <TableCell className="text-center text-slate-300"><ArrowRight className="h-4 w-4 mx-auto"/></TableCell>
                        <TableCell className="text-right pr-6">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
                            {res.kelas_nama}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}