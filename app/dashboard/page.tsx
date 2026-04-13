// Lokasi: app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { nowWIB } from '@/lib/time'
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard'
import { KepsekDashboard }     from '@/components/dashboard/KepsekDashboard'
import { WakamadDashboard }    from '@/components/dashboard/WakamadDashboard'
import { GuruDashboard }       from '@/components/dashboard/GuruDashboard'
import { WaliKelasDashboard }  from '@/components/dashboard/WaliKelasDashboard'
import { GuruBKDashboard }     from '@/components/dashboard/GuruBKDashboard'
import { GuruPiketDashboard }  from '@/components/dashboard/GuruPiketDashboard'
import { ResepsionisDashboard } from '@/components/dashboard/ResepsionisDashboard'
import { GuruPPLDashboard } from '@/components/dashboard/GuruPPLDashboard'

export const metadata = { title: 'Dashboard - MANSATAS App' }
export const dynamic  = 'force-dynamic'

// ── Color theme per role ────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'blue',
  admin_tu:    'blue',
  kepsek:      'purple',
  wakamad:     'cyan',
  guru:        'emerald',
  guru_ppl:    'emerald',
  wali_kelas:  'amber',
  guru_bk:     'rose',
  guru_piket:  'orange',
  resepsionis: 'sky',
  guru_tahfidz:'amber',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_tu:    'Admin Tata Usaha',
  kepsek:      'Kepala Madrasah',
  wakamad:     'Wakil Kepala Madrasah',
  guru:        'Guru Mata Pelajaran',
  guru_bk:     'Guru BK',
  guru_piket:  'Guru Piket',
  wali_kelas:  'Wali Kelas',
  resepsionis: 'Resepsionis',
  guru_ppl:    'Guru PPL',
  guru_tahfidz:'Guru Tahfidz',
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  // Shared minimal fetch — masing-masing dashboard komponen query sendiri
  const [freshUser, taAktif] = await Promise.all([
    db.prepare('SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?')
      .bind(user.id).first<{ nama_lengkap: string; role: string; avatar_url: string | null }>(),
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; nama: string; semester: number }>(),
  ])

  const wib       = nowWIB()
  const hour      = wib.getUTCHours()
  const sapaan    = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'

  const userRole    = freshUser?.role || (user as any).role || 'guru'
  const namaLengkap = freshUser?.nama_lengkap || (user as any).nama_lengkap || user.name || 'Pengguna'
  const namaDepan   = namaLengkap.split(' ')[0]
  const avatarUrl   = freshUser?.avatar_url ?? null
  const roleLabel   = ROLE_LABEL[userRole] ?? userRole.replace(/_/g, ' ')
  const roleColor   = ROLE_COLOR[userRole] ?? 'emerald'

  const commonProps = {
    userId:    user.id,
    nama:      namaLengkap,
    namaDepan,
    avatarUrl,
    roleLabel,
    roleColor,
    sapaan,
    taAktif:   taAktif ?? null,
  }

  switch (userRole) {
    case 'super_admin':
    case 'admin_tu':
      return <SuperAdminDashboard {...commonProps} />

    case 'kepsek':
      return <KepsekDashboard {...commonProps} />

    case 'wakamad':
      return <WakamadDashboard {...commonProps} />

    case 'wali_kelas':
      return <WaliKelasDashboard {...commonProps} />

    case 'guru_bk':
      return <GuruBKDashboard {...commonProps} />

    case 'guru_piket':
      return <GuruPiketDashboard {...commonProps} />

    case 'resepsionis':
      return <ResepsionisDashboard {...commonProps} />

    case 'guru_ppl':
      return <GuruPPLDashboard {...commonProps} />

    case 'guru':
    case 'guru_tahfidz':
    default:
      return <GuruDashboard {...commonProps} />
  }
}
