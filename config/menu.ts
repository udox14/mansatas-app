// config/menu.ts
const LayoutDashboard = 'LayoutDashboard'
const Users = 'Users'
const GraduationCap = 'GraduationCap'
const CalendarCheck = 'CalendarCheck'
const BookOpen = 'BookOpen'
const AlertTriangle = 'AlertTriangle'
const Settings = 'Settings'
const Library = 'Library'
const Shuffle = 'Shuffle'
const DoorOpen = 'DoorOpen'
const HeartHandshake = 'HeartHandshake'
const Brain = 'Brain'
const FileSpreadsheet = 'FileSpreadsheet'
const ClipboardPen = 'ClipboardPen'
const Activity = 'Activity'
const ClipboardList = 'ClipboardList'
const FileText = 'FileText'
const SlidersHorizontal = 'SlidersHorizontal'
const PackageSearch = 'PackageSearch'
const Send = 'Send'
const Eye = 'Eye'
const Calendar = 'Calendar'
const Megaphone = 'Megaphone'
const MessageSquarePlus = 'MessageSquarePlus'
const MessageCircle = 'MessageCircle'
const Radio = 'Radio'
const AlarmClock = 'AlarmClock'
const ClipboardEdit = 'ClipboardEdit'
const BookHeart = 'BookHeart'
const BookUser = 'BookUser'
const ReceiptText = 'ReceiptText'
const HandCoins = 'HandCoins'
const CalendarDays = 'CalendarDays'
const TrendingDown = 'TrendingDown'
const BarChart3 = 'BarChart3'
const ClipboardCheck = 'ClipboardCheck'
const LineChart = 'LineChart'
const FileCheck = 'FileCheck'
const FileArchive = 'FileArchive'
const Landmark = 'Landmark'
const UserCheck = 'UserCheck'
const NotebookPen = 'NotebookPen'
const BookOpenCheck = 'BookOpenCheck'
const BookCheck = 'BookCheck'
const ClipboardSignature = 'ClipboardSignature'
const FilePenLine = 'FilePenLine'
const CircleHelp = 'CircleHelp'
const Smartphone = 'Smartphone'
const FileWarning = 'FileWarning'
const Trophy = 'Trophy'

export type MenuItem = {
  id: string        // feature_id unik — dipakai di DB role_features
  title: string
  href: string
  icon: any
  roles: string[]   // default roles (fallback jika DB kosong)
  desc?: string     // Penjelasan fungsi sebenarnya dari menu
}

export type SidebarGroupConfig = {
  id: string
  label: string
  items: string[]
}

