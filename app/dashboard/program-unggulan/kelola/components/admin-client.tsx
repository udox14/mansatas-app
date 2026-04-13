// Lokasi: app/dashboard/program-unggulan/kelola/components/admin-client.tsx
'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useReactToPrint } from 'react-to-print'
import {
  Star, Users, BookOpenCheck, BarChart3, FileText, Plus, Trash2,
  Loader2, AlertCircle, CheckCircle2, School, ChevronDown, ChevronUp,
  Search, Calendar, Download, Printer, BookOpen, Languages, PenLine,
  GraduationCap, Clock, ArrowRightLeft, RefreshCw, X, Eye, Zap
} from 'lucide-react'
import {
  getKelasUnggulanAdmin, tambahKelasUnggulan, hapusKelasUnggulan,
  getGuruAutoByKelas, getWeeklySlots,
  getMateriMingguan, simpanMateriMingguan, editMateriMingguan, hapusMateriMingguan,
  generateJadwalSampling, getJadwalSampling, pindahHariSampling, resetJadwalSampling,
  generateJadwalSemuaKelas,
  getMonitoringData, getLaporanData,
  getAllKelasForDropdown,
  type ProgramType,
} from '../actions'
import { SURAH_LIST } from '../quran-data'
import { cn, formatNamaKelas } from '@/lib/utils'
import { PrintLayout } from './print-materi'

// ── Types ─────────────────────────────────────────────────
type KelasUnggulan = { id: string; kelas_id: string; tingkat: number; nomor_kelas: string; kelompok: string; jumlah_siswa: number }
type KelasOption = { id: string; tingkat: number; nomor_kelas: string; kelompok: string }

type Props = {
  initialKelas: KelasUnggulan[]
  allKelas: KelasOption[]
  currentUserId: string
}

const HARI_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const PROGRAM_CONFIG: Record<ProgramType, { label: string; icon: any; color: string; iconBg: string; desc: string }> = {
  tahfidz: { label: 'Materi Tahfidz', icon: BookOpen, color: 'emerald', iconBg: 'bg-emerald-100 text-emerald-700', desc: 'Hafalan surat & ayat Al-Quran' },
  bahasa_arab: { label: 'Materi Bahasa Arab', icon: Languages, color: 'blue', iconBg: 'bg-blue-100 text-blue-700', desc: 'Mufradat & kalimat bahasa Arab' },
  bahasa_inggris: { label: 'Materi Bahasa Inggris', icon: PenLine, color: 'violet', iconBg: 'bg-violet-100 text-violet-700', desc: 'Vocabulary, kalimat & soal' },
}

