'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Clock, CalendarDays, CheckCircle2 } from 'lucide-react'
import { tambahJadwalPiket, hapusJadwalPiket, simpanPengaturanShift } from '../actions'
import type { ShiftPiket, JadwalPiket } from '../actions'

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export function JadwalPiketClient({
  data, guruList
}: {
  data: { shifts: ShiftPiket[], jadwal: JadwalPiket[] }
  guruList: Array<{ id: string, nama: string }>
}) {
  const [shifts, setShifts] = useState(data.shifts)
  const [jadwal, setJadwal] = useState(data.jadwal)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error', teks: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form Tambah
  const [selHari, setSelHari] = useState('1')
  const [selShift, setSelShift] = useState('1')
  const [selUser, setSelUser] = useState('')

  // Settings Form
  const [settingShift, setSettingShift] = useState(data.shifts.map(s => ({ ...s })))

  async function handleTambah() {
    if (!selUser) return setPesan({ tipe: 'error', teks: 'Pilih guru terlebih dahulu.' })
    setIsSubmitting(true)
    setPesan(null)
    const res = await tambahJadwalPiket(selUser, parseInt(selHari), parseInt(selShift))
    setIsSubmitting(false)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
      // Update local state optimistic/reload
      const guru = guruList.find(g => g.id === selUser)
      if (guru) {
        setJadwal(prev => [...prev, {
          id: Math.random().toString(), // temp ID
          user_id: selUser,
          hari: parseInt(selHari),
          shift_id: parseInt(selShift),
          nama_lengkap: guru.nama
        }])
      }
    }
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus jadwal ini?')) return
    setIsSubmitting(true)
    setPesan(null)
    const res = await hapusJadwalPiket(id)
    setIsSubmitting(false)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setPesan({ tipe: 'sukses', teks: res.success || 'Dihapus.' })
      setJadwal(prev => prev.filter(j => j.id !== id))
    }
  }

  async function handleSaveShift() {
    setIsSubmitting(true)
    setPesan(null)
    const res = await simpanPengaturanShift(settingShift)
    setIsSubmitting(false)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
      setShifts([...settingShift])
    }
  }

  return (
    <div className="space-y-6">
      {pesan && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-medium ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <CheckCircle2 className="h-5 w-5" /> {pesan.teks}
        </div>
      )}

      <Tabs defaultValue="jadwal" className="space-y-4">
        <TabsList className="bg-white dark:bg-slate-900 border rounded-xl p-1 shadow-sm grid grid-cols-2 max-w-[400px]">
          <TabsTrigger value="jadwal" className="rounded-lg data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none">
            <CalendarDays className="h-4 w-4 mr-2" /> Jadwal Piket
          </TabsTrigger>
          <TabsTrigger value="shift" className="rounded-lg data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none">
            <Clock className="h-4 w-4 mr-2" /> Pengaturan Shift
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal" className="space-y-4 border-none p-0">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50 border-b rounded-t-xl px-4 py-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-700 flex items-center justify-between">
                <span>Tambah Jadwal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5 flex-1">
                  <Label>Pilih Guru</Label>
                  <Select value={selUser} onValueChange={setSelUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      {guruList.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-full md:w-32">
                  <Label>Hari</Label>
                  <Select value={selHari} onValueChange={(v) => { setSelHari(v); if (v === '5') setSelShift('1') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Hari" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map(h => (
                        <SelectItem key={h} value={h.toString()}>{HARI_NAMA[h]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 w-full md:w-32">
                  <Label>Shift</Label>
                  <Select value={selShift} onValueChange={setSelShift} disabled={selHari === '5'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.nama_shift}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selHari === '5' && <p className="text-[10px] text-gray-500">Jumat maks shift 1</p>}
                </div>
                <div className="w-full md:w-auto">
                  <Button onClick={handleTambah} disabled={isSubmitting} className="w-full bg-violet-600 hover:bg-violet-700">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Tambah
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(hari => {
              const items = jadwal.filter(j => j.hari === hari)
              return (
                <Card key={hari} className="shadow-sm overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b px-4 py-3 pb-3">
                    <CardTitle className="text-sm font-semibold flex justify-between items-center text-gray-700">
                      {HARI_NAMA[hari]}
                      <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{items.length} guru</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {items.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">Belum ada jadwal</div>
                    ) : (
                      <div className="divide-y">
                        {items.map(item => {
                          const shift = shifts.find(s => s.id === item.shift_id)
                          return (
                            <div key={item.id} className="p-3 px-4 flex justify-between items-center group hover:bg-gray-50 transition-colors">
                              <div>
                                <p className="text-sm font-medium">{item.nama_lengkap}</p>
                                <p className="text-xs text-gray-500 mt-0.5 bg-violet-100 text-violet-700 inline-block px-1.5 py-0.5 rounded-md">
                                  {shift?.nama_shift} (Jam {shift?.jam_mulai}-{(shift?.jam_selesai ?? 0) > 20 ? 'akhir' : shift?.jam_selesai})
                                </p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all" onClick={() => handleHapus(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="shift" className="space-y-4 border-none p-0">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Pengaturan Shift Piket</CardTitle>
              <CardDescription>Atur rentang jam pelajaran untuk masing-masing shift piket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingShift.map((s, index) => (
                <div key={s.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-4 border rounded-xl bg-gray-50/50">
                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-base font-semibold text-violet-800">{s.nama_shift}</Label>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mulai dari Jam Ke-</Label>
                    <Input type="number" min={1} max={20} value={s.jam_mulai} onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      const next = [...settingShift]
                      next[index].jam_mulai = v
                      setSettingShift(next)
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sampai Jam Ke-</Label>
                    <Input type="number" min={1} max={20} value={s.jam_selesai > 20 ? 99 : s.jam_selesai} onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      const next = [...settingShift]
                      next[index].jam_selesai = v > 20 ? 99 : v
                      setSettingShift(next)
                    }} />
                    <p className="text-[10px] text-gray-500">Isi 99 untuk 'sampai pelajaran usai'</p>
                  </div>
                </div>
              ))}
              
              <Button onClick={handleSaveShift} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 font-semibold px-8">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
