'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cancelCutiGuru, previewCutiGuru, saveCutiGuru, type LeaveInput, type loadCutiGuru } from '../cuti-actions'

type Props = Extract<Awaited<ReturnType<typeof loadCutiGuru>>, { people: unknown }> & { today: string }
type Preview = Exclude<Awaited<ReturnType<typeof previewCutiGuru>>, { error: string }>

export function CutiGuruClient({ people, periods, today }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [input, setInput] = useState<LeaveInput | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)
  function edit(next: LeaveInput | null) {
    setInput(next)
    setPreview(null)
    setConfirmed(false)
    setError('')
    setCancelId(null)
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => edit({ guruId: '', mulai: today, selesai: today })} disabled={pending}>Catat cuti</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {input && (
        <form className="space-y-4 rounded-lg border p-4" onSubmit={event => {
          event.preventDefault()
          startTransition(async () => {
            setError('')
            if (!preview) {
              const result = await previewCutiGuru(input).catch(() => ({ error: 'Pemeriksaan gagal. Coba lagi.' }))
              if ('error' in result) setError(result.error ?? 'Gagal memeriksa cuti.')
              else setPreview(result)
              return
            }
            const result = await saveCutiGuru({ ...input, konflik: confirmed ? JSON.stringify(preview.bentrok) : undefined })
              .catch(() => ({ error: 'Cuti gagal disimpan. Coba lagi.' }))
            if (result.error) {
              setError(result.error)
              setPreview(null)
              setConfirmed(false)
            } else {
              edit(null)
              router.refresh()
            }
          })
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Guru
              <select required value={input.guruId} disabled={!!input.id || pending} className="h-9 rounded-md border bg-background px-2" onChange={e => edit({ ...input, guruId: e.target.value, penggantiId: '' })}>
                <option value="">Pilih guru</option>
                {people.filter(p => !p.akun_pengganti_cuti).map(p => <option key={p.id} value={p.id}>{p.nama_lengkap}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Pengganti
              <select value={input.penggantiId || ''} disabled={pending || input.selesai < today} className="h-9 rounded-md border bg-background px-2" onChange={e => edit({ ...input, penggantiId: e.target.value })}>
                <option value="">Tanpa pengganti</option>
                {people.filter(p => p.id !== input.guruId).map(p => <option key={p.id} value={p.id}>{p.nama_lengkap}{p.akun_pengganti_cuti ? ' (akun khusus)' : ''}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Mulai
              <Input required type="date" value={input.mulai} disabled={pending} onChange={e => edit({ ...input, mulai: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">Selesai
              <Input required type="date" min={input.mulai} value={input.selesai} disabled={pending} onChange={e => edit({ ...input, selesai: e.target.value, penggantiId: e.target.value < today ? '' : input.penggantiId })} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">Catatan internal
            <Input value={input.catatan || ''} maxLength={1000} disabled={pending} onChange={e => edit({ ...input, catatan: e.target.value })} />
          </label>
          {preview && <div className="space-y-2 border-t pt-3 text-sm" aria-live="polite">
            <p><strong>Kelas mengajar</strong> {preview.mengajar.join(', ') || 'Tidak ada'}</p>
            <p><strong>Kelas binaan</strong> {preview.binaan.join(', ') || 'Tidak ada'}</p>
            {preview.bentrok.length > 0 && <>
              <p className="font-semibold text-amber-700 dark:text-amber-300">Bentrok jadwal pengganti</p>
              <ul className="max-h-36 list-disc overflow-y-auto pl-5">{preview.bentrok.map(item => <li key={item}>{item}</li>)}</ul>
              <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} /> Tetap tunjuk pengganti ini</label>
            </>}
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || (!!preview?.bentrok.length && !confirmed)}>{preview ? 'Simpan cuti' : 'Periksa penugasan'}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => edit(null)}>Tutup</Button>
          </div>
        </form>
      )}
      <ul className="divide-y rounded-lg border">
        {periods.length === 0 && <li className="p-4 text-sm text-muted-foreground">Belum ada cuti tercatat.</li>}
        {periods.map(row => <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
          <div>
            <p className="font-semibold">{row.guru_nama}</p>
            <p>{row.mulai} – {row.selesai} · {row.dibatalkan ? 'Dibatalkan' : row.selesai < today ? 'Selesai' : row.mulai > today ? 'Terjadwal' : 'Sedang cuti'}</p>
            <p className="text-muted-foreground">{row.pengganti_nama || 'Tanpa pengganti'}</p>
          </div>
          {!row.dibatalkan && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => edit({ id: row.id, versi: row.versi, guruId: row.guru_id, mulai: row.mulai, selesai: row.selesai, catatan: row.catatan || '', penggantiId: row.selesai < today ? '' : row.pengganti_id || '' })}>Ubah</Button>
            <Button size="sm" variant={cancelId === row.id ? 'destructive' : 'ghost'} disabled={pending} onClick={() => {
              if (cancelId !== row.id) return setCancelId(row.id)
              startTransition(async () => {
                const result = await cancelCutiGuru(row.id, row.versi).catch(() => ({ error: 'Cuti gagal dibatalkan. Coba lagi.' }))
                if (result.error) setError(result.error)
                else { edit(null); router.refresh() }
              })
            }}>{cancelId === row.id ? 'Konfirmasi batal' : 'Batalkan cuti'}</Button>
          </div>}
        </li>)}
      </ul>
    </div>
  )
}
