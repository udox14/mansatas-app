import { describe, expect, it } from 'vitest'
import { addDays, buildPbItems, pbCkhRow, pbDates, pbInputStatus, pbSlotsForDate, summarizePb, validatePbTemplates, validateSlots, type PbMember, type PbReport, type PbSlot } from './pramubakti'
import { buildCkhDateRowSpans } from './ckh'

const slot: PbSlot = { id: 's1', weekday: 1, start: '07:00', end: '08:00' }
const member: PbMember = { id: 'm', user_id: 'p', nama_lengkap: 'Pegawai', start_date: '2026-09-07', end_date: null }
const report: PbReport = { id: 'r', user_id: 'p', tanggal: '2026-09-07', slot_id: 's1', jobs: ['Membersihkan', 'Membuang Sampah'], tempat: 'halaman', foto_url: '/api/media/pramubakti/p/r.jpg', waktu_input: '2026-09-07T07:05:00+07:00', status: 'TEPAT_WAKTU', revision: 1 }
const base = { start: '2026-09-07', end: '2026-09-07', today: '2026-09-07', time: '07:00', versions: [{ id: 'v', effective_date: '2026-09-07', slots: [slot] }], holidays: [], members: [member], reports: [], leaves: [] }

describe('Pramubakti work obligations', () => {
  it('uses a strict same-day slot and five-minute opening tolerance', () => {
    expect(() => pbInputStatus(slot, '06:54', true, true, 10)).toThrow()
    expect(pbInputStatus(slot, '06:55', true, true, 10)).toBe('TEPAT_WAKTU')
    expect(pbInputStatus(slot, '07:10', true, true, 10)).toBe('TEPAT_WAKTU')
    expect(pbInputStatus(slot, '07:11', true, true, 10)).toBe('TELAT')
    expect(pbInputStatus(slot, '08:00', true, true, 10)).toBe('TELAT')
    expect(() => pbInputStatus(slot, '08:01', true, true, 10)).toThrow()
  })
  it('shares timing switches but leaves extra reports unrestricted', () => {
    expect(pbInputStatus(slot, '22:00', false, false, 10)).toBe('TEPAT_WAKTU')
    expect(pbInputStatus(slot, '22:00', false, true, 10)).toBe('TELAT')
    expect(pbInputStatus(null, '23:59', true, true, 10)).toBe('TAMBAHAN')
  })
  it('rejects overlap, invalid times, overnight slots and invalid weekdays', () => {
    expect(() => validateSlots([slot, { ...slot, id: 's2', start: '07:30', end: '09:00' }])).toThrow(/tumpang/)
    for (const bad of [{ end: '06:00' }, { start: '25:00' }, { weekday: 0 }]) expect(() => validateSlots([{ ...slot, ...bad }])).toThrow()
    expect(() => validateSlots([slot, { ...slot, id: 's2', start: '08:00', end: '09:00' }])).not.toThrow()
  })
  it('retains historical schedule versions and allows an empty future version', () => {
    const versions = [...base.versions, { id: 'v2', effective_date: '2026-09-08', slots: [] }]
    expect(pbSlotsForDate(versions, [], '2026-09-07')).toEqual([slot])
    expect(pbSlotsForDate(versions, [], '2026-09-14')).toEqual([])
    expect(pbSlotsForDate(versions, [], '2026-08-31')).toEqual([])
  })
  it('does not create obligations before membership, on holidays or after leaving', () => {
    expect(buildPbItems({ ...base, members: [{ ...member, start_date: '2026-09-08' }] })).toHaveLength(0)
    expect(buildPbItems({ ...base, members: [{ ...member, end_date: '2026-09-07' }] })).toHaveLength(0)
    expect(buildPbItems({ ...base, holidays: [{ id: 'h', start_date: base.start, end_date: base.end, reason: 'Libur' }] })).toHaveLength(0)
  })
  it('does not mark an unfinished or future slot alfa', () => {
    expect(summarizePb(buildPbItems(base))).toMatchObject({ total: 0, belum: 1, performance: null })
    expect(buildPbItems({ ...base, time: '08:00' })[0].status).toBe('BELUM')
    expect(buildPbItems({ ...base, time: '08:01' })[0].status).toBe('ALFA')
    expect(buildPbItems({ ...base, today: '2026-09-06', time: '23:59' })[0].status).toBe('BELUM')
  })
  it('counts late as attendance and extra reports outside the denominator', () => {
    const items = buildPbItems({ ...base, reports: [{ ...report, status: 'TELAT' }, { ...report, id: 'extra', slot_id: null, status: 'TAMBAHAN' }] })
    expect(summarizePb(items)).toMatchObject({ total: 1, hadir: 1, telat: 1, tambahan: 1, performance: 100 })
  })
  it('preserves evidence when leave overrides attendance and credits school leave only', () => {
    const leave = { user_id: 'p', tanggal: base.start, slot_id: 's1', status: 'IZIN' as const, reason_id: 'school', reason_name: 'Dinas', kepentingan_sekolah: true, note: 'Koreksi' }
    const items = buildPbItems({ ...base, reports: [report], leaves: [leave] })
    expect(items[0].report).toEqual(report)
    expect(summarizePb(items)).toMatchObject({ hadir: 0, izin: 1, izinSekolah: 1, performance: 100 })
    expect(summarizePb(buildPbItems({ ...base, leaves: [{ ...leave, kepentingan_sekolah: false }] })).performance).toBe(0)
    expect(summarizePb(buildPbItems({ ...base, leaves: [{ ...leave, status: 'SAKIT' }] })).performance).toBe(0)
  })
  it('validates date boundaries including leap years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(pbDates('2028-02-28', '2028-03-01')).toHaveLength(3)
    expect(() => pbDates('2026-02-30', '2026-03-02')).toThrow()
    expect(() => pbDates('2020-01-01', '2026-01-01')).toThrow()
  })
})

