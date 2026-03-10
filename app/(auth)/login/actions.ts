// Lokasi: app/(auth)/login/actions.ts
'use server'

import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    })
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password')) {
      return { error: 'Email atau password salah.' }
    }
    return { error: 'Terjadi kesalahan sistem. Coba lagi.' }
  }

  redirect('/dashboard')
}