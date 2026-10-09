const CACHE_NAME = "alishop-v33-push";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/css/native-app-bar.css",
  "./assets/css/profile-menu.css",
  "./assets/js/app.js",
  "./assets/js/config.js",
  "./assets/js/profile-menu.js",
  "./assets/js/supabase-client.js",
  "./assets/vendor/supabase.min.js",
  "./assets/vendor/lucide.min.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/badge.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const res = await fetch(asset);
          if (res && res.ok) {
            await cache.put(asset, res);
          }
        } catch (_) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = event.request.url || "";

  // 1. تجاهل تام لطلبات الـ API وقاعدة البيانات وطلبات غير GET
  if (
    event.request.method !== "GET" ||
    requestUrl.includes("supabase.co") ||
    requestUrl.includes("/rest/v1/") ||
    requestUrl.includes("/auth/v1/") ||
    requestUrl.includes("/storage/v1/") ||
    requestUrl.includes("/api/") ||
    requestUrl.startsWith("ws:") ||
    requestUrl.startsWith("wss:") ||
    requestUrl.includes("__aistudio")
  ) {
    // دعه يمر مباشرة دون تدخل الـ Service Worker
    return;
  }

  let url;
  try {
    url = new URL(requestUrl);
  } catch (_) {
    return;
  }

  // تجاهل أي نطاق خارجي آخر (CDNs, خطوط جوجل، إلخ)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. استراتيجية Network First: حاول جلبها من الشبكة أولاً، وإذا تعذر استخدم الـ Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("./offline.html");
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});

// Push Notifications Event Handler (Push API)
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      try {
        data = { body: event.data.text() };
      } catch (__) {
        data = {};
      }
    }
  }

  const title = data.title || 'علي شوب';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: data.icon || './assets/icons/icon-192.png',
    badge: data.badge || './assets/icons/badge.png',
    tag: data.tag || ('alishop-' + Date.now()),
    renotify: Boolean(data.renotify !== false),
    vibrate: [100, 50, 100],
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event Handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (typeof client.navigate === 'function') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
