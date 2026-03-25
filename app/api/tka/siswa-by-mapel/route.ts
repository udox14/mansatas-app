// app/api/tka/siswa-by-mapel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/utils/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const ta = searchParams.get('ta')
  const mapel = searchParams.get('mapel')
  const pilihan = searchParams.get('pilihan')

  if (!ta || !mapel || !pilihan) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const col = pilihan === '1' ? 'mapel_pilihan_1' : 'mapel_pilihan_2'
  const db = await getDB()

  const rows = await db.prepare(`
    SELECT s.nama_lengkap, s.nisn, k.nomor_kelas, k.kelompok
    FROM tka_mapel_pilihan t
    JOIN siswa s ON s.id = t.siswa_id
    JOIN kelas k ON k.id = s.kelas_id
    WHERE t.tahun_ajaran_id = ? AND t.${col} = ?
    ORDER BY k.nomor_kelas, s.nama_lengkap
  `).bind(ta, mapel).all()

  return NextResponse.json({ rows: rows.results })
}
