// Firebase Messaging Service Worker
// This handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: These values will be replaced at build time or you can hardcode them
firebase.initializeApp({
  apiKey: "AIzaSyDnPeoxF97c22DF0evdQSCb8GybKV5FoLE",
  authDomain: "gas-booking-7ba4d.firebaseapp.com",
  projectId: "gas-booking-7ba4d",
  storageBucket: "gas-booking-7ba4d.firebasestorage.app",
  messagingSenderId: "994025048168",
  appId: "1:994025048168:web:52abb55204b0cd3f4393dd",
  measurementId: "G-6VFMS88YG7"
});


const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
 
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/mainIcon.png',
    badge: '/mainIcon.png',
    tag: payload.data?.orderId || 'default',
    data: payload.data,
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          // Navigate to order if orderId exists
          if (data?.orderId) {
            client.navigate(`/orders/${data.orderId}`);
          }
          return client.focus();
        }
      }
      
      // Otherwise open new window
      if (clients.openWindow) {
        const url = data?.orderId ? `/orders/${data.orderId}` : '/dashboard';
        return clients.openWindow(url);
      }
    })
  );
});

// Handle push event directly (fallback)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received');
  
  if (event.data) {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Push payload:', payload);
  }
});

