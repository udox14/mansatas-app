'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Clock, CalendarDays, CheckCircle2, Users, X } from 'lucide-react'
import { tambahJadwalPiketMassal, hapusJadwalPiketMassal, simpanPengaturanShift } from '../actions'
import type { ShiftPiket, JadwalPiket } from '../actions'

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export function JadwalPiketClient({
  data, guruList
}: {
  data: { shifts: ShiftPiket[], jadwal: JadwalPiket[] }
  guruList: Array<{ id: string, nama: string, isGuruPpl: boolean }>
}) {
  const router = useRouter()
  const [shifts, setShifts] = useState(data.shifts)
  const jadwal = data.jadwal
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error', teks: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form Tambah
  const [selShift, setSelShift] = useState(data.shifts[0]?.id?.toString() ?? '')
  const [selUser, setSelUser] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedHari, setSelectedHari] = useState<number[]>([1])
  const [selectedJadwalIds, setSelectedJadwalIds] = useState<string[]>([])

  // Settings Form
  const [settingShift, setSettingShift] = useState(data.shifts.map(s => ({ ...s })))

  const guruPpl = guruList.filter(guru => guru.isGuruPpl)

  function addSelectedGuru(userId: string) {
    if (!userId) return
    setSelectedUserIds(prev => prev.includes(userId) ? prev : [...prev, userId])
    setSelUser('')
  }

  function toggleHari(hari: number) {
    setSelectedHari(prev => prev.includes(hari) ? prev.filter(item => item !== hari) : [...prev, hari])
  }

  function toggleJadwal(id: string) {
    setSelectedJadwalIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  async function handleTambah() {
    if (!selectedUserIds.length) return setPesan({ tipe: 'error', teks: 'Pilih minimal satu guru.' })
    if (!selectedHari.length) return setPesan({ tipe: 'error', teks: 'Pilih minimal satu hari.' })
    if (!selShift) return setPesan({ tipe: 'error', teks: 'Shift piket belum tersedia. Simpan pengaturan shift dulu.' })
    try {
      setIsSubmitting(true)
      setPesan(null)
      const res = await tambahJadwalPiketMassal(selectedUserIds, selectedHari, parseInt(selShift))
      if (res.error) setPesan({ tipe: 'error', teks: res.error })
      else {
        setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
        setSelectedJadwalIds([])
        router.refresh()
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Gagal menambah jadwal piket.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleHapus(id: string) {
    await handleHapusMassal([id])
  }

  async function handleHapusMassal(ids = selectedJadwalIds) {
    if (!ids.length) return setPesan({ tipe: 'error', teks: 'Pilih jadwal yang akan dihapus.' })
    if (!confirm(`Hapus ${ids.length} jadwal yang dipilih?`)) return
    try {
      setIsSubmitting(true)
      setPesan(null)
      const res = await hapusJadwalPiketMassal(ids)
      if (res.error) setPesan({ tipe: 'error', teks: res.error })
      else {
        setPesan({ tipe: 'sukses', teks: res.success || 'Dihapus.' })
        setSelectedJadwalIds([])
        router.refresh()
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Gagal menghapus jadwal piket.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveShift() {
    try {
      setIsSubmitting(true)
      setPesan(null)
      const res = await simpanPengaturanShift(settingShift)
      if (res.error) setPesan({ tipe: 'error', teks: res.error })
      else {
        setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
        setShifts([...settingShift])
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Gagal menyimpan pengaturan shift.' })
    } finally {
      setIsSubmitting(false)
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Pilih Guru</Label>
                    {guruPpl.length > 0 && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedUserIds(guruPpl.map(guru => guru.id))}>
                      <Users className="mr-1 h-3.5 w-3.5" /> Semua Guru PPL ({guruPpl.length})
                    </Button>}
                  </div>
                  <Combobox value={selUser} onValueChange={addSelectedGuru} options={guruList.map(guru => ({ value: guru.id, label: guru.nama, description: guru.isGuruPpl ? 'Guru PPL' : undefined }))} placeholder="Cari dan tambahkan guru..." searchPlaceholder="Ketik nama guru..." emptyText="Guru tidak ditemukan" />
                  {selectedUserIds.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedUserIds.map(id => {
                      const guru = guruList.find(item => item.id === id)
                      return guru ? <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-800">
                        {guru.nama}<button type="button" onClick={() => setSelectedUserIds(prev => prev.filter(item => item !== id))} aria-label={`Hapus ${guru.nama}`}><X className="h-3 w-3" /></button>
                      </span> : null
                    })}
                    <button type="button" className="text-xs text-slate-500 underline" onClick={() => setSelectedUserIds([])}>Kosongkan</button>
                  </div>}
                </div>
                <div className="space-y-1.5 w-full">
                  <Label>Shift</Label>
                  <Select value={selShift} onValueChange={(value) => { setSelShift(value); if (value !== '1') setSelectedHari(prev => prev.filter(hari => hari !== 5)) }} disabled={shifts.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="Shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.nama_shift}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shifts.length === 0 && <p className="text-[10px] text-red-500">Shift belum tersedia.</p>}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Hari Penugasan</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map(hari => <Button key={hari} type="button" size="sm" variant={selectedHari.includes(hari) ? 'default' : 'outline'} className={selectedHari.includes(hari) ? 'bg-violet-600 hover:bg-violet-700' : ''} disabled={hari === 5 && selShift !== '1'} onClick={() => toggleHari(hari)}>{HARI_NAMA[hari]}</Button>)}
                  </div>
                  {selShift !== '1' && <p className="text-[10px] text-gray-500">Jumat tersedia pada Shift 1 saja.</p>}
                </div>
                <div className="w-full md:w-auto">
                  <Button onClick={handleTambah} disabled={isSubmitting || shifts.length === 0} className="w-full bg-violet-600 hover:bg-violet-700">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Tambah Massal
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">Pilih beberapa guru dan hari untuk membuat semua kombinasi sekaligus. Jadwal yang sudah ada akan dilewati otomatis.</p>
            </CardContent>
          </Card>

          {selectedJadwalIds.length > 0 && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{selectedJadwalIds.length} jadwal dipilih</span>
            <Button variant="destructive" size="sm" disabled={isSubmitting} onClick={() => handleHapusMassal()}><Trash2 className="mr-1.5 h-4 w-4" />Hapus terpilih</Button>
          </div>}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(hari => {
              const items = jadwal.filter(j => j.hari === hari)
              return (
                <Card key={hari} className="shadow-sm overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b px-4 py-3 pb-3">
                    <CardTitle className="text-sm font-semibold flex justify-between items-center text-gray-700">
                      <span>{HARI_NAMA[hari]}</span>
                      <span className="flex items-center gap-2"><button type="button" className="text-xs font-normal text-violet-700 hover:underline" onClick={() => setSelectedJadwalIds(prev => [...new Set([...prev, ...items.map(item => item.id)])])}>Pilih semua</button><span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{items.length} guru</span></span>
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
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={selectedJadwalIds.includes(item.id)} onChange={() => toggleJadwal(item.id)} aria-label={`Pilih jadwal ${item.nama_lengkap}`} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                                <div>
                                <p className="text-sm font-medium">{item.nama_lengkap}</p>
                                <p className="text-xs text-gray-500 mt-0.5 bg-violet-100 text-violet-700 inline-block px-1.5 py-0.5 rounded-md">
                                  {shift?.nama_shift} (Jam ke-{shift?.jam_mulai}-{(shift?.jam_selesai ?? 0) > 20 ? 'akhir' : shift?.jam_selesai})
                                </p>
                                </div>
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
                    <Label>Mulai dari Jam ke-</Label>
                    <Input type="number" min={1} max={20} value={s.jam_mulai} onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      const next = [...settingShift]
                      next[index].jam_mulai = v
                      setSettingShift(next)
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sampai Jam ke-</Label>
                    <Input type="number" min={1} max={20} value={s.jam_selesai > 20 ? 99 : s.jam_selesai} onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      const next = [...settingShift]
                      next[index].jam_selesai = v > 20 ? 99 : v
                      setSettingShift(next)
                    }} />
                    <p className="text-[10px] text-gray-500">Isi 99 untuk &ldquo;sampai pelajaran usai&rdquo;</p>
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
