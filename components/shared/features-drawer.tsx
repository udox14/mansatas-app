'use client'

import React, { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MENU_ITEMS } from '@/config/menu'
import {
  GraduationCap,
  UsersRound,
  ClipboardList,
  PieChart,
  BellRing,
  CalendarCheck2,
  ChevronRight,
  ShieldCheck,
  BookOpenCheck,
  CheckCircle2,
} from 'lucide-react'

// Copy data sources from original page.tsx
const workstreams = [
  {
    title: 'Akademik dan Kelas',
    description: 'Data siswa, kelas, jadwal, nilai harian, dan rekap absensi tersusun dalam alur kerja yang mudah dipantau.',
    icon: GraduationCap,
  },
  {
    title: 'Kesiswaan dan BK',
    description: 'Izin, kedisiplinan, catatan tindak lanjut, dan layanan bimbingan berada di satu ruang koordinasi.',
    icon: UsersRound,
  },
  {
    title: 'Administrasi Madrasah',
    description: 'Surat, rapat, buku tamu, agenda, penugasan, dan monitoring kegiatan lebih cepat ditelusuri.',
    icon: ClipboardList,
  },
  {
    title: 'Keuangan dan Layanan',
    description: 'SPP, DSPT, daftar ulang, dan laporan kas hadir dengan alur yang jelas untuk petugas.',
    icon: PieChart,
  },
]

const parentPortalFeatures = [
  {
    title: 'Pengumuman Sekolah',
    description: 'Orang tua menerima informasi resmi yang ditargetkan untuk semua wali murid, angkatan, atau kelas tertentu.',
    icon: BellRing,
  },
  {
    title: 'Jadwal dan Kehadiran',
    description: 'Jadwal pelajaran, status hadir, izin, sakit, alfa, dan riwayat kehadiran anak bisa dipantau dari ponsel.',
    icon: CalendarCheck2,
  },
  {
    title: 'Akademik dan Kedisiplinan',
    description: 'Nilai semester, rata-rata akademik, poin pelanggaran, dan catatan tindak lanjut tersaji dalam satu portal.',
    icon: GraduationCap,
  },
  {
    title: 'Keuangan Siswa',
    description: 'Orang tua dapat melihat informasi DSPT, tunggakan SPP lama, dan riwayat pembayaran terakhir.',
    icon: PieChart,
  },
]

const featureGroups = [
  {
    title: 'Utama & Data Master',
    summary: 'Fondasi data madrasah: pengguna, siswa, kelas, dan plotting.',
    ids: ['dashboard', 'siswa', 'kelas', 'plotting', 'guru'],
  },
  {
    title: 'Akademik & Pembelajaran',
    summary: 'Jadwal, agenda, absensi, nilai, rekap akademik, dan tahfidz.',
    ids: ['akademik', 'akademik-nilai', 'kehadiran', 'rekap-absensi', 'keterangan-absensi', 'agenda', 'nilai-harian', 'tahfidz'],
  },
  {
    title: 'Koordinasi & Monitoring',
    summary: 'Penugasan, rapat, monitoring agenda, dan pemantauan pekerjaan.',
    ids: ['penugasan', 'monitoring-agenda', 'monitoring-penugasan', 'rapat', 'jadwal-piket', 'analitik'],
  },
  {
    title: 'Kesiswaan & Layanan BK',
    summary: 'Perizinan, kedisiplinan, BK, psikotes, TKA, dan penerimaan PT.',
    ids: ['izin', 'kedisiplinan', 'bk', 'psikotes', 'tka', 'penerimaan-pt'],
  },
  {
    title: 'Administrasi Madrasah',
    summary: 'Surat, sarpras, PPL, dan buku tamu.',
    ids: ['surat', 'sarpras', 'kelola-ppl', 'buku-tamu'],
  },
  {
    title: 'Keuangan',
    summary: 'Riwayat transaksi, DSPT, SPP tunggakan, daftar ulang, kas keluar, dan laporan.',
    ids: ['keuangan-transaksi', 'keuangan-daftar-ulang', 'keuangan-dspt', 'keuangan-spp', 'keuangan-kas-keluar', 'keuangan-laporan'],
  },
  {
    title: 'Sistem & Notifikasi',
    summary: 'Pengaturan aplikasi, akses fitur, broadcast, dan jadwal notifikasi.',
    ids: ['settings', 'settings-fitur', 'settings-notifications', 'settings-jadwal-notif'],
  },
].map((group) => ({
  ...group,
  features: group.ids
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof MENU_ITEMS)[number] => Boolean(item)),
}))