function getMondayOfWeek(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export function AdminClient({ initialKelas, allKelas, currentUserId }: Props) {
  const [kelasList, setKelasList] = useState<KelasUnggulan[]>(initialKelas)
  const [activeTab, setActiveTab] = useState('kelas')

  const refreshKelas = useCallback(async () => {
    const res = await getKelasUnggulanAdmin()
    if (res.data) setKelasList(res.data)
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="kelas" className="text-xs sm:text-sm gap-1"><School className="w-3.5 h-3.5 hidden sm:block" />Kelas & Guru</TabsTrigger>
        <TabsTrigger value="materi" className="text-xs sm:text-sm gap-1"><BookOpenCheck className="w-3.5 h-3.5 hidden sm:block" />Materi</TabsTrigger>
        <TabsTrigger value="monitoring" className="text-xs sm:text-sm gap-1"><BarChart3 className="w-3.5 h-3.5 hidden sm:block" />Monitoring</TabsTrigger>
        <TabsTrigger value="laporan" className="text-xs sm:text-sm gap-1"><FileText className="w-3.5 h-3.5 hidden sm:block" />Laporan</TabsTrigger>
      </TabsList>
      <TabsContent value="kelas"><TabKelasGuru kelasList={kelasList} allKelas={allKelas} onRefresh={refreshKelas} /></TabsContent>
      <TabsContent value="materi"><TabMateri kelasList={kelasList} currentUserId={currentUserId} /></TabsContent>
      <TabsContent value="monitoring"><TabMonitoring kelasList={kelasList} /></TabsContent>
      <TabsContent value="laporan"><TabLaporan kelasList={kelasList} /></TabsContent>
    </Tabs>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 1: KELAS & GURU
// ══════════════════════════════════════════════════════════════
function TabKelasGuru({ kelasList, allKelas, onRefresh }: {
  kelasList: KelasUnggulan[]; allKelas: KelasOption[]; onRefresh: () => void
}) {
  const [addKelasId, setAddKelasId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [guruModal, setGuruModal] = useState<KelasUnggulan | null>(null)

  // Bulk generate state
  const [bulkWeek, setBulkWeek] = useState(getMondayOfWeek())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ kelas: string; status: string }[] | null>(null)

  const availableKelas = allKelas.filter(k => !kelasList.some(uk => uk.kelas_id === k.id))

  const handleTambahKelas = async () => {
    if (!addKelasId) return
    setSaving(true); setMsg(null)
    const res = await tambahKelasUnggulan(addKelasId)
    if ('error' in res && res.error) setMsg({ type: 'err', text: res.error })
    else { setMsg({ type: 'ok', text: res.success || '' }); setAddKelasId(''); onRefresh() }
    setSaving(false)
  }

  const handleHapusKelas = async (id: string) => {
    if (!confirm('Hapus kelas unggulan ini beserta semua data terkait?')) return
    setSaving(true)
    const res = await hapusKelasUnggulan(id)
    if ('error' in res && res.error) setMsg({ type: 'err', text: res.error })
    else { setMsg({ type: 'ok', text: res.success || '' }); onRefresh() }
    setSaving(false)
  }

  const handleBulkGenerate = async () => {
    if (!confirm(`Generate jadwal sampling untuk SEMUA kelas minggu ${bulkWeek}?`)) return
    setBulkLoading(true); setBulkResults(null)
    const res = await generateJadwalSemuaKelas(bulkWeek)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setBulkResults(res.results || [])
    setBulkLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" />Tambah Kelas Unggulan</h3>
        <div className="flex gap-2">
          <Select value={addKelasId} onValueChange={setAddKelasId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
            <SelectContent>
              {availableKelas.map(k => (
                <SelectItem key={k.id} value={k.id}>{formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleTambahKelas} disabled={!addKelasId || saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        <MsgBanner msg={msg} />
      </div>

      {/* BULK GENERATE SEMUA KELAS */}
      {kelasList.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Zap className="w-4 h-4" /> Generate Jadwal Semua Kelas Sekaligus
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400">Minggu (Senin)</label>
              <Input type="date" className="h-8 w-40 text-xs" value={bulkWeek}
                onChange={e => setBulkWeek(e.target.value)} />
            </div>
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleBulkGenerate} disabled={bulkLoading}>
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
              Generate Semua ({kelasList.length} kelas)
            </Button>
          </div>
          {bulkResults && (
            <div className="space-y-1 mt-2">
              {bulkResults.map((r, i) => (
                <div key={i} className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 w-28 shrink-0">{r.kelas}</span>
                  <span className="text-slate-500 dark:text-slate-400">{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Guru & slot per hari ditentukan otomatis dari data <strong>Jadwal Mengajar</strong> di Pusat Akademik.</span>
      </div>

      {kelasList.length === 0 ? (
        <EmptyState text="Belum ada kelas unggulan" />
      ) : (
        <div className="space-y-2">
          {kelasList.map(k => (
            <KelasCardAuto key={k.id} kelas={k} isExpanded={expanded === k.id}
              onToggle={() => setExpanded(expanded === k.id ? null : k.id)}
              onDelete={() => handleHapusKelas(k.id)}
              onShowGuru={() => setGuruModal(k)} />
          ))}
        </div>
      )}

      {/* MODAL DETAIL GURU */}
      {guruModal && (
        <ModalGuruDetail kelas={guruModal} onClose={() => setGuruModal(null)} />
      )}
    </div>
  )
}

// ── Modal Guru Detail ─────────────────────────────────────
function ModalGuruDetail({ kelas, onClose }: { kelas: KelasUnggulan; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [guruList, setGuruList] = useState<any[]>([])
  const [weeklyData, setWeeklyData] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      getGuruAutoByKelas(kelas.kelas_id),
      getWeeklySlots(kelas.kelas_id),
    ]).then(([guru, ws]) => {
      setGuruList(guru)
      setWeeklyData(ws)
      setLoading(false)
    })
  }, [kelas.kelas_id])

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            Guru Kelas {formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Memuat data guru...</div>
          ) : (
            <>
              {guruList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Tidak ada penugasan mengajar untuk kelas ini di TA aktif.</p>
              ) : (
                <div className="space-y-2">
                  {guruList.map((g: any) => (
                    <div key={g.guru_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0">
                        {g.guru_nama?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{g.guru_nama}</p>
                        <p className="text-[11px] text-slate-400 truncate">{g.mapel_list || '-'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 shrink-0 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{g.total_jam || 0} jam
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Slot per hari */}
              {weeklyData && weeklyData.total > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Slot Sampling Per Hari
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map(day => (
                      <div key={day} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-center">
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{HARI_NAMES[day]}</p>
                        <p className="text-lg font-bold text-emerald-600">{weeklyData.slots[day]}</p>
                        <p className="text-[9px] text-slate-400">siswa</p>
                        {weeklyData.guruPerHari[day]?.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {weeklyData.guruPerHari[day].map((g: any, i: number) => (
                              <p key={i} className="text-[8px] text-slate-400 truncate" title={`${g.guru_nama} (${g.mapel}) ${g.jam}j→${g.kuota}siswa`}>
                                {g.guru_nama?.split(' ')[0]} {g.jam}j
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Total: <span className="font-bold text-slate-600 dark:text-slate-300">{weeklyData.total} slot/minggu</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Kelas Card (simplified) ───────────────────────────────
function KelasCardAuto({ kelas, isExpanded, onToggle, onDelete, onShowGuru }: {
  kelas: KelasUnggulan; isExpanded: boolean; onToggle: () => void; onDelete: () => void; onShowGuru: () => void
}) {
  // Sampling state
  const [samplingWeek, setSamplingWeek] = useState(getMondayOfWeek())
  const [jadwal, setJadwal] = useState<any[]>([])
  const [slotsPerHari, setSlotsPerHari] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
  const [totalSlot, setTotalSlot] = useState(0)
  const [samplingLoading, setSamplingLoading] = useState(false)
  const [samplingLoaded, setSamplingLoaded] = useState(false)
  const [samplingMsg, setSamplingMsg] = useState('')

  const handleGenerate = async () => {
    setSamplingLoading(true); setSamplingMsg('')
    const res = await generateJadwalSampling(kelas.id, samplingWeek)
    if (res.error) setSamplingMsg(res.error)
    else {
      setJadwal(res.jadwal || [])
      setSlotsPerHari(res.slotsPerHari || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
      setTotalSlot(res.totalSlot || 0)
      setSamplingLoaded(true)
    }
    setSamplingLoading(false)
  }

  const handleLoad = async () => {
    setSamplingLoading(true); setSamplingMsg('')
    const res = await getJadwalSampling(kelas.id, samplingWeek)
    setJadwal(res.jadwal || [])
    setSlotsPerHari(res.slotsPerHari || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
    setTotalSlot(res.totalSlot || 0)
    setSamplingLoaded(true); setSamplingLoading(false)
  }

  const handleReset = async () => {
    if (!confirm('Reset jadwal minggu ini? Akan diacak ulang.')) return
    setSamplingLoading(true)
    await resetJadwalSampling(kelas.id, samplingWeek)
    setJadwal([]); setSamplingLoaded(false); setSamplingLoading(false)
    setSamplingMsg('Jadwal direset. Klik Generate untuk acak baru.')
  }

  const handlePindahHari = async (jadwalId: string, hariBaru: number) => {
    await pindahHariSampling(jadwalId, hariBaru)
    const res = await getJadwalSampling(kelas.id, samplingWeek)
    setJadwal(res.jadwal || [])
  }

  // Group jadwal by hari
  const jadwalByHari: Record<number, any[]> = {}
  for (let d = 1; d <= 6; d++) jadwalByHari[d] = []
  jadwal.forEach(j => { if (jadwalByHari[j.hari]) jadwalByHari[j.hari].push(j) })

  // Check duplicates (siswa muncul >1x)
  const siswaCount = new Map<string, number>()
  jadwal.forEach(j => siswaCount.set(j.siswa_id, (siswaCount.get(j.siswa_id) || 0) + 1))

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={onToggle}>
        <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 text-sm font-bold shrink-0">
          {kelas.tingkat}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Kelas {formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)}
          </p>
          <p className="text-[11px] text-slate-400">{kelas.jumlah_siswa || 0} siswa</p>
        </div>
        <button onClick={e => { e.stopPropagation(); onShowGuru() }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" title="Lihat detail guru">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* JADWAL SAMPLING SECTION */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Jadwal Sampling Mingguan
            </p>

            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <label className="text-[10px] text-slate-400">Minggu (Senin)</label>
                <Input type="date" className="h-8 w-36 text-xs" value={samplingWeek}
                  onChange={e => { setSamplingWeek(e.target.value); setSamplingLoaded(false) }} />
              </div>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleGenerate} disabled={samplingLoading}>
                {samplingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                Generate
              </Button>
              {samplingLoaded && jadwal.length > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleReset} disabled={samplingLoading}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Reset & Acak Ulang
                </Button>
              )}
              {!samplingLoaded && !samplingLoading && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleLoad}>
                  Muat Jadwal
                </Button>
              )}
            </div>

            {samplingMsg && <p className="text-xs text-amber-600 mb-2">{samplingMsg}</p>}

            {totalSlot > 0 && (
              <div className="text-[10px] text-slate-400 mb-2 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>Total: <span className="font-bold text-slate-600 dark:text-slate-300">{totalSlot} slot/minggu</span></span>
                <span className="hidden sm:inline">·</span>
                {[1, 2, 3, 4, 5, 6].map(d => (
                  <span key={d}>{HARI_NAMES[d].slice(0, 3)}: <span className="font-bold text-slate-600 dark:text-slate-300">{slotsPerHari[d]}</span></span>
                ))}
                <span className="hidden sm:inline">·</span>
                <span>Siswa: <span className="font-bold text-slate-600 dark:text-slate-300">{kelas.jumlah_siswa || '?'}</span></span>
                {(kelas.jumlah_siswa || 0) < totalSlot && (
                  <span className="text-amber-600">(antrean wrap-around)</span>
                )}
              </div>
            )}

            {samplingLoaded && jadwal.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map(day => (
                  <div key={day} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 text-center">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{HARI_NAMES[day]}</p>
                      <p className="text-[9px] text-slate-400">
                        {jadwalByHari[day].length}/{slotsPerHari[day]} slot
                      </p>
                    </div>
                    <div className="p-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                      {jadwalByHari[day].map((j: any) => {
                        const isDuplicate = (siswaCount.get(j.siswa_id) || 0) > 1
                        return (
                          <div key={j.id} className={cn(
                            'flex items-center gap-1 px-1.5 py-1 rounded text-[10px] group',
                            isDuplicate ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-white dark:bg-slate-900'
                          )}>
                            <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">
                              {j.nama_lengkap?.split(' ').slice(0, 2).join(' ')}
                              {isDuplicate && <span className="text-amber-500 ml-0.5">⟲</span>}
                            </span>
                            <select className="opacity-0 group-hover:opacity-100 w-8 h-5 text-[9px] bg-transparent border-0 cursor-pointer p-0"
                              value={j.hari} onChange={e => handlePindahHari(j.id, Number(e.target.value))}>
                              {[1, 2, 3, 4, 5, 6].map(d => (
                                <option key={d} value={d}>{HARI_NAMES[d].slice(0, 3)}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                      {jadwalByHari[day].length === 0 && (
                        <p className="text-[9px] text-slate-400 text-center py-2">Kosong</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {samplingLoaded && jadwal.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Belum ada jadwal. Klik "Generate" untuk membuat.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 2: MATERI (3 program buttons + modals)
// ══════════════════════════════════════════════════════════════

function MateriCard({ m, openEdit, handleDelete }: { m: any; openEdit: (m: any) => void; handleDelete: (id: string) => void }) {
  const cfg = PROGRAM_CONFIG[m.program as ProgramType]
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className={`p-2 rounded-lg ${cfg?.iconBg || 'bg-slate-100 text-slate-600'}`}>
        {cfg ? <cfg.icon className="w-4 h-4" /> : <Star className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cfg?.label || m.program}</p>
        <p className="text-[10px] text-slate-400">
          Minggu {m.minggu_mulai} · {m.kelas_labels || 'Semua kelas'}
        </p>
      </div>
      <button onClick={() => handlePrint()} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50" title="Cetak F4 (PDF)">
        <Printer className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50" title="Edit">
        <PenLine className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50" title="Hapus">
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="hidden">
        <PrintLayout ref={printRef} materi={m} />
      </div>
    </div>
  )
}

function TabMateri({ kelasList, currentUserId }: { kelasList: KelasUnggulan[]; currentUserId: string }) {
  const [materiList, setMateriList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalProgram, setModalProgram] = useState<ProgramType | null>(null)
  const [editingMateri, setEditingMateri] = useState<any>(null)

  const loadMateri = useCallback(async () => {
    setLoading(true)
    const data = await getMateriMingguan()
    setMateriList(data); setLoading(false)
  }, [])

  useEffect(() => { loadMateri() }, [loadMateri])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus materi ini?')) return
    await hapusMateriMingguan(id)
    loadMateri()
  }

  const openEdit = (m: any) => {
    setEditingMateri(m)
    setModalProgram(m.program as ProgramType)
  }

  return (
    <div className="space-y-5">
      {/* 3 Big Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['tahfidz', 'bahasa_arab', 'bahasa_inggris'] as ProgramType[]).map(prog => {
          const cfg = PROGRAM_CONFIG[prog]
          const Icon = cfg.icon
          const count = materiList.filter(m => m.program === prog).length
          return (
            <button key={prog} onClick={() => { setEditingMateri(null); setModalProgram(prog) }}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed hover:border-solid transition-all group text-center
                ${prog === 'tahfidz' ? 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' :
                  prog === 'bahasa_arab' ? 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20' :
                  'border-violet-300 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20'}`}>
              <div className={`p-4 rounded-xl ${cfg.iconBg} group-hover:scale-110 transition-transform`}>
                <Icon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{cfg.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{cfg.desc}</p>
                {count > 0 && <p className="text-[10px] text-slate-500 mt-1">{count} materi tersimpan</p>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Existing Materials List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Memuat materi...</div>
      ) : materiList.length === 0 ? (
        <EmptyState text="Belum ada materi mingguan. Klik salah satu tombol di atas untuk membuat." />
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Materi yang sudah dibuat</h3>
          {materiList.map(m => (
            <MateriCard key={m.id} m={m} openEdit={openEdit} handleDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalProgram && (
        <ModalMateri
          program={modalProgram}
          kelasList={kelasList}
          currentUserId={currentUserId}
          editData={editingMateri}
          onClose={() => { setModalProgram(null); setEditingMateri(null) }}
          onSaved={() => { setModalProgram(null); setEditingMateri(null); loadMateri() }}
        />
      )}
    </div>
  )
}

// ── Modal Materi ──────────────────────────────────────────
function ModalMateri({ program, kelasList, currentUserId, editData, onClose, onSaved }: {
  program: ProgramType; kelasList: KelasUnggulan[]; currentUserId: string
  editData: any; onClose: () => void; onSaved: () => void
}) {
  const cfg = PROGRAM_CONFIG[program]
  const isEdit = !!editData

  const [mingguMulai, setMingguMulai] = useState(editData?.minggu_mulai || getMondayOfWeek())
  const [selectedKelas, setSelectedKelas] = useState<string[]>(() => {
    if (editData?.pu_kelas_ids) return editData.pu_kelas_ids.split(',').filter(Boolean)
    return kelasList.map(k => k.id)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Program-specific state
  const existingKonten = useMemo(() => {
    if (!editData?.konten) return null
    try { return typeof editData.konten === 'string' ? JSON.parse(editData.konten) : editData.konten } catch { return null }
  }, [editData])

  // Tahfidz
  const [suratNomor, setSuratNomor] = useState<number>(existingKonten?.surat_nomor || 1)
  const [tahfidzHari, setTahfidzHari] = useState<Record<number, { dari: number; sampai: number; teks_arab?: string }>>(() => {
    if (existingKonten?.hari) return existingKonten.hari
    return { 1: { dari: 1, sampai: 5, teks_arab: '' }, 2: { dari: 6, sampai: 10, teks_arab: '' }, 3: { dari: 11, sampai: 15, teks_arab: '' }, 4: { dari: 16, sampai: 20, teks_arab: '' }, 5: { dari: 21, sampai: 25, teks_arab: '' }, 6: { dari: 26, sampai: 30, teks_arab: '' } }
  })

  // Bahasa Arab
  const [arabHari, setArabHari] = useState<Record<number, { kata: string; arti: string }[]>>(() => {
    if (existingKonten?.hari && program === 'bahasa_arab') return existingKonten.hari
    const def: Record<number, any[]> = {}
    for (let i = 1; i <= 6; i++) def[i] = [{ kata: '', arti: '' }]
    return def
  })

  // Bahasa Inggris (Table style)
  const [inggrisHari, setInggrisHari] = useState<Record<number, {
    vocab: { word: string; phonetic: string; cara_baca: string; pos: string; meaning: string }[];
    phrasal: { verb: string; arti: string; contoh: string }
  }>>(() => {
    if (existingKonten?.hari && program === 'bahasa_inggris') {
      // Handle legacy string data if exist
      if (typeof Object.values(existingKonten.hari)[0] === 'string') {
        const migrated: any = {}
        Object.keys(existingKonten.hari).forEach(k => {
          migrated[Number(k)] = { vocab: [], phrasal: { verb: '', arti: '', contoh: '' } }
        })
        return migrated
      }
      return existingKonten.hari
    }
    const def: any = {}
    const ev = { word: '', phonetic: '', cara_baca: '', pos: '', meaning: '' }
    for (let i = 1; i <= 6; i++) def[i] = { vocab: [{...ev}, {...ev}, {...ev}], phrasal: { verb: '', arti: '', contoh: '' } }
    return def
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleDownloadCsv = () => {
    const header = "Hari,Kategori (Vocab/Phrasal),Word / Verb,Phonetic / Arti,CaraBaca / Contoh,Part of Speech,Meaning\n"
    let rows = ""
    for (let c=1; c<=6; c++) {
      for(let v=0;v<3;v++) rows += `${c},Vocab,,,,,\n`
      rows += `${c},Phrasal,,,,,\n`
    }
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "Format_Materi_Inggris.csv"
    link.click()
  }

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) return
      
      const parseCSVLine = (str: string) => {
        const arr = []; let quote = false; let col = "";
        for (let i = 0; i < str.length; i++) {
            const cc = str[i], nc = str[i+1];
            if (cc === '"' && quote && nc === '"') { col += cc; ++i; continue; }
            if (cc === '"') { quote = !quote; continue; }
            if (cc === ',' && !quote) { arr.push(col); col = ""; continue; }
            col += cc;
        }
        arr.push(col);
        return arr;
      }

      const lines = text.split(/\r?\n/)
      const newHari: any = {}
      for (let i=1; i<=6; i++) newHari[i] = { vocab: [], phrasal: { verb: '', arti: '', contoh: ''} }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const cols = parseCSVLine(line).map(c => c.trim())
        if (cols.length < 2) continue
        
        const h = parseInt(cols[0])
        if (isNaN(h) || h < 1 || h > 6) continue
        
        const type = cols[1].toLowerCase()
        if (type === 'vocab') {
          if (!cols[2] && !cols[3] && !cols[4] && !cols[5] && !cols[6]) continue
          newHari[h].vocab.push({
            word: cols[2] || '', phonetic: cols[3] || '', cara_baca: cols[4] || '', pos: cols[5] || '', meaning: cols[6] || ''
          })
        } else if (type === 'phrasal') {
          if (!cols[2] && !cols[3] && !cols[4]) continue
          newHari[h].phrasal = { verb: cols[2] || '', arti: cols[3] || '', contoh: cols[4] || '' }
        }
      }
      
      for(let i=1; i<=6; i++) {
         if(newHari[i].vocab.length === 0) newHari[i].vocab.push({ word: '', phonetic: '', cara_baca: '', pos: '', meaning: '' })
      }

      setInggrisHari(newHari)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const surah = SURAH_LIST.find(s => s.nomor === suratNomor)

  const handleSave = async () => {
    setError('')
    if (selectedKelas.length === 0) { setError('Pilih minimal 1 kelas'); return }

    let konten: any = {}
    if (program === 'tahfidz') {
      konten = { surat: surah?.nama || '', surat_nomor: suratNomor, nama_arab: surah?.namaArab || '', hari: tahfidzHari }
    } else if (program === 'bahasa_arab') {
      konten = { hari: arabHari }
    } else {
      konten = { hari: inggrisHari }
    }

    setSaving(true)
    const res = isEdit
      ? await editMateriMingguan(editData.id, { minggu_mulai: mingguMulai, konten, pu_kelas_ids: selectedKelas })
      : await simpanMateriMingguan({ program, minggu_mulai: mingguMulai, konten, pu_kelas_ids: selectedKelas, created_by: currentUserId })

    if (res.error) { setError(res.error); setSaving(false) }
    else onSaved()
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <cfg.icon className="w-4 h-4" /> {isEdit ? 'Edit' : 'Buat'} {cfg.label}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Minggu & Kelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Tanggal Mulai Minggu (Senin)</Label>
              <Input type="date" value={mingguMulai} onChange={e => setMingguMulai(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Kelas Tujuan</Label>
              <div className="mt-1 max-h-28 overflow-y-auto border rounded-lg border-slate-200 dark:border-slate-700 p-2 space-y-1">
                {kelasList.map(k => (
                  <label key={k.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" className="rounded" checked={selectedKelas.includes(k.id)}
                      onChange={() => setSelectedKelas(prev => prev.includes(k.id) ? prev.filter(x => x !== k.id) : [...prev, k.id])} />
                    {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* TAHFIDZ FORM */}
          {program === 'tahfidz' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Surat</Label>
                <select className="w-full mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  value={suratNomor} onChange={e => setSuratNomor(Number(e.target.value))}>
                  {SURAH_LIST.map(s => (
                    <option key={s.nomor} value={s.nomor}>{s.nomor}. {s.nama} ({s.namaArab}) — {s.jumlahAyat} ayat</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-semibold">Ayat & Teks per Hari</Label>
                {[1, 2, 3, 4, 5, 6].map(h => (
                  <div key={h} className="p-3 border border-emerald-100 dark:border-emerald-900 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 w-14">{HARI_NAMES[h]}</span>
                      <span className="text-[10px] text-slate-400">Ayat</span>
                      <Input type="number" min={1} max={surah?.jumlahAyat || 999}
                        className="w-16 h-8 text-xs text-center"
                        value={tahfidzHari[h]?.dari || ''}
                        onChange={e => setTahfidzHari(prev => ({ ...prev, [h]: { ...prev[h], dari: Number(e.target.value) } }))} />
                      <span className="text-[10px] text-slate-400">s.d.</span>
                      <Input type="number" min={1} max={surah?.jumlahAyat || 999}
                        className="w-16 h-8 text-xs text-center"
                        value={tahfidzHari[h]?.sampai || ''}
                        onChange={e => setTahfidzHari(prev => ({ ...prev, [h]: { ...prev[h], sampai: Number(e.target.value) } }))} />
                      {surah && (tahfidzHari[h]?.sampai > surah.jumlahAyat) && (
                        <span className="text-[10px] text-red-500">Max {surah.jumlahAyat}</span>
                      )}
                    </div>
                    <textarea 
                      placeholder="Paste ayat Arab di sini..." 
                      dir="rtl"
                      className="w-full mt-1.5 h-16 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm md:text-base font-arabic leading-loose focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={tahfidzHari[h]?.teks_arab || ''}
                      onChange={e => setTahfidzHari(prev => ({ ...prev, [h]: { ...prev[h], teks_arab: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BAHASA ARAB FORM */}
          {program === 'bahasa_arab' && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Mufradat / Kalimat per Hari</Label>
              {[1, 2, 3, 4, 5, 6].map(h => (
                <div key={h} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">{HARI_NAMES[h]}</span>
                    <button type="button" onClick={() => {
                      setArabHari(prev => ({ ...prev, [h]: [...(prev[h] || []), { kata: '', arti: '' }] }))
                    }} className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Tambah
                    </button>
                  </div>
                  {(arabHari[h] || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input placeholder="كلمة (kata Arab)" dir="rtl"
                        className="flex-1 h-8 text-sm"
                        value={item.kata} onChange={e => {
                          const copy = [...(arabHari[h] || [])]
                          copy[idx] = { ...copy[idx], kata: e.target.value }
                          setArabHari(prev => ({ ...prev, [h]: copy }))
                        }} />
                      <Input placeholder="Arti / Terjemah"
                        className="flex-1 h-8 text-sm"
                        value={item.arti} onChange={e => {
                          const copy = [...(arabHari[h] || [])]
                          copy[idx] = { ...copy[idx], arti: e.target.value }
                          setArabHari(prev => ({ ...prev, [h]: copy }))
                        }} />
                      <button type="button" onClick={() => {
                        setArabHari(prev => ({ ...prev, [h]: (prev[h] || []).filter((_, i) => i !== idx) }))
                      }} className="text-slate-400 hover:text-red-500 p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {(!arabHari[h] || arabHari[h].length === 0) && <p className="text-[10px] text-slate-400 text-center py-1">Belum ada mufradat</p>}
                </div>
              ))}
            </div>
          )}

          {/* BAHASA INGGRIS FORM */}
          {program === 'bahasa_inggris' && (
            <div className="space-y-5">
              <Label className="text-sm font-semibold">Materi Vocabulary & Phrasal Verb</Label>
              
              <div className="bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-400 p-3 rounded-lg border border-amber-200 dark:border-amber-900">
                <b className="block mb-1">Upload / Download CSV Excel:</b>
                Silahkan download format template file CSV, isikan materi mingguan menggunakan Microsoft Excel, dan Import filenya ke bawah sini otomatis tanpa mengetik manual.
                <div className="mt-3 flex gap-2">
                   <Button type="button" variant="outline" size="sm" onClick={handleDownloadCsv} className="h-8 text-xs border-amber-300 bg-white">
                      <Download className="w-3 h-3 mr-1" /> Unduh Template CSV
                   </Button>
                   <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                      <Plus className="w-3 h-3 mr-1" /> Import Data CSV
                   </Button>
                   <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImportCsv} />
                </div>
              </div>

              {[1, 2, 3, 4, 5, 6].map(h => (
                <div key={h} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-violet-50 dark:bg-violet-950/30 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-400">{HARI_NAMES[h]}</span>
                    <button type="button" onClick={() => {
                        const copy = { ...inggrisHari }
                        copy[h].vocab.push({ word: '', phonetic: '', cara_baca: '', pos: '', meaning: '' })
                        setInggrisHari(copy)
                      }} className="text-[10px] text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Tambah Word
                    </button>
                  </div>
                  
                  {/* Table Vocab */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#f2a900] text-black">
                        <tr>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold w-8 text-center">No</th>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold w-1/5">Word</th>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold w-1/5">Phonetic Symbol</th>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold w-1/5">Cara Baca</th>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold w-1/6 text-center">Part of Speech</th>
                          <th className="py-1.5 px-2 border border-black/20 font-semibold">Meaning</th>
                          <th className="w-6 border border-black/20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {inggrisHari[h]?.vocab.map((v, i) => (
                          <tr key={i} className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500">{i + 1}</td>
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-7 text-xs px-2 rounded-sm border-0 focus-visible:ring-1" placeholder="Orange" value={v.word} onChange={e => { const copy = { ...inggrisHari }; copy[h].vocab[i].word = e.target.value; setInggrisHari(copy) }} /></td>
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-7 text-xs px-2 rounded-sm border-0 focus-visible:ring-1" placeholder="/ˈɔːrɪndʒ/" value={v.phonetic} onChange={e => { const copy = { ...inggrisHari }; copy[h].vocab[i].phonetic = e.target.value; setInggrisHari(copy) }} /></td>
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-7 text-xs px-2 rounded-sm border-0 focus-visible:ring-1" placeholder="o-rinj" value={v.cara_baca} onChange={e => { const copy = { ...inggrisHari }; copy[h].vocab[i].cara_baca = e.target.value; setInggrisHari(copy) }} /></td>
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-7 text-xs px-2 rounded-sm border-0 focus-visible:ring-1 text-center" placeholder="Noun/Adj" value={v.pos} onChange={e => { const copy = { ...inggrisHari }; copy[h].vocab[i].pos = e.target.value; setInggrisHari(copy) }} /></td>
                            <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-7 text-xs px-2 rounded-sm border-0 focus-visible:ring-1" placeholder="Oranye/Jingga" value={v.meaning} onChange={e => { const copy = { ...inggrisHari }; copy[h].vocab[i].meaning = e.target.value; setInggrisHari(copy) }} /></td>
                            <td className="py-1 px-1 text-center"><button type="button" onClick={() => { const copy = { ...inggrisHari }; copy[h].vocab = copy[h].vocab.filter((_, idx) => idx !== i); setInggrisHari(copy) }} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3 mx-auto" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Phrasal Verb */}
                  <div className="overflow-x-auto border-t border-slate-300 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                          <td className="w-8 break-all flex items-center justify-center -rotate-90 origin-center text-[8px] font-bold tracking-widest text-[#f2a900] bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 h-16">PHRASAL<br/>VERB</td>
                          <td className="flex-1 p-0">
                            <table className="w-full h-full text-xs">
                              <thead className="bg-[#f2a900] text-black">
                                <tr>
                                  <th className="py-1.5 px-2 border-r border-b border-black/20 font-semibold w-[25%]">Phrasal Verb</th>
                                  <th className="py-1.5 px-2 border-r border-b border-black/20 font-semibold w-[25%]">Arti</th>
                                  <th className="py-1.5 px-2 border-b border-black/20 font-semibold">Contoh Kalimat</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-8 text-xs px-2 rounded-sm border-0 focus-visible:ring-1 text-center" placeholder="Grow up" value={inggrisHari[h]?.phrasal?.verb || ''} onChange={e => { const copy = { ...inggrisHari }; copy[h].phrasal.verb = e.target.value; setInggrisHari(copy) }} /></td>
                                  <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800"><Input className="h-8 text-xs px-2 rounded-sm border-0 focus-visible:ring-1 text-center" placeholder="Tumbuh dewasa" value={inggrisHari[h]?.phrasal?.arti || ''} onChange={e => { const copy = { ...inggrisHari }; copy[h].phrasal.arti = e.target.value; setInggrisHari(copy) }} /></td>
                                  <td className="py-1 px-1"><Input className="h-8 text-xs px-2 rounded-sm border-0 focus-visible:ring-1" placeholder="Their children are all grown up..." value={inggrisHari[h]?.phrasal?.contoh || ''} onChange={e => { const copy = { ...inggrisHari }; copy[h].phrasal.contoh = e.target.value; setInggrisHari(copy) }} /></td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}
            className={program === 'tahfidz' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
              program === 'bahasa_arab' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
              'bg-violet-600 hover:bg-violet-700 text-white'}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            {isEdit ? 'Simpan Perubahan' : 'Simpan Materi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 3: MONITORING
// ══════════════════════════════════════════════════════════════
function TabMonitoring({ kelasList }: { kelasList: KelasUnggulan[] }) {
  const [filterKelas, setFilterKelas] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const loadData = async () => {
    setLoading(true)
    const res = await getMonitoringData(
      filterKelas !== 'all' ? filterKelas : undefined, dateFrom || undefined, dateTo || undefined
    )
    setData(res); setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Kelas</Label>
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Dari</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Sampai</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <Button size="sm" onClick={loadData} disabled={loading} className="h-9">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />} Muat
        </Button>
      </div>

      {data ? (
        <div className="space-y-4">
          {/* Guru Activity */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Tanggal</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Guru</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Siswa</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Kelas</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-500">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {data.guruActivity.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-slate-400">Belum ada data</td></tr>
                ) : data.guruActivity.slice(0, 50).map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{r.tanggal}</td>
                    <td className="px-3 py-2 font-medium">{r.guru_nama}</td>
                    <td className="px-3 py-2">{r.siswa_nama}</td>
                    <td className="px-3 py-2">{r.kelas_label}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={r.status} nilai={r.nilai} /></td>
                    <td className="px-3 py-2 text-center">{r.nilai || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && <EmptyState text="Pilih filter dan klik 'Muat' untuk melihat data monitoring" />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 4: LAPORAN
// ══════════════════════════════════════════════════════════════
function TabLaporan({ kelasList }: { kelasList: KelasUnggulan[] }) {
  const [filterKelas, setFilterKelas] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [reportType, setReportType] = useState<'guru' | 'siswa'>('guru')
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const loadReport = async () => {
    setLoading(true)
    const res = await getLaporanData(filterKelas !== 'all' ? filterKelas : undefined, dateFrom || undefined, dateTo || undefined)
    setReportData(res); setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Kelas</Label>
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Dari</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Sampai</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <Button size="sm" onClick={loadReport} disabled={loading} className="h-9">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />} Muat Data
        </Button>
      </div>

      {reportData && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button onClick={() => setReportType('guru')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${reportType === 'guru' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}>Guru</button>
              <button onClick={() => setReportType('siswa')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${reportType === 'siswa' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}>Siswa</button>
            </div>
            <Button size="sm" variant="outline" onClick={() => handlePrint()} className="ml-auto"><Printer className="w-4 h-4 mr-1" />Cetak</Button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
            <div ref={printRef} style={{ background: '#fff', padding: '0', fontFamily: 'Times New Roman, serif' }}>
              <style>{`
                @media print {
                  @page { size: 215mm 330mm; margin: 20mm; }
                  body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                }
                .kop-img { width: calc(100% + 40mm); margin-left: -20mm; margin-right: -20mm; margin-top: -20mm; display: block; margin-bottom: 10px; }
              `}</style>
              
              {/* Fix: Standard Kop Surat - removing negative margins if it causes issues, but here we keep consistency with Rapat if preferred. Actually, let's use the safer 100% approach. */}
              <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block', marginBottom: '15px' }} />

              <h1 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                LAPORAN PROGRAM UNGGULAN ({reportType === 'guru' ? 'GURU' : 'SISWA'})
              </h1>
              <h2 style={{ fontSize: '11px', textAlign: 'center', color: '#000', marginBottom: '16px', fontWeight: 'normal' }}>
                {reportData.tahunAjaran} {dateFrom && dateTo ? `| Periode: ${dateFrom} s/d ${dateTo}` : ''}
              </h2>

              {reportType === 'guru' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>No</th>
                      <th style={thStyle}>Nama Guru</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Sesi Tes</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Siswa Dites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.guruSummary.map((g: any, i: number) => (
                      <tr key={g.guru_id}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{g.guru_nama}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{g.total_sesi}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{g.total_siswa_dites}</td>
                      </tr>
                    ))}
                    {reportData.guruSummary.length === 0 && (
                      <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>Belum ada data</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>No</th>
                      <th style={thStyle}>Nama Siswa</th>
                      <th style={thStyle}>Kelas</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Tes</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Lancar</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Kurang</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Tidak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.siswaRekap.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{r.siswa_nama}</td>
                        <td style={tdStyle}>{r.kelas_label}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{r.total_tes || 0}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{r.lancar || 0}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{r.kurang_lancar || 0}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{r.tidak_lancar || 0}</td>
                      </tr>
                    ))}
                    {reportData.siswaRekap.length === 0 && (
                      <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>Belum ada data</td></tr>
                    )}
                  </tbody>
                </table>
              )}
              
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  <p>Tasikmalaya, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p style={{ marginTop: '2px', fontWeight: 'bold' }}>Admin Program Unggulan</p>
                  <div style={{ height: '50px' }}></div>
                  <p style={{ borderTop: '1px solid #000', paddingTop: '2px' }}>( _________________________ )</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!reportData && !loading && <EmptyState text="Pilih filter lalu klik 'Muat Data' untuk melihat laporan" />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SHARED
// ══════════════════════════════════════════════════════════════
function MsgBanner({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <p className={`text-xs flex items-center gap-1 ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
      {msg.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}{msg.text}
    </p>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-10 text-slate-400 text-sm"><Star className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>{text}</p></div>
}

function StatusBadge({ status, nilai }: { status: string; nilai: string | null }) {
  if (status === 'sudah' && nilai) {
    const color = nilai === 'Lancar' ? 'bg-emerald-100 text-emerald-700' : nilai === 'Kurang Lancar' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{nilai}</span>
  }
  if (['sakit', 'izin', 'alfa'].includes(status)) {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">{status}</span>
  }
  return <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-400">Belum</span>
}

const thStyle: React.CSSProperties = { border: '1px solid #000', padding: '5px 8px', background: '#f0f0f0', fontWeight: 600, fontSize: '10px' }
const tdStyle: React.CSSProperties = { border: '1px solid #000', padding: '5px 8px', fontSize: '10px' }
