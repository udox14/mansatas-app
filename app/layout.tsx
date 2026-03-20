// Lokasi: app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { GlobalAlertProvider } from '@/components/ui/global-alert'

export const metadata: Metadata = {
  title: "MANSATAS ERP",
  description: "Sistem Informasi Manajemen Terpadu MAN 1 Tasikmalaya",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/*
          Anti-flicker script: baca localStorage SEBELUM React hydration
          sehingga dark mode langsung aktif tanpa flash of white.
          suppressHydrationWarning di <html> diperlukan karena class berubah
          di client sebelum hydration selesai.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('mansatas_dark');if(d==='true')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        <GlobalAlertProvider />
        {children}
      </body>
    </html>
  );
}