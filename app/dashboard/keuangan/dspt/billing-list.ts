export type BillingSource = 'DSPT' | 'SPP'

export interface BillingRow {
  id: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string
  siswa_status: string
  tahun_masuk: number
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada'
  catatan?: string | null
  metode_bayar_set?: string | null
  bulan_bayar_set?: string | null
  source: BillingSource
}

export function mergeBillingRows(dsptRows: Omit<BillingRow, 'source'>[], sppRows: any[]): BillingRow[] {
  return [
    ...dsptRows.map(row => ({ ...row, source: 'DSPT' as const })),
    ...sppRows
      .filter(row => row.status !== 'lunas' && Number(row.jumlah) > Number(row.total_dibayar || 0))
      .map(row => ({
        ...row,
        source: 'SPP' as const,
        nisn: row.nisn ?? '',
        tahun_masuk: row.tahun_masuk ?? 0,
        nomor_kelas: row.nomor_kelas == null ? null : String(row.nomor_kelas),
        nominal_target: Number(row.jumlah || 0),
        total_dibayar: Number(row.total_dibayar || 0),
        total_diskon: 0,
        catatan: row.keterangan,
      })),
  ]
}

export function filterBillingRows(rows: BillingRow[], filters: {
  jenis: 'semua' | BillingSource
  search: string
  siswaStatus: string
  status: string
  metode: string
  angkatan: string
  kelas: string
  bulan: string
}) {
  const term = filters.search.trim().toLowerCase()
  return rows.filter(row => {
    const kelas = row.tingkat && row.nomor_kelas
      ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ` ${row.kelompok}` : ''}`
      : '-'
    const methods = String(row.metode_bayar_set ?? '').split(',').map(value => value.trim())
    return (filters.jenis === 'semua' || row.source === filters.jenis)
      && (!term || row.nama_lengkap.toLowerCase().includes(term) || row.nisn.toLowerCase().includes(term))
      && (filters.siswaStatus === 'semua' || row.siswa_status === filters.siswaStatus)
      && (filters.status === 'semua' || row.status === filters.status)
      && (filters.metode === 'semua' || (filters.metode === 'tunai'
        ? methods.includes('tunai')
        : methods.some(value => value === 'transfer' || value === 'qris')))
      && (filters.angkatan === 'semua' || String(row.tahun_masuk) === filters.angkatan)
      && (filters.kelas === 'semua' || kelas === filters.kelas)
      && (filters.bulan === 'semua' || row.source === 'SPP' || String(row.bulan_bayar_set ?? '').includes(filters.bulan))
  })
}