export type SidebarRoleOverrideConfig = {
  groupOrder?: string[]
  groupLabels?: Record<string, string>
  itemPlacements?: Record<string, string[]>
  hiddenGroupIds?: string[]
  hiddenItemIds?: string[]
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'guru_ppl', 'guru_tahfidz', 'satpam', 'pramubakti', 'operator', 'bendahara_komite', 'pembina_ekstrakurikuler', 'ketua_komite', 'anggota_komite'],
    desc: 'Melihat ringkasan informasi dan statistik utama dari seluruh aktivitas di madrasah'
  },
  {
    id: 'siswa',
    title: 'Siswa',
    href: '/dashboard/siswa',
    icon: Users,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'wali_kelas', 'operator', 'bendahara_komite'],
    desc: 'Mengelola biodata, mutasi, dan pencarian profil lengkap seluruh siswa aktif maupun alumni'
  },
  {
    id: 'kelas',
    title: 'Kelas',
    href: '/dashboard/kelas',
    icon: Library,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengatur struktur kelas, wali kelas, serta kapasitas rombongan belajar di setiap tingkat'
  },
  {
    id: 'plotting',
    title: 'Plotting & Kenaikan',
    href: '/dashboard/plotting',
    icon: Shuffle,
    roles: ['super_admin', 'admin_tu', 'kepsek'],
    desc: 'Memindahkan siswa naik kelas atau membagi ulang rombongan belajar untuk semester baru'
  },
  {
    id: 'akademik',
    title: 'Pusat Akademik',
    href: '/dashboard/akademik',
    icon: BookOpen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengatur data mata pelajaran, penugasan guru pengajar, dan distribusi jadwal KBM'
  },
  {
    id: 'akademik-nilai',
    title: 'Rekap Nilai',
    href: '/dashboard/akademik/nilai',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru'],
    desc: 'Mengimpor dan merekap nilai Rapor Digital Madrasah (RDM) per semester dari file Excel'
  },
  {
    id: 'kalender-pendidikan',
    title: 'Kalender Pendidikan',
    href: '/dashboard/kalender-pendidikan',
    icon: CalendarDays,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengatur hari efektif belajar, libur nasional/madrasah, rapat, dan jadwal ujian'
  },

  {
    id: 'tahfidz',
    title: 'Tahfidz Qur\'an',
    href: '/dashboard/tahfidz',
    icon: BookHeart,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_tahfidz'],
    desc: 'Mengelola kemajuan hafalan Al-Qur\'an siswa, setoran juz/surah, serta rekap tilawah harian'
  },
  {
    id: 'guru',
    title: 'Guru & Pegawai',
    href: '/dashboard/guru',
    icon: GraduationCap,
    roles: ['super_admin', 'admin_tu', 'kepsek'],
    desc: 'Mengelola data kepegawaian, jabatan, dan akses sistem untuk guru dan staf'
  },
  {
    id: 'kehadiran',
    title: 'Absensi Siswa',
    href: '/dashboard/kehadiran',
    icon: CalendarCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_piket', 'wali_kelas'],
    desc: 'Melakukan absensi harian siswa per kelas secara real-time saat jam pelajaran'
  },
  {
    id: 'kelas-binaan',
    title: 'Kelas Binaan',
    href: '/dashboard/kelas-binaan',
    icon: Eye,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Pusat pantauan khusus Wali Kelas untuk memonitor kehadiran, nilai, kedisiplinan, dan profil lengkap siswa binaan'
  },
  {
    id: 'rekap-absensi',
    title: 'Rekap Absensi',
    href: '/dashboard/rekap-absensi',
    icon: ClipboardList,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Laporan absensi siswa untuk monitoring kehadiran per kelas, per siswa, maupun rincian per jam pelajaran'
  },
  {
    id: 'keterangan-absensi',
    title: 'Riwayat & Koreksi Absensi',
    href: '/dashboard/keterangan-absensi',
    icon: ClipboardSignature,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Melihat riwayat dan menetapkan koreksi status akhir harian tanpa mengubah absensi asli guru'
  },
  {
    id: 'agenda',
    title: 'Agenda Guru',
    href: '/dashboard/agenda',
    icon: NotebookPen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl'],
    desc: 'Mencatat agenda mengajar harian guru, materi pelajaran, dan absensi piket sesuai jadwal'
  },
  {
    id: 'agenda-kelas',
    title: 'Agenda Kelas',
    href: '/dashboard/agenda-kelas',
    icon: BookOpenCheck,
    roles: ['super_admin', 'admin_tu'],
    desc: 'Memeriksa lembar agenda harian kelas dan mencetak agenda bulanan format resmi'
  },
  {
    id: 'ckh-generator',
    title: 'CKH Generator',
    href: '/dashboard/ckh-generator',
    icon: FilePenLine,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam'],
    desc: 'Membuat, mengedit, menyinkronkan agenda, dan mencetak laporan bulanan Capaian Kinerja Harian (CKH)'
  },
  {
    id: 'tpg-dokumen',
    title: 'Dokumen TPG',
    href: '/dashboard/tpg-dokumen',
    icon: FileArchive,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam'],
    desc: 'Mengunggah formulir S36 bulanan dan menyiapkan berkas persyaratan Tunjangan Profesi Guru (TPG)'
  },
  {
    id: 'documentation',
    title: 'Dokumentasi',
    href: '/dashboard/dokumentasi',
    icon: CircleHelp,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'guru_ppl', 'guru_tahfidz', 'satpam', 'pramubakti', 'operator', 'bendahara_komite'],
    desc: 'Panduan penggunaan dan video tutorial cara menggunakan fitur-fitur sistem MANSATAS'
  },
  {
    id: 'rppm-generator',
    title: 'RPPM Generator',
    href: '/dashboard/rppm-generator',
    icon: ClipboardEdit,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_tahfidz', 'guru_ppl'],
    desc: 'Menyusun dokumen Rencana Pelaksanaan Pembelajaran Madrasah (RPPM) KBC dengan bantuan generator AI'
  },
  {
    id: 'nilai-harian',
    title: 'Nilai Harian',
    href: '/dashboard/nilai-harian',
    icon: BookCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_ppl'],
    desc: 'Memasukkan nilai tugas, ulangan harian, dan ujian semester milik siswa'
  },
  {
    id: 'penugasan',
    title: 'Penugasan',
    href: '/dashboard/penugasan',
    icon: Send,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl'],
    desc: 'Mendelegasikan atau menitipkan tugas mengajar dan absensi kelas ke guru lain saat berhalangan hadir'
  },
  {
    id: 'ekstrakurikuler',
    title: 'Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_ppl', 'guru_tahfidz'],
    desc: 'Mengelola anggota, absensi latihan, presensi pembina, serta input penilaian ekstrakurikuler'
  },
  {
    id: 'ekstrakurikuler-master',
    title: 'Master Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler/master',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengelola daftar kegiatan ekstrakurikuler, penunjukan pembina, dan pemantauan kegiatan'
  },
  {
    id: 'whatsapp',
    title: 'Kirim WhatsApp',
    href: '/dashboard/whatsapp',
    icon: MessageCircle,
    roles: ['super_admin', 'admin_tu', 'bendahara_komite'],
    desc: 'Mengelola antrean (outbox) pengiriman notifikasi otomatis absensi dan siaran pesan WhatsApp via WABLAS'
  },
  {
    id: 'monitoring-agenda',
    title: 'Monitoring Agenda',
    href: '/dashboard/monitoring-agenda',
    icon: Activity,
    roles: ['super_admin', 'admin_tu', 'kepsek'],
    desc: 'Memantau tingkat kepatuhan pengisian agenda mengajar guru, rekap kehadiran, dan cetak laporan'
  },
  {
    id: 'monitoring-penugasan',
    title: 'Monitoring Penugasan',
    href: '/dashboard/monitoring-penugasan',
    icon: Eye,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Memantau status dan pelaksanaan pendelegasian/penitipan tugas mengajar antar guru'
  },
  {
    id: 'monitoring-kedisiplinan',
    title: 'Monitoring Kedisiplinan',
    href: '/dashboard/monitoring-kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'wali_kelas'],
    desc: 'Memantau statistik pelanggar, akumulasi poin, radar siswa berisiko, dan analitik kedisiplinan'
  },
  {
    id: 'rapat',
    title: 'Undangan Rapat',
    href: '/dashboard/rapat',
    icon: Megaphone,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl', 'resepsionis'],
    desc: 'Membuat surat undangan pertemuan dinas digital, notulensi, dan mencatat presensi kehadiran rapat'
  },
  {
    id: 'jadwal-piket',
    title: 'Jadwal Guru Piket',
    href: '/dashboard/jadwal-piket',
    icon: Calendar,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengelola jadwal tugas guru piket harian serta pengaturan shift kerja'
  },
  {
    id: 'izin',
    title: 'Perizinan Siswa',
    href: '/dashboard/izin',
    icon: DoorOpen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam', 'wali_kelas'],
    desc: 'Mengeluarkan tiket izin keluar gerbang sekolah atau izin pulang lebih awal untuk siswa'
  },
  {
    id: 'kedisiplinan',
    title: 'Kedisiplinan',
    href: '/dashboard/kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam', 'guru_ppl', 'wali_kelas'],
    desc: 'Mencatat pelanggaran tata tertib siswa dan mengelola daftar poin aturan sekolah'
  },
  {
    id: 'sp',
    title: 'Surat Peringatan (SP)',
    href: '/dashboard/sp',
    icon: FileWarning,
    roles: ['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk'],
    desc: 'Menetapkan, mencetak, dan memantau status tindak lanjut Surat Peringatan (SP) siswa'
  },
  {
    id: 'sarpras',
    title: 'Sarana Prasarana',
    href: '/dashboard/sarpras',
    icon: PackageSearch,
    roles: ['super_admin', 'admin_tu'],
    desc: 'Mengelola data inventaris barang, kategori aset, ruangan, serta kondisi sarana prasarana'
  },
  {
    id: 'bk',
    title: 'Bimbingan Konseling',
    href: '/dashboard/bk',
    icon: HeartHandshake,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Merekam dan memantau layanan bimbingan konseling pribadi, sosial, belajar, maupun karir siswa'
  },
  {
    id: 'psikotes',
    title: 'Psikotes & Minat',
    href: '/dashboard/psikotes',
    icon: Brain,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk', 'guru'],
    desc: 'Mengelola hasil tes psikologis, bakat, minat, dan rekomendasi pilihan jurusan siswa'
  },
  {
    id: 'analitik',
    title: 'Analitik Akademik',
    href: '/dashboard/analitik',
    icon: LineChart,
    roles: ['super_admin', 'kepsek', 'wakamad'],
    desc: 'Analisis nilai Rapor Digital Madrasah (RDM) dan simulasi pemeringkatan kuota Eligible SNBP'
  },
  {
    id: 'tka',
    title: 'TKA',
    href: '/dashboard/tka',
    icon: FileCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Mengelola pilihan mata pelajaran Tes Kemampuan Akademik (TKA) dan unggah berkas PDF nilai'
  },
  {
    id: 'penerimaan-pt',
    title: 'Penerimaan PT',
    href: '/dashboard/penerimaan-pt',
    icon: Landmark,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Mendata siswa kelas 12 yang diterima di Perguruan Tinggi per jalur seleksi (SNBP, UTBK, dll)'
  },

  {
    id: 'surat',
    title: 'Surat Keluar',
    href: '/dashboard/surat',
    icon: FileText,
    roles: ['super_admin', 'admin_tu', 'wakamad', 'kepsek'],
    desc: 'Membuat dan mengarsipkan berkas surat resmi keluar (keterangan aktif, tugas, dll)'
  },
  {
    id: 'kelola-ppl',
    title: 'Kelola PPL',
    href: '/dashboard/kelola-ppl',
    icon: UserCheck,
    roles: ['super_admin', 'kepsek', 'wakamad'],
    desc: 'Mengatur pendelegasian komponen tugas mengajar atau piket dari guru utama ke mahasiswa PPL'
  },
  {
    id: 'buku-tamu',
    title: 'Buku Tamu',
    href: '/dashboard/buku-tamu',
    icon: BookUser,
    roles: ['resepsionis', 'super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mencatat buku pengunjung yang datang ke sekolah lengkap beserta tujuan keperluannya'
  },
  {
    id: 'pmb',
    title: 'PMB (Penerimaan Baru)',
    href: '/dashboard/pmb',
    icon: GraduationCap,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengelola verifikasi berkas, penjadwalan tes masuk, kelulusan, dan konversi Calon Siswa Baru'
  },
  // ── KEUANGAN ──────────────────────────────────────────────────────
  {
    id: 'keuangan-transaksi',
    title: 'Riwayat Transaksi',
    href: '/dashboard/keuangan/transaksi',
    icon: ReceiptText,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Melihat histori rinci seluruh transaksi pembayaran uang komite lintas siswa'
  },
  {
    id: 'keuangan-daftar-ulang',
    title: 'Kasir Daftar Ulang',
    href: '/dashboard/keuangan/daftar-ulang',
    icon: ClipboardCheck,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Kasir khusus memproses transaksi pembayaran daftar ulang PMB dan mencetak kuitansi'
  },
  {
    id: 'keuangan-dspt',
    title: 'DSPT',
    href: '/dashboard/keuangan/dspt',
    icon: HandCoins,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mengelola tagihan, cicilan, dan rekapitulasi pembayaran Dana Sumbangan Pendidikan Tahunan (DSPT)'
  },
  {
    id: 'keuangan-spp',
    title: 'SPP',
    href: '/dashboard/keuangan/spp',
    icon: CalendarDays,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mencatat pembayaran tunggakan SPP/iuran bulanan masa lalu untuk siswa lama'
  },
  {
    id: 'keuangan-export',
    title: 'Export Excel',
    href: '/dashboard/keuangan/export',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mengunduh rekapitulasi transaksi DSPT dan SPP siswa ke format Excel (.xlsx)'
  },
  {
    id: 'keuangan-kas-keluar',
    title: 'Kas Keluar',
    href: '/dashboard/keuangan/kas-keluar',
    icon: TrendingDown,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mencatat pengeluaran dan penggunaan dana komite untuk operasional madrasah'
  },
  {
    id: 'keuangan-laporan',
    title: 'Laporan Keuangan',
    href: '/dashboard/keuangan/laporan',
    icon: BarChart3,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Melihat ringkasan kas, total transaksi, tunggakan siswa, dan pencetakan laporan bulanan'
  },
  {
    id: 'keuangan-pengaturan',
    title: 'Pengaturan Komite',
    href: '/dashboard/keuangan/pengaturan',
    icon: Settings,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mengonfigurasi rekening tujuan transfer, kontak bendahara, dan QR code pembayaran komite'
  },
  {
    id: 'komite-pengajuan',
    title: 'Pengajuan',
    href: '/dashboard/komite/pengajuan',
    icon: FileCheck,
    roles: ['super_admin', 'kepsek', 'wakamad', 'pembina_ekstrakurikuler', 'bendahara_komite', 'ketua_komite', 'anggota_komite'],
    desc: 'Mengajukan, mereview, dan memantau persetujuan pencairan dana Komite'
  },
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Pengaturan Aplikasi',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['super_admin', 'kepsek', 'admin_tu'],
    desc: 'Mengubah profil identitas sekolah, logo, penentuan tahun ajaran aktif, dan variabel aplikasi'
  },
  {
    id: 'log-aktivitas',
    title: 'Log Aktivitas',
    href: '/dashboard/log-aktivitas',
    icon: Activity,
    roles: ['super_admin'],
    desc: 'Memonitor tindakan kritis pengguna pada data master, akses, dan pengaturan sistem'
  },
  {
    id: 'settings-fitur',
    title: 'Manajemen Fitur',
    href: '/dashboard/settings/fitur',
    icon: SlidersHorizontal,
    roles: ['super_admin'],
    desc: 'Mengatur matriks izin akses fitur per-role, membuat role kustom, dan menata template sidebar'
  },
  {
    id: 'settings-notifications',
    title: 'Broadcast',
    href: '/dashboard/settings/notifications',
    icon: Radio,
    roles: ['super_admin'],
    desc: 'Mengirimkan notifikasi push pengumuman secara langsung ke peramban web pengguna'
  },
  {
    id: 'settings-jadwal-notif',
    title: 'Notifikasi Terjadwal',
    href: '/dashboard/settings/jadwal-notif',
    icon: AlarmClock,
    roles: ['super_admin'],
    desc: 'Mengonfigurasi agenda pengiriman notifikasi push otomatis terjadwal ke target tertentu'
  },
  {
    id: 'settings-mobile-app',
    title: 'Mobile App',
    href: '/dashboard/settings/mobile-app',
    icon: Smartphone,
    roles: ['super_admin'],
    desc: 'Mengonfigurasi fitur native APK seperti kamera, gesture back button, dan info verifikasi'
  },
  {
    id: 'pengumuman-ortu',
    title: 'Pengumuman Ortu',
    href: '/dashboard/pengumuman-ortu',
    icon: Megaphone,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Menerbitkan berita atau surat edaran resmi madrasah untuk beranda Portal Orang Tua'
  },
  {
    id: 'kotak-saran-ortu',
    title: 'Kotak Saran Ortu',
    href: '/dashboard/kotak-saran-ortu',
    icon: MessageSquarePlus,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Membaca dan memantau masukan, saran, atau keluhan dari orang tua siswa'
  },
  {
    id: 'portal-ortu',
    title: 'Portal Orang Tua',
    href: '/portal-ortu',
    icon: BookUser,
    roles: ['orang_tua'],
    desc: 'Halaman dashboard khusus wali murid untuk memantau absensi, poin kedisiplinan, dan tagihan anaknya'
  }
]

