import { describe, expect, it, vi } from 'vitest'
import { dbSelect } from './db'

function databaseMock() {
  const all = vi.fn().mockResolvedValue({ results: [], success: true })
  const bind = vi.fn().mockReturnValue({ all })
  const prepare = vi.fn().mockReturnValue({ bind })
  return { db: { prepare } as unknown as D1Database, prepare }
}

describe('D1 identifier hardening', () => {
  it('quotes allowlisted tables and validated columns', async () => {
    const { db, prepare } = databaseMock()
    await dbSelect(db, 'siswa', { id: 'student-1' }, { columns: 'id,nama_lengkap', orderBy: 'nama_lengkap' })
    expect(prepare).toHaveBeenCalledWith('SELECT "id", "nama_lengkap" FROM "siswa" WHERE "id" = ? ORDER BY "nama_lengkap"')
  })

  it('rejects unknown tables and injected columns/order clauses', async () => {
    const { db } = databaseMock()
    await expect(dbSelect(db, 'siswa; DROP TABLE siswa')).rejects.toThrow('allowlisted')
    await expect(dbSelect(db, 'siswa', undefined, { columns: 'id, (SELECT 1)' })).rejects.toThrow('identifier')
    await expect(dbSelect(db, 'siswa', undefined, { orderBy: 'id DESC; DROP TABLE siswa' })).rejects.toThrow('identifier')
  })
})
