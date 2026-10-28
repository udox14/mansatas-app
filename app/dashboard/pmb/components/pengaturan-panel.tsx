'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Loader2, Info, Settings, Globe, Clock, Trophy, Printer } from 'lucide-react'
import { simpanPengaturan } from '../actions'

// Prefix no_pendaftaran dari tahun: '2026/2027' -> '2627'
function prefixDariTahun(t: string): string {
  const [a, b] = t.split('/')
  return a && b ? a.slice(-2) + b.slice(-2) : '????'
}

// Helper format to YYYY-MM-DDTHH:MM (untuk datetime-local)
function formatToDatetimeLocal(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return val.slice(0, 16)
  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return ''
}

// Helper format to YYYY-MM-DD (untuk date picker)
function formatToDate(val: string): string {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return ''
}

const FIELDS: [string, string, string][] = [
  ['tahun_pmb', 'Tahun PMB', '2026/2027'],
  ['pmb_dibuka', 'Pendaftaran Dibuka (1/0)', '1'],
  ['jalur_reguler_dibuka', 'Jalur Reguler Dibuka', '1'],
  ['jalur_prestasi_dibuka', 'Jalur Prestasi Dibuka', '1'],
  ['tanggal_buka', 'Tanggal Buka', ''],
  ['tanggal_tutup', 'Tanggal Tutup', ''],
  ['tanggal_pengumuman', 'Tanggal Pengumuman', ''],
  ['tanggal_pengumuman_reguler', 'Tanggal Pengumuman Reguler', ''],
  ['tanggal_pengumuman_prestasi', 'Tanggal Pengumuman Prestasi', ''],
  ['kelulusan_aktif', 'Pengumuman Kelulusan Aktif', '0'],
  ['cetak_kartu_aktif', 'Cetak Kartu Aktif', '0'],
  ['teks_hero', 'Teks Hero Beranda', ''],
  ['link_grup_wa', 'Link Grup WhatsApp', ''],
  ['kontak_wa', 'Kontak WA (cth 628xxx)', ''],
  ['link_berkas_pendukung', 'Link Berkas Pendukung', ''],
  ['landing_popup_aktif', 'Popup Landing Aktif', '0'],
  ['landing_popup_mode', 'Mode Popup', 'instruksi'],
  ['landing_popup_judul', 'Judul Popup', ''],
  ['landing_popup_isi', 'Isi Popup', ''],
  ['landing_popup_tombol_text', 'Teks Tombol Popup', ''],
  ['landing_popup_tombol_link', 'Tautan Tombol Popup', ''],
  ['teks_batas_daftar_ulang', 'Batas Daftar Ulang', ''],
  ['teks_daftar_reg', 'Alur: Daftar Reguler', '20 April – 20 Mei 2026'],
  ['teks_tes_cbt', 'Alur: Tes CBT', '21 – 23 Mei 2026'],
  ['teks_pengumuman_reg', 'Alur: Pengumuman Reguler', '25 Mei 2026'],
  ['teks_lapor_reg', 'Alur: Lapor Diri Reguler', '13 – 20 Juni 2026'],
  ['teks_daftar_pres', 'Alur: Daftar Prestasi', '6 – 14 April 2026'],
  ['teks_tes_pres', 'Alur: Tes Prestasi', '16 April 2026'],
  ['teks_pengumuman_pres', 'Alur: Pengumuman Prestasi', '18 April 2026'],
  ['teks_lapor_pres', 'Alur: Lapor Diri Prestasi', '20 – 25 April 2026'],
  ['teks_rapat', 'Landing: Tgl Rapat Ortu', '6 Juni 2026'],
  ['jadwal_cetak_waktu', 'Cetak Undangan: Hari/Tanggal', 'Kamis, 16 April 2026'],
  ['jadwal_cetak_tsk', 'Cetak Undangan: Tgl TTD', '10 April 2026'],
  ['nama_ketua_pmb', 'Cetak: Nama Ketua PMB', 'Dede Fathul Umam, S.Pd.I.'],
  ['nip_ketua_pmb', 'Cetak: NIP Ketua PMB', '197809132009011011'],
  ['tanggal_rapat_komite', 'Cetak Surat: Tanggal', ''],
  ['nama_kepala_madrasah', 'Nama Kepala Madrasah', ''],
  ['nip_kepala_madrasah', 'NIP Kepala Madrasah', ''],
]

