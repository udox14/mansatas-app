import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getUserRoles: vi.fn(),
  dbSelectOne: vi.fn(),
  dbUpdate: vi.fn(),
  syncSiswaRiwayatKelas: vi.fn(),
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  db: { prepare: vi.fn() },
}))

vi.mock('@/utils/db', () => ({
  dbInsert: vi.fn(),
  dbUpdate: mocks.dbUpdate,
  dbDelete: vi.fn(),
  dbSelectOne: mocks.dbSelectOne,
  dbBatchInsert: vi.fn(),
  serializeValue: (v: unknown) => v ?? null,
}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => mocks.db }))
vi.mock('@/utils/r2', () => ({
  uploadFotoSiswa: vi.fn(),
  validateImageFile: vi.fn(),
  deleteFromR2: vi.fn(),
}))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/features', () => ({ getUserRoles: mocks.getUserRoles }))
vi.mock('@/lib/riwayat-kelas', () => ({ syncSiswaRiwayatKelas: mocks.syncSiswaRiwayatKelas }))
vi.mock('@/lib/activity-log', () => ({
  createActivityDiff: vi.fn(() => ({})),
  logActivity: mocks.logActivity,
}))

import { editSiswaLengkap } from './actions'

const existingStudent = {
  id: 'siswa-1',
  nisn: '0083508503',
  nama_lengkap: 'AGNI NURUL AULIA',
  kelas_id: 'kelas-12-4',
  status: 'aktif',
  tahun_masuk: 2024,
  anak_ke: 1,
  jumlah_saudara: 2,
  alamat_lengkap: 'Kp. Lama',
  pekerjaan_ayah: 'Wiraswasta',
}

describe('editSiswaLengkap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', name: 'Admin TU' })
    mocks.getUserRoles.mockResolvedValue(['admin_tu'])
    mocks.dbSelectOne.mockResolvedValue({ ...existingStudent })
    mocks.dbUpdate.mockResolvedValue({ success: true, error: null })
    mocks.logActivity.mockResolvedValue('log-1')
  })

  it('tidak mengosongkan tahun_masuk, anak_ke, atau jumlah_saudara saat formData hanya mengirim field sebagian', async () => {
    const fd = new FormData()
    fd.set('id', 'siswa-1')
    fd.set('$ACTION_ID_abc', 'internal-marker')
    fd.set('alamat_lengkap', 'Kp. Baru')
    fd.set('pekerjaan_ayah', 'Buruh Harian Lepas')

    const res = await editSiswaLengkap(null, fd)

    expect(res).toEqual({ error: null, success: 'Biodata lengkap berhasil diperbarui!' })
    expect(mocks.dbUpdate).toHaveBeenCalledTimes(1)
    const updatePayload = mocks.dbUpdate.mock.calls[0][2] as Record<string, unknown>
    expect(updatePayload).toMatchObject({
      alamat_lengkap: 'Kp. Baru',
      pekerjaan_ayah: 'Buruh Harian Lepas',
    })
    expect(updatePayload).not.toHaveProperty('tahun_masuk')
    expect(updatePayload).not.toHaveProperty('anak_ke')
    expect(updatePayload).not.toHaveProperty('jumlah_saudara')
    expect(updatePayload).not.toHaveProperty('$ACTION_ID_abc')
  })

  it('menyimpan seluruh field multi-tab dan merevalidasi view keuangan saat tahun_masuk berubah', async () => {
    const fd = new FormData()
    fd.set('id', 'siswa-1')
    fd.set('nisn', '0083508503')
    fd.set('nama_lengkap', 'AGNI NURUL AULIA')
    fd.set('tahun_masuk', '2025')
    fd.set('anak_ke', '1')
    fd.set('jumlah_saudara', '2')
    fd.set('kelas_id', 'none')
    fd.set('alamat_lengkap', 'Jl. Sukahideng')
    fd.set('nama_ayah', 'Ahmad')

    const res = await editSiswaLengkap(null, fd)

    expect(res).toEqual({ error: null, success: 'Biodata lengkap berhasil diperbarui!' })
    const updatePayload = mocks.dbUpdate.mock.calls[0][2] as Record<string, unknown>
    expect(updatePayload).toMatchObject({
      tahun_masuk: 2025,
      anak_ke: 1,
      jumlah_saudara: 2,
      kelas_id: null,
      alamat_lengkap: 'Jl. Sukahideng',
      nama_ayah: 'Ahmad',
    })
    expect(mocks.syncSiswaRiwayatKelas).toHaveBeenCalledWith(mocks.db, 'siswa-1', null)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/keuangan/dspt')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/keuangan/siswa/siswa-1')
  })

  it('menolak nilai tahun_masuk tidak valid tanpa menulis ke database', async () => {
    const fd = new FormData()
    fd.set('id', 'siswa-1')
    fd.set('nisn', '0083508503')
    fd.set('nama_lengkap', 'AGNI NURUL AULIA')
    fd.set('tahun_masuk', '1995')

    const res = await editSiswaLengkap(null, fd)

    expect(res.error).toContain('Tahun masuk')
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
  })

  it('menolak nisn atau nama_lengkap kosong', async () => {
    const fd = new FormData()
    fd.set('id', 'siswa-1')
    fd.set('nisn', '   ')
    fd.set('nama_lengkap', 'AGNI NURUL AULIA')

    const res = await editSiswaLengkap(null, fd)

    expect(res.error).toContain('NISN wajib diisi')
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
  })
})
