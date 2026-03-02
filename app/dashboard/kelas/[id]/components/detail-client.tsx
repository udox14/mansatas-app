// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/[id]/components/detail-client.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, ArrowLeftRight } from 'lucide-react'
import { MutasiModal } from './mutasi-modal'
import { TambahSiswaModal } from './tambah-siswa-modal'

type SiswaType = {
  id: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  status: string
}

export function DetailKelasClient({ 
  siswaData, 
  kelasId, 
  tingkatKelas 
}: { 
  siswaData: SiswaType[], 
  kelasId: string, 
  tingkatKelas: number 
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isMutasiOpen, setIsMutasiOpen] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaType | null>(null)

  const filteredData = siswaData.filter(s => 
    s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nisn.includes(searchTerm)
  )

  const openMutasiModal = (siswa: SiswaType) => {
    setSelectedSiswa(siswa)
    setIsMutasiOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Cari siswa di kelas ini..."
            className="pl-9 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Tombol Tambah Siswa */}
        <TambahSiswaModal kelasId={kelasId} />
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[80px] font-semibold text-slate-600 text-center">No</TableHead>
              <TableHead className="w-[120px] font-semibold text-slate-600">NISN</TableHead>
              <TableHead className="font-semibold text-slate-600">Nama Lengkap</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">L/P</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Belum ada siswa di kelas ini.</TableCell></TableRow>
            ) : (
              filteredData.map((s, index) => (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                  <TableCell className="font-medium text-slate-900">{s.nisn}</TableCell>
                  <TableCell className="font-medium text-slate-800">{s.nama_lengkap}</TableCell>
                  <TableCell className="text-center">{s.jenis_kelamin}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openMutasiModal(s)}
                      className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Mutasi
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MutasiModal 
        isOpen={isMutasiOpen} 
        onClose={() => setIsMutasiOpen(false)} 
        siswa={selectedSiswa}
        currentKelasId={kelasId}
        tingkat={tingkatKelas}
      />
    </div>
  )
}