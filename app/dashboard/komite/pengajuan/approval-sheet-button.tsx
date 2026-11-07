'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BOS_SIGNER_NAME_MAX, BOS_SIGNER_NIP_MAX, BOS_SIGNER_STORAGE_VERSION, DEFAULT_BOS_SIGNER, parseBosSigner, readSavedBosSigner } from '@/lib/komite-approval-sheet'

export function ApprovalSheetButton({ userId }: { userId: string }) {
  const storageKey = `komite-approval-sheet:bos-signer:${userId}`
  const [open, setOpen] = useState(false)
  const [signer, setSigner] = useState(DEFAULT_BOS_SIGNER)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [storageWarning, setStorageWarning] = useState('')

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    if (nextOpen) {
      setError('')
      setStorageWarning('')
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
        setSigner(readSavedBosSigner(saved))
      } catch {
        setSigner(DEFAULT_BOS_SIGNER)
      }
    }
    setOpen(nextOpen)
  }

  function resetSigner() {
    setSigner(DEFAULT_BOS_SIGNER)
    setError('')
    setStorageWarning('')
    try {
      localStorage.removeItem(storageKey)
    } catch {
      setStorageWarning('Pengaturan cetak tidak dapat diubah di penyimpanan browser ini.')
    }
  }

  async function printSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    setStorageWarning('')
    const values = parseBosSigner(signer)
    if (!values) {
      setError('Periksa nama dan NIP Bendahara BOS. NIP boleh kosong atau berisi hingga 18 angka.')
      return
    }

    // Open the viewer from the click so the browser can allow the new tab.
    const viewer = window.open('about:blank', '_blank')
    if (!viewer) {
      setError('Izinkan tab baru untuk membuka PDF, lalu coba cetak kembali.')
      return
    }
    viewer.opener = null
    viewer.document.body.textContent = 'Menyiapkan lembar persetujuan…'
    setPending(true)

    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...values, version: BOS_SIGNER_STORAGE_VERSION }))
    } catch {
      setStorageWarning('Pengaturan cetak tidak dapat disimpan di browser ini.')
    }

    try {
      const response = await fetch('/api/komite/pengajuan/lembar-persetujuan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setError(result?.error || 'Lembar persetujuan gagal dibuat. Silakan coba cetak kembali.')
        viewer.close()
        return
      }
      if (!response.headers.get('Content-Type')?.startsWith('application/pdf')) {
        throw new Error('Invalid PDF response')
      }
      const pdf = await response.blob()
      if (viewer.closed) return
      const url = URL.createObjectURL(pdf)
      viewer.location.replace(url)
      const cleanup = window.setInterval(() => {
        if (!viewer.closed) return
        window.clearInterval(cleanup)
        URL.revokeObjectURL(url)
      }, 1000)
    } catch {
      viewer.close()
      setError('Lembar persetujuan gagal dibuka. Silakan coba cetak kembali.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Printer className="mr-1.5 h-4 w-4" />Cetak Lembar Persetujuan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cetak Lembar Persetujuan</DialogTitle>
          <DialogDescription>Cetak sebelum membuat pengajuan. Serahkan lembar yang sudah ditandatangani kepada Bendahara sebagai dasar persetujuan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={printSheet} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="komite-bos-name">Nama Bendahara BOS</Label>
            <Input id="komite-bos-name" value={signer.name} required maxLength={BOS_SIGNER_NAME_MAX} disabled={pending}
              onChange={event => setSigner({ ...signer, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="komite-bos-nip">NIP Bendahara BOS (opsional)</Label>
            <Input id="komite-bos-nip" value={signer.nip} inputMode="numeric" pattern="[0-9]*" maxLength={BOS_SIGNER_NIP_MAX} disabled={pending}
              onChange={event => setSigner({ ...signer, nip: event.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">Nama dan NIP Bendahara BOS disimpan di browser ini.</p>
          {storageWarning && <p role="status" className="text-sm text-muted-foreground">{storageWarning}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={resetSigner} disabled={pending}>Kembalikan ke bawaan</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {pending ? 'Menyiapkan PDF…' : 'Buka PDF untuk Dicetak'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
