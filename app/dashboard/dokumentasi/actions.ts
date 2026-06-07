'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { upsertDocumentationArticle, type DocumentationAudience } from '@/lib/documentation'

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' as const }

  const db = await getDB()
  const row = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<{ role: string }>()
  if (row?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengelola dokumentasi.' as const }
  return { user, db }
}

export async function saveDocumentationArticle(formData: FormData) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth

  const audienceRaw = String(formData.get('audience') || 'internal')
  const audience: DocumentationAudience = audienceRaw === 'parent' ? 'parent' : 'internal'
  const featureRaw = String(formData.get('featureId') || '')
  const featureId = featureRaw && featureRaw !== '__none__' ? featureRaw : null
  const title = cleanText(formData.get('title'), 160)
  const summary = cleanText(formData.get('summary'), 500)
  const contentMd = cleanText(formData.get('contentMd'), 20000)
  const sortOrder = Number(formData.get('sortOrder') || 0)
  const isPublished = String(formData.get('isPublished') || '') === 'on'
  const id = cleanText(formData.get('id'), 120)

  if (!title) return { error: 'Judul dokumentasi wajib diisi.' }
  if (!summary) return { error: 'Ringkasan dokumentasi wajib diisi.' }
  if (!contentMd) return { error: 'Isi dokumentasi wajib diisi.' }
  if (audience === 'parent' && featureId) return { error: 'Dokumentasi orang tua tidak boleh dikaitkan ke fitur dashboard internal.' }

  await upsertDocumentationArticle(auth.db, {
    id: id || undefined,
    audience,
    featureId,
    title,
    summary,
    contentMd,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isPublished,
  })

  revalidatePath('/dashboard/dokumentasi')
  revalidatePath('/portal-ortu')
  return { success: true }
}
