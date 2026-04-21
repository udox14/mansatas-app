// config/menu.ts
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  AlertTriangle,
  Settings,
  Library,
  Shuffle,
  DoorOpen,
  HeartHandshake,
  Brain,
  FileSpreadsheet,
  ClipboardPen,
  Activity,
  ClipboardList,
  FileText,
  SlidersHorizontal,
  PackageSearch,
  Send,
  Eye,
  Calendar,
  Megaphone,
  Radio,
  AlarmClock,
  ClipboardEdit,
  BookHeart,
  BookUser,
  Wallet,
  HandCoins,
  CalendarDays,
  ShoppingBag,
  TrendingDown,
  BarChart3,
  ClipboardCheck,
  LineChart,
  FileCheck,
  Landmark,
  UserCheck,
  NotebookPen,
  BookCheck,
  ClipboardSignature,
} from 'lucide-react'

export type MenuItem = {
  id: string        // feature_id unik — dipakai di DB role_features
  title: string
  href: string
  icon: any
  roles: string[]   // default roles (fallback jika DB kosong)
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
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis']
  },
  {
    id: 'kedisiplinan',
    title: 'Kedisiplinan',
    href: '/dashboard/kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'guru_ppl', 'wali_kelas']
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
  // ── KEUANGAN ──────────────────────────────────────────────────────
  {
    id: 'keuangan-dashboard',
    title: 'Dashboard Keuangan',
    href: '/dashboard/keuangan',
    icon: Wallet,
    roles: ['super_admin', 'bendahara_komite'],
  },
  {
    id: 'keuangan-daftar-ulang',
    title: 'Kasir Daftar Ulang',
    href: '/dashboard/keuangan/daftar-ulang',
    icon: ClipboardCheck,
    roles: ['super_admin', 'bendahara_komite', 'pengurus_koperasi'],
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
    id: 'keuangan-koperasi',
    title: 'Koperasi',
    href: '/dashboard/keuangan/koperasi',
    icon: ShoppingBag,
    roles: ['super_admin', 'bendahara_komite', 'pengurus_koperasi'],
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
  }
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
] as const

export type RoleValue = typeof ALL_ROLES[number]['value']

// Helper untuk mendapatkan label role
export function getRoleLabel(role: string): string {
  return ALL_ROLES.find(r => r.value === role)?.label || role.replace(/_/g, ' ')
}
