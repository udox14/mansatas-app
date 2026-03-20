// Lokasi: app/layout.tsx
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { GlobalAlertProvider } from '@/components/ui/global-alert'

export const metadata: Metadata = {
  title: "MANSATAS ERP",
  description: "Sistem Informasi Manajemen Terpadu MAN 1 Tasikmalaya",
  manifest: "/manifest.json",
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
  themeColor: "#059669",
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
        {children}
      </body>
    </html>
  )
}
