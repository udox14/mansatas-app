// BUAT FILE BARU
// Lokasi: app/dashboard/siswa/components/edit-modal.tsx
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
    <Button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-12 text-base font-bold">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : 'Simpan Perubahan'}
    </Button>
  )
}

export function EditSiswaModal({ isOpen, onClose, siswa, kelasList }: { isOpen: boolean, onClose: () => void, siswa: any, kelasList: any[] }) {
  const [state, formAction] = useActionState(editSiswaLengkap, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  if (!siswa) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 bg-white border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <UserCog className="h-6 w-6 text-blue-600" /> Edit Biodata Siswa
          </DialogTitle>
          <p className="text-sm text-slate-500">Perbarui data induk milik <strong className="text-slate-700">{siswa.nama_lengkap}</strong></p>
        </DialogHeader>

        <ScrollArea className="h-[70vh]">
          <form action={formAction} className="p-6 space-y-6">
            <input type="hidden" name="id" value={siswa.id} />

            {state?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0"/> {state.error}</div>}
            {state?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0"/> {state.success}</div>}

            <Tabs defaultValue="utama" className="w-full">
              <TabsList className="grid grid-cols-3 w-full bg-slate-200/50 rounded-xl p-1">
                <TabsTrigger value="utama" className="rounded-lg data-[state=active]:bg-white"><UserCog className="h-4 w-4 mr-2"/> Utama</TabsTrigger>
                <TabsTrigger value="alamat" className="rounded-lg data-[state=active]:bg-white"><MapPin className="h-4 w-4 mr-2"/> Alamat</TabsTrigger>
                <TabsTrigger value="ortu" className="rounded-lg data-[state=active]:bg-white"><Users className="h-4 w-4 mr-2"/> Orang Tua</TabsTrigger>
              </TabsList>

              {/* TAB UTAMA */}
              <TabsContent value="utama" className="space-y-4 mt-4 bg-white p-5 rounded-2xl border shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>NISN</Label><Input name="nisn" defaultValue={siswa.nisn} required className="bg-slate-50" /></div>
                  <div className="space-y-2"><Label>NIS Lokal</Label><Input name="nis_lokal" defaultValue={siswa.nis_lokal} className="bg-slate-50" /></div>
                </div>
                <div className="space-y-2"><Label>Nama Lengkap</Label><Input name="nama_lengkap" defaultValue={siswa.nama_lengkap} required className="bg-slate-50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>NIK</Label><Input name="nik" defaultValue={siswa.nik} className="bg-slate-50" /></div>
                  <div className="space-y-2">
                    <Label>Jenis Kelamin</Label>
                    <Select name="jenis_kelamin" defaultValue={siswa.jenis_kelamin}>
                      <SelectTrigger className="bg-slate-50"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Tempat Lahir</Label><Input name="tempat_lahir" defaultValue={siswa.tempat_lahir} className="bg-slate-50" /></div>
                  <div className="space-y-2"><Label>Tanggal Lahir</Label><Input type="date" name="tanggal_lahir" defaultValue={siswa.tanggal_lahir} className="bg-slate-50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kelas (Opsional)</Label>
                    <Select name="kelas_id" defaultValue={siswa.kelas?.id || "none"}>
                      <SelectTrigger className="bg-slate-50"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa Kelas</SelectItem>
                        {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.tingkat}-{k.nomor_kelas} {k.kelompok}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Siswa</Label>
                    <Select name="status" defaultValue={siswa.status}>
                      <SelectTrigger className="bg-slate-50"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="lulus">Lulus</SelectItem><SelectItem value="pindah">Pindah</SelectItem><SelectItem value="keluar">Keluar/DO</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* TAB ALAMAT */}
              <TabsContent value="alamat" className="space-y-4 mt-4 bg-white p-5 rounded-2xl border shadow-sm">
                <div className="space-y-2">
                  <Label>Status Domisili / Pesantren</Label>
                  <Select name="tempat_tinggal" defaultValue={siswa.tempat_tinggal}>
                    <SelectTrigger className="bg-slate-50"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Non-Pesantren">Non-Pesantren</SelectItem>
                      <SelectItem value="Pesantren Sukahideng">Pesantren Sukahideng</SelectItem>
                      <SelectItem value="Pesantren Sukamanah">Pesantren Sukamanah</SelectItem>
                      <SelectItem value="Pesantren Sukaguru">Pesantren Sukaguru</SelectItem>
                      <SelectItem value="Pesantren Al-Ma'mur">Pesantren Al-Ma'mur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Alamat Lengkap (Jalan/Kp)</Label><Input name="alamat_lengkap" defaultValue={siswa.alamat_lengkap} className="bg-slate-50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Desa / Kelurahan</Label><Input name="desa_kelurahan" defaultValue={siswa.desa_kelurahan} className="bg-slate-50" /></div>
                  <div className="space-y-2"><Label>Kecamatan</Label><Input name="kecamatan" defaultValue={siswa.kecamatan} className="bg-slate-50" /></div>
                </div>
                <div className="space-y-2"><Label>No WhatsApp (Aktif)</Label><Input name="nomor_whatsapp" defaultValue={siswa.nomor_whatsapp} placeholder="0812..." className="bg-slate-50" /></div>
              </TabsContent>

              {/* TAB ORANG TUA */}
              <TabsContent value="ortu" className="space-y-4 mt-4 bg-white p-5 rounded-2xl border shadow-sm">
                <div className="space-y-2"><Label>Nomor Kartu Keluarga (KK)</Label><Input name="nomor_kk" defaultValue={siswa.nomor_kk} className="bg-slate-50" /></div>
                
                <div className="border border-slate-100 p-4 rounded-xl bg-slate-50/50 space-y-4">
                  <h4 className="font-bold text-slate-700 text-sm">Data Ayah</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nama Ayah</Label><Input name="nama_ayah" defaultValue={siswa.nama_ayah} className="bg-white" /></div>
                    <div className="space-y-2"><Label>Pekerjaan</Label><Input name="pekerjaan_ayah" defaultValue={siswa.pekerjaan_ayah} className="bg-white" /></div>
                  </div>
                </div>

                <div className="border border-slate-100 p-4 rounded-xl bg-slate-50/50 space-y-4">
                  <h4 className="font-bold text-slate-700 text-sm">Data Ibu</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nama Ibu</Label><Input name="nama_ibu" defaultValue={siswa.nama_ibu} className="bg-white" /></div>
                    <div className="space-y-2"><Label>Pekerjaan</Label><Input name="pekerjaan_ibu" defaultValue={siswa.pekerjaan_ibu} className="bg-white" /></div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="pt-4"><SubmitBtn /></div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}