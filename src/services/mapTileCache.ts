// ============================================
// Map Tile Cache Service
// Downloads OSM tiles for offline use via Cache API
// ============================================

const TILE_CACHE_NAME = 'moonwave-map-tiles-v1'
const OSM_TILE_URL = 'https://tile.openstreetmap.org'

interface TileBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  zoom: number
}

/**
 * Convert lat/lon to tile coordinates at given zoom
 */
export function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

/**
 * Calculate tile bounds for a bounding box at given zoom levels
 */
export function calculateTileBounds(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  zooms: number[] = [12, 13, 14, 15]
): TileBounds[] {
  return zooms.map(zoom => {
    const topLeft = latLonToTile(maxLat, minLon, zoom)
    const bottomRight = latLonToTile(minLat, maxLon, zoom)
    return {
      minX: topLeft.x,
      maxX: bottomRight.x,
      minY: topLeft.y,
      maxY: bottomRight.y,
      zoom,
    }
  })
}

/**
 * Count total tiles across all zoom levels
 */
export function countTiles(bounds: TileBounds[]): number {
  return bounds.reduce((sum, b) => {
    return sum + (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1)
  }, 0)
}

/**
 * Generate tile URLs for given bounds
 */
export function generateTileUrls(bounds: TileBounds[]): string[] {
  const urls: string[] = []
  for (const b of bounds) {
    for (let x = b.minX; x <= b.maxX; x++) {
      for (let y = b.minY; y <= b.maxY; y++) {
        urls.push(`${OSM_TILE_URL}/${b.zoom}/${x}/${y}.png`)
      }
    }
  }
  return urls
}

/**
 * Download and cache tiles with progress callback
 */
export async function cacheTiles(
  urls: string[],
  onProgress?: (cached: number, total: number) => void
): Promise<{ cached: number; failed: number }> {
  const cache = await caches.open(TILE_CACHE_NAME)
  let cached = 0
  let failed = 0
  const total = urls.length

  // Download in batches of 6 to avoid overwhelming the server
  const BATCH_SIZE = 6
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        // Check if already cached
        const existing = await cache.match(url)
        if (existing) {
          cached++
          onProgress?.(cached + failed, total)
          return
        }
        const response = await fetch(url)
        if (response.ok) {
          await cache.put(url, response)
          cached++
        } else {
          failed++
        }
        onProgress?.(cached + failed, total)
      })
    )
  }

  return { cached, failed }
}

/**
 * Get cached tile count
 */
export async function getCachedTileCount(): Promise<number> {
  try {
    const cache = await caches.open(TILE_CACHE_NAME)
    const keys = await cache.keys()
    return keys.length
  } catch {
    return 0
  }
}

/**
 * Clear all cached tiles
 */
export async function clearTileCache(): Promise<void> {
  await caches.delete(TILE_CACHE_NAME)
}

/**
 * Calculate bounding box from plan coordinates
 */
export function getBoundingBox(coords: Array<{ lat: number; lon: number }>): {
  minLat: number; minLon: number; maxLat: number; maxLon: number
} | null {
  if (coords.length === 0) return null

  let minLat = Infinity, minLon = Infinity
  let maxLat = -Infinity, maxLon = -Infinity

  for (const { lat, lon } of coords) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }

  // Add padding (roughly 1km)
  const PAD = 0.01
  return {
    minLat: minLat - PAD,
    minLon: minLon - PAD,
    maxLat: maxLat + PAD,
    maxLon: maxLon + PAD,
  }
}
