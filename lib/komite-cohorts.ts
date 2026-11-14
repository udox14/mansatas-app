import { formatRupiah } from '@/lib/utils'

export async function listActiveKomiteCohorts(db: D1Database) {
  const result = await db.prepare(`
    SELECT DISTINCT s.tahun_masuk AS year FROM siswa s JOIN kelas k ON k.id=s.kelas_id
    WHERE s.status='aktif' AND k.tingkat IN (10,11,12) AND s.tahun_masuk BETWEEN 2000 AND 2199
    ORDER BY year DESC LIMIT 3`).all<{year: number}>()
  return result.results.map(row => row.year)
}

export function cashCohortMetric(income: number, expense: number, balance = income - expense, label = 'Selisih kas') {
  return {
    label, value: formatRupiah(balance),
    details: [{label: 'Dana masuk', value: formatRupiah(income)}, {label: 'Dana keluar', value: formatRupiah(expense)}],
  }
}
