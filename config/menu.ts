// TIMPA SELURUH ISI FILE INI
// Lokasi: config/menu.ts
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
  LineChart
} from 'lucide-react'

export type MenuItem = {
  title: string
  href: string
  icon: any
  roles: string[] // Role apa saja yang bisa melihat menu ini
}

export const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'satpam', 'pramubakti', 'wali_murid']
  },
  {
    title: 'Data Siswa',
    href: '/dashboard/siswa',
    icon: Users,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk']
  },
  {
    title: 'Manajemen Kelas',
    href: '/dashboard/kelas',
    icon: Library,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    title: 'Plotting & Kenaikan',
    href: '/dashboard/plotting',
    icon: Shuffle,
    roles: ['super_admin', 'admin_tu', 'kepsek']
  },
  {
    title: 'Pusat Akademik',
    href: '/dashboard/akademik',
    icon: BookOpen,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad']
  },
  {
    title: 'Analitik Kelulusan',
    href: '/dashboard/akademik/analitik',
    icon: LineChart,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk']
  },
  {
    title: 'Guru & Pegawai',
    href: '/dashboard/guru',
    icon: GraduationCap,
    roles: ['super_admin', 'admin_tu', 'kepsek']
  },
  {
    title: 'Kehadiran & Jurnal',
    href: '/dashboard/kehadiran',
    icon: CalendarCheck,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_piket', 'wali_murid']
  },
  {
    title: 'Kedisiplinan',
    href: '/dashboard/kedisiplinan',
    icon: AlertTriangle,
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'satpam', 'pramubakti', 'wali_murid']
  },
  {
    title: 'Pengaturan',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['super_admin']
  }
]