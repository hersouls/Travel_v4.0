// ============================================
// Cache Warming Service
// Preload critical resources for offline use
// ============================================

// Routes to preload on app start
const CRITICAL_ROUTES = [
  '/',
  '/dashboard',
  '/places',
  '/settings',
]

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
]

/**
 * Check if app is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Listen for online/offline status changes
 */
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Send message to service worker
 */
async function postToServiceWorker(message: unknown): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
    return
  }

  navigator.serviceWorker.controller.postMessage(message)
}

/**
 * Warm caches by sending message to service worker
 */
export async function warmCaches(): Promise<void> {
  if (!isOnline()) {
    console.log('[CacheWarming] Skipping - offline')
    return
  }

  try {
    await postToServiceWorker({
      type: 'WARM_CACHES',
      routes: CRITICAL_ROUTES,
      resources: EXTERNAL_RESOURCES,
    })
    console.log('[CacheWarming] Requested cache warming')
  } catch (error) {
    console.warn('[CacheWarming] Failed to warm caches:', error)
  }
}

/**
 * Register for background sync
 */
export async function registerBackgroundSync(tag: string = 'sync-data'): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // @ts-expect-error - Background Sync API
    if (registration.sync) {
      // @ts-expect-error - Background Sync API
      await registration.sync.register(tag)
      console.log('[CacheWarming] Background sync registered:', tag)
      return true
    }
  } catch (error) {
    console.warn('[CacheWarming] Failed to register background sync:', error)
  }

  return false
}

/**
 * Preload route assets using link preload
 */
export function preloadRoute(path: string): void {
  if (typeof document === 'undefined') return

  // Create preload link
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = path
  link.as = 'document'
  document.head.appendChild(link)
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

/**
 * Cache map tiles for given coordinates
 */
export async function cacheMapTiles(
  lat: number,
  lng: number,
  zoomLevels: number[] = [12, 14, 16]
): Promise<void> {
  if (!isOnline()) return

  // Calculate tile coordinates for each zoom level
  const tileUrls: string[] = []

  for (const zoom of zoomLevels) {
    const { x, y } = latLngToTile(lat, lng, zoom)

    // Cache surrounding tiles (3x3 grid)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tileX = x + dx
        const tileY = y + dy
        tileUrls.push(
          `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`
        )
      }
    }
  }

  // Preload tiles
  await Promise.allSettled(
    tileUrls.map((url) =>
      fetch(url, { mode: 'cors', credentials: 'omit' })
    )
  )

  console.log(`[CacheWarming] Cached ${tileUrls.length} map tiles`)
}

/**
 * Convert lat/lng to tile coordinates
 */
function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  )
  return { x, y }
}

/**
 * Initialize cache warming on app start
 */
export async function initCacheWarming(): Promise<void> {
  // Wait for service worker to be ready
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      await navigator.serviceWorker.ready
      await warmCaches()
    } catch {
      console.warn('[CacheWarming] Service worker not ready')
    }
  }

  // Listen for connection changes
  onConnectionChange((online) => {
    if (online) {
      console.log('[CacheWarming] Back online - warming caches')
      warmCaches()
    }
  })
}
