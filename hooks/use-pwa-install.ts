'use client'

import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type WindowWithPwaPrompt = Window & {
  __MANSATAS_DEFERRED_PWA_PROMPT?: BeforeInstallPromptEvent | null
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    setIsInstalled(isStandaloneMode())

    const syncDeferredPrompt = () => {
      const promptEvent = (window as WindowWithPwaPrompt).__MANSATAS_DEFERRED_PWA_PROMPT
      if (promptEvent && !isStandaloneMode()) {
        setDeferredPrompt(promptEvent)
        setCanInstall(true)
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      ;(window as WindowWithPwaPrompt).__MANSATAS_DEFERRED_PWA_PROMPT = promptEvent
      setDeferredPrompt(promptEvent)
      setCanInstall(!isStandaloneMode())
    }

    const handleInstalled = () => {
      ;(window as WindowWithPwaPrompt).__MANSATAS_DEFERRED_PWA_PROMPT = null
      setDeferredPrompt(null)
      setCanInstall(false)
      setIsInstalled(true)
    }

    syncDeferredPrompt()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('mansatas-pwa-install-ready', syncDeferredPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('mansatas-pwa-install-ready', syncDeferredPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' as const }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    ;(window as WindowWithPwaPrompt).__MANSATAS_DEFERRED_PWA_PROMPT = null
    setDeferredPrompt(null)
    setCanInstall(false)

    return choice
  }, [deferredPrompt])

  return {
    canInstall: canInstall && !isInstalled,
    isInstalled,
    install,
  }
}
