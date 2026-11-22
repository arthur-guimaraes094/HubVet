const CACHE_NAME = 'hubvet-static-v1';
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/templates/papel-timbrado-gabriela.jpg',
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API endpoints or HTML navigation requests (authenticated clinical data)
  if (url.pathname.startsWith('/api/') || event.request.mode === 'navigate') {
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/templates/') ||
    url.pathname === '/manifest.json';

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'HubVet';
      const options = {
        body: data.body || 'Você tem uma nova notificação.',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/agenda',
        },
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      // Falha ao parsear JSON, tenta mostrar como texto puro
      event.waitUntil(
        self.registration.showNotification('HubVet', {
          body: event.data.text(),
          icon: '/icons/icon-192x192.png',
          data: { url: '/agenda' },
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/agenda';
  let resolvedUrl = new URL('/agenda', self.location.origin).href;
  try {
    const candidate = new URL(rawUrl, self.location.origin);
    if (candidate.origin === self.location.origin) {
      resolvedUrl = candidate.href;
    }
  } catch {
    resolvedUrl = new URL('/agenda', self.location.origin).href;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Verifica se já existe uma aba aberta com essa URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === resolvedUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não tiver, abre uma nova janela/aba
      if (clients.openWindow) {
        return clients.openWindow(resolvedUrl);
      }
    })
  );
});
