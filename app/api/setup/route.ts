// TEMPORARY FILE - HAPUS SETELAH BERHASIL LOGIN!
// Lokasi: app/api/setup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const auth = createAuth(env.DB)

    await (auth.api as any).createUser({
      body: {
        name: 'Super Admin',
        email: 'admin@mansatas.sch.id',
        password: 'mansatas2026',
        role: 'kepsek',
        nama_lengkap: 'Super Admin',
      },
    })

    return NextResponse.json({ ok: true, message: 'User created! Sekarang login, lalu HAPUS file ini.' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 })
  }
}