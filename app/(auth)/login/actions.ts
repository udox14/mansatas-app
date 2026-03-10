// Lokasi: app/(auth)/login/actions.ts
'use server'

import { createAuth } from '@/utils/auth'
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
    const res = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: true, // ambil raw Response supaya bisa baca Set-Cookie
    })

    if (!res.ok) {
      return { error: 'Email atau password salah.' }
    }

    // Salin semua Set-Cookie dari response Better Auth ke browser
    const cookieStore = await cookies()
    const setCookieHeader = res.headers.getSetCookie?.() ?? []
    for (const cookieStr of setCookieHeader) {
      // Parse "name=value; Path=/; HttpOnly; ..."
      const [nameVal, ...attrs] = cookieStr.split(';').map((s: string) => s.trim())
      const eqIdx = nameVal.indexOf('=')
      const name = nameVal.slice(0, eqIdx)
      const value = nameVal.slice(eqIdx + 1)

      const options: any = { path: '/' }
      for (const attr of attrs) {
        const lower = attr.toLowerCase()
        if (lower === 'httponly') options.httpOnly = true
        else if (lower === 'secure') options.secure = true
        else if (lower === 'samesite=lax') options.sameSite = 'lax'
        else if (lower === 'samesite=strict') options.sameSite = 'strict'
        else if (lower === 'samesite=none') options.sameSite = 'none'
        else if (lower.startsWith('max-age=')) options.maxAge = parseInt(attr.split('=')[1])
        else if (lower.startsWith('path=')) options.path = attr.split('=')[1]
      }

      cookieStore.set(name, value, options)
    }
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('Invalid') || msg.includes('credentials') || msg.includes('password')) {
      return { error: 'Email atau password salah.' }
    }
    return { error: 'Terjadi kesalahan sistem: ' + msg }
  }

  redirect('/dashboard')
}