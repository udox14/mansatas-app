import { getDB } from '@/utils/db-server'
import { todayWIB } from '@/lib/time'
import { getTeacherAttendance, TEACHER_ATTENDANCE_START_DATE } from '@/lib/teacher-attendance'
import { toTeacherAttendancePublicResult } from '@/lib/teacher-attendance-core'
import { KehadiranPribadiCardClient } from './KehadiranPribadiCardClient'

type Props = { userId: string }

export async function KehadiranPribadiCard({ userId }: Props) {
  const db = await getDB()
  const user = await db.prepare(`
    SELECT role,
      (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) as secondary_roles
    FROM "user" u WHERE id = ?
  `).bind(userId).first<{ role?: string; secondary_roles?: string }>() || {}
  const roles = [user.role, ...(user.secondary_roles?.split(',') || [])].filter(Boolean)
  if (!roles.includes('guru')) return null

  const today = todayWIB()
  const month = today.slice(0, 7)
  const result = toTeacherAttendancePublicResult(await getTeacherAttendance(db, userId, month))
  const monthStart = `${month}-01`
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('id-ID', {
    month: 'long', year: 'numeric',
  })
  const cutoffLabel = new Date(`${TEACHER_ATTENDANCE_START_DATE}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <KehadiranPribadiCardClient
      month={month}
      monthLabel={monthLabel}
      subtitle={monthStart < TEACHER_ATTENDANCE_START_DATE ? `${cutoffLabel} sampai hari ini` : `${monthLabel} sampai hari ini`}
      summary={result.summary}
      items={result.items}
    />
  )
}
