'use client';

import { useState, useEffect, useCallback } from 'react';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
      setPermission(Notification.permission);
      if (sub) console.log('🛒 Active push subscription found:', sub.endpoint);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [checkSubscription]);

  const base64UrlToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  async function subscribe() {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error('VAPID public key not found');
      }

      const applicationServerKey = base64UrlToUint8Array(publicVapidKey);
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Kirim sub ke server
      const response = await fetch('/api/web-push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sub),
      });

      if (!response.ok) throw new Error('Gagal menyimpan ke server');
      
      console.log('✅ Push notification enabled & saved to server!');
      setSubscription(sub);
      setPermission(Notification.permission);
      return { success: true };
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    try {
      setLoading(true);
      if (subscription) {
        // Hapus dari server
        await fetch('/api/web-push/register', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
        setSubscription(null);
        setPermission(Notification.permission);
      }
      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      setLoading(false);
    }
  }

  return {
    isSupported,
    subscription,
    permission,
    loading,
    subscribe,
    unsubscribe,
    refresh: checkSubscription
  };
}
