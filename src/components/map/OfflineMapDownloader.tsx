// ============================================
// Offline Map Downloader
// Downloads OSM tiles for offline use
// ============================================

import { useState } from 'react'
import { Download, Trash2, Loader2, MapPin, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { toast } from '@/stores/uiStore'
import {
  calculateTileBounds,
  countTiles,
  generateTileUrls,
  cacheTiles,
  getCachedTileCount,
  clearTileCache,
  getBoundingBox,
} from '@/services/mapTileCache'
import type { Plan } from '@/types'

interface OfflineMapDownloaderProps {
  plans: Plan[]
  tripTitle: string
}

export function OfflineMapDownloader({ plans, tripTitle }: OfflineMapDownloaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [cachedCount, setCachedCount] = useState(0)

  const coords = plans
    .filter((p) => p.latitude && p.longitude)
    .map((p) => ({ lat: p.latitude!, lon: p.longitude! }))

  const bbox = getBoundingBox(coords)

  const handleOpen = async () => {
    setIsOpen(true)
    const count = await getCachedTileCount()
    setCachedCount(count)
  }

  const handleDownload = async () => {
    if (!bbox) return
    setIsDownloading(true)

    try {
      const bounds = calculateTileBounds(bbox.minLat, bbox.minLon, bbox.maxLat, bbox.maxLon)
      const urls = generateTileUrls(bounds)
      setProgress({ current: 0, total: urls.length })

      const result = await cacheTiles(urls, (current, total) => {
        setProgress({ current, total })
      })

      const count = await getCachedTileCount()
      setCachedCount(count)
      toast.success(`${result.cached}개 타일이 캐시되었습니다`)
    } catch {
      toast.error('타일 다운로드에 실패했습니다')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleClear = async () => {
    await clearTileCache()
    setCachedCount(0)
    toast.success('타일 캐시가 삭제되었습니다')
  }

  const tileCount = bbox
    ? countTiles(calculateTileBounds(bbox.minLat, bbox.minLon, bbox.maxLat, bbox.maxLon))
    : 0

  if (coords.length < 2) return null

  return (
    <>
      <Button
        color="secondary"
        outline
        size="sm"
        leftIcon={<WifiOff className="size-4" />}
        onClick={handleOpen}
      >
        오프라인 지도
      </Button>

      <Dialog open={isOpen} onClose={() => !isDownloading && setIsOpen(false)}>
        <DialogTitle onClose={() => !isDownloading && setIsOpen(false)}>
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-primary-500" />
            오프라인 지도 다운로드
          </div>
        </DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <p className="text-sm font-medium text-[var(--foreground)]">{tripTitle}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {coords.length}개 장소 기준 · 약 {tileCount}개 타일 (zoom 12-15)
              </p>
            </div>

            {cachedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Wifi className="size-4" />
                <span>현재 {cachedCount}개 타일 캐시됨</span>
              </div>
            )}

            {isDownloading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary-500" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    다운로드 중... {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-400">
              OpenStreetMap 타일을 브라우저 캐시에 저장합니다. 오프라인에서 Leaflet 지도를 사용할 수 있습니다.
            </p>
          </div>
        </DialogBody>
        <DialogActions>
          {cachedCount > 0 && (
            <Button
              color="danger"
              outline
              size="sm"
              leftIcon={<Trash2 className="size-4" />}
              onClick={handleClear}
              disabled={isDownloading}
            >
              캐시 삭제
            </Button>
          )}
          <Button
            color="primary"
            size="sm"
            leftIcon={isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            onClick={handleDownload}
            disabled={isDownloading || !bbox}
            isLoading={isDownloading}
          >
            {isDownloading ? '다운로드 중...' : '다운로드'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
