import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import { getSystemSetting, getSystemSettingBoolean, SYSTEM_SETTING_KEYS, DEFAULT_PARENT_LOGIN_HELP_WHATSAPP, DEFAULT_PARENT_LOGIN_HELP_INFO } from '@/lib/system-settings'
import ParentLoginClient from './parent-login-client'
import { DSPT_PAYMENT_URL } from '@/lib/dspt-reminder-config'

export const dynamic = 'force-dynamic'

export default async function ParentLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next === 'keuangan' ? DSPT_PAYMENT_URL : '/portal-ortu'
  const session = await getAppSession()
  if (session?.kind === 'parent') redirect(next)
  if (session?.kind === 'staff') redirect('/dashboard')

  const helpEnabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.parentLoginHelpEnabled, true)
  const helpWhatsapp = await getSystemSetting(SYSTEM_SETTING_KEYS.parentLoginHelpWhatsapp, DEFAULT_PARENT_LOGIN_HELP_WHATSAPP)
  const helpInfo = await getSystemSetting(SYSTEM_SETTING_KEYS.parentLoginHelpInfo, DEFAULT_PARENT_LOGIN_HELP_INFO)

  return <ParentLoginClient helpEnabled={helpEnabled} helpWhatsapp={helpWhatsapp} helpInfo={helpInfo} redirectTo={next} />
}

