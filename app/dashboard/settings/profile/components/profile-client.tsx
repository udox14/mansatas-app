// Lokasi: app/dashboard/settings/profile/components/profile-client.tsx
'use client'

import { useState, useRef } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, Save, KeyRound, User, CheckCircle2, AlertCircle, BellRing } from 'lucide-react'
import { updateProfileInfo, updatePassword, uploadAvatarAction } from '../actions'
import { PushNotificationManager } from '@/components/shared/PushNotificationManager'

const initialState = { error: null as string | null, success: null as string | null }

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 500
        let w = img.width, h = img.height
        if (w > h && w > MAX) { h *= MAX / w; w = MAX }
        else if (h > MAX) { w *= MAX / h; h = MAX }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', 0.8)
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

function SubmitProfileBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      Simpan Nama
    </Button>
  )
}

function SubmitPasswordBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg gap-1.5">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
      Ubah Password
    </Button>
  )
}

export function ProfileClient({ profile, email }: { profile: any; email: string }) {
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
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('avatar', compressed)
      const res = await uploadAvatarAction(fd)
      if (res.error) alert(res.error)
      else if (res.url) setAvatarUrl(res.url)
    } catch { alert('Gagal mengunggah foto.') }
    finally { setIsUploading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* KOLOM KIRI — avatar + info */}
      <div className="lg:col-span-1 space-y-4">
        <div className="rounded-xl border border-surface bg-surface p-5 shadow-sm flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative group mb-4">
            <div className={`h-24 w-24 rounded-full overflow-hidden border-2 border-surface bg-surface-3 flex items-center justify-center ${isUploading ? 'opacity-60' : ''}`}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : <span className="text-3xl font-bold text-slate-400 dark:text-slate-500">
                    {profile.nama_lengkap?.charAt(0).toUpperCase() || 'U'}
                  </span>
              }
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-colors"
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{profile.nama_lengkap}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{email}</p>
          <span className="mt-2.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold uppercase tracking-wide rounded-md">
            {profile.role.replace('_', ' ')}
          </span>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Tips Keamanan
          </p>
          <ul className="space-y-1 text-xs text-blue-600 list-disc list-inside">
            <li>Gunakan password yang sulit ditebak.</li>
            <li>Jangan berikan password kepada siapapun.</li>
            <li>Hubungi Admin TU untuk mengubah email.</li>
          </ul>
        </div>
      </div>

      {/* KOLOM KANAN — forms */}
      <div className="lg:col-span-2 space-y-4">

        {/* Form ubah nama */}
        <div className="rounded-xl border border-surface bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 mb-0.5">Informasi Dasar</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Ubah nama tampilan Anda di dalam sistem.</p>

          <form action={profileAction} className="space-y-3 max-w-md">
            {profileState?.error && (
              <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {profileState.error}
              </div>
            )}
            {profileState?.success && (
              <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {profileState.success}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Nama Lengkap</Label>
              <Input name="nama_lengkap" defaultValue={profile.nama_lengkap} required className="h-9 rounded-lg bg-surface-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Email</Label>
              <Input value={email} readOnly className="h-9 rounded-lg bg-surface-3 text-slate-400 dark:text-slate-500 text-sm cursor-not-allowed" />
            </div>
            <SubmitProfileBtn />
          </form>
        </div>

        {/* Form ubah password */}
        <div className="rounded-xl border border-surface bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 mb-0.5">Keamanan Akun</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Perbarui kata sandi Anda secara berkala.</p>

          <form action={passwordAction} className="space-y-3 max-w-md">
            {passwordState?.error && (
              <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {passwordState.error}
              </div>
            )}
            {passwordState?.success && (
              <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {passwordState.success}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Password Baru</Label>
              <Input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" className="h-9 rounded-lg bg-surface-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Konfirmasi Password Baru</Label>
              <Input name="confirm_password" type="password" required minLength={6} placeholder="Ketik ulang password baru" className="h-9 rounded-lg bg-surface-2 text-sm" />
            </div>
            <SubmitPasswordBtn />
          </form>
        </div>

        {/* Form Notifikasi */}
        <div className="rounded-xl border border-surface bg-surface p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Push Notifications</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Terima pemberitahuan saat ada tugas baru, jadwal mengajar, atau undangan rapat langsung di perangkat ini.</p>
              </div>
              <PushNotificationManager />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
