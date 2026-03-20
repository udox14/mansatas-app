'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Save, Settings2, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react'
import { simpanPengaturanAkademik } from '../actions'

function SubmitBtn({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md gap-2 px-4">
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyimpan...</> : <><Save className="h-3.5 w-3.5" />Simpan Pengaturan</>}
    </Button>
  )
}

// Komponen reusable untuk satu jalur (SNBP atau SPAN)
function JalurSection({
  label, color, mapelList, selected, onToggle, onMoveUp, onMoveDown
}: {
  label: string; color: 'emerald' | 'indigo'
  mapelList: { id: string; nama_mapel: string }[]
  selected: string[]; onToggle: (n: string) => void
  onMoveUp: (i: number) => void; onMoveDown: (i: number) => void
}) {
  const colorMap = {
    emerald: { dot: 'bg-emerald-500', title: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700', check: 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600', hover: 'hover:border-emerald-200' },
    indigo: { dot: 'bg-indigo-500', title: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-700', check: 'data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600', hover: 'hover:border-indigo-200' },
  }
  const c = colorMap[color]
  return (
    <div className="space-y-3 border border-surface-2 p-3 rounded-lg bg-slate-50/40">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${c.dot}`} />
        <h4 className={`text-xs font-bold ${c.title} tracking-wide uppercase`}>{label}</h4>
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${c.badge}`}>{selected.length} mapel</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Pilih mapel */}
        <div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1.5">1. Pilih</p>
          <ScrollArea className="h-52 border border-surface rounded-md p-2.5 bg-surface">
            <div className="space-y-2">
              {mapelList.map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <Checkbox id={`${label}-${m.id}`} checked={selected.includes(m.nama_mapel)}
                    onCheckedChange={() => onToggle(m.nama_mapel)}
                    className={`mt-0.5 ${c.check}`} />
                  <Label htmlFor={`${label}-${m.id}`} className="text-[11px] cursor-pointer leading-snug text-slate-700 dark:text-slate-200">{m.nama_mapel}</Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        {/* Urutkan */}
        <div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1.5">2. Urutan PDSS</p>
          <div className="h-52 overflow-y-auto border border-surface rounded-md p-2 bg-surface">
            {selected.length === 0
              ? <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-8">Belum ada mapel</p>
              : selected.map((mp, idx) => (
                <div key={mp} className={`flex items-center justify-between bg-surface-2 px-2 py-1.5 rounded-md border border-surface-2 mb-1 group ${c.hover} transition-colors`}>
                  <span className="text-[11px] text-slate-700 dark:text-slate-200 truncate flex-1">
                    <span className="text-slate-400 dark:text-slate-500 mr-1">{idx + 1}.</span>{mp}
                  </span>
                  <div className="flex gap-0.5 shrink-0">
                    <button type="button" onClick={() => onMoveUp(idx)} disabled={idx === 0}
                      className="h-5 w-5 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-30">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => onMoveDown(idx)} disabled={idx === selected.length - 1}
                      className="h-5 w-5 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 disabled:opacity-30">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export function PengaturanPanel({ pengaturan, mapelList }: { pengaturan: any; mapelList: { id: string; nama_mapel: string }[] }) {
  const [mapelSNBP, setMapelSNBP] = useState<string[]>(pengaturan?.mapel_snbp || [])
  const [mapelSPAN, setMapelSPAN] = useState<string[]>(pengaturan?.mapel_span || [])
  const [bobotRapor, setBobotRapor] = useState(pengaturan?.bobot_rapor || 60)
  const [pesan, setPesan] = useState('')
  const [pending, setPending] = useState(false)

  const toggle = (setter: typeof setMapelSNBP) => (nama: string) =>
    setter(prev => prev.includes(nama) ? prev.filter(m => m !== nama) : [...prev, nama])

  const moveUp = (setter: typeof setMapelSNBP, arr: string[]) => (i: number) => {
    if (i === 0) return
    const a = [...arr];[a[i - 1], a[i]] = [a[i], a[i - 1]]; setter(a)
  }
  const moveDown = (setter: typeof setMapelSNBP, arr: string[]) => (i: number) => {
    if (i === arr.length - 1) return
    const a = [...arr];[a[i + 1], a[i]] = [a[i], a[i + 1]]; setter(a)
  }

  const handleSimpan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setPending(true); setPesan('')
    const res = await simpanPengaturanAkademik({
      mapel_snbp: mapelSNBP, mapel_span: mapelSPAN,
      bobot_rapor: Number(fd.get('bobot_rapor')),
      bobot_um: 100 - Number(fd.get('bobot_rapor'))
    })
    if (res.error) alert(res.error)
    else setPesan(res.success!)
    setPending(false)
  }

  return (
    <div className="bg-surface rounded-lg border border-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-surface-2">
        <div className="bg-emerald-100 p-1.5 rounded-md text-emerald-700">
          <Settings2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pengaturan Rumus & Format Kelulusan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Pilih mapel dan atur urutan untuk format export SNBP & SPAN-PTKIN.</p>
        </div>
      </div>

      {pesan && (
        <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {pesan}
        </div>
      )}

      <form onSubmit={handleSimpan} className="space-y-4">
        {/* Grid dua jalur */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <JalurSection label="SNBP" color="emerald" mapelList={mapelList}
            selected={mapelSNBP} onToggle={toggle(setMapelSNBP)}
            onMoveUp={moveUp(setMapelSNBP, mapelSNBP)}
            onMoveDown={moveDown(setMapelSNBP, mapelSNBP)}
          />
          <JalurSection label="SPAN-PTKIN" color="indigo" mapelList={mapelList}
            selected={mapelSPAN} onToggle={toggle(setMapelSPAN)}
            onMoveUp={moveUp(setMapelSPAN, mapelSPAN)}
            onMoveDown={moveDown(setMapelSPAN, mapelSPAN)}
          />
        </div>

        {/* Bobot */}
        <div className="bg-surface-2 p-3 rounded-lg border border-surface-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Simulasi Bobot Nilai Akhir</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-semibold uppercase">Bobot Rapor 5 Smt (%)</Label>
              <Input type="number" name="bobot_rapor" value={bobotRapor}
                onChange={e => setBobotRapor(Number(e.target.value))} max={100} min={0}
                className="h-8 text-sm rounded-md bg-surface font-bold text-emerald-700" />
            </div>
            <span className="text-slate-300 dark:text-slate-600 font-bold mt-4">+</span>
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 font-semibold uppercase">Bobot Ujian Madrasah (%)</Label>
              <Input type="number" name="bobot_um" value={100 - bobotRapor} readOnly
                className="h-8 text-sm rounded-md bg-surface-3 border-transparent text-slate-400 dark:text-slate-500 font-bold" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <SubmitBtn pending={pending} />
        </div>
      </form>
    </div>
  )
}