// Lokasi: app/(auth)/login/page.tsx
import { redirect } from 'next/navigation'
import { getAppSession } from '@/utils/auth/server'
import LoginClient from './login-client'

export const dynamic = 'force-dynamic'
export default async function LoginPage() {
  const session = await getAppSession()
  if (session?.kind === 'staff') redirect('/dashboard')
  if (session?.kind === 'parent') redirect('/portal-ortu')
  return <LoginClient />
}