describe('Pramubakti CKH rendering', () => {
  it('produces one stable source row per report including every job and place', () => {
    const row = pbCkhRow(report)
    expect(row).toMatchObject({ source_key: 'pramubakti:r', vol: 1, satuan: 'Kegiatan', catatan_harian: 'Melaksanakan pekerjaan Membersihkan dan Membuang Sampah di halaman.' })
    const rows = [row, pbCkhRow({ ...report, id: 'r2' })]
    const spans = buildCkhDateRowSpans(rows)
    expect(spans.get(rows[0])).toMatchObject({ isFirstOfDate: true, dateRowSpan: 2 })
    expect(spans.get(rows[1])?.isFirstOfDate).toBe(false)
  })
  it('validates placeholders and renders literal user content without recursive replacement', () => {
    expect(() => validatePbTemplates('Bulanan', 'Tanpa tempat {pekerjaan}')).toThrow()
    expect(() => validatePbTemplates('Bulanan', '{pekerjaan} {tempat} {unknown}')).toThrow()
    expect(pbCkhRow({ ...report, tempat: '{pekerjaan} $&' }, 'Bulanan', '{tempat} — {pekerjaan}').catatan_harian).toBe('{pekerjaan} $& — Membersihkan dan Membuang Sampah')
  })
})

describe('Pramubakti dashboard integration', () => {
  it('registers pramubakti dashboard group with jadwal and performa items', async () => {
    const { DASHBOARD_GROUPS, dashboardKeyForRole } = await import('./dashboard-visibility')
    expect(dashboardKeyForRole('pramubakti')).toBe('pramubakti')

    const pbGroup = DASHBOARD_GROUPS.find(g => g.key === 'pramubakti')
    expect(pbGroup).toBeDefined()
    const itemIds = pbGroup?.items.map(i => i.id) || []
    expect(itemIds).toContain('jadwal_pramubakti')
    expect(itemIds).toContain('pramubakti_performa')
  })

  it('correctly provides slot items and counts for today dashboard widget', () => {
    const today = '2026-09-07'
    const s1: PbSlot = { id: 's1', weekday: 1, start: '06:45', end: '08:00' }
    const s2: PbSlot = { id: 's2', weekday: 1, start: '08:00', end: '10:00' }
    const input = {
      start: today,
      end: today,
      today,
      time: '07:30',
      versions: [{ id: 'v', effective_date: today, slots: [s1, s2] }],
      holidays: [],
      members: [member],
      reports: [report],
      leaves: [],
    }

    const items = buildPbItems(input)
    expect(items).toHaveLength(2)

    // Slot 1 is reported
    expect(items[0].slot?.id).toBe('s1')
    expect(items[0].status).toBe('TEPAT_WAKTU')
    expect(items[0].report).toBeDefined()

    // Slot 2 is upcoming / not reported
    expect(items[1].slot?.id).toBe('s2')
    expect(items[1].status).toBe('BELUM')
    expect(items[1].report).toBeNull()

    const doneCount = items.filter(i => i.report || i.leave).length
    const pendingCount = items.filter(i => i.status === 'BELUM').length
    expect(doneCount).toBe(1)
    expect(pendingCount).toBe(1)
  })
})

