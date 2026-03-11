'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { CalendarDays, ClipboardEdit, Loader2, Save, UserCheck, AlertCircle, CheckCircle2, User } from 'lucide-react'
import { getSiswaByKelas, getRekapBulanan, simpanRekapBulanan, simpanJurnalHarian } from '../actions'

type UserProps = { id: string, role: string, nama_lengkap: string }
type KelasProps = { id: string, tingkat: number, nomor_kelas: string, kelompok: string }
type PenugasanProps = { id: string, mapel: { nama_mapel: string }, kelas: KelasProps }

interface KehadiranClientProps {
  currentUser: UserProps
  taAktif: { id: string, nama: string, semester: string } | null
  kelasList: KelasProps[]
  penugasanGuru: PenugasanProps[]
}

const BULAN_LIST = [
  { val: 7, label: 'Juli' }, { val: 8, label: 'Agustus' }, { val: 9, label: 'September' },
  { val: 10, label: 'Oktober' }, { val: 11, label: 'November' }, { val: 12, label: 'Desember' },
  { val: 1, label: 'Januari' }, { val: 2, label: 'Februari' }, { val: 3, label: 'Maret' },
  { val: 4, label: 'April' }, { val: 5, label: 'Mei' }, { val: 6, label: 'Juni' }
]

