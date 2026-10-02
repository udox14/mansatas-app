export const ATTENDANCE_DELAY_DEFAULTS: Record<string, number> = {
  attendance_homeroom_alert: 0,
  attendance_parent_alert: 5,
  attendance_daily_update: 5,
}
export const MAX_ATTENDANCE_DELAY_MINUTES = 60

export function validAttendanceDelay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ATTENDANCE_DELAY_MINUTES
}

export function attendanceDelayMinutes(eventKey: string, reminderJson?: string) {
  const fallback = ATTENDANCE_DELAY_DEFAULTS[eventKey] ?? 0
  try {
    const value = JSON.parse(reminderJson || '{}').delayMinutes
    return validAttendanceDelay(value) ? value : fallback
  } catch { return fallback }
}
