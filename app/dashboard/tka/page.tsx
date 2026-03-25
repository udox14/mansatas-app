// app/dashboard/tka/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { TkaClient } from './components/TkaClient'
import { ALLOWED_ROLES_TKA } from '@/lib/tka/types'

export const metadata = { title: 'TKA - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function TkaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!ALLOWED_ROLES_TKA.includes(role)) redirect('/dashboard')

  const db = await getDB()

  const ta = await db.prepare(
    `SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`
  ).first<{ id: string; nama: string; semester: string }>()

  if (!ta) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <PageHeader
          title="Tes Kemampuan Akademik (TKA)"
          description="Pengelolaan mapel pilihan dan hasil TKA siswa kelas 12."
          icon={ClipboardList}
          iconColor="text-sky-500"
        />
        <p className="text-sm text-muted-foreground">Belum ada tahun ajaran aktif.</p>
      </div>
    )
  }

  // Siswa kelas 12 — join langsung via kelas_id di tabel siswa
  const siswaRows = await db.prepare(`
    SELECT
      s.id, s.nisn, s.nama_lengkap,
      k.tingkat, k.nomor_kelas, k.kelompok,
      t.mapel_pilihan_1, t.mapel_pilihan_2
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id AND k.tingkat = 3
    LEFT JOIN tka_mapel_pilihan t
      ON t.siswa_id = s.id AND t.tahun_ajaran_id = ?
    WHERE s.status = 'aktif'
    ORDER BY k.kelompok, k.nomor_kelas, s.nama_lengkap
  `).bind(ta.id).all<{
    id: string; nisn: string; nama_lengkap: string
    tingkat: number; nomor_kelas: number; kelompok: string
    mapel_pilihan_1: string | null; mapel_pilihan_2: string | null
  }>()

  const [rekapP1, rekapP2] = await Promise.all([
    db.prepare(`SELECT mapel_pilihan_1 as mapel, COUNT(*) as count FROM tka_mapel_pilihan WHERE tahun_ajaran_id=? AND mapel_pilihan_1 IS NOT NULL GROUP BY mapel_pilihan_1 ORDER BY count DESC`).bind(ta.id).all<{ mapel: string; count: number }>(),
    db.prepare(`SELECT mapel_pilihan_2 as mapel, COUNT(*) as count FROM tka_mapel_pilihan WHERE tahun_ajaran_id=? AND mapel_pilihan_2 IS NOT NULL GROUP BY mapel_pilihan_2 ORDER BY count DESC`).bind(ta.id).all<{ mapel: string; count: number }>(),
  ])

  const hasilRows = await db.prepare(`
    SELECT h.id, h.siswa_id, h.raw_nama_pdf, h.nomor_peserta,
      h.nilai_bind, h.nilai_mat, h.nilai_bing,
      h.mapel_p1, h.nilai_p1, h.mapel_p2, h.nilai_p2, h.match_confidence,
      s.nama_lengkap AS nama_siswa,
      CASE WHEN k.id IS NOT NULL THEN ('XII ' || k.kelompok || ' ' || k.nomor_kelas) ELSE NULL END AS kelas_nama
    FROM tka_hasil h
    LEFT JOIN siswa s ON s.id = h.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE h.tahun_ajaran_id = ?
    ORDER BY h.raw_nama_pdf
  `).bind(ta.id).all<any>()

  const [analitikAvg, analitikDist, top10, popularP1, popularP2] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total_peserta, ROUND(AVG(nilai_bind),2) as avg_bind, ROUND(AVG(nilai_mat),2) as avg_mat, ROUND(AVG(nilai_bing),2) as avg_bing FROM tka_hasil WHERE tahun_ajaran_id=?`).bind(ta.id).first<any>(),
    db.prepare(`SELECT SUM(CASE WHEN nilai_bind>=56 THEN 1 ELSE 0 END) as bind_istimewa, SUM(CASE WHEN nilai_bind>=41 AND nilai_bind<56 THEN 1 ELSE 0 END) as bind_baik, SUM(CASE WHEN nilai_bind>=26 AND nilai_bind<41 THEN 1 ELSE 0 END) as bind_memadai, SUM(CASE WHEN nilai_bind<26 THEN 1 ELSE 0 END) as bind_kurang, SUM(CASE WHEN nilai_mat>=56 THEN 1 ELSE 0 END) as mat_istimewa, SUM(CASE WHEN nilai_mat>=41 AND nilai_mat<56 THEN 1 ELSE 0 END) as mat_baik, SUM(CASE WHEN nilai_mat>=26 AND nilai_mat<41 THEN 1 ELSE 0 END) as mat_memadai, SUM(CASE WHEN nilai_mat<26 THEN 1 ELSE 0 END) as mat_kurang, SUM(CASE WHEN nilai_bing>=56 THEN 1 ELSE 0 END) as bing_istimewa, SUM(CASE WHEN nilai_bing>=41 AND nilai_bing<56 THEN 1 ELSE 0 END) as bing_baik, SUM(CASE WHEN nilai_bing>=26 AND nilai_bing<41 THEN 1 ELSE 0 END) as bing_memadai, SUM(CASE WHEN nilai_bing<26 THEN 1 ELSE 0 END) as bing_kurang FROM tka_hasil WHERE tahun_ajaran_id=?`).bind(ta.id).first<any>(),
    db.prepare(`SELECT h.raw_nama_pdf, s.nama_lengkap, ROUND((COALESCE(h.nilai_bind,0)+COALESCE(h.nilai_mat,0)+COALESCE(h.nilai_bing,0)+COALESCE(h.nilai_p1,0)+COALESCE(h.nilai_p2,0))/5.0,2) as rata_rata, h.nilai_bind, h.nilai_mat, h.nilai_bing FROM tka_hasil h LEFT JOIN siswa s ON s.id=h.siswa_id WHERE h.tahun_ajaran_id=? AND h.siswa_id IS NOT NULL ORDER BY rata_rata DESC LIMIT 10`).bind(ta.id).all<any>(),
    db.prepare(`SELECT mapel_p1 as mapel, COUNT(*) as count FROM tka_hasil WHERE tahun_ajaran_id=? AND mapel_p1 IS NOT NULL GROUP BY mapel_p1 ORDER BY count DESC LIMIT 8`).bind(ta.id).all<any>(),
    db.prepare(`SELECT mapel_p2 as mapel, COUNT(*) as count FROM tka_hasil WHERE tahun_ajaran_id=? AND mapel_p2 IS NOT NULL GROUP BY mapel_p2 ORDER BY count DESC LIMIT 8`).bind(ta.id).all<any>(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Tes Kemampuan Akademik (TKA)"
        description={`Tahun Ajaran ${ta.nama} — Semester ${ta.semester} · Kelas 12`}
        icon={ClipboardList}
        iconColor="text-sky-500"
      />
      <TkaClient
        siswaList={siswaRows.results}
        rekap={{ pilihan1: rekapP1.results, pilihan2: rekapP2.results }}
        hasilList={hasilRows.results}
        analitik={{ avg: analitikAvg, dist: analitikDist, top10: top10.results, popularP1: popularP1.results, popularP2: popularP2.results }}
        tahunAjaranId={ta.id}
      />
    </div>
  )
}
