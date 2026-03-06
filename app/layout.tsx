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
    <html lang="id">
      {/*
        next/font/google dihapus karena tidak kompatibel saat build di Cloudflare Workers.
        Font Inter di-load via CSS variable di globals.css (lihat catatan di bawah).
      */}
      <body style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        <GlobalAlertProvider />
        {children}
      </body>
    </html>
  );
}