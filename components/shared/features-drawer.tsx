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
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS } from '@/config/menu'
import {
  BookOpenCheck,
  CalendarCheck2,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  ClipboardList,
  Home,
  MessageSquareText,
  Megaphone,
  PieChart,
  QrCode,
  ReceiptText,
  Settings,
  ShieldAlert,
  BellRing,
  ShieldCheck,
  UsersRound,
  Wallet,
} from 'lucide-react'

const workstreams = [
  {
    title: 'Akademik, Kelas, dan Pembelajaran',
    description: 'Dashboard, data siswa, kelas, plotting, pusat akademik, kalender pendidikan, agenda kelas/guru, absensi, nilai, tahfidz, RPPM, CKH, dan dokumen TPG tersedia untuk alur kerja harian.',
    icon: GraduationCap,
  },
  {
    title: 'Kesiswaan, BK, dan Pendampingan',
    description: 'Kelas binaan, riwayat dan koreksi absensi, perizinan, kedisiplinan, monitoring kedisiplinan, BK, psikotes, TKA, dan penerimaan PT berada dalam satu ruang koordinasi.',
    icon: UsersRound,
  },
  {
    title: 'Administrasi, HR, dan Koordinasi',
    description: 'Guru dan pegawai, penugasan, monitoring penugasan, rapat, surat, sarpras, PPL, buku tamu, jadwal piket, monitoring agenda, dan analitik membantu pekerjaan lintas unit.',
    icon: ClipboardList,
  },
  {
    title: 'Keuangan Komite dan Kas',
    description: 'Daftar ulang, riwayat transaksi, DSPT, tunggakan SPP, export Excel, kas keluar, laporan keuangan, dan pengaturan komite tersedia untuk petugas berwenang.',
    icon: PieChart,
  },
  {
    title: 'Sistem, Notifikasi, dan WhatsApp',
    description: 'Pengaturan aplikasi, manajemen fitur, broadcast, notifikasi terjadwal, dan pengiriman WhatsApp mendukung operasional digital madrasah.',
    icon: Settings,
  },
  {
    title: 'Layanan Orang Tua dari Dashboard',
    description: 'Pengumuman orang tua dan kotak saran orang tua bisa dikelola oleh pegawai yang diberi akses, tersambung dengan Portal Orang Tua.',
    icon: Megaphone,
  },
]

const parentPortalFeatures = [
  {
    title: 'Beranda Profil Siswa',
    description: 'Orang tua melihat identitas anak, kelas, NISN, ringkasan cepat, kontak wali kelas, serta tombol koordinasi WhatsApp.',
    icon: Home,
  },
  {
    title: 'Pengumuman Sekolah',
    description: 'Orang tua menerima informasi resmi yang ditargetkan untuk semua wali murid, angkatan, atau kelas tertentu.',
    icon: BellRing,
  },
  {
    title: 'Jadwal Kelas Harian',
    description: 'Jadwal pelajaran Senin sampai Sabtu tampil per jam, termasuk guru pengampu, status hari ini, libur, atau pengecualian KBM.',
    icon: CalendarCheck2,
  },
  {
    title: 'Kehadiran dan Kedisiplinan',
    description: 'Ringkasan hadir, izin, sakit, alfa, catatan terbaru, poin pelanggaran, level pendampingan, dan tindak lanjut sekolah dapat dipantau.',
    icon: BookOpenCheck,
  },
  {
    title: 'Akademik dan Nilai Semester',
    description: 'Rata-rata akademik dan nilai semester dapat dibuka sampai rincian mata pelajaran saat data nilai tersedia.',
    icon: GraduationCap,
  },
  {
    title: 'Keuangan DSPT dan SPP',
    description: 'Portal menampilkan target, pembayaran, diskon, sisa DSPT, tunggakan SPP lama, status tagihan, dan riwayat pembayaran.',
    icon: Wallet,
  },
  {
    title: 'Pembayaran QRIS / Transfer',
    description: 'Orang tua dapat memilih nominal DSPT, memakai QRIS atau rekening aktif, mencatat pembayaran, lalu mengupload bukti.',
    icon: QrCode,
  },
  {
    title: 'Kuitansi dan Bukti Bayar',
    description: 'Bukti yang masuk bisa dipantau statusnya, dan kuitansi dapat dibuka setelah pembayaran diverifikasi komite.',
    icon: ReceiptText,
  },
  {
    title: 'Notifikasi dan Pemanggilan',
    description: 'Peringatan penting, tindak lanjut BK, pemanggilan orang tua, dan respons hadir atau penjadwalan ulang tampil di portal.',
    icon: ShieldAlert,
  },
  {
    title: 'Kotak Saran Orang Tua',
    description: 'Orang tua dapat mengirim saran berdasarkan kategori, melihat riwayat, dan memantau status tindak lanjut sekolah.',
    icon: MessageSquareText,
  },
  {
    title: 'Panduan Halaman',
    description: 'Tour bantuan tersedia per tab agar orang tua mudah memahami bagian beranda, jadwal, kehadiran, nilai, keuangan, dan saran.',
    icon: CircleHelp,
  },
]

