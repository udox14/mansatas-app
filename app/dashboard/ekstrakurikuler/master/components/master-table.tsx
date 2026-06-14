'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Users, Trophy, Loader2 } from 'lucide-react'
import { EkskulModal } from './ekskul-modal'
import { PembinaPicker } from './pembina-picker'
import { hapusEkskul } from '../actions'
import type { EkskulMaster, GuruOption } from '../actions'

export function MasterTable({ initialList, guruList }: {
  initialList: EkskulMaster[]
  guruList: GuruOption[]
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState<EkskulMaster | null>(null)
  const [pembinaTarget, setPembinaTarget] = useState<EkskulMaster | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const openCreate = () => { setEditData(null); setModalOpen(true) }
  const openEdit = (e: EkskulMaster) => { setEditData(e); setModalOpen(true) }

  const closeModal = (refreshed?: boolean) => {
    setModalOpen(false)
    setEditData(null)
    if (refreshed) router.refresh()
  }
  const closePembina = (refreshed?: boolean) => {
    setPembinaTarget(null)
    if (refreshed) router.refresh()
  }

  const handleDelete = (e: EkskulMaster) => {
    if (!confirm(`Hapus "${e.nama}"? Seluruh anggota, pertemuan, absensi, dan nilai ikut terhapus permanen.`)) return
    setDeletingId(e.id)
    startTransition(async () => {
      const res = await hapusEkskul(e.id)
      setDeletingId(null)
      if (res.error) { alert(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{initialList.length} ekstrakurikuler terdaftar</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
        </Button>
      </div>

      <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nama</TableHead>
              <TableHead className="text-xs">Pembina</TableHead>
              <TableHead className="text-xs text-center">Nilai</TableHead>
              <TableHead className="text-xs text-center">Anggota</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Belum ada ekstrakurikuler. Klik Tambah untuk membuat.
                </TableCell>
              </TableRow>
            ) : initialList.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {e.nama}
                  {e.deskripsi && <p className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">{e.deskripsi}</p>}
                </TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-[220px]">
                  {e.pembina_nama || <span className="text-rose-400 italic">Belum ada</span>}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {e.mode_nilai === 'angka' ? 'Angka' : 'Huruf'}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-slate-700 dark:text-slate-300">{e.jml_anggota}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${e.status === 'aktif' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {e.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPembinaTarget(e)} title="Atur pembina">
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(e)} title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-600 hover:text-rose-700" onClick={() => handleDelete(e)} disabled={pending && deletingId === e.id} title="Hapus">
                    {pending && deletingId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {modalOpen && <EkskulModal isOpen={modalOpen} onClose={closeModal} editData={editData} />}
      {pembinaTarget && <PembinaPicker ekskul={pembinaTarget} guruList={guruList} onClose={closePembina} />}
    </div>
  )
}
