// Lokasi: app/dashboard/kelas/components/assign-bk-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeartHandshake, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { getDataAssignBK, setKelasBinaanBKFromKelas } from '../actions'
import { cn, formatNamaKelas } from '@/lib/utils'

type KelasData = {
  id: string; tingkat: number; nomor_kelas: string; kelompok: string
}
type GuruBK = { id: string; nama_lengkap: string }
type MappingItem = { guru_bk_id: string; kelas_id: string }

export function AssignBKModal({ kelasList }: { kelasList: KelasData[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [guruBkAll, setGuruBkAll] = useState<GuruBK[]>([])
  const [mappingAll, setMappingAll] = useState<MappingItem[]>([])
  const [selectedGuru, setSelectedGuru] = useState('')
  const [selectedKelasIds, setSelectedKelasIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [taAktifId, setTaAktifId] = useState<string>('')

  // Lazy load data saat modal dibuka
  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    getDataAssignBK().then(({ guruBkAll, mappingAll, taAktifId }) => {
      setGuruBkAll(guruBkAll)
      setMappingAll(mappingAll)
      setTaAktifId(taAktifId || '')
      setIsLoading(false)
    })
  }, [isOpen])

  // Saat ganti guru, load kelas binaannya yang sudah ada
  const handleSelectGuru = (guruId: string) => {
    setSelectedGuru(guruId)
    const existing = mappingAll
      .filter(m => m.guru_bk_id === guruId)
      .map(m => m.kelas_id)
    setSelectedKelasIds(new Set(existing))
  }

  const toggleKelas = (kelasId: string) => {
    setSelectedKelasIds(prev => {
      const next = new Set(prev)
      if (next.has(kelasId)) next.delete(kelasId)
      else next.add(kelasId)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedGuru) { alert('Pilih guru BK terlebih dahulu.'); return }
    if (!taAktifId) { alert('Tahun Ajaran aktif belum diatur.'); return }
    setIsSaving(true)
    const res = await setKelasBinaanBKFromKelas(selectedGuru, Array.from(selectedKelasIds), taAktifId)
    if (res.error) alert(res.error)
    else {
      alert(res.success)
      // Update mapping lokal
      const newMapping = mappingAll.filter(m => m.guru_bk_id !== selectedGuru)
      Array.from(selectedKelasIds).forEach(kid => newMapping.push({ guru_bk_id: selectedGuru, kelas_id: kid }))
      setMappingAll(newMapping)
    }
    setIsSaving(false)
  }

  // Kelompokkan kelas per tingkat
  const kelasByTingkat = kelasList.reduce((acc, k) => {
    const t = String(k.tingkat)
    if (!acc[t]) acc[t] = []
    acc[t].push(k)
    return acc
  }, {} as Record<string, KelasData[]>)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"
          className="h-8 text-xs gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-md">
          <HeartHandshake className="h-3.5 w-3.5" /> Assign Guru BK
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl border-surface">
        <DialogHeader className="border-b border-surface-2 pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-rose-500" /> Assign Kelas Binaan Guru BK
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Pilih guru BK */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Guru BK</label>
              {guruBkAll.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Belum ada user dengan role Guru BK.
                </div>
              ) : (
                <Select value={selectedGuru} onValueChange={handleSelectGuru}>
                  <SelectTrigger className="h-9 text-sm rounded-lg bg-surface-2 border-surface">
                    <SelectValue placeholder="Pilih guru BK..." />
                  </SelectTrigger>
                  <SelectContent>
                    {guruBkAll.map(g => (
                      <SelectItem key={g.id} value={g.id} className="text-sm">{g.nama_lengkap}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Pilih kelas (multi-check) */}
            {selectedGuru && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Kelas Binaan
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{selectedKelasIds.size} dipilih</span>
                </div>
                <ScrollArea className="h-56 rounded-lg border border-surface bg-surface-2">
                  <div className="p-1.5 space-y-1">
                    {[10, 11, 12].map(tingkat => {
                      const items = kelasByTingkat[String(tingkat)] || []
                      if (!items.length) return null
                      return (
                        <div key={tingkat}>
                          <p className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Kelas {tingkat}
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {items.map(k => {
                              const checked = selectedKelasIds.has(k.id)
                              return (
                                <button key={k.id} type="button" onClick={() => toggleKelas(k.id)}
                                  className={cn(
                                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all text-left',
                                    checked
                                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                                      : 'bg-surface border-surface text-slate-600 dark:text-slate-300 hover:bg-surface-3'
                                  )}>
                                  <div className={cn(
                                    'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0',
                                    checked ? 'bg-rose-500 border-rose-500' : 'border-slate-300 dark:border-slate-600'
                                  )}>
                                    {checked && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                  </div>
                                  {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {selectedGuru && (
              <Button onClick={handleSave} disabled={isSaving}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white text-sm rounded-lg font-medium">
                {isSaving
                  ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</>
                  : `Simpan Kelas Binaan (${selectedKelasIds.size} kelas)`}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
