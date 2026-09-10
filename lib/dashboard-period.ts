export type LessonPattern = { hari: number[]; slots: { nama?: string; mulai: string; selesai: string }[] }

export function getDashboardPeriod(now: Date, patterns: LessonPattern[]) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'))
  if (day === 0) return 'Hari Libur'
  if (!patterns.length) return 'Luar Jam'
  const slots = patterns.find(pattern => pattern.hari?.includes(day))?.slots
  if (!slots?.length) return 'Hari Libur'
  const time = `${part('hour')}:${part('minute')}`
  const slot = slots.find(slot => time >= slot.mulai && time <= slot.selesai)
  if (slot) {
    const number = String(slot.nama || '').match(/\d+/)
    return number ? `Jam ke-${number[0]}` : slot.nama || 'Istirahat'
  }
  if (time < slots[0].mulai) return 'Belum Mulai'
  if (time > slots[slots.length - 1].selesai) return 'Pulang'
  return 'Istirahat'
}
