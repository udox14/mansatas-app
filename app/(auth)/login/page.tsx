// Lokasi: app/(auth)/login/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import LoginClient from './login-client'

export const dynamic = 'force-dynamic'
export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
  return <LoginClient />
}