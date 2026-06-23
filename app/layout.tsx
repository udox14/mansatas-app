// Lokasi: app/layout.tsx
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { GlobalAlertProvider } from '@/components/ui/global-alert'
import { MobileRuntime } from '@/components/native/mobile-runtime'

export const metadata: Metadata = {
  title: "MANSATAS App",
  description: "MANSATAS App - MAN 1 Tasikmalaya Management Application",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MANSATAS",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Anti-flicker: baca localStorage SEBELUM React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('mansatas_dark');if(d==='true')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        {/* PWA: Apple touch icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* PWA: Register service worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__MANSATAS_DEFERRED_PWA_PROMPT = null;
              window.addEventListener('beforeinstallprompt', function(event) {
                event.preventDefault();
                window.__MANSATAS_DEFERRED_PWA_PROMPT = event;
                window.dispatchEvent(new Event('mansatas-pwa-install-ready'));
              });
              window.addEventListener('appinstalled', function() {
                window.__MANSATAS_DEFERRED_PWA_PROMPT = null;
              });
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        <GlobalAlertProvider />
        <MobileRuntime />
        {children}
      </body>
    </html>
  )
}