const STATUS_CONFIG: Record<string, { bg: string, text: string, ring: string, dot: string }> = {
  'Aman':        { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-300', dot: 'bg-emerald-500' },
  'Sakit':       { bg: 'bg-amber-100',   text: 'text-amber-800',   ring: 'ring-amber-300',   dot: 'bg-amber-500' },
  'Izin':        { bg: 'bg-blue-100',    text: 'text-blue-800',    ring: 'ring-blue-300',    dot: 'bg-blue-500' },
  'Alpa':        { bg: 'bg-rose-100',    text: 'text-rose-800',    ring: 'ring-rose-300',    dot: 'bg-rose-500' },
  'Bolos Jam Ini': { bg: 'bg-purple-100', text: 'text-purple-800', ring: 'ring-purple-300',  dot: 'bg-purple-500' },
}

export function KehadiranClient({ currentUser, taAktif, kelasList, penugasanGuru }: KehadiranClientProps) {
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(currentUser.role)

  const [isLoading, setIsLoading] = useState(false)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error', teks: string } | null>(null)

  // State Admin
  const [selectedKelasAdmin, setSelectedKelasAdmin] = useState('')
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1)
  const [rekapData, setRekapData] = useState<Record<string, { sakit: number, izin: number, alpa: number }>>({})

  // State Guru
  const [selectedPenugasan, setSelectedPenugasan] = useState('')
  const [jurnalData, setJurnalData] = useState<Record<string, { status: string, catatan: string }>>({})

  const loadDataRekap = async (kelasId: string, bulan: number) => {
    setIsLoading(true); setPesan(null)
    const resSiswa = await getSiswaByKelas(kelasId)
    if (resSiswa.data) {
      setSiswaList(resSiswa.data)
      const resRekap = await getRekapBulanan(kelasId, bulan, taAktif!.id)
      const existingRekap: Record<string, any> = {}
      if (resRekap.data) {
        resRekap.data.forEach((r: any) => {
          existingRekap[r.siswa_id] = { sakit: r.sakit, izin: r.izin, alpa: r.alpa }
        })
      }
      setRekapData(existingRekap)
    }
    setIsLoading(false)
  }

  const loadDataJurnal = async (kelasId: string) => {
    setIsLoading(true); setPesan(null)
    const resSiswa = await getSiswaByKelas(kelasId)
    if (resSiswa.data) {
      setSiswaList(resSiswa.data)
      const defaultJurnal: Record<string, any> = {}
      resSiswa.data.forEach((s: any) => {
        defaultJurnal[s.id] = { status: 'Aman', catatan: '' }
      })
      setJurnalData(defaultJurnal)
    }
    setIsLoading(false)
  }

  const handleKelasAdminChange = (val: string) => {
    setSelectedKelasAdmin(val)
    setSiswaList([])
    loadDataRekap(val, selectedBulan)
  }

  const handleBulanChange = (val: string) => {
    const bulan = Number(val)
    setSelectedBulan(bulan)
    if (selectedKelasAdmin) loadDataRekap(selectedKelasAdmin, bulan)
  }

  const handlePenugasanChange = (val: string) => {
    setSelectedPenugasan(val)
    setSiswaList([])
    const p = penugasanGuru.find(x => x.id === val)
    if (p) loadDataJurnal(p.kelas.id)
  }

  const handleSimpanRekap = async () => {
    setIsLoading(true); setPesan(null)
    const payload = siswaList.map(s => ({
      siswa_id: s.id,
      sakit: rekapData[s.id]?.sakit || 0,
      izin: rekapData[s.id]?.izin || 0,
      alpa: rekapData[s.id]?.alpa || 0,
    }))
    const res = await simpanRekapBulanan(selectedKelasAdmin, selectedBulan, taAktif!.id, payload)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else setPesan({ tipe: 'sukses', teks: res.success! })
    setIsLoading(false)
  }

  const handleSimpanJurnal = async () => {
    setIsLoading(true); setPesan(null)
    const tanggalHariIni = new Date().toISOString().split('T')[0]
    const payload = siswaList.map(s => ({
      siswa_id: s.id,
      status: jurnalData[s.id]?.status || 'Aman',
      catatan: jurnalData[s.id]?.catatan || '',
    }))
    const res = await simpanJurnalHarian(selectedPenugasan, tanggalHariIni, payload)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else setPesan({ tipe: 'sukses', teks: res.success! })
    setIsLoading(false)
  }

  if (!taAktif) return (
    <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 shrink-0" />
      Tahun Ajaran aktif belum diatur!
    </div>
  )

  // ============================================================
  // TAMPILAN ADMIN — REKAP BULANAN
  // ============================================================
  if (isAdmin) {
    return (
      <div className="space-y-5">
        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3 space-y-2">
              <Label className="text-slate-600 font-medium">Pilih Kelas</Label>
              <Select value={selectedKelasAdmin} onValueChange={handleKelasAdminChange}>
                <SelectTrigger className="rounded-md bg-slate-50 h-8"><SelectValue placeholder="Pilih Kelas..." /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {kelasList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.tingkat}-{k.nomor_kelas} {k.kelompok}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-1/3 space-y-2">
              <Label className="text-slate-600 font-medium">Pilih Bulan</Label>
              <Select value={selectedBulan.toString()} onValueChange={handleBulanChange}>
                <SelectTrigger className="rounded-md bg-slate-50 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {BULAN_LIST.map(b => <SelectItem key={b.val} value={b.val.toString()}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {pesan && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${pesan.tipe === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {pesan.tipe === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {pesan.teks}
          </div>
        )}

        {selectedKelasAdmin && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <ClipboardEdit className="h-5 w-5 text-emerald-600" /> Input Rekap Bulanan
              </h3>
              <Button onClick={handleSimpanRekap} disabled={isLoading || siswaList.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 text-sm">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
              </Button>
            </div>

            {/* Desktop: Tabel */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead className="w-24 text-center">Sakit</TableHead>
                    <TableHead className="w-24 text-center">Izin</TableHead>
                    <TableHead className="w-24 text-center">Alpa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat data...</TableCell></TableRow>
                  ) : siswaList.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Tidak ada siswa di kelas ini.</TableCell></TableRow>
                  ) : (
                    siswaList.map((s, i) => (
                      <TableRow key={s.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-center font-medium text-slate-500">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800">{s.nama_lengkap}</div>
                          <div className="text-xs text-slate-500">NISN: {s.nisn}</div>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="31" className="text-center bg-slate-50 focus:bg-white rounded-lg h-9"
                            value={rekapData[s.id]?.sakit || ''}
                            onChange={e => setRekapData(prev => ({ ...prev, [s.id]: { ...prev[s.id], sakit: parseInt(e.target.value) || 0 } }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="31" className="text-center bg-slate-50 focus:bg-white rounded-lg h-9"
                            value={rekapData[s.id]?.izin || ''}
                            onChange={e => setRekapData(prev => ({ ...prev, [s.id]: { ...prev[s.id], izin: parseInt(e.target.value) || 0 } }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" max="31" className="text-center bg-slate-50 focus:bg-white rounded-lg h-9"
                            value={rekapData[s.id]?.alpa || ''}
                            onChange={e => setRekapData(prev => ({ ...prev, [s.id]: { ...prev[s.id], alpa: parseInt(e.target.value) || 0 } }))}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: Card */}
            <div className="md:hidden p-3 space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat data...</div>
              ) : siswaList.length === 0 ? (
                <div className="py-12 text-center text-slate-500">Tidak ada siswa di kelas ini.</div>
              ) : (
                siswaList.map((s, i) => (
                  <div key={s.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    {/* Header Card */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm leading-tight">{s.nama_lengkap}</div>
                        <div className="text-xs text-slate-500">NISN: {s.nisn}</div>
                      </div>
                    </div>
                    {/* Input S/I/A */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Sakit', key: 'sakit', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                        { label: 'Izin',  key: 'izin',  color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
                        { label: 'Alpa',  key: 'alpa',  color: 'text-rose-600',  bg: 'bg-rose-50 border-rose-200' },
                      ].map(({ label, key, color, bg }) => (
                        <div key={key} className={`rounded-xl border p-2 ${bg} flex flex-col items-center gap-1`}>
                          <span className={`text-xs font-bold ${color}`}>{label}</span>
                          <Input
                            type="number" min="0" max="31"
                            className="text-center bg-white rounded-lg h-9 text-sm font-bold border-0 shadow-sm"
                            value={rekapData[s.id]?.[key as 'sakit' | 'izin' | 'alpa'] || ''}
                            onChange={e => setRekapData(prev => ({ ...prev, [s.id]: { ...prev[s.id], [key]: parseInt(e.target.value) || 0 } }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // TAMPILAN GURU — JURNAL HARIAN
  // ============================================================
  return (
    <div className="space-y-5">
      {/* Hero Pilih Kelas */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><CalendarDays className="h-32 w-32" /></div>
        <h2 className="text-2xl font-bold mb-1">Jurnal Kelas Harian</h2>
        <p className="text-emerald-100 mb-6 text-sm">Pilih kelas yang sedang Anda ajar hari ini. Cukup catat siswa yang bermasalah.</p>
        <div className="w-full md:w-1/2 relative z-10">
          <Select value={selectedPenugasan} onValueChange={handlePenugasanChange}>
            <SelectTrigger className="rounded-lg bg-white/20 border-white/30 text-white focus:ring-white h-10 backdrop-blur-md">
              <SelectValue placeholder="Pilih Kelas & Mata Pelajaran..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {penugasanGuru.length === 0 ? (
                <SelectItem value="none" disabled>Belum ada jadwal mengajar.</SelectItem>
              ) : (
                penugasanGuru.map(p => (
                  <SelectItem key={p.id} value={p.id}>Kelas {p.kelas.tingkat}-{p.kelas.nomor_kelas} ({p.mapel.nama_mapel})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pesan && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${pesan.tipe === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {pesan.tipe === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {pesan.teks}
        </div>
      )}

      {selectedPenugasan && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><UserCheck className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-slate-800">Daftar Hadir & Catatan</h3>
                <p className="text-xs text-slate-500">Biarkan berstatus "Aman" jika siswa hadir dan tidak bermasalah.</p>
              </div>
            </div>
            <Button onClick={handleSimpanJurnal} disabled={isLoading || siswaList.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg w-full sm:w-auto gap-1.5 text-sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Jurnal
            </Button>
          </div>

          <div className="p-3 space-y-3">
            {isLoading && siswaList.length === 0 ? (
              <div className="py-12 text-center text-slate-500"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-emerald-600" /> Memuat siswa...</div>
            ) : siswaList.length === 0 ? (
              <div className="py-12 text-center text-slate-500">Tidak ada siswa di kelas ini.</div>
            ) : (
              siswaList.map((s, i) => {
                const statusSiswa = jurnalData[s.id]?.status || 'Aman'
                const cfg = STATUS_CONFIG[statusSiswa] || STATUS_CONFIG['Aman']
                const isAman = statusSiswa === 'Aman'

                return (
                  <div key={s.id} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isAman ? 'bg-white border-slate-200' : 'bg-rose-50/60 border-rose-200 shadow-sm'}`}>
                    {/* Strip warna status di kiri */}
                    <div className="flex">
                      <div className={`w-1.5 shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 p-4 space-y-3">

                        {/* Baris atas: nomor + nama + badge status */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-sm truncate">{s.nama_lengkap}</div>
                            <div className="text-xs text-slate-400">NISN: {s.nisn}</div>
                          </div>
                          {/* Badge status aktif */}
                          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                            {statusSiswa}
                          </span>
                        </div>

                        {/* Tombol status */}
                        <div className="grid grid-cols-3 gap-2">
                          {Object.keys(STATUS_CONFIG).map(status => {
                            const isActive = statusSiswa === status
                            const c = STATUS_CONFIG[status]
                            return (
                              <button
                                key={status} type="button"
                                onClick={() => setJurnalData(prev => ({ ...prev, [s.id]: { ...prev[s.id], status } }))}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                  isActive
                                    ? `${c.bg} ${c.text} ring-1 ${c.ring} border-transparent`
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {status}
                              </button>
                            )
                          })}
                        </div>

                        {/* Input catatan */}
                        <Input
                          placeholder="Catatan perilaku (Opsional)..."
                          className="h-9 text-xs rounded-xl bg-white/80 border-slate-200 focus:border-emerald-400"
                          value={jurnalData[s.id]?.catatan || ''}
                          onChange={e => setJurnalData(prev => ({ ...prev, [s.id]: { ...prev[s.id], catatan: e.target.value } }))}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}