const groupSummaries: Record<string, string> = {
  utama: 'Halaman awal sesuai peran pengguna.',
  'data-master': 'Fondasi data madrasah: siswa, guru/pegawai, kelas, dan plotting.',
  'tugas-harian-guru': 'Agenda, dokumen kerja, absensi, nilai harian, dan penugasan guru.',
  'monitoring-akademik': 'Pusat akademik, kalender pendidikan, dan analitik akademik.',
  'monitoring-rekap': 'Monitoring agenda, penugasan, kedisiplinan, absensi, dan nilai.',
  'program-khusus': 'Program khusus madrasah seperti tahfidz.',
  'kesiswaan-bk': 'Kelas binaan, izin, kedisiplinan, BK, psikotes, TKA, dan penerimaan PT.',
  'administrasi-hr': 'Dokumen TPG, surat, rapat, sarpras, PPL, dan buku tamu.',
  keuangan: 'Daftar ulang, transaksi, DSPT, SPP, export, kas keluar, laporan, dan pengaturan komite.',
  sistem: 'Pengaturan, WhatsApp, broadcast, jadwal notifikasi, fitur, pengumuman, dan kotak saran orang tua.',
}

const staffMenuItems = MENU_ITEMS.filter((item) => item.id !== 'portal-ortu')
const groupedFeatureIds = new Set(DEFAULT_SIDEBAR_GROUPS.flatMap((group) => group.items))
const ungroupedStaffItems = staffMenuItems.filter((item) => !groupedFeatureIds.has(item.id))

const featureGroups = [
  ...DEFAULT_SIDEBAR_GROUPS.map((group) => ({
    ...group,
    title: group.label,
    summary: groupSummaries[group.id] ?? 'Kelompok modul dashboard pegawai MANSATAS App.',
  })),
  ...(ungroupedStaffItems.length > 0
    ? [{
        id: 'lainnya',
        label: 'Lainnya',
        title: 'Lainnya',
        summary: 'Modul tambahan dashboard pegawai yang belum masuk grup sidebar.',
        items: ungroupedStaffItems.map((item) => item.id),
      }]
    : []),
].map((group) => ({
  ...group,
  features: group.items
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof MENU_ITEMS)[number] => Boolean(item && item.id !== 'portal-ortu')),
}))

