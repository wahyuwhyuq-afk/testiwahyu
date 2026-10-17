const CACHE_NAME = 'wahyu-store-v1';
const urlsToCache = [
  '/testiwahyu/',
  '/testiwahyu/index.html',
  '/testiwahyu/manifest.json'
];

// 1. Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa SW baru langsung aktif
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Aktivasi & Hapus Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event (WAJIB ADA AGAR BISA DI-INSTALL)
self.addEventListener('fetch', (event) => {
  // Abaikan request ke Firebase/Firestore agar tidak error
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Kembalikan dari cache jika ada, jika tidak ambil dari internet
      return response || fetch(event.request);
    }).catch(() => {
      // Jika offline dan tidak ada di cache, biarkan gagal (atau tampilkan halaman offline)
    })
  );
});