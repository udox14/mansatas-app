// HAPUS FILE INI SETELAH BERHASIL LOGIN!
// Lokasi: app/api/setup/route.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth } from '@/utils/auth'

export const runtime = 'edge'

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const auth = createAuth(env.DB)

    const result = await (auth.api as any).createUser({
      body: {
        name: 'Super Admin',
        email: 'admin@mansatas.sch.id',
        password: 'mansatas2026',
        role: 'kepsek',
        nama_lengkap: 'Super Admin',
      },
    })

    return Response.json({ ok: true, message: 'User created! Sekarang login lalu HAPUS file ini.' })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}