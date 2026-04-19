'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy, BarChart3, Loader2, Database, Percent } from 'lucide-react'
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
    <div className="space-y-4 animate-in fade-in duration-500 pb-12 mt-4">
      {/* Control Panel: Lazy Load Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-end justify-between">
          <div className="flex-1 w-full space-y-2">
            <Label>Pilih Target Kelas</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="w-full sm:w-[260px]">
                  <SelectValue placeholder="Pilih target analitik..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Kelas / Global</SelectItem>
                  {kelasList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleLoadData} disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
                {isLoading ? 'Memuat...' : 'Muat Data'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasLoaded ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 text-muted mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">Menunggu Instruksi Data</p>
            <p className="text-sm max-w-[400px]">Silakan pilih kelas dan muat data untuk menampilkan metrik analitik.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Target Minimal</CardDescription>
                <CardTitle className="text-xl">Standar Kelulusan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    className="w-24 h-9"
                    value={minKetuntasan}
                    onChange={e => setMinKetuntasan(parseInt(e.target.value) || 0)}
                    min={1}
                  />
                  <span className="text-sm text-muted-foreground">Ayat</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Santri Memenuhi Target</CardDescription>
                <CardTitle className="text-4xl">{tuntasCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Dari total {totalSantri} santri</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardDescription>Persentase Tuntas</CardDescription>
                  <CardTitle className="text-4xl">{persentaseTuntas}%</CardTitle>
                </div>
                <div className="p-2 bg-muted rounded-full">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Keseluruhan kelas terpilih</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Rata-rata Hafalan (Ayat)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {classAvg.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Data kelas kosong.</p>
                ) : (
                  classAvg.map((cls, idx) => {
                    const maxAvg = classAvg[0]?.avg || 1
                    const pct = (cls.avg / maxAvg) * 100
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">Kelas {cls.name}</span>
                          <span className="text-muted-foreground">{cls.avg} ayat</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Top 10 Penghafal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {top10.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada penyetor.</p>
                  ) : (
                    top10.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-muted-foreground text-xs font-medium">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none">{s.nama_lengkap}</p>
                            <p className="text-xs text-muted-foreground mt-1">Kelas {s.tingkat}-{s.nomor_kelas} {s.kelompok}</p>
                          </div>
                        </div>
                        <div className="font-semibold text-sm">
                          {s.totalAyat} <span className="text-xs font-normal text-muted-foreground">ayat</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
