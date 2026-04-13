'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Send, Loader2,
  Bell, Clock, Users, Search, Filter, CheckCircle2, AlertCircle,
  Calendar, X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  simpanJadwalNotifikasi, toggleJadwalNotifikasi,
  hapusJadwalNotifikasi, testKirimJadwal,
} from '../actions'

// ============================================================
// Types
// ============================================================
type UserItem = { id: string; nama_lengkap: string; role: string; all_roles: string[] }
type RoleOption = { value: string; label: string }
type Jadwal = {
  id: string; nama: string; judul: string; isi: string; url: string;
  jam: string; hari_aktif: string; target_type: string; target_role: string | null;
  target_user_ids: string; is_active: number;
}

const HARI_OPTIONS = [
  { v: 1, l: 'Senin' }, { v: 2, l: 'Selasa' }, { v: 3, l: 'Rabu' },
  { v: 4, l: 'Kamis' }, { v: 5, l: 'Jumat' }, { v: 6, l: 'Sabtu' }, { v: 7, l: 'Minggu' },
]
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin_tu: 'Admin TU', kepsek: 'Kepala Madrasah',
  wakamad: 'Wakamad', guru: 'Guru', guru_bk: 'Guru BK', guru_piket: 'Guru Piket',
  wali_kelas: 'Wali Kelas', resepsionis: 'Resepsionis', guru_ppl: 'Guru PPL', guru_tahfidz: 'Guru Tahfidz',
}

// ============================================================
// Checkbox Peserta (sama dengan di rapat & notif)
// ============================================================
function CheckboxPeserta({ allUsers, roles, selectedIds, setSelectedIds }: {
  allUsers: UserItem[]; roles: RoleOption[];
  selectedIds: Set<string>; setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('_all')

  const filtered = allUsers.filter(u => {
    const matchRole = filterRole === '_all' || u.all_roles.includes(filterRole)
    const q = search.toLowerCase()
    return matchRole && (!q || u.nama_lengkap.toLowerCase().includes(q))
  })

  const allIds = filtered.map(u => u.id)
  const allChecked = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  const someChecked = allIds.some(id => selectedIds.has(id))

  const toggleAll = () => setSelectedIds(prev => {
    const next = new Set(prev)
    allChecked ? allIds.forEach(id => next.delete(id)) : allIds.forEach(id => next.add(id))
    return next
  })

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama..." className="h-8 pl-8 text-xs rounded-lg" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-8 w-32 text-xs rounded-lg">
            <Filter className="h-3 w-3 mr-1 text-slate-400" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all" className="text-xs">Semua Role</SelectItem>
            {roles.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
          <input type="checkbox" checked={allChecked}
            ref={el => { if (el) el.indeterminate = !allChecked && someChecked }}
            onChange={toggleAll} className="rounded" />
          Pilih Semua ({filtered.length})
        </label>
        <span className="text-[10px] text-slate-400">{selectedIds.size} dipilih</span>
      </div>
      <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-44 divide-y divide-slate-100">
        {filtered.length === 0
          ? <div className="py-4 text-center text-xs text-slate-400">Tidak ada pengguna.</div>
          : filtered.map(u => (
            <label key={u.id} className={cn('flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50', selectedIds.has(u.id) && 'bg-blue-50/60')}>
              <input type="checkbox" checked={selectedIds.has(u.id)}
                onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n })}
                className="rounded shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{u.nama_lengkap}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABEL[u.role] || u.role}</p>
              </div>
            </label>
          ))
        }
      </div>
    </div>
  )
}

