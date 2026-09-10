import { expect, it } from 'vitest'
import { getDashboardPeriod, type LessonPattern } from './dashboard-period'

const patterns: LessonPattern[] = [{ hari: [1, 2, 3, 4, 5, 6], slots: [
  { nama: 'Jam 1', mulai: '07:00', selesai: '07:45' },
  { nama: 'Jam 2', mulai: '08:00', selesai: '08:45' },
] }]

it.each([
  ['2026-09-10T00:15:00Z', 'Jam ke-1'],
  ['2026-09-10T00:00:00Z', 'Jam ke-1'],
  ['2026-09-10T00:45:00Z', 'Jam ke-1'],
  ['2026-09-10T00:50:00Z', 'Istirahat'],
  ['2026-09-10T01:00:00Z', 'Jam ke-2'],
  ['2026-09-09T23:50:00Z', 'Belum Mulai'],
  ['2026-09-10T02:00:00Z', 'Pulang'],
  ['2026-09-12T18:00:00Z', 'Hari Libur'],
])('uses WIB for %s → %s', (date, label) => {
  expect(getDashboardPeriod(new Date(date), patterns)).toBe(label)
})

it('handles missing timetables and named breaks', () => {
  const now = new Date('2026-09-10T00:15:00Z')
  expect(getDashboardPeriod(now, [])).toBe('Luar Jam')
  expect(getDashboardPeriod(now, [{ hari: [1], slots: [] }])).toBe('Hari Libur')
  expect(getDashboardPeriod(now, [{ hari: [4], slots: [{ nama: 'Istirahat', mulai: '07:00', selesai: '07:30' }] }])).toBe('Istirahat')
})
