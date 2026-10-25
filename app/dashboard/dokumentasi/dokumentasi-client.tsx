'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  Compass,
  Users,
  Workflow,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FolderKanban,
  FileText,
  BadgeInfo,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  APP_DOMAINS,
  APP_MODULES,
  CORE_WORKFLOWS,
  type ModuleItem,
} from '@/config/app-blueprint'

type Props = {
  userRoles: string[]
  isSuperAdmin: boolean
}

const ROLE_DEFINITIONS: Record<
  string,
  {
    title: string
    category: 'Pimpinan' | 'Pendidik' | 'Kesiswaan & Disiplin' | 'Keuangan' | 'Layanan & Operasional' | 'Sistem'
    description: string
    primaryDuties: string[]
  }
> = {
  super_admin: {
    title: 'Super Admin',
    category: 'Sistem',
    description: 'Pemegang kendali tertinggi seluruh sistem, skema database, master data, dan konfigurasi fitur.',
    primaryDuties: [
      'Kelola akun pegawai, reset password, dan pembagian hak akses (multi-role)',
      'Aktivasi/deaktivasi fitur dan pengaturan global madrasah',
      'Audit log aktivitas, monitoring keamanan sistem, dan backup data',
    ],
  },
  kepsek: {
    title: 'Kepala Madrasah',
    category: 'Pimpinan',
    description: 'Pimpinan madrasah dengan hak peninjauan (executive oversight) dan penandatangan digital.',
    primaryDuties: [
      'Melihat monitoring keterlaksanaan KBM harian dan kehadiran guru',
      'Persetujuan dan pembubuhan tanda tangan digital resmi pada laporan CKH bulanan',
      'Monitoring arus kas komite dan laporan keuangan madrasah',
    ],
  },
  wakamad: {
    title: 'Wakil Kepala Madrasah',
    category: 'Pimpinan',
    description: 'Koordinator bidang kurikulum, kesiswaan, sarpras, dan kehumasan.',
    primaryDuties: [
      'Penetapan plotting penugasan guru dan verifikasi jadwal pelajaran mingguan',
      'Pencatatan dan monitoring kedisiplinan, akumulasi poin, analitik risiko, serta tindak lanjut',
      'Evaluasi pemeliharaan sarana dan kinerja pramubakti/satpam',
    ],
  },
  admin_tu: {
    title: 'Tata Usaha (Admin TU)',
    category: 'Layanan & Operasional',
    description: 'Pengelola administrasi umum, persuratan, kepegawaian, dan data induk.',
    primaryDuties: [
      'Kelola buku induk data siswa dan mutasi kelas',
      'Penomoran otomatis surat keluar dan pengarsipan surat dinas',
      'Verifikasi berkas persyaratan TPG (S36) dan administrasi pegawai',
    ],
  },
  guru: {
    title: 'Guru Mata Pelajaran',
    category: 'Pendidik',
    description: 'Pendidik yang bertanggung jawab atas proses belajar mengajar di ruang kelas.',
    primaryDuties: [
      'Mengisi agenda mengajar harian lengkap dengan materi dan foto dokumentasi',
      'Mencatat presensi siswa jam ke jam di setiap sesi pembelajaran',
      'Menyusun rencana mingguan via RPPM Generator dan input nilai siswa',
      'Mengisi catatan kegiatan harian (CKH) pegawai',
    ],
  },
  wali_kelas: {
    title: 'Wali Kelas',
    category: 'Pendidik',
    description: 'Pembina utama rombongan belajar santri dan jembatan komunikasi dengan orang tua.',
    primaryDuties: [
      'Memantau kehadiran siswa di kelas binaan dan input surat dokter/izin',
      'Mengecek status notifikasi dan panggilan orang tua santri binaan',
      'Memantau akumulasi poin pelanggaran dan mendampingi proses konseling',
      'Rekapitulasi kehadiran kelas bulanan untuk pelaporan',
    ],
  },
  guru_piket: {
    title: 'Guru Piket',
    category: 'Pendidik',
    description: 'Petugas harian yang memastikan kelancaran operasional KBM di seluruh madrasah.',
    primaryDuties: [
      'Monitoring kelas kosong dan keterlambatan guru',
      'Pendelegasian tugas atau mengajar pengganti untuk kelas yang gurunya berhalangan',
      'Mencatat pelanggaran tata tertib harian dan cetak rekap piket',
    ],
  },
  guru_bk: {
    title: 'Guru BK (Bimbingan Konseling)',
    category: 'Kesiswaan & Disiplin',
    description: 'Pembimbing psikososial, penanganan masalah, dan pembinaan karakter santri.',
    primaryDuties: [
      'Mencatat sesi konseling privat dan bimbingan karir/studi lanjut siswa',
      'Menindaklanjuti siswa dengan akumulasi poin pelanggaran tinggi',
      'Melakukan kunjungan rumah (home visit) dan pemanggilan orang tua bersama wali kelas',
    ],
  },
  bendahara_komite: {
    title: 'Bendahara Komite',
    category: 'Keuangan',
    description: 'Pengelola keuangan komite madrasah, penerimaan DSPT/SPP, dan kas belanja.',
    primaryDuties: [
      'Menetapkan nominal target DSPT santri baru dan tagihan SPP bulanan',
      'Menerima setoran tunai dan memverifikasi bukti transfer orang tua dari portal',
      'Menerbitkan kuitansi pembayaran resmi bertanda tangan digital',
      'Pencatatan kas keluar, pengajuan anggaran kegiatan, dan pelaporan buku kas',
    ],
  },
  ketua_komite: {
    title: 'Komite Madrasah',
    category: 'Keuangan',
    description: 'Representasi orang tua santri dalam pengawasan akuntabilitas dana komite.',
    primaryDuties: [
      'Meninjau transparansi pembukuan kas komite dan laporan arus kas bulanan',
      'Menyetujui pengajuan proposal belanja atau pengeluaran dana komite',
    ],
  },
  resepsionis: {
    title: 'Resepsionis',
    category: 'Layanan & Operasional',
    description: 'Petugas pelayanan tamu dinas dan penerimaan tamu madrasah.',
    primaryDuties: [
      'Mencatat buku tamu digital (nama, instansi, keperluan, foto/KTP)',
      'Menghubungkan tamu ke pegawai atau pimpinan yang dituju',
    ],
  },
  satpam: {
    title: 'Satpam (Keamanan)',
    category: 'Layanan & Operasional',
    description: 'Petugas keamanan gerbang utama madrasah.',
    primaryDuties: [
      'Validasi izin keluar santri dari komplek madrasah',
      'Mencatat jam kepulangan santri dan memantau tamu di pos gerbang',
    ],
  },
  pramubakti: {
    title: 'Pramubakti',
    category: 'Layanan & Operasional',
    description: 'Petugas kebersihan, perawatan fasilitas, dan pemeliharaan lingkungan madrasah.',
    primaryDuties: [
      'Melaporkan pekerjaan rutin (kebersihan toilet, kelas, taman) berfoto timestamp',
      'Melaporkan kerusakan fasilitas sarana prasarana sekolah',
    ],
  },
  guru_tahfidz: {
    title: 'Guru Tahfidz',
    category: 'Pendidik',
    description: 'Pengampu program akselerasi dan setoran hafalan Al-Qur\'an.',
    primaryDuties: [
      'Mencatat mutabaah setoran hafalan juz, surat, dan kelancaran tajwid santri',
      'Evaluasi target capaian hafalan santri per semester',
    ],
  },
  pembina_ekstrakurikuler: {
    title: 'Pembina Ekstrakurikuler',
    category: 'Kesiswaan & Disiplin',
    description: 'Pengelola kegiatan pengembangan bakat dan minat siswa.',
    primaryDuties: [
      'Pencatatan absensi latihan rutin ekstrakurikuler mingguan',
      'Penilaian keaktifan anggota ekskul untuk pengisian nilai rapor',
    ],
  },
}

