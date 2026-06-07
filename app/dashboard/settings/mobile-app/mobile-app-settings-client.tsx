'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Fingerprint,
  Info,
  MapPin,
  MonitorSmartphone,
  MousePointerClick,
  RotateCcw,
  Share2,
  ShieldCheck,
  Smartphone,
  Vibrate,
  Wifi,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DEFAULT_MOBILE_SETTINGS,
  type MobileBackMode,
  type MobileRuntimeSettings,
  readMobileRuntimeSettings,
  writeMobileRuntimeSettings,
} from '@/components/native/mobile-runtime'

type NativeStatus = {
  native: boolean
  platform: string
  device?: Record<string, unknown>
  network?: Record<string, unknown>
}

type TestLog = {
  tone: 'success' | 'error' | 'info'
  text: string
}

const BACK_OPTIONS: Array<{ value: MobileBackMode; label: string; desc: string }> = [
  { value: 'history', label: 'Balik halaman', desc: 'Back mengikuti riwayat halaman, lalu keluar saat sudah di awal.' },
  { value: 'confirm-exit', label: 'Konfirmasi keluar', desc: 'Back mengikuti riwayat, lalu tanya sebelum menutup aplikasi.' },
  { value: 'exit', label: 'Langsung keluar', desc: 'Tombol back Android langsung menutup aplikasi.' },
]

