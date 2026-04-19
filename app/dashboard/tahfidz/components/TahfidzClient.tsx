'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { JUZ_DATA, getTotalAyatInJuz } from '../data/juz-data'
import { Search, Loader2, BookOpen, ChevronRight, ChevronUp, History, Check, Printer, ChevronDown } from 'lucide-react'
import { getSiswaTahfidz, getProgressSiswa, simpanSetoranHafalan, getRiwayatSetoran, getNilaiJuz, simpanNilaiJuz, simpanHafalanJuzPenuh } from '../actions'
import { AyatGrid } from './AyatGrid'
import { RiwayatModal } from './RiwayatModal'
import { CetakLaporanModal, type CetakType } from './CetakLaporanModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

function useToast() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const toast = ({ title, description, variant }: { title: string, description: string, variant?: 'destructive' }) => { 
    setMsg({ ok: variant !== 'destructive', text: description })
    setTimeout(() => setMsg(null), 4000) 
  }
  return { msg, toast }
}

export function TahfidzClient({ kelasList }: { kelasList: any[] }) {
  const [cetakModalOpen, setCetakModalOpen] = useState(false)
  const [cetakType, setCetakType] = useState<CetakType>('siswa')

  const openCetak = (type: CetakType) => {
    setCetakType(type)
    setCetakModalOpen(true)
  }
  const [kelasId, setKelasId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false)

  const [selectedSiswa, setSelectedSiswa] = useState<any | null>(null)
  
  // State loaded data for selected siswa
  const [progress, setProgress] = useState<Record<number, number[]>>({}) // { [surah_nomor]: [1,2,3] }
  const [nilai, setNilai] = useState<any[]>([])
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Sub-selection
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null)

  // Modals & Forms
  const [isRiwayatOpen, setIsRiwayatOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { msg, toast } = useToast()

  // Load siswa
  const fetchSiswa = async () => {
    setIsLoadingSiswa(true)
    const data = await getSiswaTahfidz(kelasId, search)
    setSiswaList(data)
    setIsLoadingSiswa(false)
  }

  useEffect(() => {
    const t = setTimeout(fetchSiswa, 300)
    return () => clearTimeout(t)
  }, [kelasId, search])

  // Load detail whenever siswa changes
  useEffect(() => {
    if (!selectedSiswa) {
      setProgress({})
      setNilai([])
      setRiwayat([])
      setSelectedJuz(null)
      setSelectedSurah(null)
      return
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true)
      const [prog, n, riw] = await Promise.all([
        getProgressSiswa(selectedSiswa.id),
        getNilaiJuz(selectedSiswa.id),
        getRiwayatSetoran(selectedSiswa.id)
      ])
      setProgress(prog)
      setNilai(n)
      setRiwayat(riw)
      setIsLoadingDetail(false)
    }
    loadDetail()
  }, [selectedSiswa])

  const handleSaveSetoran = async (surahNomor: number, ayatList: number[]) => {
    if (!selectedSiswa || !selectedJuz) return
    setIsSaving(true)
    
    const res = await simpanSetoranHafalan(selectedSiswa.id, surahNomor, selectedJuz, ayatList)
    if (res.error) {
      toast({ title: 'Gagal', description: res.error || 'Terjadi kesalahan', variant: 'destructive' })
    } else {
      toast({ title: 'Berhasil', description: res.success || 'Tersimpan' })
      // Refresh local state without full reload to be snappy
      setProgress(prev => ({ ...prev, [surahNomor]: ayatList }))
      
      // If there were actually new ayats, reload history
      if ((res.newAyatCount || 0) > 0) {
        const riw = await getRiwayatSetoran(selectedSiswa.id)
        setRiwayat(riw)
      }
    }
    setIsSaving(false)
  }

  const handleSaveNilaiJuz = async (juz: number, nilaiInput: number) => {
    if (!selectedSiswa) return
    setIsSaving(true)
    const res = await simpanNilaiJuz(selectedSiswa.id, juz, nilaiInput)
    if (res.error) {
      toast({ title: 'Gagal', description: res.error || 'Terjadi kesalahan', variant: 'destructive' })
    } else {
      toast({ title: 'Berhasil', description: `Nilai Juz ${juz} disimpan.` })
      const n = await getNilaiJuz(selectedSiswa.id)
      setNilai(n)
    }
    setIsSaving(false)
  }

  const handleHafalSemuaJuz = async () => {
    if (!selectedSiswa || !selectedJuz) return
    const juzObj = JUZ_DATA.find(j => j.juz === selectedJuz)
    if (!juzObj) return
    setIsSaving(true)
    const surahList = juzObj.surahList.map(s => ({ nomor: s.nomor, jumlahAyat: s.jumlahAyat }))
    const res = await simpanHafalanJuzPenuh(selectedSiswa.id, selectedJuz, surahList)
    if (res.error) {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    } else {
      toast({ title: 'Berhasil', description: res.success || 'Tersimpan' })
      const newProgress = { ...progress }
      juzObj.surahList.forEach(s => {
        newProgress[s.nomor] = Array.from({ length: s.jumlahAyat }, (_, i) => i + 1)
      })
      setProgress(newProgress)
      const riw = await getRiwayatSetoran(selectedSiswa.id)
      setRiwayat(riw)
    }
    setIsSaving(false)
  }

  // --- RENDERING HELPERS ---
  const renderJuzProgress = (juzNum: number) => {
    const jData = JUZ_DATA.find(j => j.juz === juzNum)
    if (!jData) return null
    
    let hafal = 0
    let total = 0
    jData.surahList.forEach(s => {
      total += s.jumlahAyat
      if (progress[s.nomor]) {
        hafal += progress[s.nomor].length
      }
    })
    
    const pct = total > 0 ? Math.round((hafal / total) * 100) : 0
    const nilaiJuzObj = nilai.find(n => n.juz === juzNum)
    
    return (
      <Card 
        className={`cursor-pointer h-full transition-all hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-sm ${selectedJuz === juzNum ? 'border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500' : ''}`}
        onClick={() => { 
          setSelectedJuz(juzNum); 
          setSelectedSurah(null);
          setTimeout(() => document.getElementById('surah-selection-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
        }}
      >
        <CardContent className="p-4 h-full flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-600 dark:bg-teal-700 text-[14px] font-bold text-white shadow-sm ring-4 ring-teal-50 dark:ring-teal-900/30">
              {juzNum}
            </div>
            {nilaiJuzObj && (
              <div className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[11px] px-2 py-0.5 rounded font-medium border border-emerald-200 dark:border-emerald-800 mt-1">
                {nilaiJuzObj.nilai}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{hafal}/{total} ayat</div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%`}}></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div id="tahfidz-top" className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {/* KIRI: Daftar Siswa */}
      <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm flex flex-col gap-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Pilih Siswa</h3>
          <Select value={kelasId} onValueChange={setKelasId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Kelas..." />
            </SelectTrigger>
            <SelectContent>
              {kelasList.map(k => (
                <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Input 
              placeholder="Cari nama/NISN..." 
              className="pl-9" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden flex flex-col h-[280px] md:h-[600px] lg:h-[700px]">
          <div className="p-3 border-b bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            Data Siswa
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 relative">
            {isLoadingSiswa ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : siswaList.length === 0 ? (
              <div className="text-center p-8 text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
            ) : (
              siswaList.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSiswa(s)
                    setTimeout(() => {
                      document.getElementById('tahfidz-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 100)
                  }}
                  className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    selectedSiswa?.id === s.id ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                    <AvatarImage src={s.foto_url || ''} />
                    <AvatarFallback>{s.nama_lengkap.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{s.nama_lengkap}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.tingkat}-{s.nomor_kelas} {s.kelompok}</p>
                  </div>
                  {selectedSiswa?.id === s.id && <ChevronRight className="h-4 w-4 text-emerald-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* KANAN: Detail Tahfidz */}
      <div id="tahfidz-detail" className="md:col-span-8 lg:col-span-9 flex flex-col gap-6 scroll-mt-20">
        {!selectedSiswa ? (
          <div className="h-[400px] flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-800">
            <BookOpen className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Belum ada siswa dipilih</p>
            <p className="text-sm">Silakan pilih siswa dari daftar di sebelah kiri untuk melihat dan mengisi progress setoran.</p>
          </div>
        ) : isLoadingDetail ? (
          <div className="h-[400px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Tombol kembali mobile */}
            <button 
              className="md:hidden flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg w-fit transition-colors"
              onClick={() => document.getElementById('tahfidz-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <ChevronUp className="w-4 h-4" /> Kembali cari siswa
            </button>
            
            {/* Header Profil */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border border-slate-200 dark:border-slate-800">
                  <AvatarImage src={selectedSiswa.foto_url || ''} />
                  <AvatarFallback className="text-lg">{selectedSiswa.nama_lengkap.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedSiswa.nama_lengkap}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">NISN: {selectedSiswa.nisn} • Kelas {selectedSiswa.tingkat}-{selectedSiswa.nomor_kelas} {selectedSiswa.kelompok}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setIsRiwayatOpen(true)} className="gap-2">
                <History className="h-4 w-4" /> Riwayat Setoran
              </Button>
            </div>

            {/* List Juz */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">Pilih Juz Target</h3>
                  {msg && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${msg.ok ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 text-rose-700'}`}>
                      {msg.text}
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-slate-600 dark:text-slate-400">
                      <Printer className="h-4 w-4" /> Cetak Laporan <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!selectedSiswa}
                      onClick={() => openCetak('siswa')}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Laporan Siswa Ini
                      {!selectedSiswa && <span className="ml-2 text-xs text-slate-400">(pilih siswa dulu)</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openCetak('kelas')}>
                      Laporan Per Kelas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCetak('semua')}>
                      Laporan Seluruh Siswa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3">
                {JUZ_DATA.map(j => (
                  <div key={j.juz}>{renderJuzProgress(j.juz)}</div>
                ))}
              </div>
            </div>

            {/* List Surah dalam Juz terpilih */}
            {selectedJuz && (
              <div id="surah-selection-area" className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 animate-in slide-in-from-top-4 duration-300 scroll-mt-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Juz {selectedJuz} · Detail Surah</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={handleHafalSemuaJuz}
                      className="gap-1.5 border-emerald-500 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    >
                      <Check className="h-4 w-4" />
                      Hafal Semua Juz
                    </Button>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Nilai Juz ini:</span>
                    <Input
                      type="number"
                      min={0} max={100}
                      className="w-20 h-8 text-center"
                      defaultValue={nilai.find(n => n.juz === selectedJuz)?.nilai || ''}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) handleSaveNilaiJuz(selectedJuz, val)
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-6">
                  {JUZ_DATA.find(j => j.juz === selectedJuz)?.surahList.map(s => {
                    const progLen = progress[s.nomor]?.length || 0
                    const isDone = progLen === s.jumlahAyat
                    return (
                      <button
                        key={s.nomor}
                        onClick={() => {
                          setSelectedSurah(s.nomor)
                          setTimeout(() => document.getElementById('ayat-grid-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
                        }}
                        className={`p-3 text-left border rounded-lg transition-all ${
                          selectedSurah === s.nomor ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-semibold text-sm truncate">{s.nama}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center mt-1">
                          <span>{progLen}/{s.jumlahAyat}</span>
                          {isDone && <Check className="h-3 w-3 text-emerald-500" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Ayat Grid */}
                {selectedSurah && (
                  <div id="ayat-grid-area" className="pt-4 border-t animate-in fade-in duration-300 scroll-mt-20">
                    {(() => {
                      const surahObj = JUZ_DATA.find(j => j.juz === selectedJuz)?.surahList.find(s => s.nomor === selectedSurah)
                      if (!surahObj) return null
                      return (
                        <AyatGrid 
                          surahNama={surahObj.nama}
                          jumlahAyat={surahObj.jumlahAyat}
                          progressAwal={progress[selectedSurah] || []}
                          onSave={(ayatList) => handleSaveSetoran(selectedSurah, ayatList)}
                          isSaving={isSaving}
                        />
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button for Mobile: Scroll to Top */}
      {selectedSiswa && (
        <button
          onClick={() => document.getElementById('tahfidz-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="md:hidden fixed bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
          aria-label="Kembali ke atas"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}

      <RiwayatModal
        isOpen={isRiwayatOpen}
        onClose={() => setIsRiwayatOpen(false)}
        riwayat={riwayat}
        siswaNama={selectedSiswa?.nama_lengkap || ''}
      />

      <CetakLaporanModal
        isOpen={cetakModalOpen}
        onClose={() => setCetakModalOpen(false)}
        type={cetakType}
        siswaId={selectedSiswa?.id}
        siswaNama={selectedSiswa?.nama_lengkap}
        kelasList={kelasList}
      />
    </div>
  )
}
