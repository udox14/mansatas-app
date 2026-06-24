// Lokasi: app/dashboard/settings/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { checkFeatureAccess } from '@/lib/features'
import { Settings } from 'lucide-react'
import { SettingsClient } from './components/settings-client'
import { PageHeader } from '@/components/layout/page-header'
import { getSystemSetting, getSystemSettingBoolean, getSystemSettingNumber, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'

export const metadata = { title: 'Pengaturan Global - MANSATAS App' }

// Normalize jam_pelajaran: handle format lama (flat array) vs baru (PolaJam[])
function normalizeJamPelajaran(raw: string | null): any[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []
    // Format lama: [{id:1, nama:"Jam 1", mulai:"08:00", selesai:"08:40"}, ...]
    // Ciri: tidak punya field "slots" atau "hari"
    if (parsed[0] && typeof parsed[0].slots === 'undefined' && typeof parsed[0].hari === 'undefined') {
      // Convert format lama → format baru: 1 pola "Semua Hari"
      return [{
        id: 'pola_legacy',
        nama: 'Semua Hari',
        hari: [1, 2, 3, 4, 5, 6],
        slots: parsed,
      }]
    }
    // Format baru: sudah PolaJam[]
    return parsed
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'
export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings')
  if (!allowed) redirect('/dashboard')

  const taResult = await db.prepare(
    'SELECT id, nama, semester, is_active, daftar_jurusan, jam_pelajaran FROM tahun_ajaran ORDER BY nama DESC, semester DESC'
  ).all<any>()

  const taData = (taResult.results || []).map((ta: any) => ({
    ...ta,
    daftar_jurusan: (() => {
      try { return JSON.parse(ta.daftar_jurusan || '[]') }
      catch { return ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM'] }
    })(),
    jam_pelajaran: normalizeJamPelajaran(ta.jam_pelajaran),
  }))
  const agendaTimeRestrictionEnabled = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.agendaTimeRestriction,
    true
  )
  const agendaLateEnabled = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.agendaLateEnabled,
    true
  )
  const agendaLateThresholdMinutes = await getSystemSettingNumber(
    SYSTEM_SETTING_KEYS.agendaLateThresholdMinutes,
    10
  )
  const agendaLateThresholdByJam = await getSystemSetting(
    SYSTEM_SETTING_KEYS.agendaLateThresholdByJam,
    '{}'
  )
  const attendanceTimeRestrictionEnabled = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.attendanceTimeRestriction,
    false
  )
  const attendanceSkipIncompleteForDailyStatusEnabled = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.attendanceSkipIncompleteForDailyStatus,
    false
  )
  const heroBackgroundImageUrl = await getSystemSetting(SYSTEM_SETTING_KEYS.heroBackgroundImageUrl, '')
  const heroRunningText = await getSystemSetting(SYSTEM_SETTING_KEYS.heroRunningText, '')
  const heroTextColor = await getSystemSetting(SYSTEM_SETTING_KEYS.heroTextColor, 'white')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pengaturan Sistem"
        description="Kelola perilaku input, tahun ajaran, jurusan, dan jam pelajaran."
      />
      <SettingsClient
        taData={taData}
        agendaTimeRestrictionEnabled={agendaTimeRestrictionEnabled}
        agendaLateEnabled={agendaLateEnabled}
        agendaLateThresholdMinutes={agendaLateThresholdMinutes}
        agendaLateThresholdByJam={agendaLateThresholdByJam}
        attendanceTimeRestrictionEnabled={attendanceTimeRestrictionEnabled}
        attendanceSkipIncompleteForDailyStatusEnabled={attendanceSkipIncompleteForDailyStatusEnabled}
        heroBackgroundImageUrl={heroBackgroundImageUrl}
        heroRunningText={heroRunningText}
        heroTextColor={heroTextColor}
      />
    </div>
  )
}
