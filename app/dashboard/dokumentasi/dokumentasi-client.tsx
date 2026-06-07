'use client'

import { useMemo, useState, useTransition } from 'react'
import { FileText, Loader2, Pencil, Plus, Search } from 'lucide-react'
import { MENU_ITEMS } from '@/config/menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarkdownViewer } from '@/components/documentation/markdown-viewer'
import { cn } from '@/lib/utils'
import { saveDocumentationArticle } from './actions'
import type { DocumentationArticle, DocumentationAudience } from '@/lib/documentation'

type Props = {
  articles: DocumentationArticle[]
  manageableArticles: DocumentationArticle[]
  featureLabels: Record<string, string>
  isSuperAdmin: boolean
}

const EMPTY_FORM = {
  id: '',
  audience: 'internal' as DocumentationAudience,
  feature_id: null as string | null,
  title: '',
  summary: '',
  content_md: '# Judul Dokumentasi\n\n## Fungsi utama\n- \n\n## Alur penggunaan\n- \n\n## Catatan penting\n- ',
  sort_order: 100,
  is_published: 1,
  updated_at: '',
}

function getFeatureTitle(featureId: string | null, featureLabels: Record<string, string>) {
  if (!featureId) return 'Umum'
  const item = MENU_ITEMS.find(menu => menu.id === featureId)
  return featureLabels[featureId] || item?.title || featureId
}

export function DokumentasiClient({ articles, manageableArticles, featureLabels, isSuperAdmin }: Props) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(articles[0]?.id || '')
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<DocumentationArticle>(manageableArticles[0] || EMPTY_FORM)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const filteredArticles = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return articles
    return articles.filter(article => [
      article.title,
      article.summary,
      getFeatureTitle(article.feature_id, featureLabels),
      article.content_md,
    ].join(' ').toLowerCase().includes(q))
  }, [articles, featureLabels, query])

  const selectedArticle = filteredArticles.find(article => article.id === selectedId) || filteredArticles[0] || articles[0]
  const groupedArticles = useMemo(() => {
    const groups = new Map<string, DocumentationArticle[]>()
    for (const article of filteredArticles) {
      const key = getFeatureTitle(article.feature_id, featureLabels)
      groups.set(key, [...(groups.get(key) || []), article])
    }
    return Array.from(groups.entries())
  }, [featureLabels, filteredArticles])

  const openEditor = (article?: DocumentationArticle) => {
    setDraft(article || EMPTY_FORM)
    setMessage('')
    setEditorOpen(true)
  }

  const submit = (formData: FormData) => {
    setMessage('')
    startTransition(async () => {
      const res = await saveDocumentationArticle(formData)
      if (res?.error) {
        setMessage(res.error)
        return
      }
      setMessage('Dokumentasi berhasil disimpan. Muat ulang halaman untuk melihat daftar terbaru.')
      setEditorOpen(false)
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="rounded-lg border border-surface bg-surface p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Cari dokumentasi..."
              className="h-9 rounded-md pl-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-[calc(100dvh-230px)] space-y-3 overflow-y-auto pr-1">
          {groupedArticles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              Tidak ada dokumentasi yang cocok.
            </div>
          ) : groupedArticles.map(([group, items]) => (
            <div key={group} className="space-y-1">
              <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group}</p>
              {items.map(article => {
                const active = selectedArticle?.id === article.id
                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setSelectedId(article.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100'
                        : 'border-surface bg-surface hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{article.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{article.summary}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-surface bg-surface p-4 sm:p-5">
        {selectedArticle ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-surface-2 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-300">
                  {getFeatureTitle(selectedArticle.feature_id, featureLabels)}
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">{selectedArticle.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedArticle.summary}</p>
              </div>
              {isSuperAdmin && (
                <Button type="button" variant="outline" size="sm" onClick={() => openEditor(selectedArticle)} className="gap-2 rounded-md">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
            <MarkdownViewer content={selectedArticle.content_md} />
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-slate-500">Belum ada dokumentasi yang bisa ditampilkan.</div>
        )}
      </div>

      {isSuperAdmin && (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={() => openEditor()} className="fixed bottom-5 right-5 z-20 gap-2 rounded-full shadow-lg">
              <Plus className="h-4 w-4" />
              Dokumentasi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{draft.id ? 'Edit Dokumentasi' : 'Tambah Dokumentasi'}</DialogTitle>
            </DialogHeader>
            <form action={submit} className="grid gap-4 lg:grid-cols-2">
              <input type="hidden" name="id" value={draft.id} />
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Audience</span>
                  <Select value={draft.audience} onValueChange={(value: DocumentationAudience) => setDraft(prev => ({ ...prev, audience: value, feature_id: value === 'parent' ? null : prev.feature_id }))}>
                    <SelectTrigger name="audience" className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Dashboard</SelectItem>
                      <SelectItem value="parent">Portal Orang Tua</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="audience" value={draft.audience} />
                </div>

                <div className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fitur terkait</span>
                  <Select
                    value={draft.feature_id || '__none__'}
                    disabled={draft.audience === 'parent'}
                    onValueChange={value => setDraft(prev => ({ ...prev, feature_id: value === '__none__' ? null : value }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Umum</SelectItem>
                      {MENU_ITEMS.filter(item => item.id !== 'portal-ortu').map(item => (
                        <SelectItem key={item.id} value={item.id}>{featureLabels[item.id] || item.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="featureId" value={draft.feature_id || '__none__'} />
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Judul</span>
                  <Input name="title" value={draft.title} onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))} className="rounded-md" />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ringkasan</span>
                  <Textarea name="summary" value={draft.summary} onChange={event => setDraft(prev => ({ ...prev, summary: event.target.value }))} rows={3} className="rounded-md" />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Urutan</span>
                    <Input name="sortOrder" type="number" value={draft.sort_order} onChange={event => setDraft(prev => ({ ...prev, sort_order: Number(event.target.value || 0) }))} className="rounded-md" />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm font-medium">
                    <Checkbox checked={draft.is_published === 1} onCheckedChange={checked => setDraft(prev => ({ ...prev, is_published: checked ? 1 : 0 }))} />
                    <input type="hidden" name="isPublished" value={draft.is_published === 1 ? 'on' : 'off'} />
                    Published
                  </label>
                </div>

                {message && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{message}</p>}
              </div>

              <div className="space-y-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Isi Markdown</span>
                  <Textarea
                    name="contentMd"
                    value={draft.content_md}
                    onChange={event => setDraft(prev => ({ ...prev, content_md: event.target.value }))}
                    rows={14}
                    className="rounded-md font-mono text-xs leading-5"
                  />
                </label>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-surface-2 bg-white p-3 dark:bg-slate-950">
                  <MarkdownViewer content={draft.content_md} compact />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} className="rounded-md">Batal</Button>
                  <Button type="submit" disabled={isPending} className="gap-2 rounded-md">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
