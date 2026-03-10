// Lokasi: app/(auth)/login/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import LoginClient from './login-client'
import { login } from './actions'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
  return <LoginClient loginAction={login} />
}
