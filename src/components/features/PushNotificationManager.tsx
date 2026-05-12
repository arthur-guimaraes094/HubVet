'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

// Utility para converter a chave pública VAPID (base64) para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
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
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
      registerServiceWorker();
    } else {
      setIsLoading(false);
    }
  }, []);

  async function registerServiceWorker() {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function subscribeToPush() {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
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

        // Enviar a inscrição para o backend
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sub),
        });

        // alert('Notificações ativadas com sucesso!');
      } else {
        // alert('Permissão de notificação negada.');
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      // alert('Erro ao ativar notificações.');
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    setIsLoading(true);
    try {
      if (subscription) {
        await subscription.unsubscribe();
        setSubscription(null);
        
        // Em um app real, você também chamaria o backend para remover a inscrição do banco.
        // fetch('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        
        // alert('Notificações desativadas.');
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-error/10 text-error rounded-xl text-sm">
        Notificações não suportadas.
      </div>
    );
  }

  const isSubscribed = !!subscription;

  return (
    <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border">
      <span className="font-semibold text-foreground">Permitir Notificações</span>
      
      <button
        type="button"
        disabled={isLoading}
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isSubscribed ? 'bg-success' : 'bg-gray-300 dark:bg-gray-600'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="sr-only">Permitir notificações</span>
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isSubscribed ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
