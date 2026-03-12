'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Save, Settings2, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react'
import { simpanPengaturanAkademik } from '../actions'

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg shadow-md h-14 text-base font-bold transition-all">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Menyimpan Perubahan...</> : <><Save className="mr-2 h-5 w-5"/> Simpan Pengaturan & Urutan PDSS</>}
    </Button>
  )
}

export function PengaturanPanel({ pengaturan, mapelList }: { pengaturan: any, mapelList: {id: string, nama_mapel: string}[] }) {
  const [mapelSNBP, setMapelSNBP] = useState<string[]>(pengaturan?.mapel_snbp || [])
  const [mapelSPAN, setMapelSPAN] = useState<string[]>(pengaturan?.mapel_span || [])
  const [bobotRapor, setBobotRapor] = useState(pengaturan?.bobot_rapor || 60)
  const [pesan, setPesan] = useState('')

  const toggleSNBP = (nama: string) => setMapelSNBP(prev => prev.includes(nama) ? prev.filter(m => m !== nama) : [...prev, nama])
  const toggleSPAN = (nama: string) => setMapelSPAN(prev => prev.includes(nama) ? prev.filter(m => m !== nama) : [...prev, nama])

  // FUNGSI SORTING SNBP
  const moveUpSnbp = (index: number) => {
    if (index === 0) return
    const newArray = [...mapelSNBP];
    [newArray[index - 1], newArray[index]] = [newArray[index], newArray[index - 1]]
    setMapelSNBP(newArray)
  }
  const moveDownSnbp = (index: number) => {
    if (index === mapelSNBP.length - 1) return
    const newArray = [...mapelSNBP];
    [newArray[index + 1], newArray[index]] = [newArray[index], newArray[index + 1]]
    setMapelSNBP(newArray)
  }

  // FUNGSI SORTING SPAN
  const moveUpSpan = (index: number) => {
    if (index === 0) return
    const newArray = [...mapelSPAN];
    [newArray[index - 1], newArray[index]] = [newArray[index], newArray[index - 1]]
    setMapelSPAN(newArray)
  }
  const moveDownSpan = (index: number) => {
    if (index === mapelSPAN.length - 1) return
    const newArray = [...mapelSPAN];
    [newArray[index + 1], newArray[index]] = [newArray[index], newArray[index + 1]]
    setMapelSPAN(newArray)
  }

  const handleSimpan = async (formData: FormData) => {
    setPesan('')
    const payload = { mapel_snbp: mapelSNBP, mapel_span: mapelSPAN, bobot_rapor: Number(formData.get('bobot_rapor')), bobot_um: Number(formData.get('bobot_um')) }
    const res = await simpanPengaturanAkademik(payload)
    if (res.error) alert(res.error)
    else setPesan(res.success!)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 border-b border-slate-100 pb-6">
        <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-3 rounded-lg text-emerald-700 shadow-inner">
          <Settings2 className="h-6 w-6"/>
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-xl tracking-tight">Pengaturan Rumus & Format Kelulusan</h3>
          <p className="text-sm text-slate-500 mt-1">Pilih mata pelajaran dan atur urutannya secara independen untuk format export SNBP dan SPAN-PTKIN.</p>
        </div>
      </div>

      {pesan && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 flex items-center gap-3 text-sm font-medium animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0"/> {pesan}
        </div>
      )}

      <form action={handleSimpan} className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* BLOK SNBP */}
          <div className="space-y-5 border border-emerald-100/60 p-5 rounded-lg bg-gradient-to-b from-emerald-50/30 to-transparent shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <h4 className="font-bold text-emerald-900 text-lg tracking-tight">Jalur SNBP (PDSS Umum)</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Centang Mapel</Label>
                <ScrollArea className="h-64 border border-slate-200 rounded-lg p-4 bg-white/60 shadow-inner">
                  <div className="space-y-3">
                    {mapelList.map(m => (
                      <div key={`snbp-${m.id}`} className="flex items-start space-x-3 group">
                        <Checkbox id={`snbp-${m.id}`} checked={mapelSNBP.includes(m.nama_mapel)} onCheckedChange={() => toggleSNBP(m.nama_mapel)} className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                        <Label htmlFor={`snbp-${m.id}`} className="text-sm cursor-pointer leading-tight group-hover:text-emerald-700 transition-colors">{m.nama_mapel}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Urutkan Format PDSS</Label>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{mapelSNBP.length} Mapel</span>
                </div>
                <div className="h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-white/60 shadow-inner custom-scrollbar">
                  {mapelSNBP.length === 0 ? <p className="text-xs text-slate-400 text-center mt-10">Belum ada mapel terpilih.</p> : (
                    <div className="space-y-2">
                      {mapelSNBP.map((mp, idx) => (
                        <div key={`osnbp-${mp}`} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group hover:border-emerald-200 transition-colors">
                          <span className="text-xs font-bold text-slate-700 truncate pr-2 flex-1">
                            <span className="inline-block w-5 text-emerald-500 opacity-70">{idx+1}.</span> {mp}
                          </span>
                          <div className="flex gap-0.5 shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveUpSnbp(idx)} disabled={idx === 0} className="h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveDownSnbp(idx)} disabled={idx === mapelSNBP.length - 1} className="h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BLOK SPAN */}
          <div className="space-y-5 border border-indigo-100/60 p-5 rounded-lg bg-gradient-to-b from-indigo-50/30 to-transparent shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
              <h4 className="font-bold text-indigo-900 text-lg tracking-tight">Jalur SPAN-PTKIN</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Centang Mapel</Label>
                <ScrollArea className="h-64 border border-slate-200 rounded-lg p-4 bg-white/60 shadow-inner">
                  <div className="space-y-3">
                    {mapelList.map(m => (
                      <div key={`span-${m.id}`} className="flex items-start space-x-3 group">
                        <Checkbox id={`span-${m.id}`} checked={mapelSPAN.includes(m.nama_mapel)} onCheckedChange={() => toggleSPAN(m.nama_mapel)} className="mt-0.5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                        <Label htmlFor={`span-${m.id}`} className="text-sm cursor-pointer leading-tight group-hover:text-indigo-700 transition-colors">{m.nama_mapel}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Urutkan Format PTKIN</Label>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{mapelSPAN.length} Mapel</span>
                </div>
                <div className="h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-white/60 shadow-inner custom-scrollbar">
                  {mapelSPAN.length === 0 ? <p className="text-xs text-slate-400 text-center mt-10">Belum ada mapel terpilih.</p> : (
                    <div className="space-y-2">
                      {mapelSPAN.map((mp, idx) => (
                        <div key={`ospan-${mp}`} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-colors">
                          <span className="text-xs font-bold text-slate-700 truncate pr-2 flex-1">
                            <span className="inline-block w-5 text-indigo-500 opacity-70">{idx+1}.</span> {mp}
                          </span>
                          <div className="flex gap-0.5 shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveUpSpan(idx)} disabled={idx === 0} className="h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveDownSpan(idx)} disabled={idx === mapelSPAN.length - 1} className="h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* PENGATURAN BOBOT */}
        <div className="mt-8 bg-slate-50/50 p-4 rounded-lg border border-slate-200 shadow-sm">
          <Label className="font-bold text-slate-800 text-base mb-4 block">Simulasi Bobot Nilai Akhir / Ijazah</Label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bobot Rata-rata 5 Semester (%)</Label>
              <Input type="number" name="bobot_rapor" value={bobotRapor} onChange={(e) => setBobotRapor(Number(e.target.value))} max={100} min={0} className="bg-white rounded-xl h-12 text-lg font-bold text-emerald-700 focus:border-emerald-500 shadow-sm" />
            </div>
            <div className="text-lg font-bold text-slate-300 pt-6 hidden sm:block">+</div>
            <div className="flex-1 w-full space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bobot Ujian Madrasah (%)</Label>
              <Input type="number" name="bobot_um" value={100 - bobotRapor} readOnly className="bg-slate-200/50 border-transparent text-slate-500 rounded-xl h-12 text-lg font-bold shadow-inner" />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <SubmitBtn />
        </div>
      </form>
    </div>
  )
}