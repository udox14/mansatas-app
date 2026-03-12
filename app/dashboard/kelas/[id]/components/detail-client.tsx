'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, ArrowLeftRight, UserPlus } from 'lucide-react'
import { MutasiModal } from './mutasi-modal'
import { TambahSiswaModal } from './tambah-siswa-modal'

type SiswaType = { id: string; nisn: string; nama_lengkap: string; jenis_kelamin: string; status: string }

export function DetailKelasClient({ siswaData, kelasId, tingkatKelas }: { siswaData: SiswaType[]; kelasId: string; tingkatKelas: number }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isMutasiOpen, setIsMutasiOpen] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaType | null>(null)

  const filteredData = siswaData.filter(s =>
    s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm)
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Cari siswa..." className="pl-8 h-8 text-sm rounded-md" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <TambahSiswaModal kelasId={kelasId} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="h-9 w-12 text-center text-xs font-semibold text-slate-500">No</TableHead>
              <TableHead className="h-9 w-28 text-xs font-semibold text-slate-500">NISN</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500">Nama Lengkap</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500 text-center w-12">L/P</TableHead>
              <TableHead className="h-9 text-right text-xs font-semibold text-slate-500 px-4 w-24">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-slate-400">Belum ada siswa di kelas ini.</TableCell></TableRow>
            ) : filteredData.map((s, i) => (
              <TableRow key={s.id} className="hover:bg-slate-50/60 border-slate-100 group">
                <TableCell className="text-center text-xs text-slate-400 py-2.5">{i + 1}</TableCell>
                <TableCell className="text-xs font-medium text-slate-600 py-2.5 font-mono">{s.nisn}</TableCell>
                <TableCell className="text-sm font-medium text-slate-800 py-2.5">{s.nama_lengkap}</TableCell>
                <TableCell className="text-center text-xs py-2.5">
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${s.jenis_kelamin === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>{s.jenis_kelamin}</span>
                </TableCell>
                <TableCell className="text-right px-4 py-2.5">
                  <button
                    onClick={() => { setSelectedSiswa(s); setIsMutasiOpen(true) }}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowLeftRight className="h-3 w-3" /> Mutasi
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MutasiModal isOpen={isMutasiOpen} onClose={() => setIsMutasiOpen(false)} siswa={selectedSiswa} currentKelasId={kelasId} tingkat={tingkatKelas} />
    </div>
  )
}