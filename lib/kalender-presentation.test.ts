import { describe, expect, it } from 'vitest'
import {
  kalenderDateStatusFromEvents,
  kalenderEventAppliesToClass,
  kalenderHolidayExceptionsForRange,
  splitTeachingSlotsByExceptions,
  type KalenderEvent,
} from './kalender-pendidikan'

const event = (overrides: Partial<KalenderEvent> = {}): KalenderEvent => ({
  id: 'holiday',
  start_date: '2026-10-02',
  end_date: '2026-10-04',
  title: 'Libur sekolah',
  category: 'LAINNYA',
  is_effective: 0,
  source: 'official',
  external_id: null,
  description: null,
  target_type: 'ALL',
  target_value: null,
  ...overrides,
})

describe('calendar presentation uses existing holiday precedence', () => {
  it('distinguishes holidays and effective dates across a batched range', () => {
    const events = [event()]
    expect(kalenderDateStatusFromEvents('2026-10-02', events)).toMatchObject({ isEffective: false, reason: 'Libur sekolah' })
    expect(kalenderDateStatusFromEvents('2026-10-05', events)).toMatchObject({ isEffective: true, reason: null, events: [] })
    expect(kalenderDateStatusFromEvents('2026-10-04', [])).toMatchObject({ isEffective: false, reason: 'Minggu' })
  })

  it('respects a manual effective-day override even on a Sunday', () => {
    const events = [event(), event({ id: 'manual', source: 'manual', is_effective: 1, title: 'KBM pengganti' })]
    expect(kalenderDateStatusFromEvents('2026-10-04', events)).toMatchObject({ isEffective: true, reason: 'KBM pengganti' })
  })
})

describe('libur hanya untuk tingkat/kelas tertentu', () => {
  const tingkat12 = event({
    id: 'libur-12',
    title: 'Libur kelas 12',
    category: 'LIBUR_SEMESTER',
    is_effective: 0,
    source: 'manual',
    target_type: 'TINGKAT',
    target_value: '12',
  })

  it('tidak mengubah status madrasah, tetapi mengubah status kelas 12', () => {
    expect(kalenderDateStatusFromEvents('2026-10-02', [tingkat12])).toMatchObject({ isEffective: true, reason: null })
    expect(kalenderDateStatusFromEvents('2026-10-02', [tingkat12], { tingkat: 12 })).toMatchObject({
      isEffective: false,
      reason: 'Libur kelas 12',
    })
    expect(kalenderDateStatusFromEvents('2026-10-02', [tingkat12], { tingkat: 10 })).toMatchObject({
      isEffective: true,
      reason: null,
    })
  })

  it('mendukung beberapa tingkat sekaligus dan kelas spesifik', () => {
    const multi = event({ target_type: 'TINGKAT', target_value: JSON.stringify(['10', '11']), source: 'manual' })
    expect(kalenderDateStatusFromEvents('2026-10-02', [multi], { tingkat: 10 }).isEffective).toBe(false)
    expect(kalenderDateStatusFromEvents('2026-10-02', [multi], { tingkat: 11 }).isEffective).toBe(false)
    expect(kalenderDateStatusFromEvents('2026-10-02', [multi], { tingkat: 12 }).isEffective).toBe(true)

    const kelas = event({ target_type: 'KELAS', target_value: JSON.stringify(['k1', 'k2']), source: 'manual' })
    expect(kalenderEventAppliesToClass(kelas, { id: 'k2', tingkat: 12 })).toBe(true)
    expect(kalenderEventAppliesToClass(kelas, { id: 'k3', tingkat: 12 })).toBe(false)
  })

  it('mengabaikan event khusus kelas lain saat status madrasah dihitung', () => {
    const global = event({ id: 'global', source: 'manual' })
    const events = [tingkat12, global]
    expect(kalenderDateStatusFromEvents('2026-10-02', events)).toMatchObject({ isEffective: false, reason: 'Libur sekolah' })
  })

  it('menjadikan libur lintas kelas sebagai pengecualian sehari penuh', () => {
    const exceptions = kalenderHolidayExceptionsForRange([tingkat12], '2026-10-01', '2026-10-31')
    expect(exceptions).toHaveLength(3)
    expect(exceptions[0]).toMatchObject({
      tanggal: '2026-10-02',
      judul: 'Libur kelas 12',
      target_type: 'TINGKAT',
      target_value: '12',
      jam_ke_mulai: 1,
      jam_ke_selesai: 20,
    })

    const state = splitTeachingSlotsByExceptions(exceptions, { id: 'kelas-12a', tingkat: 12 }, [1, 2, 3])
    expect(state.activeJamKe).toEqual([])

    const other = splitTeachingSlotsByExceptions(exceptions, { id: 'kelas-10a', tingkat: 10 }, [1, 2, 3])
    expect(other.activeJamKe).toEqual([1, 2, 3])
  })

  it('tidak mengubah hari efektif menjadi pengecualian KBM', () => {
    const effective = event({
      id: 'kbm-pengganti',
      source: 'manual',
      is_effective: 1,
      target_type: 'TINGKAT',
      target_value: '12',
    })
    expect(kalenderHolidayExceptionsForRange([effective], '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('tidak menambah pengecualian untuk libur semua kelas', () => {
    expect(kalenderHolidayExceptionsForRange([event()], '2026-10-01', '2026-10-31')).toEqual([])
  })
})
