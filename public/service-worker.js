// Talko Service Worker (service-worker.js)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJmhvdT_Riz2y40FR0qtLtbYX2tX0d4CY",
  authDomain: "talko-40a99.firebaseapp.com",
  projectId: "talko-40a99",
  storageBucket: "talko-40a99.firebasestorage.app",
  messagingSenderId: "859502527801",
  appId: "1:859502527801:web:0f28ec7edb60e00d0954e8"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[service-worker.js] Received background message:', payload);

  const title = payload.notification?.title || payload.data?.title || "Talko'dan Yeni Mesaj";
  const body = payload.notification?.body || payload.data?.body || "Mesaj içeriği yükleniyor...";
  const icon = payload.notification?.icon || payload.data?.icon || "https://api.dicebear.com/7.x/identicon/svg?seed=Talko";
  const badge = "https://api.dicebear.com/7.x/identicon/svg?seed=Talko";
  
  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: payload.data?.chatId || 'talko-message',
    renotify: true,
    data: {
      chatId: payload.data?.chatId,
      click_action: payload.data?.click_action || '/'
    }
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click to focus or open appropriate chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const chatId = data.chatId;
  const clickAction = data.click_action || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Look for any existing window of the app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // If a chat ID is supplied, send a message to the client to switch chat
          if (chatId) {
            client.postMessage({
              type: 'NAVIGATE_CHAT',
              chatId: chatId
            });
          }
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        let destinationUrl = clickAction;
        if (chatId) {
          destinationUrl = `${clickAction}#/chat/${chatId}`;
        }
        return clients.openWindow(destinationUrl);
      }
    })
  );
});
