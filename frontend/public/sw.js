// Service Worker for caching lazy-loaded chunks and assets
const CACHE_NAME = 'wms-app-v1';
const STATIC_CACHE_NAME = 'wms-static-v1';
const DYNAMIC_CACHE_NAME = 'wms-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external requests
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Cache strategy for different types of requests
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
    // JavaScript and CSS files - cache first with network fallback
    event.respondWith(cacheFirstStrategy(request, DYNAMIC_CACHE_NAME));
  } else if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/assets/')) {
    // Static assets - cache first
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - network first with cache fallback
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE_NAME));
  } else {
    // HTML pages - network first for fresh content
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME));
  }
});

// Cache first strategy - good for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Serve from cache immediately
      console.log('Serving from cache:', request.url);
      
      // Update cache in background if needed
      updateCacheInBackground(request, cache);
      
      return cachedResponse;
    }

    // Fetch from network and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy - good for dynamic content
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    // Fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for HTML pages
    if (request.destination === 'document') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Offline - WMS</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .offline { color: #666; }
          </style>
        </head>
        <body>
          <div class="offline">
            <h1>🔌 Você está offline</h1>
            <p>Por favor, verifique sua conexão com a internet.</p>
            <button onclick="window.location.reload()">Tentar novamente</button>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Update cache in background for fresh content
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      console.log('Background cache update:', request.url);
    }
  } catch (error) {
    // Ignore background update failures
  }
}

// Handle lazy loading chunk requests with special caching
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LAZY_CHUNK_REQUEST') {
    const { chunkUrl } = event.data;
    
    // Preload and cache the chunk
    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
      fetch(chunkUrl).then(response => {
        if (response.ok) {
          cache.put(chunkUrl, response.clone());
          console.log('Lazy chunk cached:', chunkUrl);
        }
      }).catch(console.error);
    });
  }
});

// Performance optimization: Preload critical chunks
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRELOAD_CHUNKS') {
    const { chunks } = event.data;
    
    chunks.forEach(chunkUrl => {
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        cache.match(chunkUrl).then(cached => {
          if (!cached) {
            fetch(chunkUrl).then(response => {
              if (response.ok) {
                cache.put(chunkUrl, response.clone());
                console.log('Preloaded chunk:', chunkUrl);
              }
            }).catch(console.error);
          }
        });
      });
    });
  }
});