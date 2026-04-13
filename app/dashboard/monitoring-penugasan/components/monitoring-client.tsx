'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Send, Users, CheckCircle2, Clock, CalendarDays, ArrowRight } from 'lucide-react'
import type { MonitoringDelegasi } from '../actions'

export function MonitoringClient({
  initialData, initialTanggal
}: {
  initialData: MonitoringDelegasi[]
  initialTanggal: string
}) {
  const router = useRouter()
  const [tanggal, setTanggal] = useState(initialTanggal)
  const [search, setSearch] = useState('')

  function handleFilter() {
    router.push(`/dashboard/monitoring-penugasan?tanggal=${tanggal}`)
  }

  const filteredData = initialData.filter(d => 
    d.dari_nama.toLowerCase().includes(search.toLowerCase()) ||
    d.kepada_nama.toLowerCase().includes(search.toLowerCase())
  )

  const isSelesai = (status: string) => status === 'SELESAI'

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 md:items-end">
          <div className="space-y-1.5 flex-1">
            <Label>Filter Tanggal</Label>
            <div className="flex gap-2">
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} />
              <Button onClick={handleFilter} className="bg-violet-600 hover:bg-violet-700">Filter</Button>
            </div>
          </div>
          <div className="space-y-1.5 flex-1 cursor-text">
            <Label>Cari Nama Guru</Label>
            <Input type="text" placeholder="Cari nama..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {filteredData.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Tidak ada pendelegasian pada tanggal ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredData.map(dt => (
            <Card key={dt.delegasi_id} className={`shadow-sm overflow-hidden ${isSelesai(dt.status) ? 'border-emerald-200' : ''}`}>
              <CardHeader className={`px-4 py-3 border-b ${isSelesai(dt.status) ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">{dt.dari_nama}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-violet-700">{dt.kepada_nama}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isSelesai(dt.status) ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                  }`}>
                    {dt.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {dt.items.map((item, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                    <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${item.absen_selesai ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      {item.absen_selesai ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium">{item.kelas_label}</span>
                        <span className="text-[11px] text-gray-400">—</span>
                        <span className="text-xs text-gray-500">{item.mapel_nama}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 mt-1">
                        <p className="text-xs text-amber-800 break-words leading-relaxed">
                          <span className="font-semibold mr-1">Tugas:</span>
                          {item.tugas}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
