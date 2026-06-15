'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Shuffle, Loader2 } from 'lucide-react'
import { tambahSlotJadwal, hapusSlotJadwal, autoPlotting } from '../actions'

export function JadwalPanel({ jadwal, onFlash }: {
  jadwal: any[]; onFlash: (r: { success?: string; error?: string }) => void
}) {
  const [form, setForm] = useState({ tanggal: '', sesi: '', ruang: '', kapasitas: '36' })
  const [pending, start] = useTransition()

  function add() {
    if (!form.tanggal || !form.sesi || !form.ruang) { onFlash({ error: 'Lengkapi tanggal, sesi, ruang' }); return }
    start(async () => {
      onFlash(await tambahSlotJadwal({ ...form, kapasitas: parseInt(form.kapasitas) || 36 }))
      setForm({ tanggal: '', sesi: '', ruang: '', kapasitas: '36' })
    })
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-3 space-y-3">
        <h4 className="font-semibold text-sm">Tambah Slot Tes</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          <Input placeholder="Sesi (cth: 07:30-09:00)" value={form.sesi} onChange={(e) => setForm({ ...form, sesi: e.target.value })} />
          <Input placeholder="Ruang" value={form.ruang} onChange={(e) => setForm({ ...form, ruang: e.target.value })} />
          <Input type="number" placeholder="Kapasitas" value={form.kapasitas} onChange={(e) => setForm({ ...form, kapasitas: e.target.value })} />
          <Button disabled={pending} onClick={add}><Plus className="h-4 w-4 mr-1" />Tambah</Button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm">Slot Tersedia ({jadwal.length})</h4>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => onFlash(await autoPlotting()))}>
          {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Shuffle className="h-4 w-4 mr-1" />}
          Auto-Plotting (Reguler terverifikasi)
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tanggal</TableHead><TableHead>Sesi</TableHead><TableHead>Ruang</TableHead>
            <TableHead>Kapasitas</TableHead><TableHead className="text-right">Aksi</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {jadwal.map((j) => (
              <TableRow key={j.id}>
                <TableCell>{j.tanggal}</TableCell><TableCell>{j.sesi}</TableCell>
                <TableCell>{j.ruang}</TableCell><TableCell>{j.kapasitas}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => onFlash(await hapusSlotJadwal(j.id)))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {jadwal.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Belum ada slot</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
