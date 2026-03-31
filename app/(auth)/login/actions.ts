// app/(auth)/login/actions.ts
'use server'

import { createAuth, COOKIE_NAME } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { headers, cookies } from 'next/headers'
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
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: false,
    }) as any

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, result.session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    })
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password') || msg.includes('banned')) {
      return { error: 'Email atau password salah.' }
    }
    return { error: 'Terjadi kesalahan sistem: ' + msg }
  }

  redirect('/dashboard')
}
