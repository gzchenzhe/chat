const CACHE_NAME = 'wechat-screenshot-pwa-v32';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './vendor/tailwind-local.css',
  './vendor/vue.global.prod.js',
  './vendor/html-to-image.min.js',
  './css/app.css',
  './js/app.js',
  './pic/ios-single-4-dark.png',
  './pic/ios-wifi-3-dark.png',
  './pic/ios-battery-dark.png',
  './pic/wechat-nav-back.png',
  './pic/wechat-nav-right.png',
  './pic/wechat-bottom-icon1.png',
  './pic/wechat-bottom-icon2.png',
  './pic/wechat-bottom-icon3.png',
  './pic/wechat-trans-icon1.png',
  './pic/wechat-trans-icon2.png',
  './pic/wechat-trans-icon3.png',
  './pic/wechat-trans-icon4.png',
  './pic/wechat-trans-earphone.png',
  './pic/wechat-voice-icon1-clean.png',
  './pic/wechat-voice-icon2-clean.png',
  './fonts/sf-pro-text_regular.woff2',
  './fonts/sf-pro-text_medium.woff2',
  './fonts/sf-pro-text_semibold.woff2',
  './fonts/SF-Pro-Display-Bold.otf',
  './fonts/SansStdRegular.ttf',
  './fonts/SansStdMedium.ttf',
  './fonts/SansStdBold.ttf'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
