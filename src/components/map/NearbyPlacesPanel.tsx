// ============================================
// Nearby Places Recommendation Panel
// ============================================

import { useState } from 'react'
import { Star, MapPin, Plus, Loader2 } from 'lucide-react'
import { useNearbyPlaces } from '@/hooks/useNearbyPlaces'
import type { NearbyPlace } from '@/types'

const CATEGORY_TABS = [
  { key: 'restaurant', label: '맛집', types: ['restaurant', 'cafe'] },
  { key: 'attraction', label: '관광', types: ['tourist_attraction', 'museum', 'park'] },
  { key: 'shopping', label: '쇼핑', types: ['shopping_mall', 'store'] },
  { key: 'hotel', label: '숙소', types: ['hotel', 'lodging'] },
] as const

interface NearbyPlacesPanelProps {
  latitude: number
  longitude: number
  onAddPlace?: (place: NearbyPlace) => void
  className?: string
}

export function NearbyPlacesPanel({
  latitude,
  longitude,
  onAddPlace,
  className = '',
}: NearbyPlacesPanelProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [enabled, setEnabled] = useState(false)

  const currentCategory = CATEGORY_TABS[activeTab]
  const { places, isLoading } = useNearbyPlaces({
    latitude,
    longitude,
    radiusMeters: 1500,
    types: currentCategory.types as unknown as string[],
    maxResults: 8,
    enabled,
  })

  if (!enabled) {
    return (
      <div className={`${className}`}>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="w-full py-3 text-sm text-center text-primary hover:text-primary/80 transition-colors border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-primary/50"
        >
          <MapPin className="inline-block size-4 mr-1.5 -mt-0.5" />
          주변 장소 추천 보기
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        주변 추천
      </h3>

      {/* Category Tabs */}
      <div className="flex gap-1.5">
        {CATEGORY_TABS.map((tab, i) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              i === activeTab
                ? 'bg-primary/10 text-primary'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-zinc-400" />
        </div>
      ) : places.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">
          주변에 {currentCategory.label}이(가) 없습니다
        </p>
      ) : (
        <div className="grid gap-2">
          {places.map((place) => (
            <div
              key={place.placeId}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {/* Photo */}
              {place.photoUrl ? (
                <img
                  src={place.photoUrl}
                  alt={place.name}
                  className="size-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="size-12 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                  <MapPin className="size-4 text-zinc-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {place.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {place.rating && (
                    <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                      <Star className="size-3 text-amber-500 fill-amber-500" />
                      {place.rating.toFixed(1)}
                      {place.reviewCount && (
                        <span className="text-zinc-400">({place.reviewCount})</span>
                      )}
                    </span>
                  )}
                  {place.distanceMeters && (
                    <span className="text-xs text-zinc-400">
                      {place.distanceMeters >= 1000
                        ? `${(place.distanceMeters / 1000).toFixed(1)}km`
                        : `${place.distanceMeters}m`}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Button */}
              {onAddPlace && (
                <button
                  type="button"
                  onClick={() => onAddPlace(place)}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-zinc-400 hover:text-primary transition-colors flex-shrink-0"
                  title="일정에 추가"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
