'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export function PushNotificationBanner() {
  const { isSupported, permission, subscription, loading, subscribe } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Tampilkan jika:
    // 1. Browser mendukung push
    // 2. Belum ada izin (default) ATAU sudah granted tapi entah kenapa subscription hilang (misal ganti browser)
    // 3. Bukan sedang loading pemeriksaan awal
    if (isSupported && !loading) {
      if (permission === 'default' || (permission === 'granted' && !subscription)) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }
  }, [isSupported, permission, subscription, loading]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem] z-[100] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-500">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden relative">
        {/* Dekorasi top border gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-blue-500 blur-md opacity-20 rounded-full" />
              <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Bell className="h-6 w-6 fill-blue-600/20" />
              </div>
            </div>
            
            <div className="flex-1 pt-1 pr-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1.5">
                Jangan Lewatkan Info Penting!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Aktifkan notifikasi untuk mendapat pemberitahuan instan tentang <strong className="text-slate-900 dark:text-white font-semibold">Penugasan Piket</strong>, <strong className="text-slate-900 dark:text-white font-semibold">Undangan Rapat</strong>, dan info madrasah lainnya.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pt-2">
            {permission === 'denied' ? (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium px-4 py-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl w-full justify-center border border-rose-100 dark:border-rose-900/50">
                <ShieldAlert className="h-4 w-4" />
                Akses Notifikasi Diblokir
              </div>
            ) : (
              <Button 
                onClick={() => subscribe()} 
                disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Ya, Aktifkan Sekarang!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
