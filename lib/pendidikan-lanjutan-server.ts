import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Kampus, Prodi } from '@/lib/pendidikan-lanjutan'

export type ServerPendidikanCatalog = {
  kampusById: Map<string, Kampus>
  prodiByKampus: Record<string, Prodi[]>
}

let serverCatalog: ServerPendidikanCatalog | null = null
let serverCatalogPromise: Promise<ServerPendidikanCatalog> | null = null

async function fetchFromStaticAssets(): Promise<[Kampus[], Record<string, Prodi[]>] | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const assets = (env as unknown as { STATIC_ASSETS?: { fetch: (input: string) => Promise<Response> } }).STATIC_ASSETS
    if (!assets?.fetch) return null

    const [kampusRes, prodiRes] = await Promise.all([
      assets.fetch('https://assets.local/data/kampus.json'),
      assets.fetch('https://assets.local/data/prodi.json'),
    ])
    if (!kampusRes.ok || !prodiRes.ok) return null
    return await Promise.all([
      kampusRes.json() as Promise<Kampus[]>,
      prodiRes.json() as Promise<Record<string, Prodi[]>>,
    ])
  } catch {
    return null
  }
}

async function readFromLocalDisk(): Promise<[Kampus[], Record<string, Prodi[]>]> {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  // Hindari penelusuran statis @vercel/nft agar data/*.json tidak disalin ganda ke server-functions
  const dataDir = join(process.cwd(), ['da', 'ta'].join(''))
  const [kampusRaw, prodiRaw] = await Promise.all([
    readFile(join(dataDir, 'kampus.json'), 'utf8'),
    readFile(join(dataDir, 'prodi.json'), 'utf8'),
  ])
  return [
    JSON.parse(kampusRaw) as Kampus[],
    JSON.parse(prodiRaw) as Record<string, Prodi[]>,
  ]
}

export async function loadPendidikanLanjutanServer(): Promise<ServerPendidikanCatalog> {
  if (serverCatalog) return serverCatalog
  if (serverCatalogPromise) return serverCatalogPromise

  serverCatalogPromise = (async () => {
    const pair = (await fetchFromStaticAssets()) ?? (await readFromLocalDisk())
    const [kampusList, prodiByKampus] = pair
    serverCatalog = {
      kampusById: new Map(kampusList.map(k => [k.id, k])),
      prodiByKampus,
    }
    return serverCatalog
  })().catch(error => {
    serverCatalogPromise = null
    throw error
  })

  return serverCatalogPromise
}
