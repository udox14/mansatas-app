import { describe, expect, it, vi } from 'vitest'

import { loadSanksiList } from './sanksi-service'

describe('loadSanksiList', () => {
  it('loads discipline configuration without depending on an action session', async () => {
    const rows = [
      {
        id: 'warning',
        nama: 'Peringatan',
        deskripsi: null,
        poin_minimal: 1,
        urutan: 1,
      },
    ]
    const all = vi.fn().mockResolvedValue({ results: rows })
    const prepare = vi.fn().mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM sanksi_config')) {
        return { all }
      }

      return { run: vi.fn().mockResolvedValue({ success: true }) }
    })
    const db = { prepare } as unknown as D1Database

    await expect(loadSanksiList(db)).resolves.toEqual(rows)
    expect(all).toHaveBeenCalledOnce()
  })
})
