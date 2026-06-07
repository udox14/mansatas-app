'use client'

import { useEffect } from 'react'

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
  useEffect(() => {
    let backListener: { remove: () => Promise<void> } | null = null
    let linkHandler: ((event: MouseEvent) => void) | null = null
    let cancelled = false

    async function boot() {
      const [{ Capacitor }, { App }, { Browser }, { Haptics, ImpactStyle }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/app'),
        import('@capacitor/browser'),
        import('@capacitor/haptics'),
      ])

      if (cancelled || !Capacitor.isNativePlatform()) return

      const getSettings = () => readMobileRuntimeSettings()

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

      linkHandler = (event: MouseEvent) => {
        const settings = getSettings()
        if (!settings.externalLinksInApp) return

        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        if (!anchor) return

        const href = anchor.href
        if (!href || href.startsWith(window.location.origin)) return
        if (!href.startsWith('http://') && !href.startsWith('https://')) return

        event.preventDefault()
        Browser.open({ url: href }).catch(() => {
          window.location.href = href
        })
      }

      document.addEventListener('click', linkHandler)
    }

    boot().catch(() => {})

    return () => {
      cancelled = true
      backListener?.remove().catch(() => {})
      if (linkHandler) document.removeEventListener('click', linkHandler)
    }
  }, [])

  return null
}
