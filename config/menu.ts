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

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'guru_ppl', 'guru_tahfidz', 'satpam', 'pramubakti', 'operator', 'bendahara_komite'],
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
    desc: 'Mengelola mata pelajaran, kurikulum, serta pengaturan bobot nilai akademik'
  },
  {
    id: 'akademik-nilai',
    title: 'Rekap Nilai',
    href: '/dashboard/akademik/nilai',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Melihat dan mencetak rekapitulasi nilai rapor atau ujian dari seluruh kelas'
  },
  {
    id: 'kalender-pendidikan',
    title: 'Kalender Pendidikan',
    href: '/dashboard/kalender-pendidikan',
    icon: CalendarDays,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mengatur jadwal ujian, hari libur, dan event penting sekolah sepanjang tahun ajaran'
  },

  {
    id: 'tahfidz',
    title: 'Tahfidz Qur\'an',
    href: '/dashboard/tahfidz',
    icon: BookHeart,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_tahfidz'],
    desc: 'Mencatat setoran hafalan Al-Qur\'an, juz yang diselesaikan, serta rekap tilawah harian siswa'
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
    desc: 'Pantauan khusus wali kelas terhadap kehadiran, nilai, dan rekap pelanggaran anak didiknya'
  },
  {
    id: 'rekap-absensi',
    title: 'Rekap Absensi',
    href: '/dashboard/rekap-absensi',
    icon: ClipboardList,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Melihat persentase kehadiran siswa atau kelas dalam rentang waktu tertentu'
  },
  {
    id: 'keterangan-absensi',
    title: 'Keterangan Absensi',
    href: '/dashboard/keterangan-absensi',
    icon: ClipboardSignature,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Memproses surat izin atau keterangan sakit siswa untuk diverifikasi ke rekap kehadiran'
  },
  {
    id: 'agenda',
    title: 'Agenda Guru',
    href: '/dashboard/agenda',
    icon: NotebookPen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl'],
    desc: 'Mencatat jurnal mengajar guru setelah selesai memberikan materi di kelas'
  },
  {
    id: 'agenda-kelas',
    title: 'Agenda Kelas',
    href: '/dashboard/agenda-kelas',
    icon: BookOpenCheck,
    roles: ['super_admin', 'admin_tu'],
    desc: 'Melihat riwayat keseluruhan aktivitas belajar mengajar yang telah berlangsung di suatu kelas'
  },
  {
    id: 'ckh-generator',
    title: 'CKH Generator',
    href: '/dashboard/ckh-generator',
    icon: FilePenLine,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam'],
    desc: 'Membuat dokumen Catatan Kinerja Harian (CKH) untuk keperluan administrasi dan laporan pegawai'
  },
  {
    id: 'tpg-dokumen',
    title: 'Dokumen TPG',
    href: '/dashboard/tpg-dokumen',
    icon: FileArchive,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam'],
    desc: 'Mengunggah dan memverifikasi berkas persyaratan Tunjangan Profesi Guru (TPG)'
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
    desc: 'Menyusun Rencana Pelaksanaan Pembelajaran Madrasah dengan template otomatis'
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
    desc: 'Memberikan PR, materi bacaan, atau tugas terstruktur kepada siswa secara online'
  },
  {
    id: 'ekstrakurikuler',
    title: 'Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_ppl', 'guru_tahfidz'],
    desc: 'Mencatat daftar kehadiran peserta dan perkembangan siswa di kegiatan ekstrakurikuler'
  },
  {
    id: 'ekstrakurikuler-master',
    title: 'Master Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler/master',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Mendaftarkan program ekstrakurikuler baru beserta data pembina yang bertanggung jawab'
  },
  {
    id: 'whatsapp',
    title: 'Kirim WhatsApp',
    href: '/dashboard/whatsapp',
    icon: MessageCircle,
    roles: ['super_admin', 'admin_tu', 'bendahara_komite'],
    desc: 'Mengirimkan pesan siaran (broadcast) atau tagihan via WhatsApp langsung ke nomor wali siswa'
  },
  {
    id: 'monitoring-agenda',
    title: 'Monitoring Agenda',
    href: '/dashboard/monitoring-agenda',
    icon: Activity,
    roles: ['super_admin', 'admin_tu', 'kepsek'],
    desc: 'Mengecek laporan secara real-time terkait guru mana saja yang belum mengisi jurnal mengajar hari ini'
  },
  {
    id: 'monitoring-penugasan',
    title: 'Monitoring Penugasan',
    href: '/dashboard/monitoring-penugasan',
    icon: Eye,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Memantau beban siswa dengan melihat seberapa banyak tugas yang diberikan guru'
  },
  {
    id: 'monitoring-kedisiplinan',
    title: 'Monitoring Kedisiplinan',
    href: '/dashboard/monitoring-kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'wali_kelas'],
    desc: 'Memantau statistik pelanggaran tata tertib dan daftar siswa dengan poin disiplin terekstrem'
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
    desc: 'Mengatur jadwal pembagian tugas guru piket harian untuk menjaga ketertiban lingkungan'
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
    desc: 'Mencatat jenis dan poin pelanggaran siswa beserta riwayat sanksi yang telah ditindaklanjuti'
  },
  {
    id: 'sp',
    title: 'Surat Peringatan (SP)',
    href: '/dashboard/sp',
    icon: FileWarning,
    roles: ['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk'],
    desc: 'Menerbitkan Surat Peringatan (SP) untuk siswa yang telah melampaui batas wajar poin pelanggaran'
  },
  {
    id: 'sarpras',
    title: 'Sarana Prasarana',
    href: '/dashboard/sarpras',
    icon: PackageSearch,
    roles: ['super_admin', 'admin_tu'],
    desc: 'Mendata inventaris barang, daftar ruangan, serta menampung laporan kerusakan fasilitas sekolah'
  },
  {
    id: 'bk',
    title: 'Bimbingan Konseling',
    href: '/dashboard/bk',
    icon: HeartHandshake,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Mencatat jadwal konseling harian, kunjungan rumah (home visit), dan rekap penyelesaian kasus siswa'
  },
  {
    id: 'psikotes',
    title: 'Psikotes & Minat',
    href: '/dashboard/psikotes',
    icon: Brain,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk', 'guru'],
    desc: 'Menyimpan hasil tes psikologi siswa untuk rekomendasi penjurusan dan bakat minat'
  },
  {
    id: 'analitik',
    title: 'Analitik Akademik',
    href: '/dashboard/analitik',
    icon: LineChart,
    roles: ['super_admin', 'kepsek', 'wakamad'],
    desc: 'Melihat grafik tren perkembangan nilai dan kualitas akademik sekolah dari tahun ke tahun'
  },
  {
    id: 'tka',
    title: 'TKA',
    href: '/dashboard/tka',
    icon: FileCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Melakukan pendataan nilai Tes Kemampuan Akademik sebagai instrumen evaluasi pendidikan'
  },
  {
    id: 'penerimaan-pt',
    title: 'Penerimaan PT',
    href: '/dashboard/penerimaan-pt',
    icon: Landmark,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk'],
    desc: 'Mendata jejak alumni yang berhasil diterima melalui Seleksi Nasional Perguruan Tinggi (SNBP/SNBT)'
  },

  {
    id: 'surat',
    title: 'Surat Keluar',
    href: '/dashboard/surat',
    icon: FileText,
    roles: ['super_admin', 'admin_tu', 'wakamad', 'kepsek'],
    desc: 'Mencetak dan mengarsipkan template surat resmi seperti keterangan siswa aktif atau surat tugas'
  },
  {
    id: 'kelola-ppl',
    title: 'Kelola PPL',
    href: '/dashboard/kelola-ppl',
    icon: UserCheck,
    roles: ['super_admin', 'kepsek', 'wakamad'],
    desc: 'Mendata mahasiswa Praktik Pengalaman Lapangan (PPL) dan memasangkannya dengan guru pamong'
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
    desc: 'Mengelola alur pendaftaran, seleksi, penyaringan, hingga penetapan Calon Peserta Didik Baru'
  },
  // ── KEUANGAN ──────────────────────────────────────────────────────
  {
    id: 'keuangan-transaksi',
    title: 'Riwayat Transaksi',
    href: '/dashboard/keuangan/transaksi',
    icon: ReceiptText,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Melihat histori rinci seluruh pembayaran uang komite yang disetor oleh siswa ke dalam sistem'
  },
  {
    id: 'keuangan-daftar-ulang',
    title: 'Kasir Daftar Ulang',
    href: '/dashboard/keuangan/daftar-ulang',
    icon: ClipboardCheck,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Dashboard kasir khusus untuk memproses transaksi pembayaran daftar ulang di awal tahun'
  },
  {
    id: 'keuangan-dspt',
    title: 'DSPT',
    href: '/dashboard/keuangan/dspt',
    icon: HandCoins,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mencatat penerimaan dan rekapitulasi pelunasan Dana Sumbangan Pendidikan Tahunan (DSPT)'
  },
  {
    id: 'keuangan-spp',
    title: 'SPP',
    href: '/dashboard/keuangan/spp',
    icon: CalendarDays,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mencatat penerimaan iuran bulanan SPP siswa sekaligus untuk mencetak struk transaksinya'
  },
  {
    id: 'keuangan-export',
    title: 'Export Excel',
    href: '/dashboard/keuangan/export',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mengunduh rekap transaksi keuangan harian atau bulanan ke dalam format spreadsheet Excel/CSV'
  },
  {
    id: 'keuangan-kas-keluar',
    title: 'Kas Keluar',
    href: '/dashboard/keuangan/kas-keluar',
    icon: TrendingDown,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mencatat pengeluaran uang komite untuk membiayai operasional dan kebutuhan madrasah'
  },
  {
    id: 'keuangan-laporan',
    title: 'Laporan Keuangan',
    href: '/dashboard/keuangan/laporan',
    icon: BarChart3,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Melihat buku besar, neraca saldo, arus kas, dan ringkasan keuangan komite secara komprehensif'
  },
  {
    id: 'keuangan-pengaturan',
    title: 'Pengaturan Komite',
    href: '/dashboard/keuangan/pengaturan',
    icon: Settings,
    roles: ['super_admin', 'bendahara_komite'],
    desc: 'Mengonfigurasi nominal tagihan SPP dan persentase DSPT yang berbeda untuk tiap angkatan'
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
    id: 'settings-fitur',
    title: 'Manajemen Fitur',
    href: '/dashboard/settings/fitur',
    icon: SlidersHorizontal,
    roles: ['super_admin'],
    desc: 'Menghidupkan atau mematikan modul tertentu agar tidak muncul di hak akses peran/role'
  },
  {
    id: 'settings-notifications',
    title: 'Broadcast',
    href: '/dashboard/settings/notifications',
    icon: Radio,
    roles: ['super_admin'],
    desc: 'Mengirimkan notifikasi push pengumuman secara serentak ke perangkat para pengguna'
  },
  {
    id: 'settings-jadwal-notif',
    title: 'Notifikasi Terjadwal',
    href: '/dashboard/settings/jadwal-notif',
    icon: AlarmClock,
    roles: ['super_admin'],
    desc: 'Menyiapkan agenda pesan pengingat otomatis yang akan dikirim pada waktu yang ditentukan'
  },
  {
    id: 'settings-mobile-app',
    title: 'Mobile App',
    href: '/dashboard/settings/mobile-app',
    icon: Smartphone,
    roles: ['super_admin'],
    desc: 'Pengaturan peringatan update versi minimum dan merubah banner informasi di aplikasi Android'
  },
  {
    id: 'pengumuman-ortu',
    title: 'Pengumuman Ortu',
    href: '/dashboard/pengumuman-ortu',
    icon: Megaphone,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas'],
    desc: 'Menerbitkan surat edaran atau berita madrasah yang akan langsung tertampil di beranda orang tua'
  },
  {
    id: 'kotak-saran-ortu',
    title: 'Kotak Saran Ortu',
    href: '/dashboard/kotak-saran-ortu',
    icon: MessageSquarePlus,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    desc: 'Membaca dan merespon masukan perbaikan atau keluhan anonim dari keluarga siswa'
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
  { id: 'utama', label: 'Utama', items: ['dashboard'] },
  { id: 'data-master', label: 'Data Master', items: ['siswa', 'guru', 'kelas', 'plotting', 'ekstrakurikuler-master', 'pmb'] },
  { id: 'tugas-harian-guru', label: 'Tugas Harian Guru', items: ['agenda', 'agenda-kelas', 'ckh-generator', 'rppm-generator', 'kehadiran', 'nilai-harian', 'penugasan', 'ekstrakurikuler'] },
  { id: 'monitoring-akademik', label: 'Monitoring Akademik', items: ['akademik', 'kalender-pendidikan', 'analitik'] },
  { id: 'monitoring-rekap', label: 'Monitoring & Rekap', items: ['monitoring-agenda', 'monitoring-penugasan', 'monitoring-kedisiplinan', 'rekap-absensi', 'akademik-nilai'] },
  { id: 'program-khusus', label: 'Program Khusus', items: ['tahfidz'] },
  { id: 'kesiswaan-bk', label: 'Kesiswaan & BK', items: ['kelas-binaan', 'keterangan-absensi', 'jadwal-piket', 'izin', 'kedisiplinan', 'sp', 'bk', 'psikotes', 'tka', 'penerimaan-pt'] },
  { id: 'administrasi-hr', label: 'Administrasi & HR', items: ['tpg-dokumen', 'documentation', 'surat', 'rapat', 'sarpras', 'kelola-ppl', 'buku-tamu'] },
  { id: 'keuangan', label: 'Keuangan', items: ['keuangan-daftar-ulang', 'keuangan-transaksi', 'keuangan-dspt', 'keuangan-spp', 'keuangan-export', 'keuangan-kas-keluar', 'keuangan-laporan', 'keuangan-pengaturan'] },
  { id: 'sistem', label: 'Sistem', items: ['settings', 'whatsapp', 'settings-notifications', 'settings-jadwal-notif', 'settings-mobile-app', 'settings-fitur', 'pengumuman-ortu', 'kotak-saran-ortu'] },
]

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
  { value: 'pengurus_koperasi', label: 'Pengurus Koperasi' },
  { value: 'orang_tua', label: 'Orang Tua Siswa' },
] as const

export type RoleValue = typeof ALL_ROLES[number]['value']

// Helper untuk mendapatkan label role
export function getRoleLabel(role: string): string {
  return ALL_ROLES.find(r => r.value === role)?.label || role.replace(/_/g, ' ')
}
