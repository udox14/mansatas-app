'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { UserPlus, Trash2, Loader2, Users } from 'lucide-react'
import { SiswaPicker } from './siswa-picker'
import { getAnggota, removeAnggota } from '../actions'
import type { AnggotaRow, KelasOption } from '../actions'

export function AnggotaManager({ ekskulId, kelasList }: { ekskulId: string; kelasList: KelasOption[] }) {
  const [rows, setRows] = useState<AnggotaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setRows(await getAnggota(ekskulId))
    setLoading(false)
  }

  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ekskulId])

  const handleRemove = (r: AnggotaRow) => {
    if (!confirm(`Keluarkan ${r.nama_lengkap} dari ekstrakurikuler?`)) return
    setRemovingId(r.siswa_id)
    setMsg(null)
    startTransition(async () => {
      const res = await removeAnggota(ekskulId, r.siswa_id)
      setRemovingId(null)
      if (res.error) { setMsg(res.error); return }
      await reload()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{rows.length} anggota aktif</p>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Tambah Siswa
        </Button>
      </div>

      {msg && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100">{msg}</div>}

      <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nama</TableHead>
              <TableHead className="text-xs">NISN</TableHead>
              <TableHead className="text-xs">Kelas</TableHead>
              <TableHead className="text-xs text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 mx-auto animate-spin" />
              </TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-slate-400">
                <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Belum ada anggota. Klik Tambah Siswa.
              </TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.siswa_id}>
                <TableCell className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.nama_lengkap}</TableCell>
                <TableCell className="text-xs text-slate-500 dark:text-slate-400">{r.nisn}</TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-400">{r.kelas_label}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-600 hover:text-rose-700"
                    onClick={() => handleRemove(r)} disabled={pending && removingId === r.siswa_id}>
                    {pending && removingId === r.siswa_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pickerOpen && (
        <SiswaPicker
          ekskulId={ekskulId}
          kelasList={kelasList}
          onClose={(added) => { setPickerOpen(false); if (added) reload() }}
        />
      )}
    </div>
  )
}
