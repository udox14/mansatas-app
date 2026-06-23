// Lokasi: app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { nowWIB } from '@/lib/time'
import { getUserRoles, getUserAllowedFeatures } from '@/lib/features'
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard'
import { KepsekDashboard }     from '@/components/dashboard/KepsekDashboard'
import { WakamadDashboard }    from '@/components/dashboard/WakamadDashboard'
import { GuruDashboard }       from '@/components/dashboard/GuruDashboard'
import { KelasBinaanDashboard }  from '@/components/dashboard/KelasBinaanDashboard'
import { GuruBKDashboard }     from '@/components/dashboard/GuruBKDashboard'
import { GuruPiketDashboard }  from '@/components/dashboard/GuruPiketDashboard'
import { ResepsionisDashboard } from '@/components/dashboard/ResepsionisDashboard'
import { GuruPPLDashboard } from '@/components/dashboard/GuruPPLDashboard'
import { BendaharaDashboard } from '@/components/dashboard/BendaharaDashboard'
import { DashboardSPAShell } from '@/components/dashboard/shared/DashboardSPAShell'

export const metadata = { title: 'Dashboard - MANSATAS App' }
export const dynamic  = 'force-dynamic'

// ── Color theme per role ────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'emerald',
  admin_tu:    'emerald',
  kepsek:      'emerald',
  wakamad:     'emerald',
  guru:        'emerald',
  guru_ppl:    'emerald',
  wali_kelas:  'emerald',
  guru_bk:     'emerald',
  guru_piket:  'emerald',
  resepsionis: 'emerald',
  guru_tahfidz:'emerald',
  bendahara_komite:   'emerald',
  pengurus_koperasi:  'emerald',
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
  bendahara_komite:   'Bendahara Komite',
  pengurus_koperasi:  'Pengurus Koperasi',
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  // Shared minimal fetch — masing-masing dashboard komponen query sendiri
  const [freshUser, taAktif, userRoles, allowedFeatures] = await Promise.all([
    db.prepare('SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?')
      .bind(user.id).first<{ nama_lengkap: string; role: string; avatar_url: string | null }>(),
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; nama: string; semester: number }>(),
    getUserRoles(db, user.id),
    getUserAllowedFeatures(db, user.id),
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
  const isGuruPiket = userRoles.includes('guru_piket')

  let featureLabels: Record<string, string> = {}
  try {
    const featureLabelRows = await db.prepare('SELECT feature_id, title FROM feature_display_settings').all<{ feature_id: string; title: string }>()
    for (const row of featureLabelRows.results ?? []) {
      featureLabels[row.feature_id] = row.title
    }
  } catch (e) {}

  const commonProps = {
    userId:    user.id,
    nama:      namaLengkap,
    namaDepan,
    avatarUrl,
    roleLabel,
    roleColor,
    sapaan,
    taAktif:   taAktif ?? null,
    isGuruPiket,
    userRoles,
    primaryRole: userRole,
  }

  const dashboardContent = (() => {
    switch (userRole) {
      case 'super_admin':
      case 'admin_tu':
        return <SuperAdminDashboard {...commonProps} />

      case 'kepsek':
        return <KepsekDashboard {...commonProps} />

      case 'wakamad':
        return <WakamadDashboard {...commonProps} />

      case 'wali_kelas':
        return <KelasBinaanDashboard {...commonProps} />

      case 'guru_bk':
        return <GuruBKDashboard {...commonProps} />

      case 'guru_piket':
        return <GuruPiketDashboard {...commonProps} />

      case 'resepsionis':
        return <ResepsionisDashboard {...commonProps} />

      case 'guru_ppl':
        return <GuruPPLDashboard {...commonProps} />

      case 'bendahara_komite':
      case 'pengurus_koperasi':
        return <BendaharaDashboard {...commonProps} />

      case 'guru':
      case 'guru_tahfidz':
      default:
        return <GuruDashboard {...commonProps} />
    }
  })()

  return (
    <DashboardSPAShell allowedFeatures={allowedFeatures} featureLabels={featureLabels}>
      {dashboardContent}
    </DashboardSPAShell>
  )
}