const featureDescriptions: Record<string, string> = {
  dashboard: 'Halaman awal untuk melihat ringkasan pekerjaan, jadwal, pintasan menu, dan informasi penting sesuai peran pengguna.',
  siswa: 'Tempat menyimpan data siswa secara lengkap, mulai dari biodata, foto, buku induk, tahun masuk, sampai status siswa aktif atau keluar.',
  kelas: 'Membantu mengatur rombel, wali kelas, anggota kelas, perpindahan siswa, kelas binaan BK, sampai blanko absensi yang siap dicetak.',
  plotting: 'Ruang kerja untuk menyusun siswa baru, penjurusan, pembagian kelas, plotting massal, dan proses kelulusan dengan lebih tertib.',
  akademik: 'Pusat pengaturan mapel, guru mengajar, jadwal kelas, jadwal guru, import jadwal ASC, dan pembagian guru piket bergilir.',
  'akademik-nilai': 'Dipakai untuk memasukkan dan mengecek nilai akademik dari Excel, lalu melihat rekap nilai siswa dengan lebih rapi.',
  'kalender-pendidikan': 'Mengelola kalender pendidikan, hari efektif, libur, sumber kalender resmi, dan pengecualian KBM yang berdampak pada jadwal.',
  tahfidz: 'Mencatat perkembangan hafalan siswa, setoran ayat, nilai per juz, riwayat setoran, laporan, dan analitik program tahfidz.',
  guru: 'Mengelola akun guru dan pegawai, termasuk data profil, role akses, reset password, import data, dan foto pegawai.',
  kehadiran: 'Guru dapat mengisi absensi siswa per sesi mengajar, melihat rekap asli seluruh sesinya, serta mengunduh laporan PDF dan Excel.',
  'kelas-binaan': 'Wali kelas memantau siswa binaan, absensi, catatan, komunikasi orang tua, serta membuat pemanggilan atau tindak lanjut.',
  'rekap-absensi': 'Menyajikan rekap kehadiran siswa agar wali kelas, TU, wakamad, dan pimpinan bisa melihat kondisi absensi dengan cepat.',
  'keterangan-absensi': 'Wali kelas dapat melihat riwayat dan mengoreksi status akhir harian tanpa mengubah detail absensi asli yang disimpan guru.',
  agenda: 'Guru mencatat agenda mengajar dan materi pembelajaran, sementara guru piket dapat mengisi agenda piket harian.',
  'agenda-kelas': 'TU dapat memeriksa dan mencetak agenda kelas harian atau bulanan sesuai format resmi dengan data agenda guru dan absensi siswa.',
  'ckh-generator': 'Menyusun catatan kinerja harian pegawai dari template, agenda, tugas, dan catatan manual untuk kebutuhan administrasi kerja.',
  'tpg-dokumen': 'Mengelola dokumen TPG, unggahan S36, periode dokumen, rekap pegawai, dan cetak CKH pendukung pencairan.',
  'rppm-generator': 'Membantu guru membuat RPPM dari data pembelajaran dan mencetak dokumen rencana pembelajaran mingguan.',
  'nilai-harian': 'Guru bisa membuat sesi penilaian, mengisi nilai siswa, mengatur KKM, dan melihat rata-rata nilai harian per kelas.',
  penugasan: 'Memudahkan guru atau pegawai mendelegasikan tugas, menerima tugas masuk, dan melihat pekerjaan yang sudah dikirim.',
  whatsapp: 'Mengirim pesan WhatsApp terarah untuk kebutuhan operasional, pengingat, dan komunikasi komite atau madrasah.',
  'monitoring-agenda': 'Pimpinan dan admin dapat memantau agenda guru, rekap kehadiran mengajar, agenda piket, serta mencetak laporan.',
  'monitoring-penugasan': 'Menampilkan pekerjaan yang sedang didelegasikan, siapa pengirimnya, siapa penerimanya, dan bagaimana statusnya.',
  'monitoring-kedisiplinan': 'Memantau kasus kedisiplinan, total poin, level sanksi, dan tindak lanjut siswa lintas kelas.',
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
  'keuangan-export': 'Mengekspor data DSPT dan SPP ke Excel dengan pilihan kolom dan sumber data yang fleksibel.',
  'keuangan-kas-keluar': 'Mencatat pengeluaran kas madrasah berdasarkan kategori seperti operasional, pemeliharaan, kegiatan siswa, dan administrasi.',
  'keuangan-laporan': 'Menyediakan laporan keuangan dari transaksi, tagihan, pembayaran, kas keluar, dan rekap dalam periode tertentu.',
  'keuangan-pengaturan': 'Mengatur rekening komite, QRIS, WhatsApp konfirmasi, dan metode pembayaran yang tampil di Portal Orang Tua.',
  settings: 'Tempat mengatur tahun ajaran, jurusan, pola jam pelajaran, tahun aktif, dan konfigurasi dasar aplikasi.',
  'settings-fitur': 'Mengatur fitur apa saja yang boleh diakses tiap role, membuat role khusus, override akses user, dan bottom nav mobile.',
  'settings-notifications': 'Mengirim pengumuman atau broadcast ke pengguna tertentu melalui notifikasi aplikasi.',
  'settings-jadwal-notif': 'Menjadwalkan notifikasi rutin, mengaktifkan atau mematikan jadwal, menghapus jadwal, dan mencoba kirim notifikasi.',
  'pengumuman-ortu': 'Membuat pengumuman untuk Portal Orang Tua dengan target semua wali, angkatan, atau kelas tertentu.',
  'kotak-saran-ortu': 'Meninjau, memproses, dan menindaklanjuti saran yang dikirim orang tua melalui portal.',
}

type TabType = 'layanan' | 'ortu' | 'modul'

export default function FeaturesDrawer() {
  const [activeTab, setActiveTab] = useState<TabType>('layanan')

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-teal-800 transition-colors hover:text-teal-955"
        >
          <span>Lihat Detail Layanan</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
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
                { id: 'layanan', label: 'Fitur Pegawai' },
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