const CAPABILITY_GROUPS = [
  {
    title: 'Sudah aktif di project ini',
    items: [
      ['App', 'Tombol back Android, status aplikasi, deep link dasar.'],
      ['Browser', 'Membuka link eksternal lewat browser/in-app browser native.'],
      ['Camera', 'Ambil foto dari kamera atau galeri.'],
      ['Push Notifications', 'Permission dan token native; FCM masih perlu konfigurasi Firebase.'],
      ['Haptics', 'Getaran ringan untuk aksi penting.'],
      ['Share', 'Share sheet Android.'],
      ['Geolocation', 'Akses lokasi perangkat.'],
      ['Device', 'Info perangkat, OS, model, dan platform.'],
      ['Network', 'Status koneksi perangkat.'],
      ['Preferences', 'Storage key-value lokal native.'],
      ['Filesystem', 'Baca/tulis file lokal aplikasi.'],
    ],
  },
  {
    title: 'Bisa ditambahkan nanti',
    items: [
      ['Barcode Scanner', 'Scan QR/barcode untuk absensi, pembayaran, atau inventaris.'],
      ['Local Notifications', 'Notifikasi lokal tanpa push server.'],
      ['Keyboard', 'Kontrol tampilan keyboard native.'],
      ['Status Bar', 'Warna/status bar Android.'],
      ['Splash Screen', 'Kontrol splash screen native saat aplikasi dibuka.'],
      ['App Launcher', 'Membuka aplikasi lain dari APK.'],
    ],
  },
]

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function MobileAppSettingsClient() {
  const [settings, setSettings] = useState<MobileRuntimeSettings>(DEFAULT_MOBILE_SETTINGS)
  const [status, setStatus] = useState<NativeStatus>({ native: false, platform: 'web' })
  const [log, setLog] = useState<TestLog>({ tone: 'info', text: 'Belum ada test dijalankan.' })
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setSettings(readMobileRuntimeSettings())

    async function loadStatus() {
      const [{ Capacitor }, { Device }, { Network }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/device'),
        import('@capacitor/network'),
      ])

      const [device, network] = await Promise.all([
        Device.getInfo().catch(error => ({ error: String(error) })),
        Network.getStatus().catch(error => ({ error: String(error) })),
      ])

      setStatus({
        native: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
        device: device as Record<string, unknown>,
        network: network as Record<string, unknown>,
      })
    }

    loadStatus().catch(error => setLog({ tone: 'error', text: `Gagal membaca status native: ${String(error)}` }))
  }, [])

  const updateSetting = <K extends keyof MobileRuntimeSettings>(key: K, value: MobileRuntimeSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    writeMobileRuntimeSettings(next)
    setLog({ tone: 'success', text: 'Pengaturan runtime tersimpan di perangkat ini.' })
  }

  const runTest = async (name: string, task: () => Promise<string>) => {
    setBusy(name)
    try {
      const text = await task()
      setLog({ tone: 'success', text })
    } catch (error) {
      setLog({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(null)
    }
  }

  const diagnostic = useMemo(() => stringify(status), [status])

  return (
    <div className="space-y-4">
      <Card className="rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            Branding APK
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-950">
              <img src="/icon-512x512.png" alt="App icon" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-sm" />
              <p className="mt-2 text-xs font-semibold">Icon APK</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[#0d4f4a] p-3 text-center text-white dark:border-slate-800">
              <img src="/icon-512x512.png" alt="Splash screen" className="mx-auto mt-3 h-16 w-16 object-contain" />
              <p className="mt-4 text-xs font-semibold">Splash</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Sumber branding native</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Icon dan loading screen APK digenerate dari <code>resources/android/icon.png</code> dan <code>resources/android/splash.png</code>. Ganti dua file itu, lalu build APK release.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <strong>Build otomatis:</strong> script <code>android:build:release</code> menerapkan icon dan splash sebelum APK dibuat.
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>Catatan Android:</strong> launcher icon dan splash tidak bisa diganti dari UI setelah APK terinstall; perlu APK baru.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MonitorSmartphone className="h-4 w-4 text-emerald-600" />
                  Status Runtime
                </CardTitle>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Halaman ini tetap aman dibuka dari browser; fitur native penuh aktif saat dibuka dari APK.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge ok={status.native} label={status.native ? 'APK native' : 'Browser/PWA'} />
                <StatusBadge ok={status.platform !== 'web'} label={status.platform} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-56 overflow-auto rounded-lg border bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">{diagnostic}</pre>
            <div className="grid gap-2 sm:grid-cols-3">
              <ActionButton icon={Smartphone} label="Refresh Status" busy={busy === 'status'} onClick={() => runTest('status', async () => {
                const [{ Device }, { Network }] = await Promise.all([import('@capacitor/device'), import('@capacitor/network')])
                const [device, network] = await Promise.all([Device.getInfo(), Network.getStatus()])
                setStatus(prev => ({
                  ...prev,
                  device: device as unknown as Record<string, unknown>,
                  network: network as unknown as Record<string, unknown>,
                }))
                return 'Status perangkat berhasil diperbarui.'
              })} />
              <ActionButton icon={Wifi} label="Cek Network" busy={busy === 'network'} onClick={() => runTest('network', async () => {
                const { Network } = await import('@capacitor/network')
                const next = await Network.getStatus()
                setStatus(prev => ({ ...prev, network: next as unknown as Record<string, unknown> }))
                return `Network: ${next.connected ? 'online' : 'offline'} (${next.connectionType})`
              })} />
              <ActionButton icon={RotateCcw} label="Reset Setting" busy={busy === 'reset'} onClick={() => runTest('reset', async () => {
                setSettings(DEFAULT_MOBILE_SETTINGS)
                writeMobileRuntimeSettings(DEFAULT_MOBILE_SETTINGS)
                return 'Pengaturan runtime dikembalikan ke default.'
              })} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              Log Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg border p-3 text-sm ${log.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : log.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
              {log.text}
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Push native butuh Firebase/FCM untuk token produksi. Tombol permission bisa dites sekarang, tapi pengiriman push APK perlu tahap setup Firebase.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChevronLeft className="h-4 w-4 text-slate-700 dark:text-slate-200" />
            Gesture & Navigasi Android
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            {BACK_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => updateSetting('backMode', option.value)}
                className={`rounded-lg border p-3 text-left transition ${settings.backMode === option.value ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900'}`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{option.desc}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleRow label="Haptic feedback" description="Getaran ringan saat tombol back Android dipakai." checked={settings.haptics} onChange={value => updateSetting('haptics', value)} />
            <ToggleRow label="Link eksternal in-app" description="Link luar domain dibuka lewat browser native Capacitor." checked={settings.externalLinksInApp} onChange={value => updateSetting('externalLinksInApp', value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointerClick className="h-4 w-4 text-indigo-600" />
            Test Fitur Native
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ActionButton icon={Camera} label="Test Kamera" busy={busy === 'camera'} onClick={() => runTest('camera', async () => {
              const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
              const photo = await Camera.getPhoto({ quality: 75, resultType: CameraResultType.Uri, source: CameraSource.Prompt })
              return `Foto diterima: ${photo.webPath || photo.path || 'URI tersedia'}`
            })} />
            <ActionButton icon={Bell} label="Izin Notif" busy={busy === 'push'} onClick={() => runTest('push', async () => {
              const { PushNotifications } = await import('@capacitor/push-notifications')
              const permission = await PushNotifications.requestPermissions()
              if (permission.receive === 'granted') await PushNotifications.register()
              return `Permission push: ${permission.receive}`
            })} />
            <ActionButton icon={MapPin} label="Test Lokasi" busy={busy === 'geo'} onClick={() => runTest('geo', async () => {
              const { Geolocation } = await import('@capacitor/geolocation')
              const permission = await Geolocation.requestPermissions()
              const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
              return `Lokasi: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} (${permission.location})`
            })} />
            <ActionButton icon={Vibrate} label="Test Getar" busy={busy === 'haptics'} onClick={() => runTest('haptics', async () => {
              const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
              await Haptics.impact({ style: ImpactStyle.Medium })
              return 'Haptic feedback dikirim.'
            })} />
            <ActionButton icon={Share2} label="Test Share" busy={busy === 'share'} onClick={() => runTest('share', async () => {
              const { Share } = await import('@capacitor/share')
              await Share.share({ title: 'MANSATAS App', text: 'MANSATAS App', url: 'https://app.mansatas.com/' })
              return 'Share sheet dibuka.'
            })} />
            <ActionButton icon={ExternalLink} label="Buka Website" busy={busy === 'browser'} onClick={() => runTest('browser', async () => {
              const { Browser } = await import('@capacitor/browser')
              await Browser.open({ url: 'https://app.mansatas.com/' })
              return 'Browser native dibuka.'
            })} />
            <ActionButton icon={Database} label="Test Storage" busy={busy === 'prefs'} onClick={() => runTest('prefs', async () => {
              const { Preferences } = await import('@capacitor/preferences')
              await Preferences.set({ key: 'mansatas_mobile_test', value: new Date().toISOString() })
              const value = await Preferences.get({ key: 'mansatas_mobile_test' })
              return `Preferences OK: ${value.value}`
            })} />
            <ActionButton icon={FileText} label="Test File" busy={busy === 'file'} onClick={() => runTest('file', async () => {
              const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
              await Filesystem.writeFile({ path: 'mansatas-mobile-test.txt', data: new Date().toISOString(), directory: Directory.Data, encoding: Encoding.UTF8 })
              const file = await Filesystem.readFile({ path: 'mansatas-mobile-test.txt', directory: Directory.Data, encoding: Encoding.UTF8 })
              return `Filesystem OK: ${String(file.data).slice(0, 32)}`
            })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {CAPABILITY_GROUPS.map(group => (
          <Card key={group.title} className="rounded-lg shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="h-4 w-4 text-teal-600" />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {group.items.map(([name, desc]) => (
                <div key={name} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start gap-2">
                    <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Perubahan UI dan logic web cukup deploy ke domain production. Perubahan plugin native, permission Android, Firebase, ikon, versi aplikasi, atau signing tetap perlu build APK baru.</p>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <span>
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <input className="h-5 w-5 accent-emerald-600" type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  )
}

function ActionButton({ icon: Icon, label, busy, onClick }: { icon: React.ElementType; label: string; busy?: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="h-10 justify-start" disabled={busy} onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span className="truncate">{busy ? 'Memproses...' : label}</span>
    </Button>
  )
}
