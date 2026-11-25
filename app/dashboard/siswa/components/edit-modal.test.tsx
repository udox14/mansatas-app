import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ name, defaultValue, children }: { name?: string; defaultValue?: string; children: React.ReactNode }) => (
    <div data-select-name={name} data-default-value={defaultValue}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-option-value={value}>{children}</div>
  ),
}))

vi.mock('../actions', () => ({
  editSiswaLengkap: vi.fn(async () => ({ error: null, success: null })),
}))

import { EditSiswaModal } from './edit-modal'

const sampleSiswa = {
  id: 'siswa-1',
  nisn: '0083508503',
  nis_lokal: '240078',
  nama_lengkap: 'AGNI NURUL AULIA',
  jenis_kelamin: 'P',
  agama: 'Islam',
  tahun_masuk: 2024,
  anak_ke: 1,
  jumlah_saudara: 2,
  status_anak: 'Kandung',
  status: 'aktif',
  kelas_id: 'k-12',
  tempat_tinggal: 'Pesantren Sukamanah',
  alamat_lengkap: 'Kp. Contoh RT 01',
  nama_ayah: 'Bapak Contoh',
  nama_ibu: 'Ibu Contoh',
}

describe('EditSiswaModal', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React)
  })

  it('merender seluruh input dari tab utama, alamat, dan ortu sekaligus agar tidak hilang saat pindah tab', () => {
    const html = renderToStaticMarkup(
      <EditSiswaModal
        isOpen
        onClose={vi.fn()}
        siswa={sampleSiswa}
        kelasList={[{ id: 'k-12', tingkat: 12, nomor_kelas: '4', kelompok: 'MIPA-FISIKA' }]}
      />
    )

    expect(html).toMatch(/novalidate/i)
    expect(html).toContain('name="tahun_masuk"')
    expect(html).toContain('value="2024"')
    expect(html).toContain('name="anak_ke"')
    expect(html).toContain('name="jumlah_saudara"')
    expect(html).toContain('name="alamat_lengkap"')
    expect(html).toContain('value="Kp. Contoh RT 01"')
    expect(html).toContain('name="nama_ayah"')
    expect(html).toContain('value="Bapak Contoh"')
    expect(html).toContain('data-[state=inactive]:hidden')
    expect(html).toContain('data-select-name="status_anak" data-default-value="Anak Kandung"')
    expect(html).toContain('data-option-value="Anak Kandung"')
  })

  it('tidak merender form saat modal tertutup', () => {
    const html = renderToStaticMarkup(
      <EditSiswaModal
        isOpen={false}
        onClose={vi.fn()}
        siswa={sampleSiswa}
        kelasList={[]}
      />
    )

    expect(html).toBe('')
  })
})