export const DEFAULT_SIDEBAR_GROUPS: SidebarGroupConfig[] = [
  { id: 'data-master', label: 'Data Master', items: ['siswa', 'guru', 'kelas', 'plotting', 'ekstrakurikuler-master', 'pmb'] },
  { id: 'tugas-harian-guru', label: 'Tugas Harian Guru', items: ['agenda', 'agenda-kelas', 'ckh-generator', 'rppm-generator', 'kehadiran', 'nilai-harian', 'penugasan', 'ekstrakurikuler'] },
  { id: 'monitoring-akademik', label: 'Monitoring Akademik', items: ['akademik', 'kalender-pendidikan', 'analitik'] },
  { id: 'monitoring-rekap', label: 'Monitoring & Rekap', items: ['monitoring-agenda', 'monitoring-penugasan', 'monitoring-kedisiplinan', 'rekap-absensi', 'akademik-nilai'] },
  { id: 'program-khusus', label: 'Program Khusus', items: ['tahfidz'] },
  { id: 'kesiswaan-bk', label: 'Kesiswaan & BK', items: ['kelas-binaan', 'keterangan-absensi', 'jadwal-piket', 'izin', 'kedisiplinan', 'sp', 'bk', 'psikotes', 'tka', 'penerimaan-pt'] },
  { id: 'administrasi-hr', label: 'Administrasi & HR', items: ['tpg-dokumen', 'documentation', 'surat', 'rapat', 'sarpras', 'kelola-ppl', 'buku-tamu'] },
  { id: 'keuangan', label: 'Komite', items: ['komite-pengajuan', 'keuangan-daftar-ulang', 'keuangan-transaksi', 'keuangan-dspt', 'keuangan-spp', 'keuangan-export', 'keuangan-kas-keluar', 'keuangan-laporan', 'keuangan-pengaturan'] },
  { id: 'sistem', label: 'Sistem', items: ['settings', 'log-aktivitas', 'whatsapp', 'settings-notifications', 'settings-jadwal-notif', 'settings-mobile-app', 'settings-fitur', 'pengumuman-ortu', 'kotak-saran-ortu'] },
]

