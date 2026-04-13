'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  LogIn, LogOut, Clock, AlertTriangle, CheckCircle2, XCircle, Stethoscope,
  FileText, Loader2, Pencil, MapPin, Building2, CalendarDays, Timer
} from 'lucide-react'
import { catatPresensiMasuk, catatPresensiPulang, setStatusPresensi, editWaktuPresensi, simpanFotoPresensi } from '../actions'
import { CameraCapture } from '@/components/presensi/camera-capture'
import { cn } from '@/lib/utils'
import { nowWIB } from '@/lib/time'

type Pegawai = {
  id: string; nama_lengkap: string; email: string;
  domisili_pegawai: string | null; jabatan_nama: string;
  avatar_url: string | null; is_struktural: boolean;
}
type Presensi = {
  id: string; user_id: string; tanggal: string; jam_masuk: string | null;
  jam_pulang: string | null; status: string; is_telat: number;
  is_pulang_cepat: number; catatan: string | null
}
type Pengaturan = {
  jam_masuk: string; jam_pulang: string;
  batas_telat_menit: number; batas_pulang_cepat_menit: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  hadir: { label: 'Hadir', color: 'text-emerald-600', icon: CheckCircle2 },
  sakit: { label: 'Sakit', color: 'text-amber-600', icon: Stethoscope },
  izin: { label: 'Izin', color: 'text-blue-600', icon: FileText },
  alfa: { label: 'Alfa', color: 'text-rose-600', icon: XCircle },
  dinas_luar: { label: 'Dinas Luar', color: 'text-violet-600', icon: MapPin },
}

