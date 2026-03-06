// BUAT FILE BARU
// Lokasi: app/dashboard/settings/profile/components/profile-client.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, Save, KeyRound, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { updateProfileInfo, updatePassword, uploadAvatar } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

// Helper Kompresi Gambar agar Avatar tidak bikin penuh database
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 500 // Avatar cukup 500x500 pixel
        let width = img.width
        let height = img.height

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width; width = MAX_SIZE
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height; height = MAX_SIZE
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(blob => {
            if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }))
            else resolve(file)
        }, 'image/jpeg', 0.8) // Kualitas 80%
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

function SubmitProfileBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-white rounded-xl shadow-md gap-2 mt-2">
      {pending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Simpan Nama
    </Button>
  )
}

function SubmitPasswordBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-slate-900 hover:bg-slate-800 h-11 text-white rounded-xl shadow-md gap-2 mt-2">
      {pending ? <Loader2 className="h-4 w-4 animate-spin"/> : <KeyRound className="h-4 w-4"/>} Ubah Password
    </Button>
  )
}

export function ProfileClient({ profile, email }: { profile: any, email: string }) {
  const [profileState, profileAction] = useActionState(updateProfileInfo, initialState)
  const [passwordState, passwordAction] = useActionState(updatePassword, initialState)
  
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const compressedFile = await compressImage(file)
      const formData = new FormData()
      formData.append('avatar', compressedFile)
      
      const res = await uploadAvatar(formData)
      if (res.error) alert(res.error)
      else if (res.url) setAvatarUrl(res.url)
    } catch (err) {
      alert('Gagal mengunggah foto.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* KOLOM KIRI: FOTO PROFIL & INFO DASAR */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col items-center text-center">
          
          <div className="relative group mb-4">
            <div className={`h-32 w-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100 flex items-center justify-center ${isUploading ? 'animate-pulse' : ''}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="text-4xl font-black text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200 w-full h-full flex items-center justify-center">
                  {profile.nama_lengkap?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 h-10 w-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-105"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          <h2 className="text-xl font-bold text-slate-800">{profile.nama_lengkap}</h2>
          <p className="text-sm text-slate-500 font-medium">{email}</p>
          <span className="mt-3 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-full">
            {profile.role.replace('_', ' ')}
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl text-sm text-blue-800">
          <h4 className="font-bold mb-1 flex items-center gap-2"><User className="h-4 w-4"/> Tips Keamanan Akun</h4>
          <ul className="list-disc list-inside space-y-1 opacity-80">
            <li>Gunakan password yang sulit ditebak.</li>
            <li>Jangan berikan password kepada siapapun.</li>
            <li>Hubungi Admin TU jika email Anda perlu diubah.</li>
          </ul>
        </div>
      </div>

      {/* KOLOM KANAN: FORM UPDATE NAMA & PASSWORD */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* FORM UBAH NAMA */}
        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Informasi Dasar</h3>
          <p className="text-sm text-slate-500 mb-6">Ubah nama tampilan Anda di dalam sistem.</p>

          <form action={profileAction} className="space-y-4 max-w-md">
            {profileState?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0"/> {profileState.error}</div>}
            {profileState?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0"/> {profileState.success}</div>}

            <div className="space-y-2">
              <Label className="font-semibold text-slate-600">Nama Lengkap</Label>
              <Input name="nama_lengkap" defaultValue={profile.nama_lengkap} required className="h-12 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-slate-600">Email (Read-Only)</Label>
              <Input value={email} readOnly className="h-12 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed" />
            </div>
            <SubmitProfileBtn />
          </form>
        </div>

        {/* FORM UBAH PASSWORD */}
        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/60 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Keamanan Akun</h3>
          <p className="text-sm text-slate-500 mb-6">Perbarui kata sandi Anda secara berkala.</p>

          <form action={passwordAction} className="space-y-4 max-w-md">
            {passwordState?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0"/> {passwordState.error}</div>}
            {passwordState?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0"/> {passwordState.success}</div>}

            <div className="space-y-2">
              <Label className="font-semibold text-slate-600">Password Baru</Label>
              <Input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" className="h-12 rounded-xl bg-slate-50 focus:bg-white focus:border-slate-800" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-slate-600">Konfirmasi Password Baru</Label>
              <Input name="confirm_password" type="password" required minLength={6} placeholder="Ketik ulang password baru" className="h-12 rounded-xl bg-slate-50 focus:bg-white focus:border-slate-800" />
            </div>
            <SubmitPasswordBtn />
          </form>
        </div>

      </div>
    </div>
  )
}