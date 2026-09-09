import { describe, expect, it } from 'vitest'
import { filterBillingRows, mergeBillingRows, type BillingRow } from './billing-list'

const dspt: Omit<BillingRow, 'source'> = {
  id: 'dspt-1', siswa_id: 'siswa-1', nama_lengkap: 'Alya', nisn: '123', siswa_status: 'aktif',
  tahun_masuk: 2025, tingkat: 11, nomor_kelas: '1', kelompok: null,
  nominal_target: 1_000_000, total_dibayar: 250_000, total_diskon: 0, status: 'nyicil',
  metode_bayar_set: 'transfer', bulan_bayar_set: '2026-09',
}

const baseFilters = { search: '', siswaStatus: 'aktif', status: 'semua', metode: 'semua', angkatan: 'semua', kelas: 'semua', bulan: 'semua' }

describe('daftar gabungan DSPT & SPP', () => {
  it('membuat dua item terpisah untuk siswa yang sama', () => {
    const rows = mergeBillingRows([dspt], [{ ...dspt, id: 'spp-1', jumlah: 400_000, total_dibayar: 100_000, status: 'nyicil' }])
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.source)).toEqual(['DSPT', 'SPP'])
  })

  it('menyaring DSPT, SPP, atau keduanya', () => {
    const rows = mergeBillingRows([dspt], [{ ...dspt, id: 'spp-1', jumlah: 400_000, total_dibayar: 0, status: 'belum_bayar' }])
    expect(filterBillingRows(rows, { ...baseFilters, jenis: 'semua' })).toHaveLength(2)
    expect(filterBillingRows(rows, { ...baseFilters, jenis: 'DSPT' })).toHaveLength(1)
    expect(filterBillingRows(rows, { ...baseFilters, jenis: 'SPP' })[0].source).toBe('SPP')
  })

  it('tidak memasukkan SPP lunas atau tanpa sisa', () => {
    const rows = mergeBillingRows([dspt], [
      { ...dspt, id: 'spp-lunas', jumlah: 100_000, total_dibayar: 100_000, status: 'lunas' },
      { ...dspt, id: 'spp-sisa', jumlah: 200_000, total_dibayar: 50_000, status: 'nyicil' },
    ])
    expect(rows.filter(row => row.source === 'SPP').map(row => row.id)).toEqual(['spp-sisa'])
  })
})
