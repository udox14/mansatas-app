// Lokasi: app/dashboard/penugasan/components/penugasan-client.tsx
'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Send, Inbox, Loader2, Search, CheckCircle2,
  ChevronDown, ChevronUp, XCircle, Clock, Users,
  BookOpen, Trash2, ClipboardList,
} from 'lucide-react'
import {
  getJadwalUntukDelegasi, getDaftarUser, getTugasMasuk, getDelegasiTerkirim,
  kirimDelegasiTugas, batalkanDelegasi,
  loadSiswaDelegasi, simpanAbsensiDelegasi,
} from '../actions'
import type { JadwalBlock, DelegasiMasuk, UserOption } from '../actions'
import type { SlotJam } from '@/app/dashboard/settings/types'

// ============================================================
// PROPS
// ============================================================
interface PenugasanClientProps {
  initialJadwal: {
    error: string | null
    blocks: JadwalBlock[]
    slots: SlotJam[]
    tanggal: string
    hari: number
  }
  initialUsers: UserOption[]
  initialTugasMasuk: {
    error: string | null
    data: DelegasiMasuk[]
    slots: SlotJam[]
  }
  initialTerkirim: {
    error: string | null
    data: Array<{
      delegasi_id: string
      kepada_user_nama: string
      status: string
      items: Array<{ kelas_label: string; tugas: string; absen_selesai: boolean }>
    }>
  }
  isGuruPiket: boolean
  tanggalHariIni: string
}

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

