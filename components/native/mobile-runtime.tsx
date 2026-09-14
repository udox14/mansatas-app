'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { AlertCircle, BellRing, CheckCircle2, ExternalLink, Loader2, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OfflineBanner } from './offline-banner'
import {
  downloadAndOpenNativeFile,
  NATIVE_DOWNLOAD_EVENT,
  type NativeDownloadEventDetail,
} from '@/lib/pdf/download'
import { createNativePrintWindow, printDocumentNative } from '@/lib/native-print'

export type MobileBackMode = 'history' | 'confirm-exit' | 'exit'
export type DisplayScale = 'small' | 'normal' | 'large' | 'xlarge'

export type MobileRuntimeSettings = {
  backMode: MobileBackMode
  haptics: boolean
  externalLinksInApp: boolean
  displayScale: DisplayScale
}

export const MOBILE_SETTINGS_KEY = 'mansatas_mobile_runtime_settings'
const PENDING_FCM_TOKEN_KEY = 'mansatas_pending_fcm_token'
const CURRENT_FCM_TOKEN_KEY = 'mansatas_current_fcm_token'

function isLikelyFileUrl(rawUrl: string, anchor?: HTMLAnchorElement | null) {
  if (!rawUrl) return false
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return true
  if (anchor?.hasAttribute('download')) return true

  const url = new URL(rawUrl, window.location.origin)
  const pathAndQuery = `${url.pathname}${url.search}`.toLowerCase()
  if (/\.(?:pdf|docx?|xlsx?|csv|zip|rar|7z|odt|ods|pptx?|txt|rtf|jpe?g|png|webp)(?:$|[?#])/i.test(rawUrl)) return true
  if (/(?:^|[\/_-])(download|unduh|export|lampiran|attachment|berkas|spb)(?:$|[\/_?&=-])/i.test(pathAndQuery)) return true
  if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && anchor?.target === '_blank') return true
  return false
}

export const DEFAULT_MOBILE_SETTINGS: MobileRuntimeSettings = {
  backMode: 'history',
  haptics: true,
  externalLinksInApp: true,
  displayScale: 'normal',
}

const DISPLAY_SCALE_PERCENT: Record<DisplayScale, number> = {
  small: 90,
  normal: 100,
  large: 112,
  xlarge: 125,
}

export function applyDisplayScale(scale: DisplayScale) {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = `${DISPLAY_SCALE_PERCENT[scale] || 100}%`
  document.documentElement.dataset.displayScale = scale
}

export function readMobileRuntimeSettings(): MobileRuntimeSettings {
  if (typeof window === 'undefined') return DEFAULT_MOBILE_SETTINGS

  try {
    const raw = window.localStorage.getItem(MOBILE_SETTINGS_KEY)
    if (!raw) return DEFAULT_MOBILE_SETTINGS
    return { ...DEFAULT_MOBILE_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_MOBILE_SETTINGS
  }
}

export function writeMobileRuntimeSettings(settings: MobileRuntimeSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MOBILE_SETTINGS_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('mansatas-mobile-settings-change'))
}

export async function unregisterNativePushToken() {
  if (typeof window === 'undefined') return
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHE' })
  const token =
    window.localStorage.getItem(CURRENT_FCM_TOKEN_KEY) ||
    window.localStorage.getItem(PENDING_FCM_TOKEN_KEY)
  if (!token) return

  await fetch('/api/fcm/register', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  }).catch(() => {})
  window.localStorage.removeItem(CURRENT_FCM_TOKEN_KEY)
  window.localStorage.removeItem(PENDING_FCM_TOKEN_KEY)
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mansatas.app'
const NATIVE_VERIFIED_KEY = 'mansatas_native_verified'

type AndroidAccessState = 'allowed' | 'blocked'
type NativePushGateState = 'hidden' | 'prompt' | 'denied' | 'requesting' | 'error'

const NATIVE_PUSH_REQUEST_EVENT = 'mansatas-request-native-push'

function checkIsNativeAndroidSync(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.sessionStorage.getItem(NATIVE_VERIFIED_KEY) === '1') {
      return true
    }
  } catch {}

  const cap = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
    }
  }).Capacitor

  if (cap && typeof cap.isNativePlatform === 'function') {
    const isNative = Boolean(cap.isNativePlatform() && cap.getPlatform?.() === 'android')
    if (isNative) {
      try {
        window.sessionStorage.setItem(NATIVE_VERIFIED_KEY, '1')
      } catch {}
      return true
    }
  }

  return false
}