export const SIDEBAR_ROOT_ITEM_IDS = ['dashboard'] as const
const SIDEBAR_ROOT_ITEM_ID_SET = new Set<string>(SIDEBAR_ROOT_ITEM_IDS)

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
}

export function parseSidebarGroups(raw?: string | null, fallback: SidebarGroupConfig[] = DEFAULT_SIDEBAR_GROUPS): SidebarGroupConfig[] {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback
    const knownIds = new Set(MENU_ITEMS.map(item => item.id))
    const groups = parsed
      .map((group: any, index: number) => ({
        id: typeof group?.id === 'string' && group.id.trim() ? group.id.trim() : `group-${index + 1}`,
        label: typeof group?.label === 'string' && group.label.trim() ? group.label.trim() : `Group ${index + 1}`,
        items: uniqueStrings(group?.items).filter(id => knownIds.has(id) && !SIDEBAR_ROOT_ITEM_ID_SET.has(id)),
      }))
      .filter(group => group.items.length > 0)
    return groups.length > 0 ? groups : fallback
  } catch {
    return fallback
  }
}

export function normalizeSidebarRoleOverride(input: SidebarRoleOverrideConfig): SidebarRoleOverrideConfig {
  const knownIds = new Set(MENU_ITEMS.map(item => item.id))
  const groupOrder = uniqueStrings(input.groupOrder)
  const hiddenGroupIds = uniqueStrings(input.hiddenGroupIds)
  const hiddenItemIds = uniqueStrings(input.hiddenItemIds).filter(id => knownIds.has(id) && !SIDEBAR_ROOT_ITEM_ID_SET.has(id))

  const groupLabels: Record<string, string> = {}
  for (const [groupId, label] of Object.entries(input.groupLabels || {})) {
    if (typeof label === 'string' && label.trim()) groupLabels[groupId] = label.trim()
  }

  const itemPlacements: Record<string, string[]> = {}
  for (const [groupId, items] of Object.entries(input.itemPlacements || {})) {
    const cleanItems = uniqueStrings(items).filter(id => knownIds.has(id) && !SIDEBAR_ROOT_ITEM_ID_SET.has(id))
    if (cleanItems.length > 0 || groupLabels[groupId] || groupOrder.includes(groupId)) itemPlacements[groupId] = cleanItems
  }

  return { groupOrder, groupLabels, itemPlacements, hiddenGroupIds, hiddenItemIds }
}

