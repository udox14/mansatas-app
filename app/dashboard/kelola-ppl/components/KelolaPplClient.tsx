'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { Save, Loader2, UserCheck, ArrowLeft, Plus, CheckCircle2, ChevronRight, GraduationCap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { getJadwalGuruUtama, simpanMappingPPL, getMappingPPL } from '../actions'
import type { GuruInfo, JadwalGuruUtama, MappingPPL, JadwalKBM, PplWithSummary } from '../actions'

const HARI_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function getGroupedKBM(kbm: JadwalKBM[]) {
  const groups: Record<number, JadwalKBM[]> = {}
  for (const k of kbm) {
    if (!groups[k.hari]) groups[k.hari] = []
    groups[k.hari].push(k)
  }
  return groups
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function KelolaPplClient({ 
  pplList, 
  guruUtamaList 
}: { 
  pplList: PplWithSummary[], 
  guruUtamaList: GuruInfo[] 
}) {
  const [editingPplId, setEditingPplId] = useState<string | null>(null)

  // MAIN VIEW
  if (!editingPplId) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pplList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            Tida ada Guru PPL yang terdaftar.
          </div>
        ) : (
          pplList.map(ppl => (
            <div key={ppl.id} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex flex-col group">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner">
                  {ppl.nama_lengkap.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {ppl.nama_lengkap}
                  </h3>
                  <p className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit mt-1">Guru PPL</p>
                </div>
              </div>

              <div className="flex-1 mb-5">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Status Substitusi</p>
                {ppl.substitutions.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Belum ada tugas.</p>
                ) : (
                  <div className="space-y-2">
                    {ppl.substitutions.map(sub => (
                      <div key={sub.guruUtamaId} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate mb-1.5">
                          {sub.guruUtamaNama}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sub.kbm > 0 && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">{sub.kbm} KBM</span>}
                          {sub.piket > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">{sub.piket} Piket</span>}
                          {sub.pu > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">{sub.pu} PU</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setEditingPplId(ppl.id)} 
                variant="outline" 
                className="w-full justify-between hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:hover:bg-indigo-900/40 dark:hover:border-indigo-800"
              >
                Kelola Penugasan
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    )
  }

  const selectedPpl = pplList.find(p => p.id === editingPplId)
  if (!selectedPpl) return null

  // EDITOR VIEW
  return (
    <PplEditor 
      ppl={selectedPpl} 
      guruUtamaList={guruUtamaList} 
      onBack={() => setEditingPplId(null)}
    />
  )
}


// ============================================================
// EDITOR COMPONENT
// ============================================================
function PplEditor({ 
  ppl, 
  guruUtamaList,
  onBack
}: { 
  ppl: PplWithSummary, 
  guruUtamaList: GuruInfo[],
  onBack: () => void 
}) {
  // State for which Guru Utama is currently being edited in the view
  const [activeTab, setActiveTab] = useState<string>('')
  
  // Combine existing substitution IDs and initialize activeTab
  const [activeUtamaIds, setActiveUtamaIds] = useState<string[]>(
    ppl.substitutions.map(s => s.guruUtamaId)
  )

  useEffect(() => {
    if (activeUtamaIds.length > 0 && !activeTab) {
      setActiveTab(activeUtamaIds[0])
    }
  }, [activeUtamaIds, activeTab])

  // Unselected Guru Utama options for dropdown
  const availableUtama = guruUtamaList.filter(g => !activeUtamaIds.includes(g.id))

  const handleAddUtama = (id: string) => {
    if (!id || activeUtamaIds.includes(id)) return
    setActiveUtamaIds([...activeUtamaIds, id])
    setActiveTab(id)
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
      {/* Header Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">Penugasan Substitusi</h2>
            <p className="text-sm text-slate-500 font-medium">{ppl.nama_lengkap}</p>
          </div>
        </div>
        
        {/* Add Guru Utama Dropdown */}
        <div className="flex items-center gap-2">
          <Select onValueChange={handleAddUtama} value="">
            <SelectTrigger className="w-[240px] bg-slate-50 dark:bg-slate-800">
              <SelectValue placeholder="Tambahkan Guru Utama..." />
            </SelectTrigger>
            <SelectContent>
              {availableUtama.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.nama_lengkap}</SelectItem>
              ))}
              {availableUtama.length === 0 && (
                <SelectItem value="_disabled" disabled>Semua guru sudah ditambahkan</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeUtamaIds.length === 0 ? (
        <div className="py-24 text-center text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <UserCheck className="h-10 w-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Belum ada penugasan guru pengganti.</p>
          <p className="text-xs mt-1">Pilih Guru Utama dari menu dropdown di atas.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6 items-start">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 lg:w-72 flex flex-col gap-2 shrink-0">
            {activeUtamaIds.map(guId => {
              const guInfo = guruUtamaList.find(g => g.id === guId)
              const isSelected = activeTab === guId
              return (
                <button
                  key={guId}
                  onClick={() => setActiveTab(guId)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group ${
                    isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      {guInfo?.nama_lengkap || 'Unknown'}
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {activeTab && (
              <UtamaScheduleEditor 
                key={activeTab} // Force remount if tab changes for proper loading state
                guruPplId={ppl.id} 
                guruUtamaId={activeTab} 
                guruUtamaNama={guruUtamaList.find(g => g.id === activeTab)?.nama_lengkap || ''}
                onRemove={() => {
                  const nu = activeUtamaIds.filter(id => id !== activeTab)
                  setActiveUtamaIds(nu)
                  setActiveTab(nu.length > 0 ? nu[0] : '')
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// INDIVIDUAL SCHEDULE EDITOR
// ============================================================
function UtamaScheduleEditor({ 
  guruPplId, 
  guruUtamaId, 
  guruUtamaNama,
  onRemove
}: { 
  guruPplId: string
  guruUtamaId: string
  guruUtamaNama: string
  onRemove: () => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  
  const [jadwal, setJadwal] = useState<JadwalGuruUtama>({ kbm: [], piket: [], pu: [] })
  const [selKbm, setSelKbm] = useState<Set<string>>(new Set())
  const [selPiket, setSelPiket] = useState<Set<string>>(new Set())
  const [selPu, setSelPu] = useState<Set<string>>(new Set())

  // Load data immediately on mount
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      const [jData, mData] = await Promise.all([
        getJadwalGuruUtama(guruUtamaId),
        getMappingPPL(guruPplId, guruUtamaId)
      ])
      
      if (!mounted) return
      setJadwal(jData)
      
      const msKbm = new Set<string>()
      const msPiket = new Set<string>()
      const msPu = new Set<string>()
      for (const m of mData) {
        if (m.jadwal_mengajar_id) msKbm.add(m.jadwal_mengajar_id)
        if (m.jadwal_piket_id) msPiket.add(m.jadwal_piket_id)
        if (m.pu_kelas_id) msPu.add(m.pu_kelas_id)
      }
      setSelKbm(msKbm)
      setSelPiket(msPiket)
      setSelPu(msPu)
      setIsLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [guruUtamaId, guruPplId])

  const groupedKBM = useMemo(() => getGroupedKBM(jadwal.kbm), [jadwal.kbm])

  const toggleKbm = (id: string) => { const s = new Set(selKbm); s.has(id) ? s.delete(id) : s.add(id); setSelKbm(s) }
  const togglePiket = (id: string) => { const s = new Set(selPiket); s.has(id) ? s.delete(id) : s.add(id); setSelPiket(s) }
  const togglePu = (id: string) => { const s = new Set(selPu); s.has(id) ? s.delete(id) : s.add(id); setSelPu(s) }

  const handleSave = () => {
    const mappings: MappingPPL[] = []
    Array.from(selKbm).forEach(id => mappings.push({ jadwal_mengajar_id: id, jadwal_piket_id: null, pu_kelas_id: null }))
    Array.from(selPiket).forEach(id => mappings.push({ jadwal_mengajar_id: null, jadwal_piket_id: id, pu_kelas_id: null }))
    Array.from(selPu).forEach(id => mappings.push({ jadwal_mengajar_id: null, jadwal_piket_id: null, pu_kelas_id: id }))
    
    startTransition(async () => {
      const res = await simpanMappingPPL(guruPplId, guruUtamaId, mappings)
      if (res.error) {
        alert(res.error)
      } else {
        alert('Tugas PPL Untuk Guru: ' + guruUtamaNama + ' berhasil disimpan!')
        // Since revalidatePath is called in server action, next.js will auto refresh route
      }
    })
  }

  const handleRemoveAll = () => {
    if (!confirm('Hapus Guru Utama ini dari tanggungan PPL ini? (Belum tersimpan ke server sebelum klik Simpan)')) return
    setSelKbm(new Set())
    setSelPiket(new Set())
    setSelPu(new Set())
    onRemove() // Just remove from tab list visually, the real delete requires save or explicitly calling api.
    
    // Auto trigger save to clear DB
    startTransition(async () => {
      await simpanMappingPPL(guruPplId, guruUtamaId, [])
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col py-20 items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Memuat jadwal {guruUtamaNama}...</p>
      </div>
    )
  }

  const selCount = selKbm.size + selPiket.size + selPu.size

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header Inside Editor */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Jadwal {guruUtamaNama}</h3>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selCount}</span> Sesi Dipilih
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleRemoveAll} disabled={isPending} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
            Hapus Guru
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Kelas Ini
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-8">
        {/* KBM */}
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Jadwal KBM ({jadwal.kbm.length})
            </h4>
          </div>
          
          {jadwal.kbm.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Tidak ada jadwal KBM.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.keys(groupedKBM).sort((a, b) => Number(a) - Number(b)).map(hariStr => {
                const hariNum = parseInt(hariStr)
                return (
                  <div key={hariNum} className="space-y-2 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <div className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-2 px-1">
                      Hari {HARI_NAMES[hariNum]}
                    </div>
                    {groupedKBM[hariNum].map(k => (
                      <label key={k.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-colors group shadow-sm">
                        <Checkbox checked={selKbm.has(k.id)} onCheckedChange={() => toggleKbm(k.id)} className="mt-0.5 shrink-0 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold truncate text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {k.mapel_nama}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                            <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-medium">Jam {k.jam_ke}</span>
                            <span className="font-medium">Kelas {k.kelas_label}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Piket */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <h4 className="text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              Tugas Piket ({jadwal.piket.length})
            </h4>
            {jadwal.piket.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Tidak ada tugas piket.</p>
            ) : (
              <div className="space-y-2">
                {jadwal.piket.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-300 cursor-pointer shadow-sm">
                    <Checkbox checked={selPiket.has(p.id)} onCheckedChange={() => togglePiket(p.id)} className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Piket Hari {HARI_NAMES[p.hari]}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{p.shift_nama}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* PU */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              Prog. Unggulan ({jadwal.pu.length})
            </h4>
            {jadwal.pu.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Tidak ada prg. unggulan.</p>
            ) : (
              <div className="space-y-2">
                {jadwal.pu.map(pu => (
                  <label key={pu.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-300 cursor-pointer shadow-sm">
                    <Checkbox checked={selPu.has(pu.id)} onCheckedChange={() => togglePu(pu.id)} className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{pu.label}</p>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