type CategoryId = 'sistem' | 'landing' | 'reguler' | 'prestasi' | 'cetak'

interface Category {
  id: CategoryId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: Category[] = [
  {
    id: 'sistem',
    label: 'Sistem PMB',
    description: 'Pengaturan tahun ajaran, status pendaftaran, jalur penerimaan, dan tanggal penting.',
    icon: Settings,
  },
  {
    id: 'landing',
    label: 'Landing & Kontak',
    description: 'Konfigurasi teks hero halaman depan, grup koordinasi, dan kontak WhatsApp panitia.',
    icon: Globe,
  },
  {
    id: 'reguler',
    label: 'Jalur Reguler',
    description: 'Jadwal, CBT, pengumuman, dan lapor diri untuk pendaftaran Jalur Reguler.',
    icon: Clock,
  },
  {
    id: 'prestasi',
    label: 'Jalur Prestasi',
    description: 'Jadwal, tes, pengumuman, dan lapor diri untuk pendaftaran Jalur Prestasi.',
    icon: Trophy,
  },
  {
    id: 'cetak',
    label: 'Format Cetak',
    description: 'Undangan cetak, tanggal TTD, nama dan NIP Ketua PMB, serta surat komite.',
    icon: Printer,
  },
]

export function PengaturanPanel({ pengaturan, onFlash }: {
  pengaturan: Record<string, string>; onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const [k] of FIELDS) {
      v[k] = pengaturan[k] ?? FIELDS.find(([key]) => key === k)?.[2] ?? ''
    }
    return v
  })
  const [pending, start] = useTransition()
  const [activeTab, setActiveTab] = useState<CategoryId>('sistem')

  const tahun = vals.tahun_pmb || '2026/2027'
  const activeCategory = CATEGORIES.find((c) => c.id === activeTab)!

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header Panel */}
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Pengaturan PMB</h2>
        <p className="text-sm text-muted-foreground">
          Kelola konfigurasi sistem penerimaan murid baru, landing page, alur pendaftaran, dan cetak dokumen.
        </p>
      </div>

      {/* Main Container */}
      <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5 md:flex-row md:gap-7">
        {/* Sidebar Navigasi */}
        <aside className="w-full md:w-56 shrink-0">
          <nav className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-200 pb-2 scrollbar-none dark:border-slate-800 md:flex-col md:overflow-x-visible md:border-b-0 md:pb-0">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isActive = activeTab === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:w-full ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-0.5">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{activeCategory.label}</h3>
            <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Form Fields berdasarkan Tab Aktif */}
          <div className="space-y-4 min-h-[280px]">
            {activeTab === 'sistem' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <Alert className="rounded-lg border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Info className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  <AlertDescription>
                    Prefix nomor pendaftaran: <b>{prefixDariTahun(tahun)}</b> → contoh: {prefixDariTahun(tahun)}001
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="tahun_pmb" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tahun PMB</Label>
                  <Input id="tahun_pmb" value={vals.tahun_pmb} placeholder="2026/2027" onChange={(e) => setVals({ ...vals, tahun_pmb: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pmb_dibuka" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pendaftaran</Label>
                    <Select value={vals.pmb_dibuka} onValueChange={(v) => setVals({ ...vals, pmb_dibuka: v })}>
                      <SelectTrigger id="pmb_dibuka" className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Buka</SelectItem>
                        <SelectItem value="0">Tutup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jalur_reguler_dibuka" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jalur Reguler</Label>
                    <Select value={vals.jalur_reguler_dibuka} onValueChange={(v) => setVals({ ...vals, jalur_reguler_dibuka: v })}>
                      <SelectTrigger id="jalur_reguler_dibuka" className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Buka</SelectItem>
                        <SelectItem value="0">Tutup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jalur_prestasi_dibuka" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jalur Prestasi</Label>
                    <Select value={vals.jalur_prestasi_dibuka} onValueChange={(v) => setVals({ ...vals, jalur_prestasi_dibuka: v })}>
                      <SelectTrigger id="jalur_prestasi_dibuka" className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Buka</SelectItem>
                        <SelectItem value="0">Tutup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Pengumuman Kelulusan</Label><Select value={vals.kelulusan_aktif} onValueChange={(v) => setVals({ ...vals, kelulusan_aktif: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Aktif</SelectItem><SelectItem value="0">Nonaktif</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Cetak Kartu Ujian</Label><Select value={vals.cetak_kartu_aktif} onValueChange={(v) => setVals({ ...vals, cetak_kartu_aktif: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Aktif</SelectItem><SelectItem value="0">Nonaktif</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Pengumuman Reguler</Label><Input type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_pengumuman_reguler)} onChange={(e) => setVals({ ...vals, tanggal_pengumuman_reguler: e.target.value })}/></div>
                  <div className="space-y-2"><Label>Pengumuman Prestasi</Label><Input type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_pengumuman_prestasi)} onChange={(e) => setVals({ ...vals, tanggal_pengumuman_prestasi: e.target.value })}/></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_buka" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Buka</Label>
                    <Input id="tanggal_buka" type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_buka)} onChange={(e) => setVals({ ...vals, tanggal_buka: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_tutup" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Tutup</Label>
                    <Input id="tanggal_tutup" type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_tutup)} onChange={(e) => setVals({ ...vals, tanggal_tutup: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_pengumuman" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Pengumuman</Label>
                    <Input id="tanggal_pengumuman" type="datetime-local" value={formatToDatetimeLocal(vals.tanggal_pengumuman)} onChange={(e) => setVals({ ...vals, tanggal_pengumuman: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'landing' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="space-y-2">
                  <Label htmlFor="teks_hero" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Teks Hero Beranda</Label>
                  <Input id="teks_hero" value={vals.teks_hero} placeholder="Penerimaan Murid Baru MAN 1 Tasikmalaya" onChange={(e) => setVals({ ...vals, teks_hero: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link_grup_wa" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Link Grup WhatsApp</Label>
                  <Input id="link_grup_wa" value={vals.link_grup_wa} placeholder="https://chat.whatsapp.com/..." onChange={(e) => setVals({ ...vals, link_grup_wa: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kontak_wa" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kontak WA (format 628xxx)</Label>
                    <Input id="kontak_wa" value={vals.kontak_wa} placeholder="628123456789" onChange={(e) => setVals({ ...vals, kontak_wa: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teks_rapat" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Landing: Tgl Rapat Ortu</Label>
                    <Input id="teks_rapat" value={vals.teks_rapat} placeholder="6 Juni 2026" onChange={(e) => setVals({ ...vals, teks_rapat: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Link Berkas Pendukung</Label><Input value={vals.link_berkas_pendukung} onChange={(e) => setVals({ ...vals, link_berkas_pendukung: e.target.value })}/></div>
                  <div className="space-y-2"><Label>Batas Daftar Ulang</Label><Input value={vals.teks_batas_daftar_ulang} onChange={(e) => setVals({ ...vals, teks_batas_daftar_ulang: e.target.value })}/></div>
                  <div className="space-y-2"><Label>Popup Landing</Label><Select value={vals.landing_popup_aktif} onValueChange={(v) => setVals({ ...vals, landing_popup_aktif: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Aktif</SelectItem><SelectItem value="0">Nonaktif</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Mode Popup</Label><Select value={vals.landing_popup_mode} onValueChange={(v) => setVals({ ...vals, landing_popup_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="instruksi">Instruksi</SelectItem><SelectItem value="pengumuman">Pengumuman</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Judul Popup</Label><Input value={vals.landing_popup_judul} onChange={(e) => setVals({ ...vals, landing_popup_judul: e.target.value })}/></div>
                  <div className="space-y-2"><Label>Teks Tombol Popup</Label><Input value={vals.landing_popup_tombol_text} onChange={(e) => setVals({ ...vals, landing_popup_tombol_text: e.target.value })}/></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Isi Popup</Label><Input value={vals.landing_popup_isi} onChange={(e) => setVals({ ...vals, landing_popup_isi: e.target.value })}/></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Tautan Tombol Popup</Label><Input value={vals.landing_popup_tombol_link} onChange={(e) => setVals({ ...vals, landing_popup_tombol_link: e.target.value })}/></div>
                </div>
              </div>
            )}

            {activeTab === 'reguler' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="space-y-2">
                  <Label htmlFor="teks_daftar_reg" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Daftar Reguler</Label>
                  <Input id="teks_daftar_reg" value={vals.teks_daftar_reg} placeholder="20 April – 20 Mei 2026" onChange={(e) => setVals({ ...vals, teks_daftar_reg: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nama Kepala Madrasah</Label><Input value={vals.nama_kepala_madrasah} onChange={(e) => setVals({ ...vals, nama_kepala_madrasah: e.target.value })}/></div>
                  <div className="space-y-2"><Label>NIP Kepala Madrasah</Label><Input value={vals.nip_kepala_madrasah} onChange={(e) => setVals({ ...vals, nip_kepala_madrasah: e.target.value })}/></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teks_tes_cbt" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Tes CBT</Label>
                  <Input id="teks_tes_cbt" value={vals.teks_tes_cbt} placeholder="21 – 23 Mei 2026" onChange={(e) => setVals({ ...vals, teks_tes_cbt: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teks_pengumuman_reg" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Pengumuman Reguler</Label>
                    <Input id="teks_pengumuman_reg" value={vals.teks_pengumuman_reg} placeholder="25 Mei 2026" onChange={(e) => setVals({ ...vals, teks_pengumuman_reg: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teks_lapor_reg" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Lapor Diri Reguler</Label>
                    <Input id="teks_lapor_reg" value={vals.teks_lapor_reg} placeholder="13 – 20 Juni 2026" onChange={(e) => setVals({ ...vals, teks_lapor_reg: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prestasi' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="space-y-2">
                  <Label htmlFor="teks_daftar_pres" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Daftar Prestasi</Label>
                  <Input id="teks_daftar_pres" value={vals.teks_daftar_pres} placeholder="6 – 14 April 2026" onChange={(e) => setVals({ ...vals, teks_daftar_pres: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teks_tes_pres" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Tes Prestasi</Label>
                  <Input id="teks_tes_pres" value={vals.teks_tes_pres} placeholder="16 April 2026" onChange={(e) => setVals({ ...vals, teks_tes_pres: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teks_pengumuman_pres" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Pengumuman Prestasi</Label>
                    <Input id="teks_pengumuman_pres" value={vals.teks_pengumuman_pres} placeholder="18 April 2026" onChange={(e) => setVals({ ...vals, teks_pengumuman_pres: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teks_lapor_pres" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alur: Lapor Diri Prestasi</Label>
                    <Input id="teks_lapor_pres" value={vals.teks_lapor_pres} placeholder="20 – 25 April 2026" onChange={(e) => setVals({ ...vals, teks_lapor_pres: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cetak' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jadwal_cetak_waktu" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Undangan: Hari/Tgl</Label>
                    <Input id="jadwal_cetak_waktu" value={vals.jadwal_cetak_waktu} placeholder="Kamis, 16 April 2026" onChange={(e) => setVals({ ...vals, jadwal_cetak_waktu: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jadwal_cetak_tsk" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Undangan: Tgl TTD</Label>
                    <Input id="jadwal_cetak_tsk" type="date" value={formatToDate(vals.jadwal_cetak_tsk)} onChange={(e) => setVals({ ...vals, jadwal_cetak_tsk: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama_ketua_pmb" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cetak: Nama Ketua PMB</Label>
                    <Input id="nama_ketua_pmb" value={vals.nama_ketua_pmb} placeholder="Dede Fathul Umam, S.Pd.I." onChange={(e) => setVals({ ...vals, nama_ketua_pmb: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nip_ketua_pmb" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cetak: NIP Ketua PMB</Label>
                    <Input id="nip_ketua_pmb" value={vals.nip_ketua_pmb} placeholder="197809132009011011" onChange={(e) => setVals({ ...vals, nip_ketua_pmb: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggal_rapat_komite" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cetak Surat: Tanggal</Label>
                  <Input id="tanggal_rapat_komite" type="date" value={formatToDate(vals.tanggal_rapat_komite)} onChange={(e) => setVals({ ...vals, tanggal_rapat_komite: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Footer terintegrasi */}
          <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Pastikan semua perubahan data telah diisi dengan benar sebelum disimpan.
            </p>
            <Button disabled={pending} onClick={() => start(async () => onFlash(await simpanPengaturan(vals)))} className="w-full rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 sm:w-auto">
              {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Simpan Pengaturan
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
