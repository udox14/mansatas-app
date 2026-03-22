// Lokasi: app/dashboard/akademik/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { BookOpen } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

// Normalize jam_pelajaran: handle format lama (flat) vs baru (PolaJam[])
function normalizePolaJam(raw: string | null): any[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    // Format lama: [{id, nama, mulai, selesai}] — tidak punya field slots/hari
    if (typeof parsed[0].slots === 'undefined' && typeof parsed[0].hari === 'undefined') {
      return [{ id: 'pola_legacy', nama: 'Semua Hari', hari: [1,2,3,4,5,6], slots: parsed }]
    }
    return parsed
  } catch { return [] }
}

async function AkademikDataFetcher() {
  const db = await getDB()

  const [taAktif, mapelResult, guruResult] = await Promise.all([
    db.prepare('SELECT id, nama, semester, daftar_jurusan, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1').first<any>(),
    db.prepare('SELECT id, nama_mapel, kode_mapel, kelompok, tingkat, kategori FROM mata_pelajaran ORDER BY nama_mapel ASC').all<any>(),
    db.prepare(`SELECT id, nama_lengkap FROM "user" WHERE role IN ('guru','guru_bk','wakamad','kepsek','guru_piket') AND nama_lengkap IS NOT NULL ORDER BY nama_lengkap ASC`).all<any>(),
  ])

  let penugasanData: any[] = []
  if (taAktif) {
    const res = await db.prepare(`
      SELECT pm.id, u.nama_lengkap as guru_nama, mp.nama_mapel, mp.kelompok as mapel_kelompok,
        k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
      FROM penugasan_mengajar pm
      JOIN "user" u ON pm.guru_id = u.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      JOIN kelas k ON pm.kelas_id = k.id
      WHERE pm.tahun_ajaran_id = ?
      ORDER BY k.tingkat ASC, k.nomor_kelas ASC, u.nama_lengkap ASC
    `).bind(taAktif.id).all<any>()

    penugasanData = (res.results || []).map((p: any) => ({
      id: p.id,
      guru: { nama_lengkap: p.guru_nama },
      mapel: { nama_mapel: p.nama_mapel, kelompok: p.mapel_kelompok },
      kelas: { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelas_kelompok }
    }))
  }

  const kelasResult = taAktif
    ? await db.prepare('SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat ASC, kelompok ASC, nomor_kelas ASC').all<any>()
    : { results: [] }

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  const polaDaftar = normalizePolaJam(taAktif?.jam_pelajaran ?? null)

  return (
    <AkademikClient
      mapelData={mapelResult.results || []}
      penugasanData={penugasanData}
      taAktif={taAktif ?? null}
      daftarJurusan={daftarJurusan}
      kelasList={kelasResult.results || []}
      guruList={guruResult.results || []}
      polaDaftar={polaDaftar}
    />
  )
}

export default async function AkademikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Pusat Akademik" description="Kelola mata pelajaran, penugasan mengajar, dan jadwal." icon={BookOpen} iconColor="text-emerald-500" />
      <Suspense fallback={<PageLoading text="Memuat pusat akademik..." />}>
        <AkademikDataFetcher />
      </Suspense>
    </div>
  )
}