const featureDescriptions: Record<string, string> = {
  dashboard: 'Halaman awal untuk melihat ringkasan pekerjaan, jadwal, pintasan menu, dan informasi penting sesuai peran pengguna.',
  siswa: 'Tempat menyimpan data siswa secara lengkap, mulai dari biodata, foto, buku induk, tahun masuk, sampai status siswa aktif atau keluar.',
  kelas: 'Membantu mengatur rombel, wali kelas, anggota kelas, perpindahan siswa, kelas binaan BK, sampai blanko absensi yang siap dicetak.',
  plotting: 'Ruang kerja untuk menyusun siswa baru, penjurusan, pembagian kelas, plotting massal, dan proses kelulusan dengan lebih tertib.',
  akademik: 'Pusat pengaturan mapel, guru mengajar, jadwal kelas, jadwal guru, import jadwal ASC, dan pembagian guru piket bergilir.',
  'akademik-nilai': 'Dipakai untuk memasukkan dan mengecek nilai akademik dari Excel, lalu melihat rekap nilai siswa dengan lebih rapi.',
  tahfidz: 'Mencatat perkembangan hafalan siswa, setoran ayat, nilai per juz, riwayat setoran, laporan, dan analitik program tahfidz.',
  guru: 'Mengelola akun guru dan pegawai, termasuk data profil, role akses, reset password, import data, dan foto pegawai.',
  kehadiran: 'Guru dapat mengisi absensi siswa sesuai jadwal mengajar hari itu, lengkap dengan catatan hadir, sakit, izin, alfa, atau bolos.',
  'rekap-absensi': 'Menyajikan rekap kehadiran siswa agar wali kelas, TU, wakamad, dan pimpinan bisa melihat kondisi absensi dengan cepat.',
  'keterangan-absensi': 'Wali kelas bisa memberi keterangan ketidakhadiran siswa per tanggal, baik satu per satu maupun sekaligus satu kelas.',
  agenda: 'Guru mencatat agenda mengajar dan materi pembelajaran, sementara guru piket dapat mengisi agenda piket harian.',
  'agenda-kelas': 'TU dapat memeriksa dan mencetak agenda kelas harian atau bulanan sesuai format resmi dengan data agenda guru dan absensi siswa.',
  'nilai-harian': 'Guru bisa membuat sesi penilaian, mengisi nilai siswa, mengatur KKM, dan melihat rata-rata nilai harian per kelas.',
  penugasan: 'Memudahkan guru atau pegawai mendelegasikan tugas, menerima tugas masuk, dan melihat pekerjaan yang sudah dikirim.',
  'monitoring-agenda': 'Pimpinan dan admin dapat memantau agenda guru, rekap kehadiran mengajar, agenda piket, serta mencetak laporan.',
  'monitoring-penugasan': 'Menampilkan pekerjaan yang sedang didelegasikan, siapa pengirimnya, siapa penerimanya, dan bagaimana statusnya.',
  rapat: 'Membuat undangan rapat, memilih peserta, menerima konfirmasi kehadiran, mengirim ulang undangan, dan memberi pengingat.',
  'jadwal-piket': 'Mengatur siapa saja guru piket setiap hari dan shift, sehingga pencatatan piket harian punya dasar yang jelas.',
  izin: 'Mencatat izin siswa, baik tidak masuk, keluar, maupun izin di jam pelajaran, lengkap dengan alasan dan status kembali.',
  kedisiplinan: 'Mencatat pelanggaran siswa, poin beban, jenis sanksi, tindak lanjut, dan ringkasan kasus kedisiplinan.',
  sarpras: 'Mendata aset madrasah, kategori barang, kondisi aset, foto aset, dan filter pencarian sarana prasarana.',
  bk: 'Guru BK dapat mengelola kelas binaan, topik bimbingan, rekaman masalah siswa, sesi konseling, home visit, dan tindak lanjut.',
  psikotes: 'Mengelola hasil psikotes siswa seperti IQ, gaya belajar, bakat-minat, RIASEC, MBTI, dan rekomendasi jurusan.',
  analitik: 'Membantu membaca data nilai untuk kebutuhan ranking, kelulusan, SNBP, SPAN, ijazah, dan ekspor hasil analisis.',
  tka: 'Mengatur pilihan mapel TKA, mengimpor hasil tes, mencocokkan nama siswa, melihat daftar hasil, dan membaca analitik nilai.',
  'penerimaan-pt': 'Mencatat siswa kelas 12 yang diterima di perguruan tinggi berdasarkan jalur, kampus, status, dan hasil import data.',
  surat: 'Membuat dan menyimpan arsip surat keluar, seperti SPPD, surat tugas, keterangan aktif, pindah, undangan, dan surat lainnya.',
  'kelola-ppl': 'Menghubungkan guru PPL dengan guru utama, jadwal mengajar, dan jadwal piket agar akses tugas PPL sesuai penugasan.',
  'buku-tamu': 'Mencatat kunjungan tamu individu atau instansi, termasuk foto, tujuan kunjungan, daftar tamu hari ini, dan monitoring kunjungan.',
  'keuangan-transaksi': 'Menampilkan riwayat seluruh transaksi keuangan dari berbagai sumber, diurutkan dari transaksi terbaru.',
  'keuangan-daftar-ulang': 'Kasir untuk proses daftar ulang, pembayaran DSPT, pemberian diskon, transaksi, dan cetak kuitansi.',
  'keuangan-dspt': 'Mengatur target DSPT, pembayaran, diskon, status pelunasan, import data, dan nominal massal per angkatan.',
  'keuangan-spp': 'Menampilkan dan menagih SPP hanya untuk siswa yang masih memiliki tunggakan terdahulu.',
  'keuangan-kas-keluar': 'Mencatat pengeluaran kas madrasah berdasarkan kategori seperti operasional, pemeliharaan, kegiatan siswa, dan administrasi.',
  'keuangan-laporan': 'Menyediakan laporan keuangan dari transaksi, tagihan, pembayaran, kas keluar, dan rekap dalam periode tertentu.',
  settings: 'Tempat mengatur tahun ajaran, jurusan, pola jam pelajaran, tahun aktif, dan konfigurasi dasar aplikasi.',
  'settings-fitur': 'Mengatur fitur apa saja yang boleh diakses tiap role, membuat role khusus, override akses user, dan bottom nav mobile.',
  'settings-notifications': 'Mengirim pengumuman atau broadcast ke pengguna tertentu melalui notifikasi aplikasi.',
  'settings-jadwal-notif': 'Menjadwalkan notifikasi rutin, mengaktifkan atau mematikan jadwal, menghapus jadwal, dan mencoba kirim notifikasi.',
}

