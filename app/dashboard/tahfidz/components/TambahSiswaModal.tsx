'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Loader2 } from 'lucide-react'
import { searchSiswaGlobal, tambahSiswaTahfidz } from '../actions'

interface TambahSiswaModalProps {
  onSuccess: () => void
}

export function TambahSiswaModal({ onSuccess }: TambahSiswaModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSearch = async () => {
    if (search.length < 3) return
    setIsSearching(true)
    const res = await searchSiswaGlobal(search)
    setResults(res)
    setIsSearching(false)
  }

  const handleAdd = async (siswaId: string) => {
    setIsAdding(true)
    const res = await tambahSiswaTahfidz(siswaId)
    setIsAdding(false)
    if (res.error) {
      setMsg({ ok: false, text: res.error })
      setTimeout(() => setMsg(null), 4000)
    } else {
      setOpen(false)
      onSuccess() // trigger refresh
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 mt-2">
          <Plus className="h-4 w-4 mr-2" />
          Daftarkan Siswa Lainnya
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daftar Siswa ke Program Tahfidz</DialogTitle>
        </DialogHeader>
        
        {msg && (
          <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 text-rose-700'}`}>
            {msg.text}
          </div>
        )}
        
        <div className="space-y-4 pt-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Cari Nama / NISN..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching || search.length < 3}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {results.length === 0 && search.length >= 3 && !isSearching && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">Tidak ada siswa ditemukan.</p>
            )}
            {results.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                <div>
                  <p className="font-semibold text-sm">{s.nama_lengkap}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.nisn} • {s.tingkat}-{s.nomor_kelas} {s.kelompok}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleAdd(s.id)}
                  disabled={isAdding}
                >
                  Pilih
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