// ============================================================
// MAIN COMPONENT
// ============================================================
export function PenugasanClient({
  initialJadwal, initialUsers, initialTugasMasuk, initialTerkirim,
  isGuruPiket, tanggalHariIni,
}: PenugasanClientProps) {
  const tugasMasukCount = initialTugasMasuk.data.length

  return (
    <Tabs defaultValue={isGuruPiket && tugasMasukCount > 0 ? 'masuk' : 'kirim'} className="space-y-3">
      <TabsList className={`grid w-full ${isGuruPiket ? 'grid-cols-2 max-w-md' : 'grid-cols-1 max-w-[200px]'}`}>
        <TabsTrigger value="kirim" className="text-xs sm:text-sm">
          <Send className="h-3.5 w-3.5 mr-1.5" />Kirim Tugas
        </TabsTrigger>
        {isGuruPiket && (
          <TabsTrigger value="masuk" className="text-xs sm:text-sm">
            <Inbox className="h-3.5 w-3.5 mr-1.5" />
            Tugas Masuk
            {tugasMasukCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                {tugasMasukCount}
              </span>
            )}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="kirim">
        <TabKirimTugas
          initialJadwal={initialJadwal}
          initialUsers={initialUsers}
          initialTerkirim={initialTerkirim}
          tanggalHariIni={tanggalHariIni}
        />
      </TabsContent>

      {isGuruPiket && (
        <TabsContent value="masuk">
          <TabTugasMasuk
            initialData={initialTugasMasuk}
            tanggalHariIni={tanggalHariIni}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}

// ============================================================
// TAB: KIRIM TUGAS
// ============================================================
function TabKirimTugas({
  initialJadwal, initialUsers, initialTerkirim, tanggalHariIni,
}: {
  initialJadwal: PenugasanClientProps['initialJadwal']
  initialUsers: UserOption[]
  initialTerkirim: PenugasanClientProps['initialTerkirim']
  tanggalHariIni: string
}) {
  const [blocks] = useState(initialJadwal.blocks)
  const [users] = useState(initialUsers)
  const [terkirim, setTerkirim] = useState(initialTerkirim.data)

  // Form state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tugasMap, setTugasMap] = useState<Record<string, string>>({})
  const [pelaksanaId, setPelaksanaId] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [showUserList, setShowUserList] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const filteredUsers = useMemo(() => {
    let minJam = 999
    let maxJam = 0
    if (selected.size > 0) {
      selected.forEach(pid => {
        const b = blocks.find(x => x.penugasan_id === pid)
        if (b) {
          if (b.jam_ke_mulai < minJam) minJam = b.jam_ke_mulai
          if (b.jam_ke_selesai > maxJam) maxJam = b.jam_ke_selesai
        }
      })
    }

    let allowedUsers = users
    if (selected.size > 0 && minJam <= maxJam) {
      allowedUsers = users.filter(u => !(u.jam_selesai < minJam || u.jam_mulai > maxJam))
    }

    if (!searchUser.trim()) return allowedUsers.slice(0, 20)
    const q = searchUser.toLowerCase()
    return allowedUsers.filter(u => u.nama.toLowerCase().includes(q)).slice(0, 20)
  }, [users, searchUser, selected, blocks])

  const selectedPelaksana = users.find(u => u.id === pelaksanaId)

  // Available blocks (not already delegated or agenda-filled)
  const availableBlocks = blocks.filter(b => !b.sudah_didelegasi)

  function toggleBlock(penugasanId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(penugasanId)) next.delete(penugasanId)
      else next.add(penugasanId)
      return next
    })
  }

  function setTugas(penugasanId: string, tugas: string) {
    setTugasMap(prev => ({ ...prev, [penugasanId]: tugas }))
  }

  async function handleSubmit() {
    if (selected.size === 0) return setPesan({ tipe: 'error', teks: 'Pilih minimal satu kelas.' })
    if (!pelaksanaId) return setPesan({ tipe: 'error', teks: 'Pilih pelaksana terlebih dahulu.' })

    const items = Array.from(selected).map(pid => {
      const block = blocks.find(b => b.penugasan_id === pid)!
      return {
        penugasan_mengajar_id: pid,
        kelas_id: block.kelas_id,
        tugas: tugasMap[pid] || '',
      }
    })

    const empty = items.find(i => !i.tugas.trim())
    if (empty) return setPesan({ tipe: 'error', teks: 'Tugas untuk setiap kelas wajib diisi.' })

    setIsSubmitting(true)
    setPesan(null)
    const result = await kirimDelegasiTugas(pelaksanaId, tanggalHariIni, items)
    setIsSubmitting(false)

    if (result.error) {
      setPesan({ tipe: 'error', teks: result.error })
    } else {
      setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil!' })
      setSelected(new Set())
      setTugasMap({})
      setPelaksanaId('')
      setSearchUser('')
      // Refresh terkirim
      const fresh = await getDelegasiTerkirim(tanggalHariIni)
      setTerkirim(fresh.data)
    }
  }

  async function handleBatalkan(delegasiId: string) {
    const result = await batalkanDelegasi(delegasiId)
    if (result.error) {
      setPesan({ tipe: 'error', teks: result.error })
    } else {
      setPesan({ tipe: 'sukses', teks: result.success || 'Dibatalkan.' })
      const fresh = await getDelegasiTerkirim(tanggalHariIni)
      setTerkirim(fresh.data)
    }
  }

  const hari = initialJadwal.hari

  if (hari === 7) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Hari Minggu — tidak ada jadwal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{HARI_NAMA[hari]}, {new Date(tanggalHariIni + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-sm font-medium mt-0.5">{availableBlocks.length} kelas tersedia untuk didelegasikan</p>
          </div>
        </div>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`p-3 rounded-lg text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Form Kirim */}
      {availableBlocks.length > 0 && (
        <div className="space-y-3">
          {/* Step 1: Pilih Kelas */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-3 py-2.5 bg-gray-50 border-b">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">1. Pilih Kelas</p>
            </div>
            <div className="divide-y">
              {availableBlocks.map(block => {
                const isSelected = selected.has(block.penugasan_id)
                return (
                  <div key={block.penugasan_id} className="p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleBlock(block.penugasan_id)}
                        className="mt-0.5"
                        disabled={block.sudah_isi_agenda}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{block.kelas_label}</span>
                          <span className="text-[11px] text-gray-400">—</span>
                          <span className="text-xs text-gray-500">{block.mapel_nama}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {block.slot_mulai} - {block.slot_selesai}
                        </p>
                        {block.sudah_isi_agenda && (
                          <p className="text-[11px] text-emerald-600 mt-0.5">Agenda sudah diisi</p>
                        )}
                      </div>
                    </label>

                    {/* Input tugas jika terseleksi */}
                    {isSelected && (
                      <div className="mt-2 ml-8">
                        <textarea
                          className="w-full text-sm border rounded-lg p-2.5 resize-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                          rows={2}
                          placeholder="Tulis tugas untuk kelas ini..."
                          value={tugasMap[block.penugasan_id] || ''}
                          onChange={e => setTugas(block.penugasan_id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step 2: Pilih Pelaksana */}
          {selected.size > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-3 py-2.5 bg-gray-50 border-b">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">2. Pilih Pelaksana</p>
              </div>
              <div className="p-3">
                {selectedPelaksana && !showUserList ? (
                  <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-medium text-violet-700">{selectedPelaksana.nama}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-violet-600"
                      onClick={() => { setShowUserList(true); setSearchUser('') }}
                    >
                      Ganti
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Cari nama guru/pegawai..."
                        className="pl-9 text-sm"
                        value={searchUser}
                        onChange={e => { setSearchUser(e.target.value); setShowUserList(true) }}
                        onFocus={() => setShowUserList(true)}
                      />
                    </div>
                    {showUserList && (
                      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {filteredUsers.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-3">Tidak ditemukan</p>
                        ) : (
                          filteredUsers.map(u => (
                            <button
                              key={u.id}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-violet-50 active:bg-violet-100 transition-colors"
                              onClick={() => {
                                setPelaksanaId(u.id)
                                setSearchUser(u.nama)
                                setShowUserList(false)
                              }}
                            >
                              {u.nama}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Kirim */}
          {selected.size > 0 && pelaksanaId && (
            <Button
              className="w-full h-12 text-sm font-semibold bg-violet-600 hover:bg-violet-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Kirim Tugas ({selected.size} kelas)</>
              )}
            </Button>
          )}
        </div>
      )}

      {availableBlocks.length === 0 && terkirim.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Tidak ada jadwal hari ini.</p>
        </div>
      )}

      {/* Delegasi Terkirim */}
      {terkirim.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Tugas Terkirim Hari Ini</p>
          {terkirim.map(dt => (
            <DelegasiTerkirimCard
              key={dt.delegasi_id}
              data={dt}
              onBatalkan={() => handleBatalkan(dt.delegasi_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// CARD: DELEGASI TERKIRIM
// ============================================================
function DelegasiTerkirimCard({
  data, onBatalkan,
}: {
  data: PenugasanClientProps['initialTerkirim']['data'][0]
  onBatalkan: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelesai = data.status === 'SELESAI'

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isSelesai ? 'border-emerald-200' : ''}`}>
      <button
        className="w-full px-3 py-2.5 flex items-center justify-between text-left"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="text-sm font-medium truncate">{data.kepada_user_nama}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              isSelesai ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isSelesai ? 'Selesai' : 'Dikirim'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{data.items.length} kelas</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t">
          <div className="divide-y">
            {data.items.map((item, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                {item.absen_selesai ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{item.kelas_label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{item.tugas}</p>
                </div>
              </div>
            ))}
          </div>
          {!isSelesai && (
            <div className="px-3 py-2 border-t bg-gray-50">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                onClick={onBatalkan}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Batalkan Delegasi
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: TUGAS MASUK
// ============================================================
function TabTugasMasuk({
  initialData, tanggalHariIni,
}: {
  initialData: PenugasanClientProps['initialTugasMasuk']
  tanggalHariIni: string
}) {
  const [data, setData] = useState(initialData.data)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  async function handleRefresh() {
    const fresh = await getTugasMasuk(tanggalHariIni)
    setData(fresh.data)
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Tidak ada tugas masuk hari ini.</p>
      </div>
    )
  }

  // Group by delegasi_id (dari siapa)
  const grouped = new Map<string, DelegasiMasuk[]>()
  for (const item of data) {
    if (!grouped.has(item.delegasi_id)) grouped.set(item.delegasi_id, [])
    grouped.get(item.delegasi_id)!.push(item)
  }

  return (
    <div className="space-y-3">
      {pesan && (
        <div className={`p-3 rounded-lg text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {pesan.teks}
        </div>
      )}

      {Array.from(grouped).map(([delegasiId, items]) => (
        <div key={delegasiId} className="bg-white rounded-xl border overflow-hidden">
          {/* Header: dari siapa */}
          <div className="px-3 py-2.5 bg-violet-50 border-b border-violet-100">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-medium text-violet-700">Dari: {items[0].dari_user_nama}</span>
            </div>
          </div>

          {/* Kelas items */}
          <div className="divide-y">
            {items.map(item => (
              <TugasMasukItem
                key={item.delegasi_kelas_id}
                item={item}
                tanggal={tanggalHariIni}
                onSuccess={(msg) => { setPesan({ tipe: 'sukses', teks: msg }); handleRefresh() }}
                onError={(msg) => setPesan({ tipe: 'error', teks: msg })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// ITEM: TUGAS MASUK (per kelas)
// ============================================================
function TugasMasukItem({
  item, tanggal, onSuccess, onError,
}: {
  item: DelegasiMasuk
  tanggal: string
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [siswaList, setSiswaList] = useState<Array<{
    siswa_id: string; nama_lengkap: string; nisn: string; status: string; catatan: string
  }>>([])
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleExpand() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)

    if (siswaList.length === 0) {
      setIsLoadingSiswa(true)
      const result = await loadSiswaDelegasi(
        item.delegasi_kelas_id,
        item.penugasan_mengajar_id,
        item.kelas_id,
        tanggal,
      )
      setIsLoadingSiswa(false)
      if (result.error) {
        onError(result.error)
        return
      }
      setSiswaList(result.siswa)
    }
  }

  function updateSiswaStatus(siswaId: string, status: string) {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, status } : s))
  }

  async function handleSimpanAbsensi() {
    setIsSaving(true)
    const result = await simpanAbsensiDelegasi(
      item.delegasi_kelas_id,
      item.penugasan_mengajar_id,
      tanggal,
      item.jam_ke_mulai,
      item.jam_ke_selesai,
      siswaList.map(s => ({ siswa_id: s.siswa_id, status: s.status, catatan: s.catatan })),
    )
    setIsSaving(false)

    if (result.error) onError(result.error)
    else onSuccess(result.success || 'Absensi disimpan!')
  }

  const STATUS_COLORS: Record<string, string> = {
    HADIR: 'bg-emerald-500',
    SAKIT: 'bg-blue-500',
    IZIN: 'bg-sky-500',
    ALFA: 'bg-red-500',
  }

  return (
    <div>
      {/* Kelas header */}
      <button
        className="w-full px-3 py-3 flex items-start gap-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
        onClick={handleExpand}
      >
        <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${item.absen_selesai ? 'bg-emerald-100' : 'bg-gray-100'}`}>
          {item.absen_selesai ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ClipboardList className="h-3 w-3 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{item.kelas_label}</span>
            <span className="text-[11px] text-gray-400">—</span>
            <span className="text-xs text-gray-500">{item.mapel_nama}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            <Clock className="h-3 w-3 inline mr-0.5" />
            {item.slot_mulai} - {item.slot_selesai}
          </p>
          <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-lg p-2">
            <p className="text-xs text-amber-800"><span className="font-medium">Tugas:</span> {item.tugas}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 mt-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 mt-1 shrink-0" />}
      </button>

      {/* Expanded: Absensi */}
      {expanded && (
        <div className="px-3 pb-3">
          {isLoadingSiswa ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400 ml-2">Memuat data siswa...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Summary */}
              <div className="flex gap-2 flex-wrap">
                {(['HADIR', 'SAKIT', 'IZIN', 'ALFA'] as const).map(st => {
                  const count = siswaList.filter(s => s.status === st).length
                  return (
                    <span key={st} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_COLORS[st]} mr-1`} />
                      {st}: {count}
                    </span>
                  )
                })}
              </div>

              {/* Siswa List */}
              <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
                {siswaList.map(siswa => (
                  <div key={siswa.siswa_id} className="px-2.5 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{siswa.nama_lengkap}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(['HADIR', 'SAKIT', 'IZIN', 'ALFA'] as const).map(st => (
                        <button
                          key={st}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            siswa.status === st
                              ? st === 'HADIR' ? 'bg-emerald-500 text-white'
                                : st === 'SAKIT' ? 'bg-blue-500 text-white'
                                : st === 'IZIN' ? 'bg-sky-500 text-white'
                                : 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                          onClick={() => updateSiswaStatus(siswa.siswa_id, st)}
                        >
                          {st === 'HADIR' ? 'H' : st === 'SAKIT' ? 'S' : st === 'IZIN' ? 'I' : 'A'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Simpan */}
              <Button
                className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSimpanAbsensi}
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Simpan Absensi</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