export function parseSidebarRoleOverride(raw?: string | null): SidebarRoleOverrideConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const legacyGroups = parseSidebarGroups(raw, [])
      return normalizeSidebarRoleOverride({
        groupOrder: legacyGroups.map(group => group.id),
      })
    }
    if (parsed && typeof parsed === 'object') return normalizeSidebarRoleOverride(parsed as SidebarRoleOverrideConfig)
  } catch {}
  return {}
}

export function serializeSidebarRoleOverride(override: SidebarRoleOverrideConfig): string {
  return JSON.stringify(normalizeSidebarRoleOverride(override))
}

export function getSidebarFeatureIds(allowedFeatures: string[] = []): string[] {
  const allowedSet = new Set(allowedFeatures)
  const ids = MENU_ITEMS
    .filter(item =>
      (allowedSet.has(item.id) && !SIDEBAR_ROOT_ITEM_ID_SET.has(item.id)) ||
      (item.id === 'keuangan-transaksi' && allowedSet.has('keuangan-laporan')) ||
      (item.id === 'keuangan-export' && (allowedSet.has('keuangan-dspt') || allowedSet.has('keuangan-spp')))
    )
    .map(item => item.id)
  return Array.from(new Set(ids))
}

export function resolveSidebarGroups(
  template: SidebarGroupConfig[] = DEFAULT_SIDEBAR_GROUPS,
  rawOverride?: string | null,
  allowedFeatures?: string[]
): SidebarGroupConfig[] {
  const override = parseSidebarRoleOverride(rawOverride)
  const sidebarFeatureIds = allowedFeatures ? getSidebarFeatureIds(allowedFeatures) : []
  const allowedSet = allowedFeatures ? new Set(sidebarFeatureIds) : null
  const hiddenGroups = new Set(override.hiddenGroupIds || [])
  const hiddenItems = new Set(override.hiddenItemIds || [])
  const templateMap = new Map(template.map(group => [group.id, group]))
  const placementGroups = Object.keys(override.itemPlacements || {})
  const orderedGroupIds = [
    ...(override.groupOrder || []),
    ...template.map(group => group.id),
    ...placementGroups,
  ].filter((id, index, arr) => id && arr.indexOf(id) === index && !hiddenGroups.has(id))

  const explicitlyPlaced = new Set<string>()
  for (const items of Object.values(override.itemPlacements || {})) {
    for (const itemId of items) explicitlyPlaced.add(itemId)
  }

  const seen = new Set<string>()
  const groups = orderedGroupIds
    .map((groupId, index) => {
      const templateGroup = templateMap.get(groupId)
      const overrideItems = override.itemPlacements?.[groupId]
      const sourceItems = overrideItems ?? (templateGroup?.items || []).filter(id => !explicitlyPlaced.has(id))
      const items = sourceItems.filter(id => {
        if (seen.has(id) || hiddenItems.has(id)) return false
        if (allowedSet && !allowedSet.has(id)) return false
        seen.add(id)
        return true
      })
      const resolvedLabel = override.groupLabels?.[groupId] || templateGroup?.label || `Group ${index + 1}`
      return {
        id: groupId,
        label: groupId === 'keuangan' && resolvedLabel === 'Keuangan' ? 'Komite' : resolvedLabel,
        items,
      }
    })
    .filter(group => group.items.length > 0 || override.groupLabels?.[group.id])

  const knownTemplateIds = new Set(groups.flatMap(group => group.items))
  const unconfiguredAllowedIds = sidebarFeatureIds
    .filter(id => MENU_ITEMS.some(item => item.id === id))
    .filter(id => !knownTemplateIds.has(id) && !hiddenItems.has(id))

  if (unconfiguredAllowedIds.length > 0) {
    const remaining = new Set(unconfiguredAllowedIds)
    // Template sidebar tersimpan bisa berasal dari versi lama. Tempatkan fitur baru
    // ke grup defaultnya agar tidak tiba-tiba muncul di "Lainnya".
    for (const defaultGroup of DEFAULT_SIDEBAR_GROUPS) {
      const additions = defaultGroup.items.filter(id => remaining.has(id))
      if (!additions.length) continue
      const target = groups.find(group => group.id === defaultGroup.id)
      if (target) target.items.push(...additions)
      else groups.push({ id: defaultGroup.id, label: defaultGroup.label, items: additions })
      additions.forEach(id => remaining.delete(id))
    }
    if (remaining.size > 0) groups.push({ id: 'lainnya', label: 'Lainnya', items: Array.from(remaining) })
  }

  return groups.length > 0 ? groups : (allowedFeatures ? [] : template)
}

