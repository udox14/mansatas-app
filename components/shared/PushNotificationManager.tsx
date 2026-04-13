'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PushNotificationManager() {
  const { isSupported, subscription, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return null; // Don't show if not supported
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Memuat...
      </Button>
    );
  }

  if (subscription) {
    return (
      <Button variant="outline" size="sm" onClick={() => unsubscribe()} className="text-red-500 hover:text-red-600 hover:bg-red-50">
        <BellOff className="h-4 w-4 mr-2" />
        Matikan Notifikasi
      </Button>
    );
  } else {
    return (
      <Button variant="default" size="sm" onClick={() => subscribe()} className="bg-primary text-primary-foreground hover:bg-primary/90">
        <Bell className="h-4 w-4 mr-2" />
        Aktifkan Notifikasi
      </Button>
    );
  }
}
