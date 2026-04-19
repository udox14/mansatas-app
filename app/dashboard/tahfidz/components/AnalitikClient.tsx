'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy, BarChart3, Target, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAnalitikSantri } from '../actions'

export function AnalitikClient({ kelasList }: { kelasList: any[] }) {
  const [minKetuntasan, setMinKetuntasan] = useState<number>(250)
  const [selectedKelas, setSelectedKelas] = useState<string>('semua')
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const handleLoadData = async () => {
    setIsLoading(true)
    const data = await getAnalitikSantri(selectedKelas)
    setSiswaList(data)
    setHasLoaded(true)
    setIsLoading(false)
  }

  // Calculations
  const totalSantri = siswaList.length
  
  const top10 = useMemo(() => {
    return [...siswaList].sort((a,b) => b.totalAyat - a.totalAyat).slice(0, 10)
  }, [siswaList])

  const tuntasCount = useMemo(() => {
    return siswaList.filter(s => s.totalAyat >= minKetuntasan).length
  }, [siswaList, minKetuntasan])

  const classAvg = useMemo(() => {
    const map: Record<string, { total: number, count: number }> = {}
    siswaList.forEach(s => {
      const className = `${s.tingkat}-${s.nomor_kelas} ${s.kelompok}`
      if (!map[className]) map[className] = { total: 0, count: 0 }
      map[className].total += s.totalAyat
      map[className].count += 1
    })
    return Object.entries(map).map(([k, v]) => ({
      name: k,
      avg: Math.round(v.total / v.count)
    })).sort((a,b) => b.avg - a.avg)
  }, [siswaList])

  const persentaseTuntas = totalSantri > 0 ? Math.round((tuntasCount / totalSantri) * 100) : 0

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 mt-4">
      
      {/* Control Panel: Lazy Load Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
        <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-center gap-3">
          <Label className="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">Target Analisis:</Label>
          <Select value={selectedKelas} onValueChange={setSelectedKelas}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Pilih target..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas / Global</SelectItem>
              {kelasList.map(k => (
                <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleLoadData} disabled={isLoading} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm">
          {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
          {isLoading ? 'Mengambil Data...' : 'Muat Data Analitik'}
        </Button>
      </div>

      {!hasLoaded ? (
        <div className="h-[300px] flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
          <BarChart3 className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Mode Hemat Data Aktif</p>
          <p className="text-sm max-w-md mx-auto">
            Gunakan panel di atas dan klik <b>Muat Data Analitik</b> untuk mulai memproses ribuan ayat hafalan santri secara *real-time*.
          </p>
        </div>
      ) : (
        <>
          {/* Target Setting Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-900 dark:to-teal-950 p-6 rounded-2xl shadow-lg border border-emerald-500/30 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Target className="w-48 h-48" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-end justify-between">
              <div>
                 <h2 className="text-2xl font-bold mb-2">Target & Ketuntasan Santri</h2>
                 <p className="text-emerald-100 max-w-lg mb-4 text-sm">
                   Sesuaikan parameter Ketuntasan Minimal (jumlah ayat) untuk melihat berapa banyak santri yang memenuhi ambang batas hafalan.
                 </p>
                 <div className="flex items-center gap-3 bg-white/10 p-2 rounded-xl backdrop-blur-md w-fit border border-white/20">
                   <Label htmlFor="targetInput" className="text-sm font-semibold pl-2 cursor-pointer">Target Minimal:</Label>
                   <Input 
                     id="targetInput"
                     type="number"
                     className="w-24 bg-white/20 border-0 text-white placeholder:text-white/50 focus-visible:ring-emerald-400 font-bold"
                     value={minKetuntasan}
                     onChange={e => setMinKetuntasan(parseInt(e.target.value) || 0)}
                     min={1}
                   />
                   <span className="pr-2 text-sm font-medium">Ayat</span>
                 </div>
              </div>
              <div className="flex gap-4">
                 <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/10 min-w-[120px]">
                    <div className="text-4xl font-extrabold mb-1 text-emerald-50">{tuntasCount}</div>
                    <div className="text-xs uppercase tracking-wider text-emerald-200">Santri Tuntas</div>
                 </div>
                 <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 text-center border border-white/10 min-w-[120px]">
                    <div className="text-4xl font-extrabold mb-1 text-teal-50">{persentaseTuntas}%</div>
                    <div className="text-xs uppercase tracking-wider text-teal-200">Persentase</div>
                 </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rata Rata Kelas */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 p-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  Rata-rata Hafalan per Kelas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[500px] no-scrollbar">
                {classAvg.map((cls, idx) => {
                  const maxAvg = classAvg[0]?.avg || 1
                  const pct = (cls.avg / maxAvg) * 100
                  return (
                    <div key={idx} className="group flex flex-col gap-1.5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kelas {cls.name}</span>
                        <span className="text-xs font-medium text-slate-500">{cls.avg} ayat</span>
                      </div>
                      <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden relative border border-slate-200/50 dark:border-slate-700/50">
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-teal-500/90 rounded-md transition-all duration-1000 ease-out group-hover:bg-teal-400 group-hover:shadow-[0_0_10px_rgba(45,212,191,0.5)]"
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
                {classAvg.length === 0 && <p className="text-center text-sm text-slate-500 py-8">Tidak ada data kelas.</p>}
              </CardContent>
            </Card>

            {/* Top 10 Santri */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="border-b bg-amber-50/50 dark:bg-amber-950/20 p-4">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-500">
                  <Trophy className="w-5 h-5" />
                  Top 10 Penghafal Terbanyak
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {top10.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-sm ${
                          idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 ring-2 ring-amber-400 scale-110' :
                          idx === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 scale-105' :
                          idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' :
                          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="ml-1">
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{s.nama_lengkap}</p>
                          <p className="text-xs text-slate-500 font-medium">Kelas {s.tingkat}-{s.nomor_kelas} {s.kelompok}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-600 dark:text-emerald-400">{s.totalAyat}</div>
                        <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Ayat</div>
                      </div>
                    </div>
                  ))}
                  {top10.length === 0 && <p className="text-center text-sm text-slate-500 py-8">Belum ada penyetor.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
