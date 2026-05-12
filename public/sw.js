self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json()
      const title = data.title || 'HubVet'
      const options = {
        body: data.body || 'Você tem uma nova notificação.',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/agenda',
        },
      }

      event.waitUntil(self.registration.showNotification(title, options))
    } catch (e) {
      // Falha ao parsear JSON, tenta mostrar como texto puro
      event.waitUntil(
        self.registration.showNotification('HubVet', {
          body: event.data.text(),
          icon: '/icons/icon-192x192.png',
          data: { url: '/agenda' },
        })
      )
    }
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const urlToOpen = event.notification.data.url

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Verifica se já existe uma aba aberta com essa URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Se não tiver, abre uma nova janela/aba
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
