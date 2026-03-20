'use client'

import { useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, AlertCircle, CheckCircle2, UserCog, MapPin, Users } from 'lucide-react'
import { editSiswaLengkap } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
    </Button>
  )
}

export function EditSiswaModal({ isOpen, onClose, siswa, kelasList }: {
  isOpen: boolean; onClose: () => void; siswa: any; kelasList: any[]
}) {
  const [state, formAction] = useActionState(editSiswaLengkap, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  if (!siswa) return null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 bg-surface border-b">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <UserCog className="h-4 w-4 text-blue-600" /> Edit Biodata — <span className="text-blue-600 truncate max-w-[200px]">{siswa.nama_lengkap}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <form action={formAction} className="p-4 space-y-4">
            <input type="hidden" name="id" value={siswa.id} />

            {state?.error && (
              <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
              </div>
            )}
            {state?.success && (
              <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
              </div>
            )}

            <Tabs defaultValue="utama" className="w-full">
              <TabsList className="grid grid-cols-3 w-full bg-surface-3 rounded-md p-0.5 h-8">
                <TabsTrigger value="utama" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
                  <UserCog className="h-3 w-3" /> Utama
                </TabsTrigger>
                <TabsTrigger value="alamat" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
                  <MapPin className="h-3 w-3" /> Alamat
                </TabsTrigger>
                <TabsTrigger value="ortu" className="rounded text-xs data-[state=active]:bg-surface data-[state=active]:shadow-sm gap-1.5">
                  <Users className="h-3 w-3" /> Orang Tua
                </TabsTrigger>
              </TabsList>

              {/* TAB UTAMA */}
              <TabsContent value="utama" className="space-y-3 mt-3 bg-surface p-3 rounded-lg border border-surface-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">NISN</Label>
                    <Input name="nisn" defaultValue={siswa.nisn} required className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">NIS Lokal</Label>
                    <Input name="nis_lokal" defaultValue={siswa.nis_lokal} className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Nama Lengkap</Label>
                  <Input name="nama_lengkap" defaultValue={siswa.nama_lengkap} required className="h-8 text-sm rounded-md bg-surface-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">NIK</Label>
                    <Input name="nik" defaultValue={siswa.nik} className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Jenis Kelamin</Label>
                    <Select name="jenis_kelamin" defaultValue={siswa.jenis_kelamin}>
                      <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L" className="text-xs">Laki-laki</SelectItem>
                        <SelectItem value="P" className="text-xs">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Tempat Lahir</Label>
                    <Input name="tempat_lahir" defaultValue={siswa.tempat_lahir} className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Tanggal Lahir</Label>
                    <Input type="date" name="tanggal_lahir" defaultValue={siswa.tanggal_lahir} className="h-8 text-xs rounded-md bg-surface-2" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Kelas</Label>
                    <Select name="kelas_id" defaultValue={siswa.kelas?.id || 'none'}>
                      <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs text-slate-400">Tanpa Kelas</SelectItem>
                        {kelasList.map(k => (
                          <SelectItem key={k.id} value={k.id} className="text-xs">
                            {k.tingkat}-{k.nomor_kelas} {k.kelompok}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Status Siswa</Label>
                    <Select name="status" defaultValue={siswa.status}>
                      <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktif" className="text-xs">Aktif</SelectItem>
                        <SelectItem value="lulus" className="text-xs">Lulus</SelectItem>
                        <SelectItem value="pindah" className="text-xs">Pindah</SelectItem>
                        <SelectItem value="keluar" className="text-xs">Keluar/DO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* TAB ALAMAT */}
              <TabsContent value="alamat" className="space-y-3 mt-3 bg-surface p-3 rounded-lg border border-surface-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Status Domisili / Pesantren</Label>
                  <Select name="tempat_tinggal" defaultValue={siswa.tempat_tinggal}>
                    <SelectTrigger className="h-8 text-xs rounded-md bg-surface-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Non-Pesantren" className="text-xs">Non-Pesantren</SelectItem>
                      <SelectItem value="Pesantren Sukahideng" className="text-xs">Pesantren Sukahideng</SelectItem>
                      <SelectItem value="Pesantren Sukamanah" className="text-xs">Pesantren Sukamanah</SelectItem>
                      <SelectItem value="Pesantren Sukaguru" className="text-xs">Pesantren Sukaguru</SelectItem>
                      <SelectItem value="Pesantren Al-Ma'mur" className="text-xs">Pesantren Al-Ma'mur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Alamat Lengkap</Label>
                  <Input name="alamat_lengkap" defaultValue={siswa.alamat_lengkap} className="h-8 text-sm rounded-md bg-surface-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Desa / Kelurahan</Label>
                    <Input name="desa_kelurahan" defaultValue={siswa.desa_kelurahan} className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Kecamatan</Label>
                    <Input name="kecamatan" defaultValue={siswa.kecamatan} className="h-8 text-sm rounded-md bg-surface-2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">No. WhatsApp</Label>
                  <Input name="nomor_whatsapp" defaultValue={siswa.nomor_whatsapp} placeholder="0812..." className="h-8 text-sm rounded-md bg-surface-2" />
                </div>
              </TabsContent>

              {/* TAB ORANG TUA */}
              <TabsContent value="ortu" className="space-y-3 mt-3 bg-surface p-3 rounded-lg border border-surface-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Nomor KK</Label>
                  <Input name="nomor_kk" defaultValue={siswa.nomor_kk} className="h-8 text-sm rounded-md bg-surface-2" />
                </div>
                <div className="border border-surface-2 p-3 rounded-lg bg-slate-50/50 space-y-3">
                  <p className="text-xs font-semibold text-slate-600">Data Ayah</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Nama Ayah</Label>
                      <Input name="nama_ayah" defaultValue={siswa.nama_ayah} className="h-8 text-sm rounded-md bg-surface" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Pekerjaan</Label>
                      <Input name="pekerjaan_ayah" defaultValue={siswa.pekerjaan_ayah} className="h-8 text-sm rounded-md bg-surface" />
                    </div>
                  </div>
                </div>
                <div className="border border-surface-2 p-3 rounded-lg bg-slate-50/50 space-y-3">
                  <p className="text-xs font-semibold text-slate-600">Data Ibu</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Nama Ibu</Label>
                      <Input name="nama_ibu" defaultValue={siswa.nama_ibu} className="h-8 text-sm rounded-md bg-surface" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Pekerjaan</Label>
                      <Input name="pekerjaan_ibu" defaultValue={siswa.pekerjaan_ibu} className="h-8 text-sm rounded-md bg-surface" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <SubmitBtn />
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}