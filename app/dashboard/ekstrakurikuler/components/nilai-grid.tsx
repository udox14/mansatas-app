'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle2, AlertCircle, GraduationCap, Save } from 'lucide-react'
import { getNilai, simpanNilai } from '../actions'
import type { NilaiRow } from '../actions'

const HURUF = ['A', 'B', 'C', 'D']
const EMPTY = '__empty__'

export function NilaiGrid({ ekskulId, modeNilai }: { ekskulId: string; modeNilai: 'angka' | 'huruf' }) {
  const [rows, setRows] = useState<NilaiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const reload = async () => {
    setLoading(true)
    const res = await getNilai(ekskulId)
    setRows(res.rows)
    setLoading(false)
  }
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ekskulId])

  const setNilai = (siswaId: string, nilai: string) =>
    setRows(prev => prev.map(r => r.siswa_id === siswaId ? { ...r, nilai } : r))
  const setCatatan = (siswaId: string, catatan: string) =>
    setRows(prev => prev.map(r => r.siswa_id === siswaId ? { ...r, catatan } : r))

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    const res = await simpanNilai(ekskulId, rows.map(r => ({
      siswa_id: r.siswa_id, nilai: r.nilai ?? '', catatan: r.catatan ?? '',
    })))
    setSaving(false)
    if (res.error) { setMsg({ tipe: 'error', teks: res.error }); return }
    setMsg({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
    await reload()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rows.length} anggota · Mode: <b>{modeNilai === 'angka' ? 'Angka (0-100)' : 'Huruf (A/B/C/D)'}</b> · semester berjalan
        </p>
        {rows.length > 0 && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Menyimpan...</> : <><Save className="h-3.5 w-3.5 mr-1" />Simpan</>}
          </Button>
        )}
      </div>

      {msg && (
        <div className={`p-2.5 text-xs rounded-lg border flex gap-2 ${msg.tipe === 'sukses' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
          {msg.tipe === 'sukses' ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5" />}{msg.teks}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
          <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada anggota untuk dinilai.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.siswa_id} className="rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{r.nama_lengkap}</p>
                <p className="text-[11px] text-slate-400">{r.nisn} · {r.kelas_label}</p>
              </div>
              <div className="w-20 shrink-0">
                {modeNilai === 'angka' ? (
                  <Input type="number" min={0} max={100} value={r.nilai ?? ''}
                    onChange={e => setNilai(r.siswa_id, e.target.value)}
                    placeholder="0-100" className="h-8 text-sm text-center" />
                ) : (
                  <Select value={r.nilai || EMPTY} onValueChange={v => setNilai(r.siswa_id, v === EMPTY ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY} className="text-sm text-slate-400">-</SelectItem>
                      {HURUF.map(h => <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="w-40 shrink-0">
                <Input value={r.catatan ?? ''} onChange={e => setCatatan(r.siswa_id, e.target.value)}
                  placeholder="Catatan" className="h-8 text-xs" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
