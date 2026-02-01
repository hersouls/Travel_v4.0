// Moonwave Travel Service Worker v4.0.0
const CACHE_VERSION = 'travel-v4.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const MAP_TILE_CACHE = `${CACHE_VERSION}-tiles`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Cache size limits
const CACHE_LIMITS = {
  dynamic: 100,
  tiles: 500,
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[SW] Failed to cache some static assets:', error);
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('travel-') && !key.startsWith(CACHE_VERSION))
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Handle map tiles separately
  if (isMapTileRequest(url)) {
    event.respondWith(handleMapTile(request));
    return;
  }

  // Handle API requests (network-first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Handle navigation requests (network-first with offline fallback)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Handle static assets (cache-first)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Check if request is for map tiles
function isMapTileRequest(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tiles.stadiamaps.com') ||
    url.hostname.includes('cartodb-basemaps')
  );
}

// Check if request is for static asset
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  );
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(cacheName, CACHE_LIMITS.dynamic);
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Return cached index.html for offline SPA navigation
    const cached = await caches.match('/index.html');
    if (cached) return cached;

    return new Response(
      `<!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>오프라인 - Travel</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #030303;
            color: #edece8;
          }
          .container { text-align: center; padding: 2rem; }
          h1 { color: #2effb4; margin-bottom: 1rem; }
          p { color: #a1a1aa; margin-bottom: 2rem; }
          button {
            background: #2effb4;
            color: #030303;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>오프라인</h1>
          <p>인터넷 연결이 필요합니다.</p>
          <button onclick="location.reload()">다시 시도</button>
        </div>
      </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Handle map tile requests with caching
async function handleMapTile(request) {
  const cache = await caches.open(MAP_TILE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached tile immediately, but revalidate in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response);
          trimCache(MAP_TILE_CACHE, CACHE_LIMITS.tiles);
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(MAP_TILE_CACHE, CACHE_LIMITS.tiles);
    }
    return response;
  } catch (error) {
    // Return a placeholder tile if offline
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
        <rect fill="#1a1a1a" width="256" height="256"/>
        <text x="128" y="128" text-anchor="middle" fill="#3f3f46" font-size="12">
          오프라인
        </text>
      </svg>`,
      {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Trim cache to limit size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle cache warming request
  if (event.data.type === 'WARM_CACHES') {
    const { routes = [], resources = [] } = event.data;
    warmCaches(routes, resources);
  }
});

// Warm caches with specified routes and resources
async function warmCaches(routes, resources) {
  console.log('[SW] Warming caches...');

  const staticCache = await caches.open(STATIC_CACHE);
  const dynamicCache = await caches.open(DYNAMIC_CACHE);

  // Cache routes
  const routePromises = routes.map(async (route) => {
    try {
      const cached = await staticCache.match(route);
      if (!cached) {
        const response = await fetch(route);
        if (response.ok) {
          await staticCache.put(route, response);
          console.log('[SW] Cached route:', route);
        }
      }
    } catch (error) {
      console.warn('[SW] Failed to cache route:', route, error);
    }
  });

  // Cache external resources
  const resourcePromises = resources.map(async (url) => {
    try {
      const cached = await dynamicCache.match(url);
      if (!cached) {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          await dynamicCache.put(url, response);
          console.log('[SW] Cached resource:', url);
        }
      }
    } catch (error) {
      console.warn('[SW] Failed to cache resource:', url, error);
    }
  });

  await Promise.allSettled([...routePromises, ...resourcePromises]);
  console.log('[SW] Cache warming complete');
}

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    // Data is stored locally in IndexedDB, so no server sync needed
    // This is a placeholder for future server sync implementation
  }
});

console.log('[SW] Service Worker loaded');
