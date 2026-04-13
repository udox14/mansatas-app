'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Calendar, BookOpen, Clock, Hash } from 'lucide-react'
import { formatNamaKelas } from '@/lib/utils'

interface RiwayatItem {
  id: string
  tanggal: string
  materi: string
  waktu_input: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  nama_mapel: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
}

interface Props {
  data: RiwayatItem[]
}

export function RiwayatMateriTab({ data }: Props) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredData = data.filter(item => 
    item.nama_mapel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.materi.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const fmtTgl = (tgl: string) => {
    return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const fmtWaktu = (iso: string) => {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari mapel atau isi materi..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl"
        />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          <BookOpen className="h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500 font-medium">Riwayat materi tidak ditemukan.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredData.map((item) => (
            <Card key={item.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 group">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white">
                  {/* Left: Info Metadata */}
                  <div className="p-4 md:w-64 bg-slate-50/50 group-hover:bg-indigo-50/30 transition-colors shrink-0">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
                        <Hash className="h-3.5 w-3.5" />
                        {formatNamaKelas(item.tingkat, item.nomor_kelas, item.kelompok)}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 text-xs font-medium">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {fmtTgl(item.tanggal)}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Diinput pukul {fmtWaktu(item.waktu_input)}
                      </div>
                      <div className="mt-1 text-[10px] bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded w-fit font-medium">
                        Jam {item.jam_ke_mulai === item.jam_ke_selesai ? item.jam_ke_mulai : `${item.jam_ke_mulai}-${item.jam_ke_selesai}`}
                      </div>
                    </div>
                  </div>

                  {/* Right: Content */}
                  <div className="p-4 flex-1">
                    <h3 className="font-bold text-slate-800 text-sm mb-2">{item.nama_mapel}</h3>
                    <div className="bg-slate-50/30 p-3 rounded-lg border border-slate-100/50">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap italic">
                        &quot;{item.materi}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
