import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { nowWIB } from '@/lib/time'
import { getUserRoles } from '@/lib/features'
import { getAccessibleWaliKelasClasses } from '@/lib/wali-kelas-attendance'
import { PageHeader } from '@/components/layout/page-header'
import { KelasBinaanDashboard } from '@/components/dashboard/KelasBinaanDashboard'
import { KelasSelector } from './components/kelas-selector'

export const metadata = { title: 'Kelas Binaan - MANSATAS App' }
export const dynamic = 'force-dynamic'

const ROLE_COLOR: Record<string, string> = {
  super_admin: 'blue',
  admin_tu: 'blue',
  kepsek: 'purple',
  wakamad: 'cyan',
  wali_kelas: 'amber',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_tu: 'Admin Tata Usaha',
  kepsek: 'Kepala Madrasah',
  wakamad: 'Wakil Kepala Madrasah',
  wali_kelas: 'Wali Kelas',
}

export default async function KelasBinaanPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string; risiko?: string }>
}) {
  const { kelas: kelasId, risiko } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const canAccess = roles.some(role => ['wali_kelas', 'super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
  if (!canAccess) redirect('/dashboard')

  const [freshUser, taAktif, kelasList] = await Promise.all([
    db.prepare('SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?')
      .bind(user.id).first<{ nama_lengkap: string; role: string; avatar_url: string | null }>(),
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
      .first<{ id: string; nama: string; semester: number }>(),
    getAccessibleWaliKelasClasses(db, user.id, roles),
  ])

  if (kelasList.length === 0) redirect('/dashboard')

  const selectedKelasId = kelasId && kelasList.some(item => item.id === kelasId)
    ? kelasId
    : kelasList[0].id

  const wib = nowWIB()
  const hour = wib.getUTCHours()
  const sapaan = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const userRole = freshUser?.role || (user as any).role || 'wali_kelas'
  const namaLengkap = freshUser?.nama_lengkap || (user as any).nama_lengkap || user.name || 'Pengguna'
  const namaDepan = namaLengkap.split(' ')[0]
  const avatarUrl = freshUser?.avatar_url ?? null
  const isWaliKelasOnly =
    roles.includes('wali_kelas') &&
    !roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kelas Binaan"
        description="Pantau status hadir sekolah, koreksi absensi, kedisiplinan, dan daftar siswa binaan dari satu halaman."
      />

      {kelasList.length > 1 && (
        isWaliKelasOnly ? (
          <div className="rounded-xl border border-surface bg-surface shadow-sm p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Pilih Kelas</p>
            <div className="flex flex-wrap gap-2">
              {kelasList.map(item => (
                <Link
                  key={item.id}
                  href={`/dashboard/kelas-binaan?kelas=${item.id}`}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    item.id === selectedKelasId
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <KelasSelector
            kelasList={kelasList.map(({ id, label }) => ({ id, label }))}
            selectedKelasId={selectedKelasId}
          />
        )
      )}

      <KelasBinaanDashboard
        userId={user.id}
        nama={namaLengkap}
        namaDepan={namaDepan}
        avatarUrl={avatarUrl}
        roleLabel={ROLE_LABEL[userRole] ?? 'Wali Kelas'}
        roleColor={ROLE_COLOR[userRole] ?? 'amber'}
        sapaan={sapaan}
        taAktif={taAktif ?? null}
        kelasIdOverride={selectedKelasId}
        riskFilter={risiko || 'all'}
        showWelcome={false}
        showTopCards={false}
        showFeatureShortcuts={false}
      />
    </div>
  )
}
