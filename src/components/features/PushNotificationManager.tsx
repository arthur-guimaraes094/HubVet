'use client';

import { useState, useEffect, useId } from 'react';
import { useToast } from '@/components/ui/Toast';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const labelId = useId();
  const { success, error } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function initPushNotifications() {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        if (active) setIsLoading(false);
        return;
      }

      if (active) setIsSupported(true);

      try {
        await navigator.serviceWorker.register('/sw.js');
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        const sub = await registration?.pushManager.getSubscription();
        if (active) {
          setSubscription(sub ?? null);
        }
      } catch (err) {
        console.error('Error initializing push notifications:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    initPushNotifications();

    return () => {
      active = false;
    };
  }, []);

  async function subscribeToPush() {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        error('Permissão de notificações negada no navegador.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error('VAPID public key not found');
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(sub);

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sub),
      });

      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        setSubscription(null);
        throw new Error('Falha ao salvar inscrição de notificação');
      }

      success('Notificações ativadas com sucesso!');
    } catch (err) {
      console.error('Failed to subscribe:', err);
      error('Não foi possível ativar as notificações neste dispositivo.');
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    setIsLoading(true);
    try {
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        setSubscription(null);

        const res = await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });

        if (!res.ok) {
          throw new Error('Falha ao remover inscrição de notificação');
        }

        success('Notificações desativadas.');
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      error('Erro ao desativar notificações.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-error/15 border border-error/30 text-red-800 dark:text-red-200 rounded-xl text-sm font-medium">
        Notificações não suportadas.
      </div>
    );
  }

  const isSubscribed = !!subscription;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-background/50 rounded-xl border border-border-strong">
      <span id={labelId} className="font-semibold text-foreground">
        Permitir Notificações
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isSubscribed}
        aria-labelledby={labelId}
        disabled={isLoading}
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isSubscribed
            ? 'bg-success border-success'
            : 'bg-slate-600 border-border-strong'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
            isSubscribed
              ? 'translate-x-6 bg-success-foreground'
              : 'translate-x-0.5 bg-white'
          }`}
        />
      </button>
    </div>
  );
}
