'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveDashboardShortcuts } from '@/app/dashboard/shortcut-actions'
import { MAX_DASHBOARD_SHORTCUTS, moveDashboardShortcut, searchDashboardMenus, type DashboardMenuItem } from '@/lib/dashboard-menu'

export function ShortcutEditor({ menus, initialIds, onSaved, onCancel, readOnly }: {
  menus: DashboardMenuItem[]; initialIds: string[]; onSaved: (ids: string[]) => void; onCancel: () => void; readOnly: boolean
}) {
  const [ids, setIds] = useState(initialIds)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = ids.flatMap(id => menus.find(item => item.id === id) ?? [])
  const full = ids.length >= MAX_DASHBOARD_SHORTCUTS
  async function save() {
    setError('')
    setSaving(true)
    try {
      const result = await saveDashboardShortcuts(ids)
      if ('error' in result) setError(result.error)
      else onSaved(ids)
    } catch { setError('Koneksi terputus. Pilihan Anda tetap di sini; silakan coba lagi.') }
    finally { setSaving(false) }
  }
  return <>
    <div className="shrink-0 px-5 pb-3 sm:px-6">
      <Input aria-label="Cari menu untuk favorit" placeholder="Cari menu..." value={query} onChange={event => setQuery(event.target.value)} className="h-12 rounded-2xl border-0 bg-slate-100 dark:bg-slate-800" />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold"><h3>Urutan favorit</h3><span aria-live="polite" className="text-emerald-700 dark:text-emerald-400">{ids.length}/8</span></div>
      {selected.length === 0 && <p className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900">Pilih menu di bawah untuk membuat favorit Anda.</p>}
      <ol className="mb-5 space-y-1">
        {selected.map((item, index) => <li key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 pl-3 dark:bg-slate-900">
          <span className="text-xs text-slate-400">{index + 1}</span><span className="min-w-0 flex-1 break-words text-xs font-medium">{item.title}</span>
          <div className="flex shrink-0">
            <button type="button" disabled={saving || readOnly || index === 0} onClick={() => setIds(moveDashboardShortcut(ids, index, -1))} aria-label={`Geser ${item.title} lebih awal`} className="dashboard-icon-button disabled:opacity-25"><ArrowLeft size={16} /></button>
            <button type="button" disabled={saving || readOnly || index === ids.length - 1} onClick={() => setIds(moveDashboardShortcut(ids, index, 1))} aria-label={`Geser ${item.title} lebih akhir`} className="dashboard-icon-button disabled:opacity-25"><ArrowRight size={16} /></button>
            <button type="button" disabled={saving || readOnly} onClick={() => setIds(ids.filter(id => id !== item.id))} aria-label={`Hapus ${item.title}`} className="dashboard-icon-button text-rose-600"><X size={16} /></button>
          </div>
        </li>)}
      </ol>
      <h3 className="mb-2 text-sm font-semibold">Pilih menu</h3>
      {full && <p className="mb-2 text-xs text-slate-500">Delapan slot terisi. Hapus satu favorit untuk menggantinya.</p>}
      <div className="space-y-1">
        {searchDashboardMenus(menus, query).map(item => {
          const checked = ids.includes(item.id)
          return <button key={item.id} type="button" aria-pressed={checked} disabled={saving || readOnly || (!checked && full)}
            onClick={() => setIds(checked ? ids.filter(id => id !== item.id) : [...ids, item.id])}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 dark:hover:bg-slate-800">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{checked ? <Check size={16} /> : <Plus size={16} />}</span>
            {item.title}
          </button>
        })}
        {searchDashboardMenus(menus, query).length === 0 && <p className="py-6 text-center text-sm text-slate-500">Menu tidak ditemukan. Coba kata lain.</p>}
      </div>
    </div>
    <div className="dashboard-sheet-footer shrink-0 border-t border-slate-100 bg-white px-5 pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
      {readOnly && <p className="mb-3 text-sm text-amber-700">Akun reviewer hanya memiliki akses baca.</p>}
      {error && <p role="alert" className="mb-3 text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3"><Button variant="outline" onClick={onCancel} disabled={saving} className="h-12 flex-1 rounded-2xl">Batal</Button><Button onClick={save} disabled={saving || readOnly} className="h-12 flex-1 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>
    </div>
  </>
}
