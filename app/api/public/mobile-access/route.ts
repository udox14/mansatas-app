import { NextResponse } from 'next/server'
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const androidPlayStoreRequired = await getSystemSettingBoolean(
    SYSTEM_SETTING_KEYS.androidPlayStoreRequired,
    false
  ).catch(() => false)

  return NextResponse.json(
    { androidPlayStoreRequired },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
