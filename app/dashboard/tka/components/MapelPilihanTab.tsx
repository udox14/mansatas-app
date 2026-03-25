'use client'
// app/dashboard/tka/components/MapelPilihanTab.tsx

import { useState, useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertMapelPilihan } from '../actions'
import { MAPEL_TKA } from '@/lib/tka/types'

type SiswaRow = {
  id: string; nisn: string; nama_lengkap: string; kelas_id: string
  tingkat: number; nomor_kelas: number; kelompok: string
  mapel_pilihan_1: string | null; mapel_pilihan_2: string | null
}

type Props = {
  siswaList: SiswaRow[]
  rekap: { pilihan1: { mapel: string; count: number }[]; pilihan2: { mapel: string; count: number }[] }
  tahunAjaranId: string
}

const NONE = '__none__'

export function MapelPilihanTab({ siswaList, rekap, tahunAjaranId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [rekapModal, setRekapModal] = useState<{ mapel: string; pilihan: 1 | 2 } | null>(null)
  const [rekapSiswa, setRekapSiswa] = useState<any[]>([])
  const [rekapPage, setRekapPage] = useState(1)
  const [loadingRekap, setLoadingRekap] = useState(false)

  // Optimistic local state untuk update dropdown tanpa reload
  const [localMapel, setLocalMapel] = useState<Record<string, { p1: string | null; p2: string | null }>>(
    () => Object.fromEntries(siswaList.map(s => [s.id, { p1: s.mapel_pilihan_1, p2: s.mapel_pilihan_2 }]))
  )

  const filtered = siswaList.filter(s =>
    s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || s.nisn.includes(search)
  )

  const grouped = filtered.reduce<Record<string, SiswaRow[]>>((acc, s) => {
    const key = `XII ${s.kelompok} ${s.nomor_kelas}`
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  function handleChange(siswaId: string, pilihan: 1 | 2, value: string) {
    const val = value === NONE ? null : value
    // Update optimistic state dulu
    setLocalMapel(prev => ({
      ...prev,
      [siswaId]: {
        p1: pilihan === 1 ? val : prev[siswaId]?.p1 ?? null,
        p2: pilihan === 2 ? val : prev[siswaId]?.p2 ?? null,
      }
    }))
    startTransition(async () => {
      const cur = localMapel[siswaId] ?? { p1: null, p2: null }
      const p1 = pilihan === 1 ? val : cur.p1
      const p2 = pilihan === 2 ? val : cur.p2
      const res = await upsertMapelPilihan(siswaId, tahunAjaranId, p1, p2)
      if (!res.ok) {
        alert('Gagal menyimpan, coba lagi.')
        // Rollback
        setLocalMapel(prev => ({
          ...prev,
          [siswaId]: { p1: cur.p1, p2: cur.p2 }
        }))
      }
    })
  }

  async function openRekap(mapel: string, pilihan: 1 | 2) {
    setRekapModal({ mapel, pilihan })
    setRekapPage(1)
    setLoadingRekap(true)
    try {
      const res = await fetch(
        `/api/tka/siswa-by-mapel?ta=${tahunAjaranId}&mapel=${encodeURIComponent(mapel)}&pilihan=${pilihan}`
      )
      const data = await res.json()
      setRekapSiswa(data.rows ?? [])
    } finally {
      setLoadingRekap(false)
    }
  }

  // Merge rekap
  const rekapMap = new Map<string, { p1: number; p2: number }>()
  for (const r of rekap.pilihan1) rekapMap.set(r.mapel, { p1: r.count, p2: 0 })
  for (const r of rekap.pilihan2) {
    if (rekapMap.has(r.mapel)) rekapMap.get(r.mapel)!.p2 = r.count
    else rekapMap.set(r.mapel, { p1: 0, p2: r.count })
  }
  const rekapArr = [...rekapMap.entries()].sort((a, b) => (b[1].p1 + b[1].p2) - (a[1].p1 + a[1].p2))

  const totalIsi = Object.values(localMapel).filter(v => v.p1 || v.p2).length
  const PER_PAGE = 15
  const pagedRekap = rekapSiswa.slice((rekapPage - 1) * PER_PAGE, rekapPage * PER_PAGE)
  const totalPagesRekap = Math.ceil(rekapSiswa.length / PER_PAGE)

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Siswa Kelas 12', value: siswaList.length, color: '' },
          { label: 'Sudah Pilih Mapel', value: totalIsi, color: 'text-green-600' },
          { label: 'Belum Pilih', value: siswaList.length - totalIsi, color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Rekapitulasi */}
      {rekapArr.length > 0 && (
        <div className="border rounded-lg p-4 bg-white dark:bg-slate-900">
          <p className="text-sm font-medium mb-3">Rekapitulasi Pemilihan Mapel</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {rekapArr.map(([mapel, { p1, p2 }]) => (
              <div key={mapel} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate text-xs">{mapel}</span>
                <button onClick={() => openRekap(mapel, 1)}
                  className="text-xs text-blue-600 hover:underline whitespace-nowrap font-medium">
                  P1: {p1}
                </button>
                <button onClick={() => openRekap(mapel, 2)}
                  className="text-xs text-purple-600 hover:underline whitespace-nowrap font-medium">
                  P2: {p2}
                </button>
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${Math.min(100, ((p1 + p2) / siswaList.length) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Cari nama atau NISN..."
        value={search}
        onChange={e => { setSearch(e.target.value) }}
        className="max-w-xs"
      />

      {/* Tabel per kelas */}
      {Object.entries(grouped).map(([kelas, siswas]) => {
        const isi = siswas.filter(s => localMapel[s.id]?.p1 || localMapel[s.id]?.p2).length
        return (
          <div key={kelas} className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 flex items-center justify-between">
              <span className="font-medium text-sm">{kelas}</span>
              <span className={`text-xs ${isi === siswas.length ? 'text-green-600' : 'text-muted-foreground'}`}>
                {isi}/{siswas.length} terisi
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium w-6">#</th>
                  <th className="text-left px-4 py-2 font-medium">Nama Siswa</th>
                  <th className="text-left px-4 py-2 font-medium w-52">Mapel Pilihan 1</th>
                  <th className="text-left px-4 py-2 font-medium w-52">Mapel Pilihan 2</th>
                </tr>
              </thead>
              <tbody>
                {siswas.map((s, idx) => {
                  const cur = localMapel[s.id] ?? { p1: null, p2: null }
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{s.nama_lengkap}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.nisn}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={cur.p1 ?? NONE} onValueChange={v => handleChange(s.id, 1, v)} disabled={isPending}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih mapel..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Kosong —</SelectItem>
                            {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={cur.p2 ?? NONE} onValueChange={v => handleChange(s.id, 2, v)} disabled={isPending}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih mapel..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Kosong —</SelectItem>
                            {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Modal rekap siswa per mapel */}
      <Dialog open={!!rekapModal} onOpenChange={() => setRekapModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {rekapModal?.mapel}
              <span className="ml-2 text-muted-foreground font-normal">— Pilihan {rekapModal?.pilihan}</span>
            </DialogTitle>
          </DialogHeader>
          {loadingRekap ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Memuat...</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{rekapSiswa.length} siswa</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Nama</th>
                    <th className="text-left py-1.5 font-medium">Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRekap.map((s: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5">{s.nama_lengkap}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">XII {s.kelompok} {s.nomor_kelas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPagesRekap > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <Button size="sm" variant="outline" disabled={rekapPage === 1} onClick={() => setRekapPage(p => p - 1)}>Prev</Button>
                  <span className="text-xs text-muted-foreground">{rekapPage}/{totalPagesRekap}</span>
                  <Button size="sm" variant="outline" disabled={rekapPage === totalPagesRekap} onClick={() => setRekapPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
