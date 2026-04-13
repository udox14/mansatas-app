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
    <div className="fixed top-0 left-0 right-0 z-[100] p-2 sm:p-4 animate-in slide-in-from-top duration-500">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 shadow-2xl rounded-2xl overflow-hidden flex flex-col sm:flex-row items-center gap-4 p-4 pr-12 relative">
        <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 animate-pulse">
          <Bell className="h-6 w-6" />
        </div>
        
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 italic">
            Aktifkan Notifikasi MANSATAS!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Dapatkan pemberitahuan instan untuk <span className="font-semibold text-blue-600 dark:text-blue-400 text-[10px] uppercase">Penugasan Piket</span>, <span className="font-semibold text-blue-600 dark:text-blue-400 text-[10px] uppercase">Undangan Rapat</span>, dan info penting lainnya.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {permission === 'denied' ? (
            <div className="flex items-center gap-2 text-rose-500 text-xs font-medium px-3 py-2 bg-rose-50 dark:bg-rose-950 rounded-lg border border-rose-100 dark:border-rose-900 w-full justify-center">
              <ShieldAlert className="h-3.5 w-3.5" />
              Notifikasi diblokir browser
            </div>
          ) : (
            <Button 
              onClick={() => subscribe()} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 h-10 w-full sm:w-auto shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-105 active:scale-95"
            >
              Ya, Aktifkan!
            </Button>
          )}
        </div>

        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 sm:top-auto sm:bottom-auto h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          title="Tutup sementara"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
