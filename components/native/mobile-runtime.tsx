'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Smartphone } from 'lucide-react'
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

type AndroidAccessState = 'allowed' | 'checking' | 'blocked'

export function MobileRuntime({
  androidPlayStoreRequired = false,
  isAndroidRequest = false,
}: {
  androidPlayStoreRequired?: boolean
  isAndroidRequest?: boolean
}) {
  const pathname = usePathname()
  const [playStoreRequired, setPlayStoreRequired] = useState(androidPlayStoreRequired)
  const [androidAccess, setAndroidAccess] = useState<AndroidAccessState>(
    androidPlayStoreRequired && isAndroidRequest ? 'checking' : 'allowed'
  )
  const [isOffline, setIsOffline] = useState(false)
  const [hasSwUpdate, setHasSwUpdate] = useState(false)
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

    let cancelled = false
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (cancelled) return
        const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
        setAndroidAccess(isAndroidApp ? 'allowed' : 'blocked')
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

  // FCM baru dimulai setelah pengguna masuk. Token yang gagal dikirim karena sesi
  // belum siap disimpan sementara dan dicoba ulang saat aplikasi kembali aktif.
  useEffect(() => {
    if (!isAuthenticatedArea) return

    const listeners: { remove: () => Promise<void> }[] = []
    let cancelled = false

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
      const [{ Capacitor }, { PushNotifications }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/push-notifications'),
      ])
      if (cancelled || !Capacitor.isNativePlatform()) return

      const platform = Capacitor.getPlatform()
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted' || cancelled) return

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

      const pendingToken = window.localStorage.getItem(PENDING_FCM_TOKEN_KEY)
      if (pendingToken) await registerTokenWithServer(pendingToken, platform).catch(() => {})
      await PushNotifications.register()
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
      {androidAccess !== 'allowed' && (
        <div
          className="fixed inset-0 z-[2147483647] flex min-h-[100dvh] items-center justify-center bg-slate-950 px-5 py-8 text-white"
          role={androidAccess === 'blocked' ? 'dialog' : 'status'}
          aria-modal={androidAccess === 'blocked' ? true : undefined}
          aria-live="polite"
        >
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 shadow-2xl shadow-emerald-500/25">
              {androidAccess === 'checking'
                ? <Loader2 className="h-9 w-9 animate-spin" />
                : <Smartphone className="h-9 w-9" />}
            </div>
            {androidAccess === 'checking' ? (
              <>
                <h1 className="mt-6 text-xl font-bold">Memeriksa aplikasi…</h1>
                <p className="mt-2 text-sm text-slate-300">Mohon tunggu sebentar.</p>
              </>
            ) : (
              <>
                <h1 className="mt-6 text-2xl font-bold tracking-tight">Gunakan MANSATAS App</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Akses melalui browser Android telah dialihkan ke aplikasi resmi MANSATAS. Instal atau buka aplikasinya melalui Google Play untuk melanjutkan.
                </p>
                <a
                  href={PLAY_STORE_URL}
                  className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                  rel="noreferrer"
                >
                  Buka di Google Play
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="mt-4 text-xs text-slate-500">Pengguna komputer dan iPhone tetap dapat memakai versi web.</p>
              </>
            )}
          </div>
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
