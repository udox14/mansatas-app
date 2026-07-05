import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getPrimaryRole } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { AkademikInputWizard } from '../components/akademik-input-wizard'

export const metadata = { title: 'Input Bertahap Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

function normalizePolaJam(raw: string | null): any[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    if (typeof parsed[0].slots === 'undefined' && typeof parsed[0].hari === 'undefined') {
      return [{ id: 'pola_legacy', nama: 'Semua Hari', hari: [1, 2, 3, 4, 5, 6], slots: parsed }]
    }
    return parsed
  } catch {
    return []
  }
}

export default async function AkademikInputBertahapPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'akademik')
  if (!allowed) redirect('/dashboard')

  const userRole = await getPrimaryRole(db, user.id)
  const [taAktif, mapelResult, guruResult] = await Promise.all([
    db.prepare('SELECT id, nama, semester, daftar_jurusan, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1').first<any>(),
    db.prepare('SELECT id, nama_mapel, kode_mapel, kode_asc, kelompok, tingkat, kategori FROM mata_pelajaran ORDER BY nama_mapel ASC').all<any>(),
    db.prepare(`SELECT id, nama_lengkap FROM "user" WHERE nama_lengkap IS NOT NULL ORDER BY nama_lengkap ASC`).all<any>(),
  ])

  const kelasResult = taAktif
    ? await db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat ASC, kelompok ASC, nomor_kelas ASC').all<any>()
    : { results: [] }

  const polaDaftar = normalizePolaJam(taAktif?.jam_pelajaran ?? null)
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Input Bertahap Akademik"
        description="Isi master mapel, beban mengajar, dan jadwal melalui checkpoint draft."
      >
        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
          <Link href="/dashboard/akademik">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Pusat Akademik
          </Link>
        </Button>
      </PageHeader>

      <AkademikInputWizard
        taAktif={taAktif ?? null}
        kelasList={kelasResult.results || []}
        guruList={guruResult.results || []}
        mapelData={mapelResult.results || []}
        polaDaftar={polaDaftar}
        userRole={userRole}
      />
    </div>
  )
}