// Registry semua role yang tersedia di sistem
export const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin_tu', label: 'Admin Tata Usaha' },
  { value: 'kepsek', label: 'Kepala Madrasah' },
  { value: 'wakamad', label: 'Wakil Kepala Madrasah' },
  { value: 'guru', label: 'Guru Mata Pelajaran' },
  { value: 'guru_bk', label: 'Guru BK' },
  { value: 'guru_piket', label: 'Guru Piket' },
  { value: 'guru_tahfidz', label: 'Guru Tahfidz' },
  { value: 'wali_kelas', label: 'Wali Kelas' },
  { value: 'resepsionis', label: 'Resepsionis' },
  { value: 'guru_ppl', label: 'Guru PPL' },
  { value: 'satpam', label: 'Satpam' },
  { value: 'pramubakti', label: 'Pramubakti' },
  { value: 'operator', label: 'Operator EMIS' },
  { value: 'bendahara_komite', label: 'Bendahara Komite' },
  { value: 'ketua_komite', label: 'Ketua Komite' },
  { value: 'anggota_komite', label: 'Anggota Komite' },
  { value: 'pembina_ekstrakurikuler', label: 'Pembina Ekstrakurikuler' },
  { value: 'pengurus_koperasi', label: 'Pengurus Koperasi' },
  { value: 'orang_tua', label: 'Orang Tua Siswa' },
] as const

export type RoleValue = typeof ALL_ROLES[number]['value']

// Helper untuk mendapatkan label role
export function getRoleLabel(role: string): string {
  return ALL_ROLES.find(r => r.value === role)?.label || role.replace(/_/g, ' ')
}
