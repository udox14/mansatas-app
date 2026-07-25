// Lokasi: components/native/mobile-runtime.tsx
'use client'

import { useEffect, useState } from 'react'
import { OfflineBanner } from './offline-banner'
import { downloadAndOpenNativeFile } from '@/lib/pdf/download'

export type MobileBackMode = 'history' | 'confirm-exit' | 'exit'

export type MobileRuntimeSettings = {
  backMode: MobileBackMode
  haptics: boolean
  externalLinksInApp: boolean
}

export const MOBILE_SETTINGS_KEY = 'mansatas_mobile_runtime_settings'

export const DEFAULT_MOBILE_SETTINGS: MobileRuntimeSettings = {
  backMode: 'history',
  haptics: true,
  externalLinksInApp: true,
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

export function MobileRuntime() {
  const [isOffline, setIsOffline] = useState(false)
  const [hasSwUpdate, setHasSwUpdate] = useState(false)

  // ── Network status detection ──────────────────────────────────────────────
  useEffect(() => {
    let networkListener: { remove: () => Promise<void> } | null = null

    async function initNetwork() {
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setIsOffline(!status.connected)

        networkListener = await Network.addListener('networkStatusChange', (s) => {
          setIsOffline(!s.connected)
        })
      } catch {
        // Fallback untuk browser baku
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

  // ── Service Worker Update detection ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const handleSwUpdate = () => setHasSwUpdate(true)
    window.addEventListener('mansatas-sw-update-available', handleSwUpdate)

    return () => {
      window.removeEventListener('mansatas-sw-update-available', handleSwUpdate)
    }
  }, [])

  // ── Native runtime listeners (Capacitor App, FCM, BackButton, Links, PDF, Window.open) ──────
  useEffect(() => {
    let backListener: { remove: () => Promise<void> } | null = null
    let linkHandler: ((event: MouseEvent) => void) | null = null
    const pushListeners: { remove: () => Promise<void> }[] = []
    let cancelled = false
    let originalWindowOpen: typeof window.open | null = null

    async function boot() {
      const [{ Capacitor }, { App }, { Browser }, { Haptics, ImpactStyle }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/app'),
        import('@capacitor/browser'),
        import('@capacitor/haptics'),
      ])

      if (cancelled || !Capacitor.isNativePlatform()) return

      // ── Override window.open untuk membuka PDF & Halaman Cetak di Android ──
      originalWindowOpen = window.open
      window.open = (url?: string | URL, target?: string, features?: string) => {
        if (url && typeof url === 'string') {
          const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
          const isPdfOrFile = fullUrl.match(/\.pdf$/i) ||
            fullUrl.includes('/api/pdf/') ||
            fullUrl.includes('/files/') ||
            fullUrl.includes('download') ||
            fullUrl.includes('/spb')

          if (isPdfOrFile) {
            downloadAndOpenNativeFile(fullUrl).catch(console.error)
            return null
          }

          if (target === '_blank' || fullUrl.includes('print')) {
            Browser.open({ url: fullUrl }).catch(() => {
              window.location.href = fullUrl
            })
            return null
          }
        }

        return originalWindowOpen ? originalWindowOpen.call(window, url, target, features) : null
      }

      // ── FCM: minta izin, register, kirim token ke server ──
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const perm = await PushNotifications.requestPermissions()
        if (perm.receive === 'granted') {
          if (Capacitor.getPlatform() === 'android') {
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
          const regListener = await PushNotifications.addListener('registration', (token) => {
            fetch('/api/fcm/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
            }).catch(() => {})
          })
          const errListener = await PushNotifications.addListener('registrationError', (err) => {
            console.error('FCM registration error:', err)
          })
          const recListener = await PushNotifications.addListener(
            'pushNotificationReceived',
            (notification) => {
              console.log('[FCM] Push received in foreground:', notification)
            }
          )
          const tapListener = await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (action) => {
              const url = action?.notification?.data?.url
              if (url && typeof url === 'string') {
                if (url.startsWith('http')) window.location.href = url
                else window.location.pathname = url
              }
            }
          )
          pushListeners.push(regListener, errListener, recListener, tapListener)
          await PushNotifications.register()
        }
      } catch (e) {
        console.error('FCM init gagal:', e)
      }

      const getSettings = () => readMobileRuntimeSettings()

      // ── Android Back Button ──
      backListener = await App.addListener('backButton', async ({ canGoBack }) => {
        const settings = getSettings()
        if (settings.haptics) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
        }

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

      // ── Interceptor Klik Link (PDF, Lampiran, Cetak, Link Eksternal) ──
      linkHandler = (event: MouseEvent) => {
        const settings = getSettings()
        if (!settings.externalLinksInApp) return

        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        if (!anchor) return

        const href = anchor.href
        if (!href) return

        const isPdfFile = href.match(/\.pdf$/i) ||
          href.includes('/api/pdf/') ||
          href.includes('/files/') ||
          href.includes('download') ||
          href.includes('/spb') ||
          anchor.hasAttribute('download')

        const isPrintRoute = href.includes('/print') || href.includes('print-ckh') || anchor.target === '_blank'

        // 1. Jika link berupa PDF / Lampiran File -> Download & Buka Native Viewer / Share Sheet
        if (isPdfFile) {
          event.preventDefault()
          downloadAndOpenNativeFile(href).catch(console.error)
          return
        }

        // 2. Jika link berupa Halaman Cetak / target="_blank" -> Buka via Native Browser Custom Tab (Mendukung Print)
        if (isPrintRoute) {
          event.preventDefault()
          const fullUrl = href.startsWith('/') ? `${window.location.origin}${href}` : href
          Browser.open({ url: fullUrl }).catch(() => {
            window.location.href = fullUrl
          })
          return
        }

        // 3. Jika link eksternal di luar origin -> Buka via Native Browser
        if (!href.startsWith(window.location.origin) && (href.startsWith('http://') || href.startsWith('https://'))) {
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
      pushListeners.forEach((l) => l.remove().catch(() => {}))
      if (linkHandler) document.removeEventListener('click', linkHandler, true)
      if (originalWindowOpen) window.open = originalWindowOpen
    }
  }, [])

  return <OfflineBanner isOffline={isOffline} hasSwUpdate={hasSwUpdate} />
}
