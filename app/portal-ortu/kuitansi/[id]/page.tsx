import { notFound, redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import type { KuitansiData } from '@/app/dashboard/keuangan/components/kuitansi-print'
import { ParentReceiptPageClient } from './kuitansi-page-client'

export const dynamic = 'force-dynamic'

function kelasLabel(row: any) {
  const parts = [row.tingkat, row.nomor_kelas, row.kelompok].filter(Boolean)
  return parts.length ? parts.join(' ') : '-'
}

function kategoriLabel(kategori: string): KuitansiData['kategori'] {
  if (kategori === 'dspt') return 'DSPT'
  if (kategori === 'spp') return 'SPP'
  return 'Koperasi'
}

export default async function ParentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession()
  if (!session || session.kind !== 'parent') redirect('/portal-ortu/login')

  const { id } = await params
  const db = await getDB()
  const transaksi = await db.prepare(`
    SELECT t.id, t.nomor_kuitansi, t.kategori, t.metode_bayar, t.jumlah_total, t.created_at,
           s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok,
           u.nama_lengkap AS nama_petugas
    FROM fin_transaksi t
    JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN "user" u ON u.id = t.input_oleh
    WHERE t.id = ? AND t.siswa_id = ? AND t.is_void = 0
    LIMIT 1
  `).bind(id, session.user.siswa_id).first<any>()

  if (!transaksi) notFound()

  const detailRows = await db.prepare(`
    SELECT d.ref_type, d.jumlah, st.bulan, st.tahun
    FROM fin_transaksi_detail d
    LEFT JOIN fin_spp_tagihan st ON st.id = d.ref_id
    WHERE d.transaksi_id = ?
    ORDER BY d.rowid ASC
  `).bind(id).all<any>()

  const kategori = String(transaksi.kategori || '').toLowerCase()
  const label = kategoriLabel(kategori)
  const rincianBayar = (detailRows.results || []).map((row: any) => {
    if (row.ref_type === 'spp_tagihan') {
      const bulan = row.bulan ? ` bulan ${row.bulan}` : ''
      const tahun = row.tahun ? ` ${row.tahun}` : ''
      return { label: `Pembayaran SPP${bulan}${tahun}`, nominal: Number(row.jumlah || 0) }
    }
    if (row.ref_type === 'dspt') {
      return { label: 'DSPT - Dana Sumbangan Pendidikan Tahunan', nominal: Number(row.jumlah || 0) }
    }
    return { label: `Pembayaran ${label}`, nominal: Number(row.jumlah || 0) }
  })

  if (rincianBayar.length === 0) {
    rincianBayar.push({ label: `Pembayaran ${label}`, nominal: Number(transaksi.jumlah_total || 0) })
  }

  let sisaTunggakan = 0
  if (kategori === 'dspt') {
    const dspt = await db.prepare(`
      SELECT nominal_target, total_dibayar, total_diskon
      FROM fin_dspt
      WHERE siswa_id = ?
      LIMIT 1
    `).bind(session.user.siswa_id).first<any>()
    if (dspt) {
      sisaTunggakan = Math.max(
        0,
        Number(dspt.nominal_target || 0) - Number(dspt.total_dibayar || 0) - Number(dspt.total_diskon || 0)
      )
    }
  }

  const data: KuitansiData = {
    nomorKuitansi: transaksi.nomor_kuitansi || transaksi.id,
    tanggal: transaksi.created_at,
    kategori: label,
    namaSiswa: transaksi.nama_lengkap || '-',
    nisn: transaksi.nisn || '-',
    kelas: kelasLabel(transaksi),
    namaPerugas: transaksi.nama_petugas || 'Bendahara Komite',
    metodeBayar: transaksi.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer Bank',
    jumlahDiserahkan: Number(transaksi.jumlah_total || 0),
    jumlahTagihan: Number(transaksi.jumlah_total || 0),
    rincianBayar,
    sisaTunggakan: sisaTunggakan > 0 ? [{ label: `Sisa ${label}`, sisa: sisaTunggakan }] : [],
    isLunas: true,
  }

  return <ParentReceiptPageClient data={data} />
}