interface FeaturesDrawerProps {
  children: React.ReactNode
}

type TabType = 'layanan' | 'ortu' | 'modul'

export default function FeaturesDrawer({ children }: FeaturesDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('layanan')

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl bg-white border-l border-teal-100 p-0 flex flex-col h-full"
      >
        <div className="p-6 border-b border-slate-100 bg-teal-50/50">
          <SheetHeader className="text-left">
            <SheetTitle className="text-2xl font-extrabold text-teal-950 flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-teal-700" />
              Detail Fitur & Layanan
            </SheetTitle>
            <SheetDescription className="text-slate-600 font-medium">
              Eksplorasi seluruh modul operasional digital MANSATAS App untuk MAN 1 Tasikmalaya.
            </SheetDescription>
          </SheetHeader>

          {/* Tab buttons */}
          <div className="flex gap-2 mt-5 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'layanan', label: 'Layanan Utama' },
                { id: 'ortu', label: 'Wali Murid' },
                { id: 'modul', label: 'Semua Modul' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-teal-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeTab === 'layanan' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-teal-800">Meja Kerja Staf & Guru</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {workstreams.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-teal-200 transition-colors">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900">{item.title}</h4>
                      <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-600">{item.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'ortu' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-teal-800">Akses Orang Tua / Wali Murid</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {parentPortalFeatures.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-teal-200 transition-colors">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-900">{item.title}</h4>
                      <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-600">{item.description}</p>
                    </div>
                  )
                })}
              </div>
              <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/50 flex gap-3 items-center">
                <ShieldCheck className="h-6 w-6 text-teal-700 shrink-0" />
                <p className="text-xs font-semibold text-teal-950">
                  Orang tua dapat memantau nilai, status kehadiran, pelanggaran poin, dan info tagihan sekolah anak secara real-time.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'modul' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-teal-800">Seluruh Modul & Menu Utama</h3>
              <p className="text-xs font-medium text-slate-500">Klik pada kelompok modul di bawah untuk melihat detail fitur di dalamnya:</p>
              
              <div className="space-y-3">
                {featureGroups.map((group) => (
                  <details
                    key={group.title}
                    className="group rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm open:bg-white open:border-teal-200 transition-all"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 select-none">
                      <div>
                        <span className="block text-sm sm:text-base font-extrabold text-slate-900">{group.title}</span>
                        <span className="mt-1 block text-xs font-medium text-slate-500 leading-normal">{group.summary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5">
                          {group.features.length}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-open:rotate-90 transition-transform" />
                      </div>
                    </summary>

                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                      {group.features.map((feature) => {
                        const FeatureIcon = feature.icon
                        return (
                          <div key={feature.id} className="flex gap-3 rounded-lg bg-slate-50/50 p-3 hover:bg-teal-50/25 transition-colors">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-teal-800">
                              <FeatureIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900">{feature.title}</h5>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                                {featureDescriptions[feature.id] ?? 'Modul kerja MANSATAS App untuk mendukung operasional madrasah.'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-[10px] sm:text-xs font-bold text-slate-500">
          MAN 1 Tasikmalaya — Bangkit, Jaya, Juara
        </div>
      </SheetContent>
    </Sheet>
  )
}
