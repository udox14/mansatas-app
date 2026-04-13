// Lokasi: app/dashboard/monitoring-agenda/components/monitoring-client.tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Search, Loader2, Eye, Edit3, CheckCircle2, Clock, XCircle,
  AlertTriangle, Calendar, BarChart3, Printer,
  ChevronLeft, ChevronRight, Send, ShieldCheck,
} from 'lucide-react'
import {
  getMonitoringHarian, getRekapKehadiranGuru,
  editAgendaStatus, getDataCetakLaporan,
  getMonitoringPiketHarian, editAgendaPiketStatus,
} from '../actions'
import { todayWIB, nowWIB } from '@/lib/time'

// ============================================================
// TYPES
// ============================================================
type FilterOption = { id: string; nama?: string; label?: string }
interface MonitoringClientProps {
  filterOptions: { guru: FilterOption[]; kelas: FilterOption[] }
  userRole: string
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string; dot: string }> = {
  TEPAT_WAKTU: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: 'Tepat Waktu', dot: 'bg-emerald-500' },
  HADIR:       { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: 'Hadir', dot: 'bg-emerald-500' },
  TELAT:       { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Clock, label: 'Telat', dot: 'bg-amber-500' },
  TUGAS:       { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', icon: Send, label: 'Tugas', dot: 'bg-violet-500' },
  ALFA:        { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Alfa', dot: 'bg-red-500' },
  SAKIT:       { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: AlertTriangle, label: 'Sakit', dot: 'bg-blue-500' },
  IZIN:        { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: AlertTriangle, label: 'Izin', dot: 'bg-sky-500' },
}

const STATUS_OPTIONS = ['TEPAT_WAKTU', 'TELAT', 'TUGAS', 'ALFA', 'SAKIT', 'IZIN']
const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function formatTanggal(tgl: string) {
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function todayStr() { return todayWIB() }

// ============================================================
// MAIN COMPONENT
// ============================================================
export function MonitoringClient({ filterOptions, userRole }: MonitoringClientProps) {
  return (
    <Tabs defaultValue="harian" className="space-y-3">
      <TabsList className="grid w-full grid-cols-4 max-w-2xl">
        <TabsTrigger value="harian" className="text-xs sm:text-sm"><Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Harian</TabsTrigger>
        <TabsTrigger value="rekap" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Rekap</TabsTrigger>
        <TabsTrigger value="cetak" className="text-xs sm:text-sm"><Printer className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Cetak</TabsTrigger>
        <TabsTrigger value="mon-piket" className="text-xs sm:text-sm"><ShieldCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Mon. Piket</TabsTrigger>
      </TabsList>

      <TabsContent value="harian"><TabHarian filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="rekap"><TabRekap filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="cetak"><TabCetak filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="mon-piket"><TabMonitoringPiket /></TabsContent>
    </Tabs>
  )
}

// ============================================================
// TAB: MONITORING HARIAN
// ============================================================
function TabHarian({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const [tanggal, setTanggal] = useState(todayStr())
  const [filterMode, setFilterMode] = useState<'semua' | 'guru' | 'kelas'>('semua')
  const [filterId, setFilterId] = useState('')
  const [data, setData] = useState<any[]>([])
  const [hariNama, setHariNama] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Detail modal
  const [detailItem, setDetailItem] = useState<any>(null)
  // Edit modal
  const [editItem, setEditItem] = useState<any>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const handleSearch = async () => {
    setIsLoading(true); setPesan(null)
    const result = await getMonitoringHarian(tanggal, filterMode, filterMode !== 'semua' ? filterId : undefined)
    if (result.error) setPesan({ tipe: 'error', teks: result.error })
    else { setData(result.data || []); setHariNama(result.hariNama || '') }
    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!editItem) return
    setIsEditing(true)
    const result = await editAgendaStatus(
      editItem.agenda_id || null,
      editItem.penugasan_id,
      tanggal,
      editItem.guru_id,
      editItem.jam_ke_mulai,
      editItem.jam_ke_selesai,
      editStatus,
      editCatatan,
    )
    if (result.error) setPesan({ tipe: 'error', teks: result.error })
    else { setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil' }); setEditItem(null); handleSearch() }
    setIsEditing(false)
  }

  const navigateDate = (offset: number) => {
    const d = new Date(tanggal + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const newTgl = d.toISOString().split('T')[0]
    setTanggal(newTgl)
  }

  // Summary counts
  const summary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} className="px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="max-w-[180px] text-sm" />
          <Button variant="outline" size="sm" onClick={() => navigateDate(1)} className="px-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTanggal(todayStr())} className="text-xs">Hari Ini</Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">Filter</Label>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v as any); setFilterId('') }}>
              <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="guru">Per Guru</SelectItem>
                <SelectItem value="kelas">Per Kelas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === 'guru' && (
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-slate-500">Guru</Label>
              <Select value={filterId} onValueChange={setFilterId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih guru..." /></SelectTrigger>
                <SelectContent>
                  {filterOptions.guru.map(g => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterMode === 'kelas' && (
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-slate-500">Kelas</Label>
              <Select value={filterId} onValueChange={setFilterId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                <SelectContent>
                  {filterOptions.kelas.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Cari
          </Button>
        </div>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Summary badges */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{hariNama} &middot; {data.length} blok</span>
          {Object.entries(summary).map(([status, count]) => {
            const s = STATUS_STYLE[status]
            return s ? <span key={status} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.bg} ${s.text}`}>{s.label}: {count as number}</span> : null
          })}
        </div>
      )}

      {/* Table */}
      {data.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Guru</TableHead>
                <TableHead className="text-xs">Mapel</TableHead>
                <TableHead className="text-xs">Kelas</TableHead>
                <TableHead className="text-xs">Jam</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, idx) => {
                const style = STATUS_STYLE[item.status] || STATUS_STYLE.ALFA
                const StatusIcon = style.icon
                return (
                  <TableRow key={`${item.penugasan_id}-${idx}`}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.mapel_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.kelas_label}</TableCell>
                    <TableCell className="text-xs text-slate-500">{item.jam_label}<br /><span className="text-[10px]">{item.slot_mulai}-{item.slot_selesai}</span></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
                        <StatusIcon className="h-3 w-3" />{style.label}
                      </span>
                      {item.status === 'TUGAS' && item.pelaksana_nama && (
                        <p className="text-[10px] text-violet-500 mt-0.5">Pelaksana: {item.pelaksana_nama}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.agenda_id && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailItem(item)} title="Detail">
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        setEditItem(item); setEditStatus(item.status); setEditCatatan(item.catatan_admin || '')
                      }} title="Edit Status">
                        <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Detail Agenda</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500 text-xs">Guru</span><p className="font-medium">{detailItem.guru_nama}</p></div>
                <div><span className="text-slate-500 text-xs">Mapel</span><p className="font-medium">{detailItem.mapel_nama}</p></div>
                <div><span className="text-slate-500 text-xs">Kelas</span><p className="font-medium">{detailItem.kelas_label}</p></div>
                <div><span className="text-slate-500 text-xs">Jam</span><p className="font-medium">{detailItem.jam_label}</p></div>
                <div><span className="text-slate-500 text-xs">Waktu Input</span><p className="font-medium">{detailItem.waktu_input ? new Date(detailItem.waktu_input).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p></div>
                <div>
                  <span className="text-slate-500 text-xs">Status</span>
                  {(() => {
                    const s = STATUS_STYLE[detailItem.status] || STATUS_STYLE.ALFA
                    return <p className={`font-medium ${s.text}`}>{s.label}</p>
                  })()}
                </div>
              </div>
              {detailItem.materi && (
                <div>
                  <span className="text-slate-500 text-xs">Materi</span>
                  <p className="text-sm bg-slate-50 rounded-md p-2 mt-0.5">{detailItem.materi}</p>
                </div>
              )}
              {detailItem.foto_url && (
                <div>
                  <span className="text-slate-500 text-xs">Foto</span>
                  <img src={detailItem.foto_url} alt="Foto agenda" className="mt-1 w-full max-h-72 object-cover rounded-lg border" />
                </div>
              )}
              {detailItem.catatan_admin && (
                <div>
                  <span className="text-slate-500 text-xs">Catatan Admin</span>
                  <p className="text-sm bg-amber-50 rounded-md p-2 mt-0.5 text-amber-800">{detailItem.catatan_admin}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Status Modal */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ubah Status Agenda</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-slate-800">{editItem.guru_nama}</p>
                <p className="text-xs text-slate-500">{editItem.mapel_nama} — {editItem.kelas_label} — {editItem.jam_label}</p>
              </div>
              <div>
                <Label className="text-xs">Status Baru</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_STYLE[s]?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catatan Admin</Label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Alasan perubahan status..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none"
                />
              </div>
              <Button onClick={handleEdit} disabled={isEditing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {isEditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit3 className="h-4 w-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// TAB: REKAP KEHADIRAN
// ============================================================
function TabRekap({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const [tglMulai, setTglMulai] = useState(() => {
    const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0]
  })
  const [tglSelesai, setTglSelesai] = useState(todayStr())
  const [sortBy, setSortBy] = useState<'nama' | 'patuh' | 'alfa'>('patuh')
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('semua')

  const handleSearch = async () => {
    setIsLoading(true)
    const result = await getRekapKehadiranGuru(tglMulai, tglSelesai, sortBy)
    setData(result.data || [])
    setIsLoading(false)
  }

  const filteredData = statusFilter === 'semua' ? data : data.filter(d => {
    if (statusFilter === 'patuh') return d.kepatuhan >= 80
    if (statusFilter === 'kurang') return d.kepatuhan < 50
    if (statusFilter === 'sedang') return d.kepatuhan >= 50 && d.kepatuhan < 80
    return true
  })

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">Dari Tanggal</Label>
            <Input type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
            <Input type="date" value={tglSelesai} onChange={(e) => setTglSelesai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Urutkan</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="patuh">Paling Patuh</SelectItem>
                <SelectItem value="alfa">Paling Banyak Alfa</SelectItem>
                <SelectItem value="nama">Nama (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Tampilkan
          </Button>
        </div>
      </div>

      {/* Filter badges */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['semua', 'patuh', 'sedang', 'kurang'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter === f ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {f === 'semua' ? `Semua (${data.length})` : f === 'patuh' ? `Patuh ≥80% (${data.filter(d => d.kepatuhan >= 80).length})` : f === 'sedang' ? `Sedang 50-79% (${data.filter(d => d.kepatuhan >= 50 && d.kepatuhan < 80).length})` : `Kurang <50% (${data.filter(d => d.kepatuhan < 50).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Rekap Table */}
      {filteredData.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Nama Guru</TableHead>
                <TableHead className="text-xs text-center">Total Blok</TableHead>
                <TableHead className="text-xs text-center">Tepat</TableHead>
                <TableHead className="text-xs text-center">Telat</TableHead>
                <TableHead className="text-xs text-center">Tugas</TableHead>
                <TableHead className="text-xs text-center">Alfa</TableHead>
                <TableHead className="text-xs text-center">Sakit</TableHead>
                <TableHead className="text-xs text-center">Izin</TableHead>
                <TableHead className="text-xs text-center">Kepatuhan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, idx) => {
                const kepColor = item.kepatuhan >= 80 ? 'text-emerald-600' : item.kepatuhan >= 50 ? 'text-amber-600' : 'text-red-600'
                const barWidth = `${Math.min(item.kepatuhan, 100)}%`
                const barColor = item.kepatuhan >= 80 ? 'bg-emerald-400' : item.kepatuhan >= 50 ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <TableRow key={item.guru_id}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800 min-w-[140px]">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-center text-slate-600">{item.total_blok}</TableCell>
                    <TableCell className="text-xs text-center text-emerald-600 font-medium">{item.tepat_waktu}</TableCell>
                    <TableCell className="text-xs text-center text-amber-600 font-medium">{item.telat}</TableCell>
                    <TableCell className="text-xs text-center text-violet-600 font-medium">{item.tugas || 0}</TableCell>
                    <TableCell className="text-xs text-center text-red-600 font-medium">{item.alfa}</TableCell>
                    <TableCell className="text-xs text-center text-blue-600 font-medium">{item.sakit}</TableCell>
                    <TableCell className="text-xs text-center text-sky-600 font-medium">{item.izin}</TableCell>
                    <TableCell className="text-center min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: barWidth }} />
                        </div>
                        <span className={`text-xs font-semibold ${kepColor} w-10 text-right`}>{item.kepatuhan}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Pilih rentang tanggal dan klik &quot;Tampilkan&quot; untuk melihat rekap.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: CETAK LAPORAN
// ============================================================
function TabCetak({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const [tglMulai, setTglMulai] = useState(() => {
    const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0]
  })
  const [tglSelesai, setTglSelesai] = useState(todayStr())
  const [guruId, setGuruId] = useState('')
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const handleLoad = async () => {
    setIsLoading(true)
    const gid = guruId && guruId !== 'all_guru' ? guruId : undefined
    const result = await getDataCetakLaporan(tglMulai, tglSelesai, gid)
    setData(result)
    setIsLoading(false)
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Laporan Agenda Guru</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 11px; margin: 0; padding: 0; color: #333; }
        .page { padding: 20mm; }
        .kop-img { width: 100%; display: block; margin-bottom: 10px; }
        h2 { font-size: 14px; margin: 10px 0 4px; text-align: center; text-transform: uppercase; }
        .sub { font-size: 11px; color: #666; margin-bottom: 12px; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 10px; }
        th { background: #f5f5f5; font-weight: 600; text-align: center; }
        .status-tepat { color: #059669; } .status-telat { color: #d97706; }
        .status-alfa { color: #dc2626; } .status-sakit { color: #2563eb; } .status-izin { color: #0284c7; }
        @media print { 
          @page { size: 215mm 330mm; margin: 0; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style></head><body>
      <div class="page">
        <img src="/kopsurat.png" class="kop-img" />
        ${printRef.current.innerHTML}
      </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const guruNamaMap = new Map(filterOptions.guru.map(g => [g.id, g.nama]))

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">Dari Tanggal</Label>
            <Input type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
            <Input type="date" value={tglSelesai} onChange={(e) => setTglSelesai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-slate-500">Guru (opsional)</Label>
            <Select value={guruId} onValueChange={setGuruId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Semua guru" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_guru">Semua Guru</SelectItem>
                {filterOptions.guru.map(g => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleLoad} disabled={isLoading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Muat Data
          </Button>
          {data.length > 0 && (
            <Button onClick={handlePrint} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1.5" /> Cetak
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      {data.length > 0 && (
        <div className="rounded-lg border bg-white p-4 overflow-x-auto">
            <div ref={printRef} className="hidden lg:block">
              {/* Note: This content is used for printing. Not visible in UI preview here but used by handlePrint */}
              <h2>Laporan Agenda Guru</h2>
              <p className="sub">
                MAN 1 Tasikmalaya<br/>
                Periode: {formatTanggal(tglMulai)} s/d {formatTanggal(tglSelesai)}
                {guruId && guruId !== 'all_guru' && ` — ${guruNamaMap.get(guruId) || ''}`}
              </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>No</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Tanggal</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Guru</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Mapel</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Kelas</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Jam</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Materi</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any, idx: number) => {
                  const statusClass = `status-${item.status?.toLowerCase().replace('_', '-')}`
                  return (
                    <tr key={item.id || idx}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.tanggal}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.guru_nama}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.nama_mapel}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.tingkat} {item.kelompok} {item.nomor_kelas}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                        {item.jam_ke_mulai === item.jam_ke_selesai ? `${item.jam_ke_mulai}` : `${item.jam_ke_mulai}-${item.jam_ke_selesai}`}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.materi || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} className={statusClass}>
                        {STATUS_STYLE[item.status]?.label || item.status}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Printer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Pilih periode dan klik &quot;Muat Data&quot; untuk preview laporan.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: MONITORING PIKET
// ============================================================
function TabMonitoringPiket() {
  const [tanggal, setTanggal] = useState(todayStr())
  const [data, setData] = useState<any[]>([])
  const [hariNama, setHariNama] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Detail foto modal
  const [fotoModal, setFotoModal] = useState<{ url: string; nama: string } | null>(null)
  // Edit status modal
  const [editItem, setEditItem] = useState<any>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const PIKET_STATUS_OPTIONS = ['HADIR', 'TELAT', 'ALFA', 'SAKIT', 'IZIN']

  const handleSearch = async () => {
    setIsLoading(true); setPesan(null)
    const result = await getMonitoringPiketHarian(tanggal)
    if (result.error) setPesan({ tipe: 'error', teks: result.error })
    else { setData(result.data || []); setHariNama(result.hariNama || '') }
    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!editItem) return
    setIsEditing(true)
    const result = await editAgendaPiketStatus(
      editItem.agenda_id || null,
      editItem.jadwal_id,
      editItem.user_id,
      editItem.shift_id,
      tanggal,
      editStatus,
      editCatatan,
    )
    if (result.error) setPesan({ tipe: 'error', teks: result.error })
    else { setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil' }); setEditItem(null); handleSearch() }
    setIsEditing(false)
  }

  const navigateDate = (offset: number) => {
    const d = new Date(tanggal + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setTanggal(d.toISOString().split('T')[0])
  }

  const summary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      {/* Date Picker */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} className="px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="max-w-[180px] text-sm" />
          <Button variant="outline" size="sm" onClick={() => navigateDate(1)} className="px-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTanggal(todayStr())} className="text-xs">Hari Ini</Button>
          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Cari
          </Button>
        </div>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${
          pesan.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>{pesan.teks}</div>
      )}

      {/* Summary badges */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
            {hariNama} &middot; {data.length} guru piket
          </span>
          {Object.entries(summary).map(([status, count]) => {
            const s = STATUS_STYLE[status]
            return s ? (
              <span key={status} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.bg} ${s.text}`}>
                {s.label}: {count as number}
              </span>
            ) : null
          })}
        </div>
      )}

      {/* Table */}
      {data.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Guru</TableHead>
                <TableHead className="text-xs">Shift</TableHead>
                <TableHead className="text-xs">Waktu Shift</TableHead>
                <TableHead className="text-xs">Waktu Submit</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, idx) => {
                const style = STATUS_STYLE[item.status] || STATUS_STYLE.ALFA
                const StatusIcon = style.icon
                return (
                  <TableRow key={`${item.jadwal_id}-${idx}`}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600">{item.shift_nama}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {item.slot_mulai !== '-' ? `${item.slot_mulai}–${item.slot_selesai}` : `Jam ${item.jam_mulai}–${item.jam_selesai}`}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {item.waktu_submit
                        ? new Date(item.waktu_submit).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
                        : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
                        <StatusIcon className="h-3 w-3" />{style.label}
                      </span>
                      {item.catatan_admin && (
                        <p className="text-[10px] text-amber-600 mt-0.5">{item.catatan_admin}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.foto_url && (
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setFotoModal({ url: item.foto_url, nama: item.guru_nama })}
                          title="Lihat Foto"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setEditItem(item); setEditStatus(item.status); setEditCatatan(item.catatan_admin || '') }}
                        title="Ubah Status"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-teal-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Pilih tanggal dan klik &quot;Cari&quot; untuk melihat kehadiran guru piket.</p>
        </div>
      )}

      {/* Modal Foto */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Foto Kehadiran Piket</DialogTitle>
          </DialogHeader>
          {fotoModal && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{fotoModal.nama}</p>
              <img
                src={fotoModal.url}
                alt={`Foto piket ${fotoModal.nama}`}
                className="w-full max-h-96 object-cover rounded-lg border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Edit Status */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ubah Status Piket</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-slate-800">{editItem.guru_nama}</p>
                <p className="text-xs text-slate-500">{editItem.shift_nama} &mdash; {tanggal}</p>
              </div>
              <div>
                <Label className="text-xs">Status Baru</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIKET_STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_STYLE[s]?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catatan Admin</Label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Alasan perubahan status..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
                />
              </div>
              <Button onClick={handleEdit} disabled={isEditing} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                {isEditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit3 className="h-4 w-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
