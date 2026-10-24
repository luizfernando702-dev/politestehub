/**
 * POLIHUB — PUSH NOTIFICATIONS SERVICE WORKER SCRIPT
 * Suporte a PushEvent nativo e notificationclick
 * Integrado ao Service Worker existente via workbox.importScripts
 */

self.addEventListener('push', (event) => {
  let data = {
    title: 'Nova NF para recebimento',
    body: 'Uma nova NF está disponível para conferência.',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: 'nova-nf-recebimento',
    data: {
      url: '/',
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
        data: {
          ...data.data,
          ...(payload.data || {}),
        },
      };
    } catch {
      const text = event.data.text();
      if (text) {
        data.body = text;
      }
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'nova-nf-recebimento',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Regra 5: O clique NÃO deve direcionar para Recebimentos.
  // Apenas abre o PoliHub ou foca a janela existente caso já esteja aberto.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Se já existe uma janela aberta, foca nela sem alterar a rota
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // 2. Se nenhuma janela estiver aberta, abre a raiz do PoliHub
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
