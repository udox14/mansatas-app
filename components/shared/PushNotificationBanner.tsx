'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Bell, Download, Loader2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

const INSTALL_DISMISSED_KEY = 'mansatas_pwa_install_prompt_v2_dismissed_at';
const PUSH_DISMISSED_KEY = 'mansatas_push_prompt_dismissed_at';
const DISMISS_FOR_MS = 3 * 24 * 60 * 60 * 1000;

function recentlyDismissed(key: string) {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
}

function dismissPrompt(key: string) {
  window.localStorage.setItem(key, String(Date.now()));
}

function PromptCard({
  icon,
  title,
  description,
  action,
  onDismiss,
  tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
  onDismiss: () => void;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card className="overflow-hidden rounded-lg border-slate-200 bg-white/95 shadow-lg shadow-slate-950/10 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:border-slate-800 dark:bg-slate-950/95">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
            tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-50">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={onDismiss}
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {action}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PwaInstallPrompt() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsVisible(!isInstalled && canInstall && !recentlyDismissed(INSTALL_DISMISSED_KEY));
  }, [canInstall, isInstalled]);

  if (!isVisible) return null;

  const close = () => {
    dismissPrompt(INSTALL_DISMISSED_KEY);
    setIsVisible(false);
  };

  return (
    <PromptCard
      icon={<Download className="h-5 w-5" />}
      title="Pasang MANSATAS App"
      description="Buka lebih cepat dari layar utama, tanpa perlu mencari alamat web lagi."
      onDismiss={close}
      action={
        <>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md px-3 text-xs"
            disabled={installing}
            onClick={async () => {
              setInstalling(true);
              await install();
              setInstalling(false);
              close();
            }}
          >
            {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Instal Aplikasi
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-md px-3 text-xs" onClick={close}>
            Nanti
          </Button>
        </>
      }
    />
  );
}

function PushNotificationPrompt() {
  const { isSupported, permission, subscription, loading, subscribe } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Tampilkan jika:
    // 1. Browser mendukung push
    // 2. Belum ada izin (default) ATAU sudah granted tapi entah kenapa subscription hilang (misal ganti browser)
    // 3. Bukan sedang loading pemeriksaan awal
    if (isSupported && !loading) {
      if ((permission === 'default' || permission === 'denied' || (permission === 'granted' && !subscription)) && !recentlyDismissed(PUSH_DISMISSED_KEY)) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }
  }, [isSupported, permission, subscription, loading]);

  if (!isVisible) return null;
  const close = () => {
    dismissPrompt(PUSH_DISMISSED_KEY);
    setIsVisible(false);
  };

  return (
    <PromptCard
      icon={permission === 'denied' ? <ShieldAlert className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      title={permission === 'denied' ? 'Notifikasi diblokir' : 'Aktifkan notifikasi'}
      description={permission === 'denied'
        ? 'Izin notifikasi diblokir di browser. Buka pengaturan situs untuk mengaktifkannya kembali.'
        : 'Terima info penugasan, rapat, dan pengumuman madrasah langsung di perangkat ini.'}
      tone={permission === 'denied' ? 'warning' : 'default'}
      onDismiss={close}
      action={permission === 'denied' ? (
        <Button type="button" variant="secondary" size="sm" className="h-8 rounded-md px-3 text-xs" onClick={close}>
          Mengerti
        </Button>
      ) : (
        <>
          <Button type="button" size="sm" className="h-8 rounded-md px-3 text-xs" onClick={() => subscribe()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Aktifkan
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-md px-3 text-xs" onClick={close}>
            Nanti
          </Button>
        </>
      )}
    />
  );
}

export function PushNotificationBanner() {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[23rem]">
      <PwaInstallPrompt />
      <PushNotificationPrompt />
    </div>
  );
}