export function DokumentasiClient({ userRoles, isSuperAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'matrix' | 'workflows'>('blueprint')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<string>('guru')

  // Filter modul pada Denah
  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return APP_MODULES.filter((m) => {
      const matchDomain = selectedDomain === 'all' || m.domain === selectedDomain
      if (!matchDomain) return false
      if (!q) return true
      return (
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.href.toLowerCase().includes(q) ||
        m.roles.some((r) => r.toLowerCase().includes(q)) ||
        m.keyFeatures.some((k) => k.toLowerCase().includes(q))
      )
    })
  }, [searchQuery, selectedDomain])

  // Modul untuk role yang dipilih di Matriks
  const roleAccessibleModules = useMemo(() => {
    return APP_MODULES.filter((m) => m.roles.includes(selectedRole) || selectedRole === 'super_admin')
  }, [selectedRole])

  return (
    <div className="space-y-6">
      {/* Tab Navigasi Utama */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          variant={activeTab === 'blueprint' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('blueprint')}
          className="gap-2"
        >
          <Compass className="h-4 w-4" />
          <span>Denah & Peta Modul</span>
          <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
            {APP_MODULES.length}
          </span>
        </Button>
        <Button
          variant={activeTab === 'matrix' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('matrix')}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          <span>Matriks Hak Akses Peran</span>
        </Button>
        <Button
          variant={activeTab === 'workflows' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('workflows')}
          className="gap-2"
        >
          <Workflow className="h-4 w-4" />
          <span>Alur Kerja Operasional</span>
          <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
            {CORE_WORKFLOWS.length}
          </span>
        </Button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: DENAH & PETA MODUL (INTERACTIVE BLUEPRINT)            */}
      {/* ============================================================ */}
      {activeTab === 'blueprint' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Baris Pencarian & Filter Domain */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama modul, path URL, atau kata kunci..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground mr-1 font-medium">Domain:</span>
              <button
                onClick={() => setSelectedDomain('all')}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  selectedDomain === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Semua ({APP_MODULES.length})
              </button>
              {APP_DOMAINS.map((dom) => {
                const count = APP_MODULES.filter((m) => m.domain === dom.id).length
                return (
                  <button
                    key={dom.id}
                    onClick={() => setSelectedDomain(dom.id)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      selectedDomain === dom.id
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {dom.badge} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grid Modul */}
          {filteredModules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Tidak ada modul yang cocok dengan kriteria pencarian &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredModules.map((item) => {
                const domain = APP_DOMAINS.find((d) => d.id === item.domain)
                const canAccess =
                  isSuperAdmin || item.roles.some((r) => userRoles.includes(r))

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="space-y-3">
                      {/* Header Kartu */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {domain?.badge}
                          </span>
                          <h3 className="mt-1 font-semibold text-foreground text-base leading-snug">
                            {item.title}
                          </h3>
                        </div>
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {item.href}
                        </span>
                      </div>

                      {/* Deskripsi */}
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {item.description}
                      </p>

                      {/* Fitur Utama */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-foreground/80 block">
                          Fitur Utama:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.keyFeatures.map((kf, i) => (
                            <span
                              key={i}
                              className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                            >
                              {kf}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Role yang Berhak */}
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[10px] font-medium text-muted-foreground block">
                          Hak Akses Role:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.roles.slice(0, 4).map((r, i) => (
                            <span
                              key={i}
                              className={`rounded px-1.5 py-0.2 text-[10px] font-mono ${
                                userRoles.includes(r)
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                          {item.roles.length > 4 && (
                            <span className="rounded bg-muted px-1 py-0.2 text-[9px] text-muted-foreground">
                              +{item.roles.length - 4} role
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol Aksi Langsung */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      {canAccess ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Akun Anda berhak
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Role khusus
                        </span>
                      )}
                      <Link
                        href={item.href}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Buka Halaman <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MATRIKS HAK AKSES PERAN (ROLE ACCESS MATRIX)         */}
      {/* ============================================================ */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pilih Peran Pengguna untuk Melihat Tugas & Hak Akses:
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(ROLE_DEFINITIONS).map(([roleKey, roleDef]) => (
                <button
                  key={roleKey}
                  onClick={() => setSelectedRole(roleKey)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedRole === roleKey
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card text-foreground border border-border hover:bg-muted'
                  }`}
                >
                  {roleDef.title}
                  {userRoles.includes(roleKey) && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Detail Role yang Dipilih */}
          {(() => {
            const currentDef = ROLE_DEFINITIONS[selectedRole]
            if (!currentDef) return null

            return (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Kategori: {currentDef.category}
                      </span>
                      <h2 className="text-xl font-bold text-foreground">
                        {currentDef.title}
                      </h2>
                    </div>
                    <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground">
                      Kode Role: {selectedRole}
                    </span>
                  </div>

                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {currentDef.description}
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Tanggung Jawab Utama di Sistem:
                    </h4>
                    <ul className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                      {currentDef.primaryDuties.map((duty, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-muted/40 p-2 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{duty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Modul yang Dapat Diakses Role Ini */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    Modul yang Terbuka untuk {currentDef.title} ({roleAccessibleModules.length} Modul):
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {roleAccessibleModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="rounded-lg border border-border bg-card p-3 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-foreground">{mod.title}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{mod.href}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{mod.summary}</p>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/40 flex justify-end">
                          <Link
                            href={mod.href}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            Buka <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ALUR KERJA UTAMA SISTEM (CORE BUSINESS WORKFLOWS)     */}
      {/* ============================================================ */}
      {activeTab === 'workflows' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-primary/90 flex items-start gap-3">
            <BadgeInfo className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-semibold text-sm text-foreground">
                Panduan Rantai Proses Bisnis Terpadu
              </p>
              <p className="text-muted-foreground mt-0.5">
                Setiap alur menjelaskan urutan langkah nyata, siapa peran pelaksananya, modul apa yang dipakai,
                dan apa luaran data yang dihasilkan ke sistem.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {CORE_WORKFLOWS.map((wf) => (
              <div
                key={wf.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
              >
                <div className="border-b border-border pb-3">
                  <h3 className="text-lg font-bold text-foreground">{wf.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{wf.subtitle}</p>
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed">
                  {wf.description}
                </p>

                {/* Steps Timeline */}
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {wf.steps.map((st) => (
                    <div key={st.step} className="relative group">
                      {/* Step Circle */}
                      <span className="absolute -left-6 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs">
                        {st.step}
                      </span>

                      <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-1.5 transition hover:bg-muted/40">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h4 className="text-xs font-bold text-foreground">
                            {st.title}
                          </h4>
                          <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Pelaku: {st.actor}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {st.action}
                        </p>
                        <div className="pt-1.5 flex justify-end">
                          <Link
                            href={st.module}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            Modul: {st.module} <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