// ============================================================
// Form Dialog: Tambah/Edit Jadwal
// ============================================================
function FormDialog({ open, onClose, existing, roles, allUsers }: {
  open: boolean; onClose: (refresh?: boolean) => void;
  existing: Jadwal | null; roles: RoleOption[]; allUsers: UserItem[];
}) {
  const [isPending, startTransition] = useTransition()
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  // Form state
  const [nama, setNama] = useState(existing?.nama || '')
  const [judul, setJudul] = useState(existing?.judul || '')
  const [isi, setIsi] = useState(existing?.isi || '')
  const [url, setUrl] = useState(existing?.url || '/dashboard')
  const [jam, setJam] = useState(existing?.jam || '06:30')
  const [hariAktif, setHariAktif] = useState<number[]>(() => {
    try { return JSON.parse(existing?.hari_aktif || '[1,2,3,4,5,6]') } catch { return [1,2,3,4,5,6] }
  })
  const [targetType, setTargetType] = useState(existing?.target_type || 'all')
  const [targetRole, setTargetRole] = useState(existing?.target_role || roles[0]?.value || '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (existing?.target_type === 'custom') {
      try { return new Set(JSON.parse(existing.target_user_ids || '[]')) } catch {}
    }
    return new Set()
  })

  const handleTargetTypeChange = useCallback((v: string) => {
    setTargetType(v)
    if (v === 'all') setSelectedIds(new Set(allUsers.map(u => u.id)))
    else if (v === 'role') setSelectedIds(new Set(allUsers.filter(u => u.all_roles.includes(targetRole)).map(u => u.id)))
    else if (v === 'guru') setSelectedIds(new Set(allUsers.filter(u => u.all_roles.includes('guru')).map(u => u.id)))
    else setSelectedIds(new Set())
  }, [allUsers, targetRole])

  const toggleHari = (h: number) => setHariAktif(prev =>
    prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h].sort()
  )

  const handleSubmit = () => {
    if (!nama || !judul || !isi || !jam || hariAktif.length === 0) {
      setPesan({ ok: false, teks: 'Lengkapi semua field wajib.' }); return
    }
    startTransition(async () => {
      const res = await simpanJadwalNotifikasi({
        id: existing?.id,
        nama, judul, isi, url, jam,
        hari_aktif: hariAktif,
        target_type: targetType,
        target_role: targetType === 'role' ? targetRole : undefined,
        target_user_ids: (targetType === 'custom' || targetType === 'all') ? [...selectedIds] : undefined,
        is_active: true,
      })
      if (res.error) { setPesan({ ok: false, teks: res.error }); return }
      onClose(true)
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">{existing ? 'Edit' : 'Tambah'} Jadwal Notifikasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          {pesan && (
            <div className={cn('text-xs px-3 py-2 rounded-lg border flex items-center gap-2',
              pesan.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700')}>
              {pesan.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              {pesan.teks}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Nama Jadwal <span className="text-rose-500">*</span></Label>
            <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="cth: Pengingat Jadwal Mengajar" className="h-8 text-xs rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Jam Kirim (WIB) <span className="text-rose-500">*</span></Label>
              <Input type="time" value={jam} onChange={e => setJam(e.target.value)} className="h-8 text-xs rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL Tujuan</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="/dashboard" className="h-8 text-xs rounded-lg" />
            </div>
          </div>

          {/* Hari Aktif */}
          <div className="space-y-1">
            <Label className="text-xs">Hari Aktif <span className="text-rose-500">*</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {HARI_OPTIONS.map(h => (
                <button key={h.v} type="button" onClick={() => toggleHari(h.v)}
                  className={cn('px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors',
                    hariAktif.includes(h.v)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300')}>
                  {h.l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Judul Notifikasi <span className="text-rose-500">*</span></Label>
            <Input value={judul} onChange={e => setJudul(e.target.value)} placeholder="cth: Pengingat Jadwal Mengajar" className="h-8 text-xs rounded-lg" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Isi Pesan <span className="text-rose-500">*</span></Label>
            <Textarea value={isi} onChange={e => setIsi(e.target.value)} rows={3} placeholder="Tulis isi notifikasi..." className="text-xs rounded-lg resize-none" />
          </div>

          {/* Target */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Target Penerima</Label>
              <Select value={targetType} onValueChange={handleTargetTypeChange}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pengguna</SelectItem>
                  <SelectItem value="role">Berdasarkan Role</SelectItem>
                  <SelectItem value="guru">Guru Bertugas Hari Ini</SelectItem>
                  <SelectItem value="custom">Pilih Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType === 'role' && (
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={targetRole} onValueChange={v => { setTargetRole(v); setSelectedIds(new Set(allUsers.filter(u => u.all_roles.includes(v)).map(u => u.id))) }}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(targetType === 'all' || targetType === 'custom') && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Daftar Penerima
                <span className="text-slate-400 font-normal">({selectedIds.size} dipilih)</span>
              </Label>
              <CheckboxPeserta allUsers={allUsers} roles={roles} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
            </div>
          )}

          {targetType === 'guru' && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
              <strong>Khusus Guru Bertugas:</strong> Notifikasi hanya dikirim ke guru yang memiliki jadwal mengajar pada hari pengiriman.
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onClose()} className="flex-1 h-8 text-xs rounded-lg">Batal</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending} className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {existing ? 'Simpan Perubahan' : 'Buat Jadwal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Kartu Jadwal
// ============================================================
function KartuJadwal({ jadwal, roles, allUsers, onEdit, onRefresh }: {
  jadwal: Jadwal; roles: RoleOption[]; allUsers: UserItem[];
  onEdit: (j: Jadwal) => void; onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition()
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  const hariAktif: number[] = (() => { try { return JSON.parse(jadwal.hari_aktif || '[1,2,3,4,5,6]') } catch { return [1,2,3,4,5,6] } })()
  const isActive = jadwal.is_active === 1

  const handleToggle = () => startTransition(async () => {
    await toggleJadwalNotifikasi(jadwal.id, !isActive)
    onRefresh()
  })

  const handleHapus = () => {
    if (!confirm(`Hapus jadwal "${jadwal.nama}"?`)) return
    startTransition(async () => {
      await hapusJadwalNotifikasi(jadwal.id)
      onRefresh()
    })
  }

  const handleTest = () => startTransition(async () => {
    const res = await testKirimJadwal(jadwal.id)
    setPesan({ ok: !res.error, teks: res.success || res.error || '' })
    setTimeout(() => setPesan(null), 4000)
  })

  const getTargetLabel = () => {
    if (jadwal.target_type === 'all') return 'Semua Pengguna'
    if (jadwal.target_type === 'guru') return 'Guru Bertugas Hari Ini'
    if (jadwal.target_type === 'role') return `Role: ${ROLE_LABEL[jadwal.target_role || ''] || jadwal.target_role}`
    try {
      const ids = JSON.parse(jadwal.target_user_ids || '[]')
      return `${ids.length} pengguna terpilih`
    } catch { return 'Custom' }
  }

  return (
    <div className={cn('bg-surface border rounded-xl p-4 flex flex-col gap-3 transition-opacity', !isActive && 'opacity-60', 'border-surface')}>
      {pesan && (
        <div className={cn('text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5',
          pesan.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700')}>
          {pesan.ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
          {pesan.teks}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{jadwal.nama}</h3>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase',
              isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
              {isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 italic">"{jadwal.judul}"</p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-black">{jadwal.jam}</span>
            <span className="text-[10px] text-slate-400">WIB</span>
          </div>
        </div>
      </div>

      {/* Hari aktif */}
      <div className="flex flex-wrap gap-1">
        {HARI_OPTIONS.map(h => (
          <span key={h.v} className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
            hariAktif.includes(h.v) ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-300 border-slate-100')}>
            {h.l.slice(0, 3)}
          </span>
        ))}
        <span className="text-[9px] text-slate-400 ml-1 self-center">· {getTargetLabel()}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-surface flex-wrap">
        <Button size="sm" variant="ghost" onClick={handleTest} disabled={isPending}
          className="h-7 text-[10px] px-2 text-violet-600 hover:bg-violet-50 gap-1">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Test Kirim
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(jadwal)} disabled={isPending}
          className="h-7 text-[10px] px-2 text-slate-600 hover:bg-slate-100 gap-1">
          <Pencil className="h-3 w-3" /> Edit
        </Button>
        <button onClick={handleToggle} disabled={isPending}
          className={cn('ml-auto h-7 flex items-center gap-1 text-[10px] font-medium px-2 rounded-lg transition-colors',
            isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}>
          {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <Button size="sm" variant="ghost" onClick={handleHapus} disabled={isPending}
          className="h-7 text-[10px] px-2 text-rose-600 hover:bg-rose-50 gap-1">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN CLIENT COMPONENT
// ============================================================

export function JadwalNotifClient({ jadwals: initialJadwals, roles, allUsers }: {
  jadwals: Jadwal[]; roles: RoleOption[]; allUsers: UserItem[];
}) {
  const [jadwals, setJadwals] = useState<Jadwal[]>(initialJadwals)
  const [editTarget, setEditTarget] = useState<Jadwal | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [, startTransition] = useTransition()

  const refresh = () => {
    // Trigger server revalidation — user perlu reload, tapi jadwals sudah revalidate
    window.location.reload()
  }

  const handleCloseForm = (shouldRefresh?: boolean) => {
    setShowForm(false)
    setEditTarget(null)
    if (shouldRefresh) refresh()
  }

  const handleEdit = (j: Jadwal) => { setEditTarget(j); setShowForm(true) }

  return (
    <div className="space-y-4">
      {/* Header + Tambah */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {jadwals.length} jadwal terdaftar · cron berjalan setiap menit
        </p>
        <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> Tambah Jadwal
        </Button>
      </div>

      {/* Info box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-700 flex items-start gap-2">
        <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <div>
          <strong>Cara kerja:</strong> Sistem memeriksa jadwal ini setiap menit. Notifikasi dikirim otomatis saat jam WIB sesuai dengan jadwal yang aktif pada hari tersebut.
          Gunakan tombol <strong>Test Kirim</strong> untuk menguji pengiriman langsung tanpa menunggu jadwal.
        </div>
      </div>

      {/* Daftar Jadwal */}
      {jadwals.length === 0 ? (
        <div className="py-12 text-center bg-surface rounded-xl border border-surface">
          <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Belum ada jadwal notifikasi.</p>
          <p className="text-xs text-slate-400 mt-1">Klik "Tambah Jadwal" untuk membuat yang pertama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jadwals.map(j => (
            <KartuJadwal key={j.id} jadwal={j} roles={roles} allUsers={allUsers} onEdit={handleEdit} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <FormDialog
        open={showForm}
        onClose={handleCloseForm}
        existing={editTarget}
        roles={roles}
        allUsers={allUsers}
      />
    </div>
  )
}
