const CACHE_NAME = 'buddy-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './orb.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip caching for API calls and health check
    if (event.request.url.includes('/api/') || event.request.url.includes('/health')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
