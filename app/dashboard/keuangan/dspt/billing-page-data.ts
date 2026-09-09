import { getDB } from '@/utils/db-server'
import { getDsptList } from '../actions'
import { studentFinanceScopeSql, type StudentFinanceScope } from '../student-finance-scope'

export async function loadBillingPageData(scope: StudentFinanceScope) {
  const db = await getDB()
  const condition = studentFinanceScopeSql(scope)
  const [{ data }, angkatanRes, tunggakanRes] = await Promise.all([
    getDsptList(scope),
    db.prepare(`SELECT DISTINCT tahun_masuk FROM siswa s WHERE tahun_masuk IS NOT NULL AND ${condition} ORDER BY tahun_masuk DESC`).all<{ tahun_masuk: number }>(),
    db.prepare(`
      SELECT sa.id, sa.siswa_id, sa.jumlah, sa.total_dibayar, sa.status, sa.keterangan,
             s.nama_lengkap, s.nisn, s.status AS siswa_status, s.tahun_masuk,
             COALESCE(k.tingkat, (SELECT rk.kelas_tingkat FROM riwayat_kelas rk WHERE rk.siswa_id=s.id ORDER BY rk.created_at DESC LIMIT 1)) AS tingkat,
             COALESCE(k.nomor_kelas, (SELECT rk.kelas_nomor FROM riwayat_kelas rk WHERE rk.siswa_id=s.id ORDER BY rk.created_at DESC LIMIT 1)) AS nomor_kelas,
             COALESCE(k.kelompok, (SELECT rk.kelas_kelompok FROM riwayat_kelas rk WHERE rk.siswa_id=s.id ORDER BY rk.created_at DESC LIMIT 1)) AS kelompok,
             (SELECT GROUP_CONCAT(DISTINCT t.metode_bayar) FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id WHERE td.ref_type='spp_saldo_awal' AND td.ref_id=sa.id AND t.is_void=0) AS metode_bayar_set,
             (SELECT GROUP_CONCAT(DISTINCT strftime('%Y-%m', t.created_at)) FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id WHERE td.ref_type='spp_saldo_awal' AND td.ref_id=sa.id AND t.is_void=0) AS bulan_bayar_set
      FROM fin_spp_saldo_awal sa
      JOIN siswa s ON s.id=sa.siswa_id
      LEFT JOIN kelas k ON k.id=COALESCE(s.kelas_id, s.kelas_id_sebelum_keluar)
      WHERE ${condition} AND sa.status!='lunas' AND sa.jumlah>sa.total_dibayar
      ORDER BY s.nama_lengkap
    `).all<any>(),
  ])
  return {
    data,
    sppData: tunggakanRes.results ?? [],
    angkatanList: (angkatanRes.results ?? []).map(row => row.tahun_masuk),
  }
}
