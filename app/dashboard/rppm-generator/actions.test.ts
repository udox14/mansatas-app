import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyRppmContent, emptyRppmPackage } from '@/lib/rppm'
import { saveRppmDocument } from './actions'

const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'guru-1' }) }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({ prepare }) }))
vi.mock('@/lib/features', () => ({
  checkFeatureAccess: async () => true,
  getUserRoles: async () => ['guru_ppl'],
}))

const spec = {
  satuan_pendidikan: 'MAN 1 Tasikmalaya',
  mata_pelajaran: 'Matematika',
  kelas_semester: 'XI / Ganjil',
  topik_pembelajaran: 'Tabel frekuensi',
  alokasi_waktu: '2 JP',
}

describe('Penyimpanan RPPM', () => {
  beforeEach(() => prepare.mockReset())

  it('menolak final untuk dokumen baru meski penanda paket tidak dikirim', async () => {
    const result = await saveRppmDocument({
      template_type: 'discovery-learning',
      status: 'FINAL',
      content: emptyRppmContent(spec),
    })
    expect(result.error).toContain('Impor paket RPPM lengkap')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('memakai format tersimpan ketika validasi final dokumen yang sudah ada', async () => {
    const bind = vi.fn(() => ({
      first: async () => ({ template_type: 'discovery-learning', content_json: JSON.stringify(emptyRppmPackage(spec)) }),
    }))
    prepare.mockReturnValue({ bind })

    const result = await saveRppmDocument({
      id: 'paket-1',
      template_type: 'discovery-learning',
      status: 'FINAL',
      content: emptyRppmContent(spec),
    })

    expect(result.error).toContain('Impor paket RPPM lengkap')
    expect(bind).toHaveBeenCalledWith('paket-1', 'guru-1')
    expect(prepare).toHaveBeenCalledTimes(1)
  })
})
