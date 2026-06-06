// Lokasi: app/dashboard/guru/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'
import { ensureJabatanStrukturalSchema } from './actions'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

async function GuruDataFetcher() {
  const db = await getDB()
  await ensureJabatanStrukturalSchema(db)

  const [usersResult, userRolesResult, masterRolesResult, masterJabatanResult] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.nama_lengkap, u.avatar_url, u.nip, u.jabatan_cetak, u.nomor_whatsapp,
        u.jabatan_struktural_id, mjs.nama AS jabatan_struktural_nama
      FROM "user" u
      LEFT JOIN master_jabatan_struktural mjs ON u.jabatan_struktural_id = mjs.id
      ORDER BY u.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`
      SELECT user_id, role FROM user_roles ORDER BY user_id
    `).all<{ user_id: string; role: string }>(),
    db.prepare(`
      SELECT value, label, is_custom FROM master_roles ORDER BY is_custom ASC, label ASC
    `).all<{ value: string; label: string; is_custom: number }>(),
    db.prepare(`
      SELECT id, nama, urutan FROM master_jabatan_struktural ORDER BY urutan ASC, nama ASC
    `).all<{ id: string; nama: string; urutan: number }>(),
  ])

  const userRolesMap: Record<string, string[]> = {}
  for (const row of userRolesResult.results || []) {
    if (!userRolesMap[row.user_id]) userRolesMap[row.user_id] = []
    userRolesMap[row.user_id].push(row.role)
  }

  const mergedData = (usersResult.results || []).map((u: any) => ({
    id: u.id,
    nama_lengkap: u.nama_lengkap || u.name || '',
    role: u.role || '',
    avatar_url: u.avatar_url || null,
    nip: u.nip || null,
    jabatan_cetak: u.jabatan_cetak || null,
    nomor_whatsapp: u.nomor_whatsapp || null,
    jabatan_struktural_id: u.jabatan_struktural_id || null,
    jabatan_struktural_nama: u.jabatan_struktural_nama || null,
    roles: userRolesMap[u.id] || (u.role ? [u.role] : []),
    email: u.email || 'Email tidak ditemukan',
  }))

  return (
    <GuruClient
      initialData={mergedData}
      masterRoles={masterRolesResult.results || []}
      masterJabatanStruktural={masterJabatanResult.results || []}
    />
  )
}

export const dynamic = 'force-dynamic'
export default async function GuruPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'guru')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Guru & Pegawai" description="Kelola data pendidik, hak akses, dan role pengguna." />
      <Suspense fallback={<PageLoading text="Memuat data kepegawaian..." />}>
        <GuruDataFetcher />
      </Suspense>
    </div>
  )
}
