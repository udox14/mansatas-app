import { describe, expect, it } from 'vitest'
import { getKbmExceptionClassIds, kbmExceptionAppliesToClass, splitTeachingSlotsByExceptions, type KbmException } from './kalender-pendidikan'

const exception = (overrides: Partial<KbmException> = {}): KbmException => ({
  id: 'exception-1', tanggal: '2026-10-06', judul: 'Pembinaan', kategori: 'KEGIATAN_MADRASAH',
  jam_ke_mulai: 2, jam_ke_selesai: 3, target_type: 'KELAS', target_value: '["kelas-a","kelas-b"]',
  description: null, ...overrides,
})

describe('KBM exception class selection', () => {
  it('supports legacy single-class records and deduplicates multiple classes', () => {
    expect(getKbmExceptionClassIds('kelas-a')).toEqual(['kelas-a'])
    expect(getKbmExceptionClassIds('["kelas-a","kelas-b","kelas-a"]')).toEqual(['kelas-a', 'kelas-b'])
    expect(kbmExceptionAppliesToClass(exception({ target_value: 'kelas-a' }), { id: 'kelas-a', tingkat: 10 })).toBe(true)
    expect(kbmExceptionAppliesToClass(exception({ target_value: 'kelas-a' }), { id: 'kelas-b', tingkat: 10 })).toBe(false)
  })

  it('excludes only selected classes and the specified hours', () => {
    for (const id of ['kelas-a', 'kelas-b']) {
      const result = splitTeachingSlotsByExceptions([exception()], { id, tingkat: 10 }, [1, 2, 3, 4])
      expect(result.activeJamKe).toEqual([1, 4])
      expect(result.exceptionSegments).toMatchObject([{ exception_id: 'exception-1', jam_ke_mulai: 2, jam_ke_selesai: 3 }])
    }
    expect(splitTeachingSlotsByExceptions([exception()], { id: 'kelas-c', tingkat: 10 }, [1, 2, 3, 4]).activeJamKe).toEqual([1, 2, 3, 4])
  })

  it('preserves all-class and grade targets', () => {
    expect(kbmExceptionAppliesToClass(exception({ target_type: 'ALL', target_value: null }), { id: 'kelas-c', tingkat: 10 })).toBe(true)
    expect(kbmExceptionAppliesToClass(exception({ target_type: 'TINGKAT', target_value: '10' }), { id: 'kelas-c', tingkat: 10 })).toBe(true)
    expect(kbmExceptionAppliesToClass(exception({ target_type: 'TINGKAT', target_value: '10' }), { id: 'kelas-c', tingkat: 11 })).toBe(false)
  })

  it('does not apply empty or malformed lists to a class', () => {
    for (const value of [null, '', '[]', '[broken', '["kelas-a",2]']) {
      expect(getKbmExceptionClassIds(value)).toEqual([])
      expect(kbmExceptionAppliesToClass(exception({ target_value: value }), { id: 'kelas-a', tingkat: 10 })).toBe(false)
    }
  })
})
