'use client'

import * as React from 'react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { KelasMultiSelect } from './kelas-multi-select'
import { createParentAnnouncement } from './actions'

interface CreatePengumumanModalProps {
  isWaliOnly: boolean
  kelasRows: any[]
  angkatanRows: any[]
}

export function CreatePengumumanModal({
  isWaliOnly,
  kelasRows,
  angkatanRows
}: CreatePengumumanModalProps) {
  const [open, setOpen] = useState(false)
  const [targetScope, setTargetScope] = useState(isWaliOnly ? 'kelas' : 'all')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Buat Pengumuman
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Pengumuman Baru</DialogTitle>
          <DialogDescription>
            Isi formulir di bawah ini untuk membuat pengumuman yang akan tampil di beranda portal orang tua.
          </DialogDescription>
        </DialogHeader>
        
        <form 
          action={async (formData) => {
            await createParentAnnouncement(formData)
            setOpen(false)
          }} 
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Judul</label>
            <input 
              name="title" 
              required 
              placeholder="Masukkan judul pengumuman"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent dark:border-slate-700 dark:text-slate-50" 
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Isi Pengumuman</label>
            <textarea 
              name="body" 
              required 
              rows={5} 
              placeholder="Tulis isi pengumuman di sini..."
              className="flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent dark:border-slate-700 dark:text-slate-50 resize-none" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Target</label>
            <select 
              name="target_scope" 
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-50"
            >
              {!isWaliOnly && <option value="all">Semua Orang Tua</option>}
              <option value="kelas">Kelas Tertentu</option>
              {!isWaliOnly && <option value="angkatan">Satu Angkatan</option>}
            </select>
          </div>

          {targetScope === 'kelas' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Pilih Kelas</label>
              <div className="mt-1">
                <KelasMultiSelect kelasRows={kelasRows} />
              </div>
            </div>
          )}

          {targetScope === 'angkatan' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Pilih Angkatan</label>
              <select 
                name="tingkat" 
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-50"
              >
                <option value="">Pilih angkatan</option>
                {angkatanRows.map((a: any) => (
                  <option key={a.tingkat} value={a.tingkat}>Angkatan Kelas {a.tingkat}</option>
                ))}
              </select>
            </div>
          )}

          {targetScope === 'all' && (
            <div className="space-y-1.5 hidden md:block">
              {/* Empty space filler for layout */}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Waktu Publish (Opsional)</label>
            <input 
              name="publish_at" 
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-50" 
            />
            <p className="text-[10px] text-slate-500">Kosongkan untuk publish sekarang</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Berakhir Pada (Opsional)</label>
            <input 
              name="expires_at" 
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-slate-50" 
            />
            <p className="text-[10px] text-slate-500">Kapan pengumuman ini otomatis diarsipkan</p>
          </div>
          <div className="md:col-span-2 pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Pengumuman
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
