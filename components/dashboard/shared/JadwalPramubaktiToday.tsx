import { getDB } from '@/utils/db-server'
import { getPbData, getPbRules } from '@/lib/pramubakti-db'
import { todayWIB } from '@/lib/time'
import { JadwalPramubaktiTodayClient } from './JadwalPramubaktiTodayClient'

export async function JadwalPramubaktiToday({ userId }: { userId: string }) {
  const db = await getDB()
  const today = todayWIB()

  const [data, rules] = await Promise.all([
    getPbData(db, today, today, userId),
    getPbRules(),
  ])

  const holiday = data.holidays.find(h => h.start_date <= today && h.end_date >= today) || null
  const todayItems = data.items.filter(i => i.tanggal === today)

  return (
    <JadwalPramubaktiTodayClient
      today={today}
      holiday={holiday ? { reason: holiday.reason } : null}
      items={todayItems}
      rules={rules}
    />
  )
}
