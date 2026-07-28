'use client';

import { useCallback, useEffect, useState } from 'react';

function base64UrlToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

function applicationServerKeysMatch(
  currentKey: ArrayBuffer | null,
  expectedKey: Uint8Array<ArrayBuffer>,
) {
  if (!currentKey || currentKey.byteLength !== expectedKey.byteLength) return false;

  const currentBytes = new Uint8Array(currentKey);
  return currentBytes.every((byte, index) => byte === expectedKey[index]);
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/web-push/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) throw new Error('Gagal menyimpan subscription ke server');
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      let currentSubscription = await registration.pushManager.getSubscription();
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (currentSubscription && publicVapidKey) {
        const expectedKey = base64UrlToUint8Array(publicVapidKey);
        const currentKey = currentSubscription.options.applicationServerKey;

        if (!applicationServerKeysMatch(currentKey, expectedKey)) {
          const oldEndpoint = currentSubscription.endpoint;

          await fetch('/api/web-push/register', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endpoint: oldEndpoint }),
          }).catch(() => undefined);

          await currentSubscription.unsubscribe();
          currentSubscription = null;

          if (Notification.permission === 'granted') {
            currentSubscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: expectedKey,
            });
            await saveSubscription(currentSubscription);
          }
        }
      }

      setSubscription(currentSubscription);
      setPermission(Notification.permission);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);
      void checkSubscription();
    } else {
      setLoading(false);
    }
  }, [checkSubscription]);

  async function subscribe() {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicVapidKey) {
        throw new Error('VAPID public key tidak ditemukan');
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicVapidKey),
      });

      await saveSubscription(newSubscription);
      setSubscription(newSubscription);
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
    refresh: checkSubscription,
  };
}
