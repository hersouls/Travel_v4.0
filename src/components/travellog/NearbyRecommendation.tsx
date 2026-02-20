// ============================================
// Nearby Place Recommendation Component
// Shows nearby restaurants/attractions near a log
// ============================================

import { useState } from 'react'
import { MapPin, Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useNearbyPlaces } from '@/hooks/useNearbyPlaces'

interface NearbyRecommendationProps {
  latitude: number
  longitude: number
}

export function NearbyRecommendation({ latitude, longitude }: NearbyRecommendationProps) {
  const [expanded, setExpanded] = useState(false)
  const { places, isLoading } = useNearbyPlaces({
    latitude,
    longitude,
    radiusMeters: 500,
    types: ['restaurant', 'cafe', 'tourist_attraction'],
    maxResults: 4,
    enabled: expanded,
  })

  return (
    <div className="mt-2 border-t border-[var(--border)] pt-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        <MapPin className="size-3" />
        <span>주변 추천</span>
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="size-3 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
              검색 중...
            </div>
          ) : places.length === 0 ? (
            <p className="text-xs text-zinc-400">주변 장소가 없습니다</p>
          ) : (
            places.map((place) => (
              <div key={place.placeId} className="flex items-start gap-2">
                {place.photoUrl ? (
                  <img
                    src={place.photoUrl}
                    alt={place.name}
                    className="size-10 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <MapPin className="size-4 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {place.name}
                    </span>
                    <a
                      href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    >
                      <ExternalLink className="size-3 text-zinc-400 hover:text-primary-500" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    {place.rating && (
                      <span className="flex items-center gap-0.5">
                        <Star className="size-2.5 fill-yellow-400 text-yellow-400" />
                        {place.rating}
                      </span>
                    )}
                    {place.distanceMeters && (
                      <span>{place.distanceMeters < 1000 ? `${place.distanceMeters}m` : `${(place.distanceMeters / 1000).toFixed(1)}km`}</span>
                    )}
                    {place.category && <span>{place.category}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
