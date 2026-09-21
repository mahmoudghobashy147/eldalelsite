/* Firebase Cloud Messaging service worker for الدليل الشامل */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA8Xrrp0N0CnDyI-0yvEYFVnh7HYCmH_PQ',
  authDomain: 'eldalel-elshamel.firebaseapp.com',
  projectId: 'eldalel-elshamel',
  storageBucket: 'eldalel-elshamel.firebasestorage.app',
  messagingSenderId: '355717459859',
  appId: '1:355717459859:web:50ef5d6db4fe5a7425c266',
  measurementId: 'G-P9BNJJSHVB'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // لو الرسالة فيها notification payload فـ FCM بيعرضها تلقائيًا في الخلفية.
  // عدم عرض نسخة ثانية هنا يمنع ظهور نفس الإشعار مرتين للمستخدم.
  if (payload.notification) return;

  const data = payload.data || {};
  const title = data.title || 'الدليل الشامل';
  const options = {
    body: data.body || '',
    data: {
      url: data.url || data.link || '/'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
