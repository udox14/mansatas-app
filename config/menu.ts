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
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'guru_ppl', 'guru_tahfidz', 'satpam', 'pramubakti', 'operator', 'bendahara_komite']
  },
  {
    id: 'siswa',
    title: 'Siswa',
    href: '/dashboard/siswa',
    icon: Users,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'wali_kelas', 'operator', 'bendahara_komite']
  },
  {
    id: 'kelas',
    title: 'Kelas',
    href: '/dashboard/kelas',
    icon: Library,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'plotting',
    title: 'Plotting & Kenaikan',
    href: '/dashboard/plotting',
    icon: Shuffle,
    roles: ['super_admin', 'admin_tu', 'kepsek']
  },
  {
    id: 'akademik',
    title: 'Pusat Akademik',
    href: '/dashboard/akademik',
    icon: BookOpen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'akademik-nilai',
    title: 'Rekap Nilai',
    href: '/dashboard/akademik/nilai',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'kalender-pendidikan',
    title: 'Kalender Pendidikan',
    href: '/dashboard/kalender-pendidikan',
    icon: CalendarDays,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },

  {
    id: 'tahfidz',
    title: 'Tahfidz Qur\'an',
    href: '/dashboard/tahfidz',
    icon: BookHeart,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_tahfidz']
  },
  {
    id: 'guru',
    title: 'Guru & Pegawai',
    href: '/dashboard/guru',
    icon: GraduationCap,
    roles: ['super_admin', 'admin_tu', 'kepsek']
  },
  {
    id: 'kehadiran',
    title: 'Absensi Siswa',
    href: '/dashboard/kehadiran',
    icon: CalendarCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_piket', 'wali_kelas']
  },
  {
    id: 'kelas-binaan',
    title: 'Kelas Binaan',
    href: '/dashboard/kelas-binaan',
    icon: Eye,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas']
  },
  {
    id: 'rekap-absensi',
    title: 'Rekap Absensi',
    href: '/dashboard/rekap-absensi',
    icon: ClipboardList,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas']
  },
  {
    id: 'keterangan-absensi',
    title: 'Keterangan Absensi',
    href: '/dashboard/keterangan-absensi',
    icon: ClipboardSignature,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas']
  },
  {
    id: 'agenda',
    title: 'Agenda Guru',
    href: '/dashboard/agenda',
    icon: NotebookPen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl']
  },
  {
    id: 'agenda-kelas',
    title: 'Agenda Kelas',
    href: '/dashboard/agenda-kelas',
    icon: BookOpenCheck,
    roles: ['super_admin', 'admin_tu']
  },
  {
    id: 'ckh-generator',
    title: 'CKH Generator',
    href: '/dashboard/ckh-generator',
    icon: FilePenLine,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam']
  },
  {
    id: 'tpg-dokumen',
    title: 'Dokumen TPG',
    href: '/dashboard/tpg-dokumen',
    icon: FileArchive,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam']
  },
  {
    id: 'documentation',
    title: 'Dokumentasi',
    href: '/dashboard/dokumentasi',
    icon: CircleHelp,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'guru_ppl', 'guru_tahfidz', 'satpam', 'pramubakti', 'operator', 'bendahara_komite']
  },
  {
    id: 'rppm-generator',
    title: 'RPPM Generator',
    href: '/dashboard/rppm-generator',
    icon: ClipboardEdit,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_tahfidz', 'guru_ppl']
  },
  {
    id: 'nilai-harian',
    title: 'Nilai Harian',
    href: '/dashboard/nilai-harian',
    icon: BookCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_ppl']
  },
  {
    id: 'penugasan',
    title: 'Penugasan',
    href: '/dashboard/penugasan',
    icon: Send,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl']
  },
  {
    id: 'ekstrakurikuler',
    title: 'Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_ppl', 'guru_tahfidz']
  },
  {
    id: 'ekstrakurikuler-master',
    title: 'Master Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler/master',
    icon: Trophy,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'whatsapp',
    title: 'Kirim WhatsApp',
    href: '/dashboard/whatsapp',
    icon: MessageCircle,
    roles: ['super_admin', 'admin_tu', 'bendahara_komite']
  },
  {
    id: 'monitoring-agenda',
    title: 'Monitoring Agenda',
    href: '/dashboard/monitoring-agenda',
    icon: Activity,
    roles: ['super_admin', 'admin_tu', 'kepsek']
  },
  {
    id: 'monitoring-penugasan',
    title: 'Monitoring Penugasan',
    href: '/dashboard/monitoring-penugasan',
    icon: Eye,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'monitoring-kedisiplinan',
    title: 'Monitoring Kedisiplinan',
    href: '/dashboard/monitoring-kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'wali_kelas']
  },
  {
    id: 'rapat',
    title: 'Undangan Rapat',
    href: '/dashboard/rapat',
    icon: Megaphone,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl', 'resepsionis']
  },
  {
    id: 'jadwal-piket',
    title: 'Jadwal Guru Piket',
    href: '/dashboard/jadwal-piket',
    icon: Calendar,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'izin',
    title: 'Perizinan Siswa',
    href: '/dashboard/izin',
    icon: DoorOpen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam', 'wali_kelas']
  },
  {
    id: 'kedisiplinan',
    title: 'Kedisiplinan',
    href: '/dashboard/kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam', 'guru_ppl', 'wali_kelas']
  },
  {
    id: 'sp',
    title: 'Surat Peringatan (SP)',
    href: '/dashboard/sp',
    icon: FileWarning,
    roles: ['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk']
  },
  {
    id: 'sarpras',
    title: 'Sarana Prasarana',
    href: '/dashboard/sarpras',
    icon: PackageSearch,
    roles: ['super_admin', 'admin_tu']
  },
  {
    id: 'bk',
    title: 'Bimbingan Konseling',
    href: '/dashboard/bk',
    icon: HeartHandshake,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk']
  },
  {
    id: 'psikotes',
    title: 'Psikotes & Minat',
    href: '/dashboard/psikotes',
    icon: Brain,
    roles: ['super_admin', 'kepsek', 'wakamad', 'guru_bk', 'guru']
  },
  {
    id: 'analitik',
    title: 'Analitik Akademik',
    href: '/dashboard/analitik',
    icon: LineChart,
    roles: ['super_admin', 'kepsek', 'wakamad']
  },
  {
    id: 'tka',
    title: 'TKA',
    href: '/dashboard/tka',
    icon: FileCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk']
  },
  {
    id: 'penerimaan-pt',
    title: 'Penerimaan PT',
    href: '/dashboard/penerimaan-pt',
    icon: Landmark,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk']
  },

  {
    id: 'surat',
    title: 'Surat Keluar',
    href: '/dashboard/surat',
    icon: FileText,
    roles: ['super_admin', 'admin_tu', 'wakamad', 'kepsek']
  },
  {
    id: 'kelola-ppl',
    title: 'Kelola PPL',
    href: '/dashboard/kelola-ppl',
    icon: UserCheck,
    roles: ['super_admin', 'kepsek', 'wakamad']
  },
  {
    id: 'buku-tamu',
    title: 'Buku Tamu',
    href: '/dashboard/buku-tamu',
    icon: BookUser,
    roles: ['resepsionis', 'super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'pmb',
    title: 'PMB (Penerimaan Baru)',
    href: '/dashboard/pmb',
    icon: GraduationCap,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  // ── KEUANGAN ──────────────────────────────────────────────────────
  {
    id: 'keuangan-transaksi',
    title: 'Riwayat Transaksi',
    href: '/dashboard/keuangan/transaksi',
    icon: ReceiptText,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-daftar-ulang',
    title: 'Kasir Daftar Ulang',
    href: '/dashboard/keuangan/daftar-ulang',
    icon: ClipboardCheck,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-dspt',
    title: 'DSPT',
    href: '/dashboard/keuangan/dspt',
    icon: HandCoins,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-spp',
    title: 'SPP',
    href: '/dashboard/keuangan/spp',
    icon: CalendarDays,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-export',
    title: 'Export Excel',
    href: '/dashboard/keuangan/export',
    icon: FileSpreadsheet,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-kas-keluar',
    title: 'Kas Keluar',
    href: '/dashboard/keuangan/kas-keluar',
    icon: TrendingDown,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-laporan',
    title: 'Laporan Keuangan',
    href: '/dashboard/keuangan/laporan',
    icon: BarChart3,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-pengaturan',
    title: 'Pengaturan Komite',
    href: '/dashboard/keuangan/pengaturan',
    icon: Settings,
    roles: ['super_admin', 'bendahara_komite'],
  },
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Pengaturan Aplikasi',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['super_admin', 'kepsek', 'admin_tu']
  },
  {
    id: 'settings-fitur',
    title: 'Manajemen Fitur',
    href: '/dashboard/settings/fitur',
    icon: SlidersHorizontal,
    roles: ['super_admin']
  },
  {
    id: 'settings-notifications',
    title: 'Broadcast',
    href: '/dashboard/settings/notifications',
    icon: Radio,
    roles: ['super_admin']
  },
  {
    id: 'settings-jadwal-notif',
    title: 'Notifikasi Terjadwal',
    href: '/dashboard/settings/jadwal-notif',
    icon: AlarmClock,
    roles: ['super_admin']
  },
  {
    id: 'settings-mobile-app',
    title: 'Mobile App',
    href: '/dashboard/settings/mobile-app',
    icon: Smartphone,
    roles: ['super_admin']
  },
  {
    id: 'pengumuman-ortu',
    title: 'Pengumuman Ortu',
    href: '/dashboard/pengumuman-ortu',
    icon: Megaphone,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas']
  },
  {
    id: 'kotak-saran-ortu',
    title: 'Kotak Saran Ortu',
    href: '/dashboard/kotak-saran-ortu',
    icon: MessageSquarePlus,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    id: 'portal-ortu',
    title: 'Portal Orang Tua',
    href: '/portal-ortu',
    icon: BookUser,
    roles: ['orang_tua']
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
