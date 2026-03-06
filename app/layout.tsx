// Lokasi: app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. IMPORT GLOBAL ALERT PROVIDER YANG BARU KITA BUAT
import { GlobalAlertProvider } from '@/components/ui/global-alert'

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        
        {/* 2. TARUH PROVIDER DI SINI (PALING ATAS DI DALAM BODY) */}
        <GlobalAlertProvider />
        
        {children}
      </body>
    </html>
  );
}