const getAvatarColor = (name: string) => {
  const colors = [
    'from-rose-400 to-rose-600', 'from-violet-400 to-violet-600',
    'from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600',
    'from-amber-400 to-amber-600', 'from-cyan-400 to-cyan-600'
  ]
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function PresensiClient({ pegawai, presensiHariIni, pengaturan, tanggal, currentUserId, isSuperAdmin }: {
  pegawai: Pegawai[]; presensiHariIni: Presensi[]; pengaturan: Pengaturan; tanggal: string; currentUserId: string; isSuperAdmin: boolean
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{ presensi: Presensi; pegawai: Pegawai } | null>(null)
  const [editJamMasuk, setEditJamMasuk] = useState('')
  const [editJamPulang, setEditJamPulang] = useState('')
  const [statusModal, setStatusModal] = useState<Pegawai | null>(null)
  const [statusValue, setStatusValue] = useState('sakit')
  const [statusCatatan, setStatusCatatan] = useState('')
  const [currentTime, setCurrentTime] = useState(nowWIB())
  const [modalPending, setModalPending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [fakeMap, setFakeMap] = useState<Record<string, Presensi>>({})
  const [cameraTarget, setCameraTarget] = useState<{ pg: Pegawai; action: 'masuk' | 'pulang' } | null>(null)

  // Initialize from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mansatas_fake_presensi')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Check if data is from today, otherwise clear
        const todayKeys: Record<string, Presensi> = {}
        for (const k in parsed) {
          if (parsed[k].tanggal === tanggal) {
            todayKeys[k] = parsed[k]
          }
        }
        setFakeMap(todayKeys)
      }
    } catch (e) {
      console.error('Failed to parse fake presensi', e)
    }
  }, [tanggal])

  // Save to LocalStorage whenever fakeMap changes
  useEffect(() => {
    localStorage.setItem('mansatas_fake_presensi', JSON.stringify(fakeMap))
  }, [fakeMap])

  // Live clock
  useState(() => {
    const interval = setInterval(() => setCurrentTime(nowWIB()), 30000)
    return () => clearInterval(interval)
  })

  // Combine real and fake presensi
  const presensiMap = new Map(presensiHariIni.map(p => [p.user_id, p]))
  Object.values(fakeMap).forEach(p => presensiMap.set(p.user_id, p))

  const handleCapture = async (file: File) => {
    if (!cameraTarget) return
    const { pg, action } = cameraTarget
    setLoadingId(pg.id)
    setCameraTarget(null)

    // 1. Upload ke R2
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', pg.id)
    formData.append('action', action)
    
    const uploadRes = await simpanFotoPresensi(formData)
    if (uploadRes.error) {
      alert("Peringatan: Gagal mengunggah foto ke Cloud. Namun presensi akan tetap dicatat.\nError: " + uploadRes.error)
    }

    // 2. Catat Presensi
    if (action === 'masuk') {
      if (pg.is_struktural) {
        const res = await catatPresensiMasuk(pg.id, currentUserId, undefined)
        if (res.error) alert(res.error)
      } else {
        const timeStr = nowWIB().toTimeString().slice(0, 5)
        setFakeMap(prev => ({ ...prev, [pg.id]: { id: 'fake_m_' + pg.id, user_id: pg.id, tanggal, jam_masuk: timeStr, jam_pulang: null, status: 'hadir', is_telat: 0, is_pulang_cepat: 0, catatan: null } }))
      }
    } else {
      if (pg.is_struktural) {
        const res = await catatPresensiPulang(pg.id, currentUserId)
        if (res.error) alert(res.error)
      } else {
        const timeStr = nowWIB().toTimeString().slice(0, 5)
        setFakeMap(prev => ({
          ...prev,
          [pg.id]: prev[pg.id] ? { ...prev[pg.id], jam_pulang: timeStr } : { id: 'fake_p_' + pg.id, user_id: pg.id, tanggal, jam_masuk: null, jam_pulang: timeStr, status: 'hadir', is_telat: 0, is_pulang_cepat: 0, catatan: null }
        }))
      }
    }
    setLoadingId(null)
  }


  const handleSetStatus = async () => {
    if (!statusModal) return
    setModalPending(true)
    if (statusModal.is_struktural) {
      const res = await setStatusPresensi(statusModal.id, statusValue, currentUserId, statusCatatan || undefined)
      if (res.error) alert(res.error)
      else setStatusModal(null)
    } else {
      setFakeMap(prev => ({ ...prev, [statusModal.id]: { id: 'fake_s_' + statusModal.id, user_id: statusModal.id, tanggal, jam_masuk: null, jam_pulang: null, status: statusValue, is_telat: 0, is_pulang_cepat: 0, catatan: statusCatatan || null } }))
      setStatusModal(null)
    }
    setModalPending(false)
  }

  const handleEditSave = async () => {
    if (!editData) return
    setModalPending(true)
    if (editData.pegawai.is_struktural) {
      const res = await editWaktuPresensi(
        editData.presensi.id,
        editJamMasuk || null,
        editJamPulang || null,
        currentUserId
      )
      if (res?.error) alert(res.error)
      else setEditData(null)
    } else {
      setFakeMap(prev => ({ ...prev, [editData.pegawai.id]: { ...prev[editData.pegawai.id], jam_masuk: editJamMasuk || null, jam_pulang: editJamPulang || null } }))
      setEditData(null)
    }
    setModalPending(false)
  }

  const openEdit = (p: Presensi, pg: Pegawai) => {
    setEditData({ presensi: p, pegawai: pg })
    setEditJamMasuk(p.jam_masuk || '')
    setEditJamPulang(p.jam_pulang || '')
  }

  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const d = new Date(tanggal + 'T00:00:00')
  const hariStr = hari[d.getDay()]

  // Stats
  const totalPegawai = pegawai.length
  const hadir = Array.from(presensiMap.values()).filter(p => p.status === 'hadir').length
  const telat = Array.from(presensiMap.values()).filter(p => p.is_telat).length
  const absen = Array.from(presensiMap.values()).filter(p => ['sakit', 'izin', 'alfa', 'dinas_luar'].includes(p.status)).length
  const belum = totalPegawai - presensiMap.size

  const filteredPegawai = pegawai.filter(p => p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || p.jabatan_nama.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <>
      {cameraTarget && (
        <CameraCapture 
          onCapture={handleCapture} 
          onClose={() => setCameraTarget(null)} 
        />
      )}

      {/* MODAL SET STATUS */}

      <Dialog open={!!statusModal} onOpenChange={o => !o && setStatusModal(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold">Set Status — {statusModal?.nama_lengkap}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Status</Label>
              <Select value={statusValue} onValueChange={setStatusValue}>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sakit" className="text-xs">Sakit</SelectItem>
                  <SelectItem value="izin" className="text-xs">Izin</SelectItem>
                  <SelectItem value="alfa" className="text-xs">Alfa (Tanpa Keterangan)</SelectItem>
                  <SelectItem value="dinas_luar" className="text-xs">Dinas Luar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Keterangan (opsional)</Label>
              <Input value={statusCatatan} onChange={e => setStatusCatatan(e.target.value)} className="h-9 text-sm rounded-lg" placeholder="Alasan..." />
            </div>
            <Button onClick={handleSetStatus} disabled={modalPending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              {modalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Status'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIT WAKTU */}
      <Dialog open={!!editData} onOpenChange={o => !o && setEditData(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold">Edit Waktu — {editData?.pegawai.nama_lengkap}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Jam Masuk</Label>
              <Input type="time" value={editJamMasuk} onChange={e => setEditJamMasuk(e.target.value)} className="h-9 text-sm rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Jam Pulang</Label>
              <Input type="time" value={editJamPulang} onChange={e => setEditJamPulang(e.target.value)} className="h-9 text-sm rounded-lg" />
            </div>
            <Button onClick={handleEditSave} disabled={modalPending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              {modalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {/* HEADER INFO */}
        <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-teal-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{hariStr}, {tanggal}</p>
              <p className="text-[10px] text-slate-400">Jam kerja: {pengaturan.jam_masuk} — {pengaturan.jam_pulang} | Toleransi telat: {pengaturan.batas_telat_menit} mnt</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
              {String(currentTime.getUTCHours()).padStart(2, '0')}:{String(currentTime.getUTCMinutes()).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Hadir', value: hadir, total: totalPegawai, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { label: 'Telat', value: telat, total: hadir, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { label: 'Tidak Hadir', value: absen, total: totalPegawai, color: 'text-rose-600 bg-rose-50 border-rose-200' },
            { label: 'Belum Absen', value: belum, total: totalPegawai, color: 'text-slate-600 bg-slate-50 border-slate-200' },
          ].map(s => (
            <div key={s.label} className={cn("rounded-lg border px-3 py-2", s.color)}>
              <p className="text-lg font-bold">{s.value}<span className="text-xs font-normal opacity-60">/{s.total}</span></p>
              <p className="text-[10px] font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* SEARCH BAR (FULL WIDTH) */}
        <div className="w-full flex shrink-0 border border-surface rounded-lg bg-surface mb-2 mt-3">
          <Input placeholder="Cari pegawai..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-10 border-0 bg-transparent text-sm w-full" />
        </div>

        {/* GRID CARDS */}
        {filteredPegawai.length === 0 ? (
          <div className="bg-surface py-10 rounded-lg border border-surface text-center">
            <Building2 className="h-7 w-7 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Tidak ada pegawai yang cocok dengan pencarian.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredPegawai.map(pg => {
              const pr = presensiMap.get(pg.id)
              const status = pr?.status || null
              const cfg = status ? STATUS_CONFIG[status] : null
              const StatusIcon = cfg?.icon || null

              return (
                <div key={pg.id} className={cn(
                  "bg-surface border rounded-xl p-2.5 flex gap-3 h-[148px] overflow-hidden transition-all",
                  status === 'hadir' ? 'border-emerald-200' : status ? 'border-surface' : 'border-dashed border-slate-300'
                )}>
                  {/* Photo Profile 3:4 */}
                  <div className="w-[96px] h-[128px] shrink-0 rounded bg-slate-100 border border-slate-100 dark:border-slate-800 flex items-center justify-center relative overflow-hidden">
                    {pg.avatar_url ? (
                      <img src={pg.avatar_url} alt={pg.nama_lengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-4xl font-black text-white/50", getAvatarColor(pg.nama_lengkap))}>
                        {pg.nama_lengkap.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info area */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 min-w-0 mb-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight" title={pg.nama_lengkap}>{pg.nama_lengkap}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 max-w-full truncate">
                          <Building2 className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{pg.jabatan_nama}</span>
                        </span>
                      </div>
                      
                      {/* Fixed height status block */}
                      <div className="h-[40px] mt-2 flex flex-col justify-start">
                        {cfg ? (
                          <div className="flex flex-wrap items-center gap-1.5 px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold w-fit">
                            {StatusIcon && <StatusIcon className={cn("h-3 w-3 shrink-0", cfg.color)} />}
                            <span className="text-slate-700 dark:text-slate-300">{cfg.label}</span>
                            {pr?.is_telat ? <span className="ml-0.5 text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded shadow-sm border border-amber-100">TELAT</span> : null}
                            {pr?.is_pulang_cepat ? <span className="ml-0.5 text-[8px] font-bold text-orange-600 bg-orange-50 px-1 py-0.5 rounded shadow-sm border border-orange-100">PC</span> : null}

                            {pr?.status === 'hadir' && pr?.jam_masuk && (
                              <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-slate-300 dark:border-slate-700">
                                <div className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-none shadow-sm">
                                  {pr.jam_masuk}
                                </div>
                                {pr.jam_pulang && (
                                  <>
                                    <span className="text-slate-400 text-[10px]">→</span>
                                    <div className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px] text-rose-600 dark:text-rose-400 font-bold leading-none shadow-sm">
                                      {pr.jam_pulang}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic py-1">Belum absen</div>
                        )}
                        {pr?.catatan && (
                          <p className="text-[9px] text-slate-400 italic line-clamp-1 mt-1" title={pr.catatan}>{pr.catatan}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons (bottom aligned with mt-auto) */}
                    <div className="flex gap-1.5 shrink-0 mt-auto">
                      {!pr ? (
                        <>
                          <Button size="sm" onClick={() => setCameraTarget({ pg, action: 'masuk' })} disabled={loadingId === pg.id}
                            className="flex-1 h-7 text-[11px] rounded bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2">
                            {loadingId === pg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />} Masuk
                          </Button>

                          {isSuperAdmin && (
                            <Button size="sm" variant="outline" onClick={() => { setStatusModal(pg); setStatusValue('sakit'); setStatusCatatan('') }} disabled={loadingId === pg.id}
                              className="h-7 text-[11px] rounded gap-1 px-2 shrink-0">
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      ) : pr.status === 'hadir' && !pr.jam_pulang ? (
                        <>
                          <Button size="sm" onClick={() => setCameraTarget({ pg, action: 'pulang' })} disabled={loadingId === pg.id}
                            className="flex-1 h-7 text-[11px] rounded bg-rose-500 hover:bg-rose-600 text-white gap-1 px-2">
                            {loadingId === pg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />} Pulang
                          </Button>

                          {isSuperAdmin && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(pr, pg)} className="h-7 w-7 p-0 rounded shrink-0">
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      ) : pr.status === 'hadir' && pr.jam_pulang ? (
                        <>
                          <div className="flex-1 flex items-center justify-center h-7 text-[11px] text-emerald-600 font-semibold gap-1 bg-emerald-50 rounded border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
                          </div>
                          {isSuperAdmin && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(pr, pg)} className="h-7 w-7 p-0 rounded shrink-0">
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {isSuperAdmin && (
                            <Button size="sm" variant="outline" onClick={() => { setStatusModal(pg); setStatusValue(pr.status); setStatusCatatan(pr.catatan || '') }} disabled={loadingId === pg.id}
                              className="flex-1 h-7 text-[11px] rounded gap-1 px-2">
                              <Pencil className="h-3 w-3" /> Ubah Status
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
