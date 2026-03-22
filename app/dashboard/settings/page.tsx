// Lokasi: app/dashboard/settings/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { SettingsClient } from './components/settings-client'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Pengaturan Global - MANSATAS App' }

// Normalize jam_pelajaran: handle format lama (flat array) vs baru (PolaJam[])
function normalizeJamPelajaran(raw: string | null): any[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    // Format lama: [{id:1, nama:"Jam 1", mulai:"08:00", selesai:"08:40"}, ...]
    // Ciri: tidak punya field "slots" atau "hari"
    if (parsed[0] && typeof parsed[0].slots === 'undefined' && typeof parsed[0].hari === 'undefined') {
      // Convert format lama → format baru: 1 pola "Semua Hari"
      return [{
        id: 'pola_legacy',
        nama: 'Semua Hari',
        hari: [1, 2, 3, 4, 5, 6],
        slots: parsed,
      }]
    }
    // Format baru: sudah PolaJam[]
    return parsed
  } catch {
    return []
  }
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!['super_admin', 'kepsek', 'admin_tu'].includes(role)) redirect('/dashboard')

  const db = await getDB()
  const taResult = await db.prepare(
    'SELECT id, nama, semester, is_active, daftar_jurusan, jam_pelajaran FROM tahun_ajaran ORDER BY nama DESC, semester DESC'
  ).all<any>()

  const taData = (taResult.results || []).map((ta: any) => ({
    ...ta,
    daftar_jurusan: (() => {
      try { return JSON.parse(ta.daftar_jurusan || '[]') }
      catch { return ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM'] }
    })(),
    jam_pelajaran: normalizeJamPelajaran(ta.jam_pelajaran),
  }))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pengaturan Sistem"
        description="Kelola kalender akademik, jurusan, dan jam pelajaran."
        icon={Settings}
        iconColor="text-slate-500 dark:text-slate-400"
      />
      <SettingsClient taData={taData} />
    </div>
  )
}
