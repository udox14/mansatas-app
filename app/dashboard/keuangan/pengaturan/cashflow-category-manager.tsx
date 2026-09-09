'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ListTree, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CashDirection, CashflowCategory } from '@/lib/cashflow'
import { saveCashflowCategories } from './actions'

type EditableCategory = CashflowCategory & { isNew?: boolean }

export function CashflowCategoryManager({ initialCategories, canUpdate }: { initialCategories: CashflowCategory[]; canUpdate: boolean }) {
  const [rows, setRows] = useState<EditableCategory[]>(initialCategories)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function add(direction: CashDirection) {
    setRows(current => [...current, { id: crypto.randomUUID(), direction, name: '', sortOrder: current.length * 10 + 10, isActive: true, isSystem: false, isNew: true }])
  }
  function update(id: string, patch: Partial<EditableCategory>) { setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row)) }
  function move(id: string, delta: -1|1) {
    setRows(current => {
      const row = current.find(item => item.id === id); if (!row) return current
      const same = current.filter(item => item.direction === row.direction)
      const from = same.findIndex(item => item.id === id); const to = from + delta
      if (to < 0 || to >= same.length) return current
      const reordered = [...same]; [reordered[from],reordered[to]] = [reordered[to],reordered[from]]
      let index = 0; return current.map(item => item.direction === row.direction ? reordered[index++] : item)
    })
  }
  function save() {
    setMessage(''); startTransition(async () => {
      const result = await saveCashflowCategories(rows.map((row,index) => ({ id: row.id, direction: row.direction, name: row.name, sortOrder: index * 10 + 10, isActive: row.isActive, isNew: row.isNew })))
      setMessage(result.error ?? result.success ?? '')
      if (!result.error) setRows(current => current.map(row => ({...row,isNew:false})))
    })
  }
  function panel(direction: CashDirection) {
    const items = rows.filter(row => row.direction === direction)
    return <div className="space-y-3">{items.map((row,index) => <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center"><Input disabled={!canUpdate} value={row.name} maxLength={100} onChange={event => update(row.id,{name:event.target.value})} placeholder={`Nama kategori ${direction === 'income' ? 'pemasukan' : 'pengeluaran'}`} className="flex-1"/><label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300"><input disabled={!canUpdate} type="checkbox" checked={row.isActive} onChange={event => update(row.id,{isActive:event.target.checked})} className="h-4 w-4 rounded"/> Aktif</label><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canUpdate || index === 0} onClick={() => move(row.id,-1)} aria-label="Naikkan"><ArrowUp className="h-4 w-4"/></Button><Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canUpdate || index === items.length - 1} onClick={() => move(row.id,1)} aria-label="Turunkan"><ArrowDown className="h-4 w-4"/></Button></div></div>)}{canUpdate && <Button type="button" variant="outline" size="sm" onClick={() => add(direction)}><Plus className="h-4 w-4"/> Tambah Jenis</Button>}</div>
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="rounded-lg bg-violet-50 p-2 text-violet-700 dark:bg-violet-950/40"><ListTree className="h-4 w-4"/></span><div><h2 className="text-sm font-semibold">Jenis Arus Kas</h2><p className="text-xs text-slate-500">Kelola jenis pemasukan dan kategori pengeluaran SNP.</p></div></div>{canUpdate && <Button size="sm" onClick={save} disabled={isPending}><Save className="h-4 w-4"/>{isPending ? 'Menyimpan...' : 'Simpan Jenis'}</Button>}</div>{message && <p className={`mb-3 rounded-md px-3 py-2 text-xs ${message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message}</p>}<Tabs defaultValue="income"><TabsList><TabsTrigger value="income">Pemasukan</TabsTrigger><TabsTrigger value="expense">Pengeluaran</TabsTrigger></TabsList><TabsContent value="income" className="mt-4">{panel('income')}</TabsContent><TabsContent value="expense" className="mt-4">{panel('expense')}</TabsContent></Tabs></section>
}
