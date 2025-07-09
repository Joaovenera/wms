// Service Worker for MWS - Mobile Warehouse System
// Optimized for pallets page performance

const CACHE_VERSION = 'mws-v1.0.0';
const STATIC_CACHE = `mws-static-${CACHE_VERSION}`;
const DATA_CACHE = `mws-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `mws-images-${CACHE_VERSION}`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  // Add other static assets
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/pallets',
  '/api/pallets/next-code',
  '/api/dashboard/stats',
  '/api/positions',
  '/api/products',
  '/api/ucps',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Static assets: Cache first, fallback to network
  static: 'cache-first',
  // API data: Network first, fallback to cache
  api: 'network-first', 
  // Images: Cache first with expiration
  images: 'cache-first-with-refresh',
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DATA_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle image requests
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Default: network first for everything else
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// API request handler - Network first with cache fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const cacheName = DATA_CACHE;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      
      // Only cache GET requests for specific endpoints
      if (shouldCacheApiEndpoint(url.pathname)) {
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed for API request, trying cache:', url.pathname);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Add header to indicate cached response
      const response = cachedResponse.clone();
      response.headers.set('X-Cache-Status', 'hit');
      return response;
    }
    
    // Return error response if no cache
    return new Response(
      JSON.stringify({ error: 'Network error and no cache available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Image request handler - Cache first with background refresh
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached image immediately
    const response = cachedResponse.clone();
    
    // Background refresh if image is old (> 24 hours)
    const cacheDate = new Date(cachedResponse.headers.get('date'));
    const isOld = (Date.now() - cacheDate.getTime()) > 24 * 60 * 60 * 1000;
    
    if (isOld) {
      fetch(request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
        })
        .catch(() => {
          // Ignore background refresh errors
        });
    }
    
    return response;
  }
  
  // Fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return placeholder image for failed requests
    return new Response(
      '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#f0f0f0"/><text x="50" y="50" text-anchor="middle" fill="#999">Image</text></svg>',
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Static asset handler - Cache first
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Static asset failed:', request.url);
    throw error;
  }
}

// Helper functions
function isImageRequest(request) {
  return request.destination === 'image' || 
         /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(request.url);
}

function isStaticAsset(request) {
  return request.destination === 'script' ||
         request.destination === 'style' ||
         request.destination === 'document' ||
         /\.(js|css|html|woff|woff2|ttf|eot)$/i.test(request.url);
}

function shouldCacheApiEndpoint(pathname) {
  return API_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint));
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Handle cache update requests from the app
    const { endpoint, data } = event.data;
    
    if (endpoint && data) {
      caches.open(DATA_CACHE)
        .then(cache => {
          const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
          });
          cache.put(endpoint, response);
        });
    }
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    // Clear specific cache
    const { cacheName } = event.data;
    
    if (cacheName) {
      caches.delete(cacheName)
        .then(() => {
          console.log('[SW] Cache cleared:', cacheName);
        });
    }
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle queued actions when connection is restored
  try {
    const cache = await caches.open(DATA_CACHE);
    const requests = await cache.keys();
    
    // Process any queued offline actions
    for (const request of requests) {
      if (request.url.includes('offline-queue')) {
        const response = await cache.match(request);
        const data = await response.json();
        
        // Process offline action
        await processOfflineAction(data);
        
        // Remove from queue
        await cache.delete(request);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

async function processOfflineAction(data) {
  // Process queued offline actions
  try {
    const response = await fetch(data.url, {
      method: data.method,
      headers: data.headers,
      body: data.body
    });
    
    if (!response.ok) {
      throw new Error('Network response not ok');
    }
    
    console.log('[SW] Offline action processed:', data.url);
  } catch (error) {
    console.error('[SW] Failed to process offline action:', error);
    // Re-queue for retry
  }
}

console.log('[SW] Service Worker loaded');