export function MobileRuntime({
  androidPlayStoreRequired = false,
  isAndroidRequest = false,
}: {
  androidPlayStoreRequired?: boolean
  isAndroidRequest?: boolean
}) {
  const pathname = usePathname()
  const [playStoreRequired, setPlayStoreRequired] = useState(androidPlayStoreRequired)
  // Mulai langsung dengan 'allowed' agar tidak ada flicker layar hitam saat transisi rute/fitur.
  // Pengecekan native berjalan senyap di background.
  const [androidAccess, setAndroidAccess] = useState<AndroidAccessState>(() => {
    if (!androidPlayStoreRequired || !isAndroidRequest) return 'allowed'
    if (checkIsNativeAndroidSync()) return 'allowed'
    return 'allowed'
  })
  const [isOffline, setIsOffline] = useState(false)
  const [hasSwUpdate, setHasSwUpdate] = useState(false)
  const [nativePushGate, setNativePushGate] = useState<NativePushGateState>('hidden')
  const [downloadState, setDownloadState] = useState<{
    phase: 'idle' | 'loading' | 'success' | 'error'
    filename?: string
    message?: string
  }>({ phase: 'idle' })
  const isAuthenticatedArea =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/portal-ortu') && !pathname.startsWith('/portal-ortu/login'))

  useEffect(() => {
    setPlayStoreRequired(androidPlayStoreRequired)
  }, [androidPlayStoreRequired])

  useEffect(() => {
    if (!isAndroidRequest) return

    let cancelled = false
    const refreshRequirement = () => {
      fetch('/api/public/mobile-access', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!cancelled && typeof data?.androidPlayStoreRequired === 'boolean') {
            setPlayStoreRequired(data.androidPlayStoreRequired)
          }
        })
        .catch(() => {})
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshRequirement()
    }
    refreshRequirement()
    const interval = window.setInterval(refreshRequirement, 60_000)
    window.addEventListener('focus', refreshRequirement)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshRequirement)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAndroidRequest])

  useEffect(() => {
    if (!playStoreRequired || !isAndroidRequest) {
      setAndroidAccess('allowed')
      return
    }

    // Jika sudah diverifikasi native di session ini atau via window.Capacitor, loloskan langsung.
    if (checkIsNativeAndroidSync()) {
      setAndroidAccess('allowed')
      return
    }

    let cancelled = false
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (cancelled) return
        const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
        if (isAndroidApp) {
          try {
            window.sessionStorage.setItem(NATIVE_VERIFIED_KEY, '1')
          } catch {}
          setAndroidAccess('allowed')
        } else {
          setAndroidAccess('blocked')
        }
      })
      .catch(() => {
        if (!cancelled) setAndroidAccess('blocked')
      })

    return () => { cancelled = true }
  }, [playStoreRequired, isAndroidRequest])

  useEffect(() => {
    const apply = () => applyDisplayScale(readMobileRuntimeSettings().displayScale)
    apply()
    window.addEventListener('mansatas-mobile-settings-change', apply)
    return () => window.removeEventListener('mansatas-mobile-settings-change', apply)
  }, [])

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | undefined
    const handleDownload = (event: Event) => {
      const detail = (event as CustomEvent<NativeDownloadEventDetail>).detail
      if (!detail) return
      if (dismissTimer) clearTimeout(dismissTimer)
      setDownloadState({
        phase: detail.phase === 'start' ? 'loading' : detail.phase,
        filename: detail.filename,
        message: detail.message,
      })
      if (detail.phase !== 'start') {
        dismissTimer = setTimeout(() => setDownloadState({ phase: 'idle' }), detail.phase === 'error' ? 6000 : 2500)
      }
    }
    window.addEventListener(NATIVE_DOWNLOAD_EVENT, handleDownload)
    return () => {
      if (dismissTimer) clearTimeout(dismissTimer)
      window.removeEventListener(NATIVE_DOWNLOAD_EVENT, handleDownload)
    }
  }, [])

  // Status jaringan native dengan fallback browser.
  useEffect(() => {
    let networkListener: { remove: () => Promise<void> } | null = null

    async function initNetwork() {
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setIsOffline(!status.connected)
        networkListener = await Network.addListener('networkStatusChange', (nextStatus) => {
          setIsOffline(!nextStatus.connected)
        })
      } catch {
        setIsOffline(!navigator.onLine)
      }
    }

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    initNetwork()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      networkListener?.remove().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleSwUpdate = () => setHasSwUpdate(true)
    window.addEventListener('mansatas-sw-update-available', handleSwUpdate)
    return () => window.removeEventListener('mansatas-sw-update-available', handleSwUpdate)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!isAuthenticatedArea) {
      if (pathname === '/login' || pathname.startsWith('/portal-ortu/login')) {
        navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHE' })
      }
      return
    }

    let cancelled = false
    fetch('/api/auth/get-session', { credentials: 'include', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (cancelled || !data?.session?.id) return
        navigator.serviceWorker.controller?.postMessage({
          type: 'SET_CACHE_CONTEXT',
          context: data.session.id,
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isAuthenticatedArea, pathname])

  // FCM baru dimulai setelah pengguna masuk. Pada aplikasi native, izin tidak lagi
  // diminta diam-diam: layar wajib izin di bawah memicu permintaan dari aksi pengguna.
  useEffect(() => {
    if (!isAuthenticatedArea) {
      setNativePushGate('hidden')
      return
    }

    const listeners: { remove: () => Promise<void> }[] = []
    let cancelled = false
    let requestInFlight = false

    async function registerTokenWithServer(token: string, platform: string) {
      window.localStorage.setItem(CURRENT_FCM_TOKEN_KEY, token)
      window.localStorage.setItem(PENDING_FCM_TOKEN_KEY, token)
      const response = await fetch('/api/fcm/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, platform }),
      })
      if (!response.ok) throw new Error(`FCM token register failed (${response.status})`)
      window.localStorage.removeItem(PENDING_FCM_TOKEN_KEY)
    }

    async function initPush() {
      const [{ Capacitor, registerPlugin }, { PushNotifications }, { App }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/push-notifications'),
        import('@capacitor/app'),
      ])
      if (cancelled || !Capacitor.isNativePlatform()) return

      const platform = Capacitor.getPlatform()
      const NotificationSettings = registerPlugin<{
        check: () => Promise<{ enabled: boolean }>
      }>('NotificationSettings')
      listeners.push(
        await PushNotifications.addListener('registration', (token) => {
          registerTokenWithServer(token.value, platform).catch((error) => {
            console.error('FCM token belum tersimpan:', error)
          })
        }),
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('FCM registration error:', error)
        }),
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          window.dispatchEvent(new CustomEvent('mansatas-push-received', { detail: notification }))
        }),
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const target = action?.notification?.data?.url
          if (typeof target !== 'string' || !target) return
          window.location.href = target.startsWith('http')
            ? target
            : new URL(target, window.location.origin).href
        }),
      )

      async function registerDevice() {
        if (platform === 'android') {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Notifikasi Utama',
            description: 'Notifikasi penting dari MANSATAS App',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true,
          }).catch(() => {})
        }

        const pendingToken = window.localStorage.getItem(PENDING_FCM_TOKEN_KEY)
        if (pendingToken) await registerTokenWithServer(pendingToken, platform).catch(() => {})
        await PushNotifications.register()
      }

      async function refreshPermission() {
        const [permission, systemStatus] = await Promise.all([
          PushNotifications.checkPermissions(),
          NotificationSettings.check(),
        ])
        if (cancelled) return
        if (permission.receive === 'granted' && systemStatus.enabled) {
          setNativePushGate('hidden')
          await registerDevice()
        } else {
          setNativePushGate(
            permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale'
              ? 'prompt'
              : 'denied',
          )
        }
      }

      async function requestPermission() {
        if (requestInFlight) return
        requestInFlight = true
        setNativePushGate('requesting')
        try {
          const permission = await PushNotifications.requestPermissions()
          if (cancelled) return
          if (permission.receive === 'granted') {
            setNativePushGate('hidden')
            await registerDevice()
          } else {
            setNativePushGate('denied')
          }
        } catch (error) {
          console.error('Permintaan izin notifikasi gagal:', error)
          if (!cancelled) setNativePushGate('error')
        } finally {
          requestInFlight = false
        }
      }

      const handlePermissionRequest = () => { void requestPermission() }
      const handleAppFocus = () => { void refreshPermission() }
      window.addEventListener(NATIVE_PUSH_REQUEST_EVENT, handlePermissionRequest)
      window.addEventListener('focus', handleAppFocus)
      listeners.push({
        remove: async () => {
          window.removeEventListener(NATIVE_PUSH_REQUEST_EVENT, handlePermissionRequest)
          window.removeEventListener('focus', handleAppFocus)
        },
      })
      listeners.push(await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refreshPermission()
      }))

      await refreshPermission()
    }

    const retryPendingToken = async () => {
      const token = window.localStorage.getItem(PENDING_FCM_TOKEN_KEY)
      if (!token) return
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return
      registerTokenWithServer(token, Capacitor.getPlatform()).catch(() => {})
    }

    window.addEventListener('focus', retryPendingToken)
    initPush().catch((error) => console.error('FCM init gagal:', error))

    return () => {
      cancelled = true
      window.removeEventListener('focus', retryPendingToken)
      listeners.forEach((listener) => listener.remove().catch(() => {}))
    }
  }, [isAuthenticatedArea])

  // Form logout portal orang tua harus mencabut token perangkat sebelum sesi ditutup.
  useEffect(() => {
    const handleSubmit = async (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null
      if (!form || !form.action.includes('/api/auth/sign-out') || form.dataset.pushCleaned === 'true') return
      event.preventDefault()
      form.dataset.pushCleaned = 'true'
      await unregisterNativePushToken()
      form.submit()
    }
    document.addEventListener('submit', handleSubmit, true)
    return () => document.removeEventListener('submit', handleSubmit, true)
  }, [])

  // Listener native umum: tombol back, link, PDF, dan window.open.
  useEffect(() => {
    let backListener: { remove: () => Promise<void> } | null = null
    let linkHandler: ((event: MouseEvent) => void) | null = null
    let originalWindowOpen: typeof window.open | null = null
    let originalWindowPrint: typeof window.print | null = null
    let originalAnchorClick: typeof HTMLAnchorElement.prototype.click | null = null
    let iframeObserver: MutationObserver | null = null
    let cancelled = false

    async function boot() {
      const [{ Capacitor }, { App }, { Browser }, { Haptics, ImpactStyle }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/app'),
        import('@capacitor/browser'),
        import('@capacitor/haptics'),
      ])
      if (cancelled || !Capacitor.isNativePlatform()) return

      originalWindowOpen = window.open
      window.open = (url?: string | URL, target?: string, features?: string) => {
        const rawUrl = typeof url === 'string' ? url : url?.toString() || ''
        if (!rawUrl && target === '_blank') return createNativePrintWindow()

        if (rawUrl) {
          const fullUrl = rawUrl.startsWith('/') ? `${window.location.origin}${rawUrl}` : rawUrl
          const isFile = isLikelyFileUrl(fullUrl)

          if (isFile) {
            downloadAndOpenNativeFile(fullUrl).catch(console.error)
            return null
          }

          const isSameOrigin = fullUrl.startsWith(window.location.origin)
          if (isSameOrigin && fullUrl.toLowerCase().includes('print')) {
            window.location.href = fullUrl
            return null
          }

          if (target === '_blank') {
            Browser.open({ url: fullUrl }).catch(() => {
              window.location.href = fullUrl
            })
            return null
          }
        }
        return originalWindowOpen ? originalWindowOpen.call(window, url, target, features) : null
      }

      originalWindowPrint = window.print
      window.print = () => {
        void printDocumentNative(document).catch((error) => {
          console.error('[NativePrint] Gagal mencetak halaman:', error)
          window.alert('Gagal membuka dialog cetak Android.')
        })
      }

      const patchFramePrint = (frame: HTMLIFrameElement) => {
        const patch = () => {
          try {
            if (!frame.contentWindow || !frame.contentDocument) return
            frame.contentWindow.print = () => {
              if (!frame.contentDocument) return
              void printDocumentNative(frame.contentDocument).catch(console.error)
            }
          } catch {
            // Iframe lintas origin tidak boleh diakses dan bukan dokumen cetak aplikasi.
          }
        }
        frame.addEventListener('load', patch)
        patch()
      }
      document.querySelectorAll('iframe').forEach(patchFramePrint)
      iframeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLIFrameElement) patchFramePrint(node)
            if (node instanceof HTMLElement) node.querySelectorAll('iframe').forEach(patchFramePrint)
          })
        }
      })
      iframeObserver.observe(document.documentElement, { childList: true, subtree: true })

      originalAnchorClick = HTMLAnchorElement.prototype.click
      HTMLAnchorElement.prototype.click = function nativeDownloadClick() {
        const href = this.href
        if (this.hasAttribute('download') || href.startsWith('blob:')) {
          void downloadAndOpenNativeFile(href, this.getAttribute('download') || undefined).catch(console.error)
          return
        }
        originalAnchorClick?.call(this)
      }

      const getSettings = () => readMobileRuntimeSettings()
      backListener = await App.addListener('backButton', async ({ canGoBack }) => {
        // A dashboard sheet consumes Back before page navigation or exit preferences.
        const overlayBack = new Event('mansatas:close-overlay', { cancelable: true })
        if (!window.dispatchEvent(overlayBack)) return
        const settings = getSettings()
        if (settings.haptics) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})

        if (settings.backMode === 'exit') {
          App.exitApp()
          return
        }
        if (canGoBack || window.history.length > 1) {
          window.history.back()
          return
        }
        if (settings.backMode === 'confirm-exit') {
          if (window.confirm('Keluar dari MANSATAS App?')) App.exitApp()
          return
        }
        App.exitApp()
      })

      linkHandler = (event: MouseEvent) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null
        if (!anchor?.href) return

        const href = anchor.href
        const isFile = isLikelyFileUrl(href, anchor)
        const isPrintRoute = href.includes('/print') || href.includes('print-ckh')

        if (isFile) {
          event.preventDefault()
          downloadAndOpenNativeFile(href, anchor.getAttribute('download') || undefined).catch(console.error)
          return
        }
        if (isPrintRoute) {
          event.preventDefault()
          window.location.href = href
          return
        }
        if (!getSettings().externalLinksInApp) return
        if (!href.startsWith(window.location.origin) && /^https?:\/\//i.test(href)) {
          event.preventDefault()
          Browser.open({ url: href }).catch(() => {
            window.location.href = href
          })
        }
      }
      document.addEventListener('click', linkHandler, true)
    }

    boot().catch(() => {})
    return () => {
      cancelled = true
      backListener?.remove().catch(() => {})
      if (linkHandler) document.removeEventListener('click', linkHandler, true)
      if (originalWindowOpen) window.open = originalWindowOpen
      if (originalWindowPrint) window.print = originalWindowPrint
      if (originalAnchorClick) HTMLAnchorElement.prototype.click = originalAnchorClick
      iframeObserver?.disconnect()
    }
  }, [])

  return (
    <>
      {androidAccess === 'blocked' && (
        <div
          className="fixed inset-0 z-[2147483647] flex min-h-[100dvh] items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
        >
          <Card className="w-full max-w-sm border-border bg-card text-card-foreground shadow-2xl rounded-2xl">
            <CardHeader className="flex flex-col items-center text-center pb-3 pt-6 sm:pt-7">
              {/* Logo Resmi MANSATAS App */}
              <div className="relative mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background p-2 shadow-sm">
                <Image
                  src="/icon-192x192.png"
                  alt="Logo MANSATAS App"
                  width={64}
                  height={64}
                  className="h-full w-full object-contain rounded-xl"
                  priority
                />
              </div>

              <Badge variant="secondary" className="mb-2 text-[11px] font-medium text-muted-foreground">
                MAN 1 Tasikmalaya
              </Badge>

              <CardTitle className="text-xl font-bold tracking-tight">
                Gunakan MANSATAS App
              </CardTitle>

              <CardDescription className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                Untuk kemudahan presensi harian, akses fitur lebih cepat, dan notifikasi madrasah langsung di perangkat Android, silakan gunakan aplikasi resmi.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-3 pt-1 pb-6 sm:pb-7">
              <Button asChild size="lg" className="w-full h-11 gap-2 font-semibold shadow-sm">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>Buka di Google Play</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download MANSATAS App di Google Play (buka tab baru)"
                className="transition-opacity hover:opacity-80"
              >
                <Image
                  src="/google-play-badge.png"
                  alt="Get it on Google Play"
                  width={3840}
                  height={1138}
                  className="h-10 w-auto object-contain"
                />
              </a>

              <div className="mt-2 w-full border-t border-border pt-4 text-center">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Pengguna komputer/laptop dan iPhone (iOS) tetap dapat mengakses versi web.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {isAuthenticatedArea && nativePushGate !== 'hidden' && (
        <div
          className="fixed inset-0 z-[2147483646] flex min-h-[100dvh] items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="native-push-title"
          aria-describedby="native-push-description"
        >
          <Card className="w-full max-w-sm rounded-2xl border-amber-200 bg-white text-slate-950 shadow-2xl dark:border-amber-900 dark:bg-slate-950 dark:text-slate-50">
            <CardHeader className="items-center pb-3 pt-6 text-center">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <BellRing className="h-7 w-7" />
              </div>
              <CardTitle id="native-push-title" className="text-xl">
                Notifikasi wajib diaktifkan
              </CardTitle>
              <CardDescription id="native-push-description" className="mt-1.5 leading-relaxed">
                {nativePushGate === 'denied'
                  ? 'Notifikasi MANSATAS sedang diblokir. Buka pengaturan aplikasi, pilih Notifikasi, lalu aktifkan izin notifikasi.'
                  : nativePushGate === 'error'
                    ? 'Izin notifikasi belum berhasil diperiksa. Silakan coba kembali agar informasi penting tidak terlewat.'
                    : 'Aktifkan notifikasi untuk menerima pengingat KBM, agenda, pengajuan, dan informasi penting lainnya.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <Button
                type="button"
                size="lg"
                className="h-11 w-full gap-2 font-semibold"
                disabled={nativePushGate === 'requesting'}
                onClick={async () => {
                  if (nativePushGate === 'denied') {
                    try {
                      const { registerPlugin } = await import('@capacitor/core')
                      const NotificationSettings = registerPlugin<{ open: () => Promise<void> }>('NotificationSettings')
                      await NotificationSettings.open()
                    } catch (error) {
                      console.error('Gagal membuka pengaturan notifikasi:', error)
                      setNativePushGate('error')
                    }
                    return
                  }
                  window.dispatchEvent(new Event(NATIVE_PUSH_REQUEST_EVENT))
                }}
              >
                {nativePushGate === 'requesting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : nativePushGate === 'denied' ? (
                  <Settings className="h-4 w-4" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                {nativePushGate === 'requesting'
                  ? 'Meminta izin…'
                  : nativePushGate === 'denied'
                    ? 'Buka Pengaturan Notifikasi'
                    : 'Izinkan Notifikasi'}
              </Button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Peringatan ini akan hilang otomatis setelah izin notifikasi aktif.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      <OfflineBanner isOffline={isOffline} hasSwUpdate={hasSwUpdate} />
      {downloadState.phase !== 'idle' && (
        <div
          className={`fixed left-1/2 top-5 z-[10000] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${
            downloadState.phase === 'error'
              ? 'border-rose-200 bg-rose-50/95 text-rose-800'
              : downloadState.phase === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                : 'border-blue-200 bg-blue-50/95 text-blue-800'
          }`}
          role={downloadState.phase === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {downloadState.phase === 'loading' && <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />}
          {downloadState.phase === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
          {downloadState.phase === 'error' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {downloadState.phase === 'loading'
                ? 'Menyiapkan file…'
                : downloadState.phase === 'success'
                  ? 'File siap'
                  : 'Unduhan gagal'}
            </p>
            <p className="mt-0.5 break-words text-xs font-medium opacity-90">
              {downloadState.phase === 'error'
                ? downloadState.message || 'Silakan coba lagi.'
                : downloadState.filename || (downloadState.phase === 'success'
                    ? 'File sudah disimpan atau diteruskan ke aplikasi pilihan.'
                    : 'Mohon tunggu, jangan tutup halaman ini.')}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
