import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import ParentLoginClient from './parent-login-client'

export const dynamic = 'force-dynamic'

export default async function ParentLoginPage() {
  const session = await getAppSession()
  if (session?.kind === 'parent') redirect('/portal-ortu')
  if (session?.kind === 'staff') redirect('/dashboard')
  return <ParentLoginClient />
}

