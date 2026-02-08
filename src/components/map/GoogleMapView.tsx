// ============================================
// Google Maps View Component
// ============================================

import { useRef, useEffect } from 'react'
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader'
import { MARKER_COLORS, ROUTE_COLORS } from '@/utils/mapStyles'
import type { Plan, RouteSegment, TravelMode } from '@/types'

interface GoogleMapViewProps {
  plans: Plan[]
  routeSegments?: RouteSegment[]
  center?: { lat: number; lng: number }
  zoom?: number
  className?: string
  onMarkerClick?: (plan: Plan) => void
  mapTypeControl?: boolean
  selectedDay?: number | null
}

export function GoogleMapView({
  plans,
  routeSegments = [],
  center,
  zoom = 13,
  className = '',
  onMarkerClick,
  mapTypeControl = true,
  selectedDay,
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const { isLoaded, isError } = useGoogleMapsLoader()

  // Filter plans
  const filteredPlans = plans.filter((p) => {
    if (!p.latitude || !p.longitude) return false
    if (selectedDay != null && p.day !== selectedDay) return false
    return true
  })

  // Calculate center from plans
  const mapCenter = center || (() => {
    if (filteredPlans.length === 0) return { lat: 37.5665, lng: 126.978 }
    const lats = filteredPlans.map((p) => p.latitude!)
    const lngs = filteredPlans.map((p) => p.longitude!)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  })()

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom,
      mapTypeControl,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      mapId: 'moonwave-travel-map',
    })
  }, [isLoaded])


  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach((m) => (m.map = null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()

    filteredPlans.forEach((plan, index) => {
      const position = { lat: plan.latitude!, lng: plan.longitude! }
      bounds.extend(position)

      const color = MARKER_COLORS[plan.type] || MARKER_COLORS.other

      const pinEl = document.createElement('div')
      pinEl.className = 'google-map-marker'
      pinEl.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; color: white;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `
      pinEl.textContent = `${index + 1}`

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current!,
        position,
        content: pinEl,
        title: plan.placeName,
      })

      marker.addListener('click', () => {
        onMarkerClick?.(plan)
      })

      markersRef.current.push(marker)
    })

    if (filteredPlans.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 60)
    } else if (filteredPlans.length === 1) {
      mapInstanceRef.current.setCenter(bounds.getCenter())
      mapInstanceRef.current.setZoom(15)
    }
  }, [filteredPlans, isLoaded, selectedDay])

  // Update route polylines
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing polylines
    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    const filteredSegments = selectedDay != null
      ? routeSegments.filter((s) => {
          const fromPlan = plans.find((p) => p.id === s.fromPlanId)
          return fromPlan && fromPlan.day === selectedDay
        })
      : routeSegments

    filteredSegments.forEach((segment) => {
      try {
        const path = google.maps.geometry.encoding.decodePath(
          segment.encodedPolyline,
        )
        const color = ROUTE_COLORS[segment.travelMode] || ROUTE_COLORS.DRIVE
        const isDashed = segment.travelMode === 'WALK'

        const polyline = new google.maps.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: isDashed ? 0 : 0.8,
          strokeWeight: 4,
          map: mapInstanceRef.current!,
          ...(isDashed && {
            icons: [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  scale: 3,
                },
                offset: '0',
                repeat: '16px',
              },
            ],
          }),
        })

        polylinesRef.current.push(polyline)
      } catch {
        // Skip invalid polylines
      }
    })
  }, [routeSegments, isLoaded, selectedDay, plans])

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => (m.map = null))
      polylinesRef.current.forEach((p) => p.setMap(null))
    }
  }, [])

  if (isError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl ${className}`}
      >
        <p className="text-zinc-500 text-sm">Google Maps를 불러올 수 없습니다</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse ${className}`}
      >
        <p className="text-zinc-400 text-sm">지도 로딩 중...</p>
      </div>
    )
  }

  return <div ref={mapRef} className={`rounded-2xl ${className}`} />
}
