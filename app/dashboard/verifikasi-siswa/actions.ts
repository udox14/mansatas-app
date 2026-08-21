'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { logActivity } from '@/lib/activity-log'
import {
  DEFAULT_VERIFICATION_THRESHOLDS,
  normalizeVerificationThresholds,
  VERIFICATION_SETTINGS_ID,
  type VerificationThresholds,
} from './verification-core'

async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  return roles.includes('super_admin') ? { user, db } : null
}

function validateSettings(input: VerificationThresholds) {
  if (input.attendanceCritical >= input.attendanceWarning) return 'Ambang kritis kehadiran harus lebih rendah daripada ambang perhatian.'
  if (input.attendanceCritical < 0 || input.attendanceWarning > 100) return 'Ambang kehadiran harus berada antara 0–100.'
  if (input.academicCriticalRatio < 1 || input.academicCriticalRatio > 100) return 'Rasio akademik harus berada antara 1–100.'
  return null
}

export async function saveVerificationSettings(input: VerificationThresholds) {
  const auth = await requireSuperAdmin()
  if (!auth) return { error: 'Hanya Super Admin yang dapat mengubah ambang indikator.' }
  const candidate = { ...input, version: 1 as const }
  const error = validateSettings(candidate)
  if (error) return { error }
  const normalized = normalizeVerificationThresholds(candidate)
  const beforeRaw = await getSystemSetting(VERIFICATION_SETTINGS_ID, JSON.stringify(DEFAULT_VERIFICATION_THRESHOLDS))
  const before = normalizeVerificationThresholds(JSON.parse(beforeRaw))
  await setSystemSetting(VERIFICATION_SETTINGS_ID, JSON.stringify(normalized))
  await logActivity({
    db: auth.db, module: 'verifikasi-siswa', action: 'update_thresholds', severity: 'warning',
    summary: 'Mengubah ambang indikator Insight & Verifikasi Siswa', entityType: 'system_setting',
    entityId: VERIFICATION_SETTINGS_ID, before, after: normalized,
  })
  revalidatePath('/dashboard/verifikasi-siswa')
  return { success: true, settings: normalized }
}

export async function resetVerificationSettings() {
  return saveVerificationSettings({ ...DEFAULT_VERIFICATION_THRESHOLDS })
}
