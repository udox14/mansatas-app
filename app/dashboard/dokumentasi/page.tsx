import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getAllDocumentationArticles, getDocumentationArticles } from '@/lib/documentation'
import { getUserAllowedFeatures, getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { DokumentasiClient } from './dokumentasi-client'
import { MENU_ITEMS } from '@/config/menu'

export const metadata = { title: 'Dokumentasi - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function getFeatureLabels(db: D1Database) {
  try {
    const rows = await db.prepare('SELECT feature_id, title FROM feature_display_settings').all<{ feature_id: string; title: string }>()
    return Object.fromEntries((rows.results || []).map(row => [row.feature_id, row.title]))
  } catch {
    return {}
  }
}

export default async function DokumentasiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const [allowedFeatures, roles, featureLabels] = await Promise.all([
    getUserAllowedFeatures(db, user.id),
    getUserRoles(db, user.id),
    getFeatureLabels(db),
  ])
  const isSuperAdmin = roles.includes('super_admin') || (user as any).role === 'super_admin'

  const [articles, manageableArticles] = await Promise.all([
    getDocumentationArticles(db, { audience: 'internal', allowedFeatures }),
    isSuperAdmin ? getAllDocumentationArticles(db) : Promise.resolve([]),
  ])
  const featureOptions = MENU_ITEMS
    .filter(item => item.id !== 'portal-ortu')
    .map(item => ({
      id: item.id,
      title: featureLabels[item.id] || item.title,
    }))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Dokumentasi"
        description="Panduan penggunaan aplikasi sesuai fitur yang aktif untuk akun Anda."
      />
      <DokumentasiClient
        articles={articles}
        manageableArticles={manageableArticles}
        featureLabels={featureLabels}
        featureOptions={featureOptions}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
