// ============================================
// TravelLog Map View Component
// Displays travel log entries as markers on Google Maps
// with track lines, clustering, and photo map mode
// ============================================

import { useRef, useEffect, useMemo, useCallback } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader'
import { getLogMarkerColor, getDayTrackColor } from '@/utils/mapStyles'
import type { TravelLog } from '@/types'

interface TravelLogMapViewProps {
  logs: TravelLog[]
  selectedDay?: number | null
  className?: string
  onMarkerClick?: (log: TravelLog) => void
  showTrackLine?: boolean
  showPhotoMap?: boolean
  showHeatmap?: boolean
}

export function TravelLogMapView({
  logs,
  selectedDay,
  className = '',
  onMarkerClick,
  showTrackLine = true,
  showPhotoMap = false,
  showHeatmap = false,
}: TravelLogMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null)
  const { isLoaded, isError } = useGoogleMapsLoader()

  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  // Filter logs with valid finite coordinates
  const filteredLogs = useMemo(() => {
    const hasValidCoords = (l: TravelLog) =>
      typeof l.latitude === 'number' && typeof l.longitude === 'number' &&
      isFinite(l.latitude) && isFinite(l.longitude)

    return logs.filter((l) => {
      if (!hasValidCoords(l)) return false
      if (selectedDay != null && l.day !== selectedDay) return false
      return true
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [logs, selectedDay])

  // Calculate center
  const mapCenter = useMemo(() => {
    if (filteredLogs.length === 0) return { lat: 37.5665, lng: 126.978 }
    const lats = filteredLogs.map((l) => l.latitude!)
    const lngs = filteredLogs.map((l) => l.longitude!)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [filteredLogs])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 13,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      mapId: 'moonwave-travellog-map',
    })

    infoWindowRef.current = new google.maps.InfoWindow()
  }, [isLoaded, mapCenter])

  // Create marker element for a log
  const createMarkerContent = useCallback(
    (log: TravelLog, index: number) => {
      if (showPhotoMap && log.type === 'photo' && log.thumbnailPhoto) {
        const container = document.createElement('div')
        container.style.cssText = `
          width: 48px; height: 48px; border-radius: 8px;
          overflow: hidden; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;
        `
        const img = document.createElement('img')
        img.src = log.thumbnailPhoto
        img.alt = log.placeName || ''
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;'
        container.appendChild(img)
        return container
      }

      const color = getLogMarkerColor(log.type)
      const iconMap: Record<string, string> = {
        photo: '\u{1F4F7}',
        receipt: '\u{1F9FE}',
        memo: '\u{1F4DD}',
      }

      const el = document.createElement('div')
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', `${index + 1}번 기록: ${log.placeName || log.type}`)
      el.setAttribute('tabindex', '0')
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; color: white;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
      `
      el.textContent = iconMap[log.type] || `${index + 1}`
      return el
    },
    [showPhotoMap],
  )

  // Build InfoWindow content
  const buildInfoContent = useCallback((log: TravelLog) => {
    const time = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    let content = '<div style="max-width:240px;font-family:system-ui,sans-serif;">'

    if (log.type === 'photo' && log.thumbnailPhoto) {
      content += `<img src="${log.thumbnailPhoto}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
    }

    const title = log.placeName || log.address || log.type
    content += `<div style="font-weight:600;font-size:14px;margin-bottom:4px;">${title}</div>`
    content += `<div style="font-size:12px;color:#666;">Day ${log.day} \u00B7 ${time}</div>`

    if (log.type === 'memo' && log.memo) {
      const excerpt = log.memo.length > 60 ? `${log.memo.slice(0, 60)}...` : log.memo
      content += `<div style="font-size:12px;color:#888;margin-top:4px;">${excerpt}</div>`
    }

    if (log.type === 'receipt' && log.expense) {
      content += `<div style="font-size:13px;font-weight:600;color:#f97316;margin-top:4px;">${log.expense.totalAmount.toLocaleString()} ${log.expense.currency}</div>`
    }

    content += '</div>'
    return content
  }, [])

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current = null
    }
    markersRef.current.forEach((m) => { m.map = null })
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    const markers: google.maps.marker.AdvancedMarkerElement[] = []

    filteredLogs.forEach((log, index) => {
      const position = { lat: log.latitude!, lng: log.longitude! }
      bounds.extend(position)

      const content = createMarkerContent(log, index)

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: showHeatmap ? null : mapInstanceRef.current!,
        position,
        content,
        title: log.placeName || log.address || `${log.type} - Day ${log.day}`,
      })

      marker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          infoWindowRef.current.setContent(buildInfoContent(log))
          infoWindowRef.current.open(mapInstanceRef.current, marker)
        }
        onMarkerClickRef.current?.(log)
      })

      markers.push(marker)
    })

    markersRef.current = markers

    // Apply clustering when not in heatmap mode
    if (!showHeatmap && markers.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers,
        renderer: {
          render: ({ count, position }) => {
            const el = document.createElement('div')
            el.style.cssText = `
              width: 40px; height: 40px; border-radius: 50%;
              background: rgba(59, 130, 246, 0.85); color: white;
              display: flex; align-items: center; justify-content: center;
              font-size: 13px; font-weight: 700;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `
            el.textContent = `${count}`
            return new google.maps.marker.AdvancedMarkerElement({
              position,
              content: el,
            })
          },
        },
      })
    }

    if (filteredLogs.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 60)
    } else if (filteredLogs.length === 1) {
      mapInstanceRef.current.setCenter(bounds.getCenter())
      mapInstanceRef.current.setZoom(15)
    }
  }, [filteredLogs, isLoaded, showPhotoMap, showHeatmap, createMarkerContent, buildInfoContent])

  // Update track lines
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    if (!showTrackLine || showHeatmap) return

    // Group by day
    const logsByDay = new Map<number, TravelLog[]>()
    for (const log of filteredLogs) {
      const dayLogs = logsByDay.get(log.day) || []
      dayLogs.push(log)
      logsByDay.set(log.day, dayLogs)
    }

    // Draw polyline per day
    for (const [day, dayLogs] of logsByDay) {
      if (dayLogs.length < 2) continue

      const path = dayLogs.map((l) => ({ lat: l.latitude!, lng: l.longitude! }))
      const color = getDayTrackColor(day)

      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: mapInstanceRef.current!,
      })

      polylinesRef.current.push(polyline)
    }

    // Draw dashed lines between days
    const days = [...logsByDay.keys()].sort((a, b) => a - b)
    for (let i = 0; i < days.length - 1; i++) {
      const currentDayLogs = logsByDay.get(days[i])!
      const nextDayLogs = logsByDay.get(days[i + 1])!
      const lastLog = currentDayLogs[currentDayLogs.length - 1]
      const firstLog = nextDayLogs[0]

      const polyline = new google.maps.Polyline({
        path: [
          { lat: lastLog.latitude!, lng: lastLog.longitude! },
          { lat: firstLog.latitude!, lng: firstLog.longitude! },
        ],
        strokeColor: '#9ca3af',
        strokeOpacity: 0,
        strokeWeight: 2,
        map: mapInstanceRef.current!,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.5,
            strokeWeight: 2,
            scale: 3,
          },
          offset: '0',
          repeat: '12px',
        }],
      })

      polylinesRef.current.push(polyline)
    }
  }, [filteredLogs, isLoaded, showTrackLine, showHeatmap])

  // Heatmap layer
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null)
      heatmapRef.current = null
    }

    if (!showHeatmap || filteredLogs.length === 0) return

    // Dynamically import visualization library
    const loadHeatmap = async () => {
      try {
        await google.maps.importLibrary('visualization')
        const data = filteredLogs.map((l) => new google.maps.LatLng(l.latitude!, l.longitude!))
        heatmapRef.current = new google.maps.visualization.HeatmapLayer({
          data,
          map: mapInstanceRef.current!,
          radius: 30,
          opacity: 0.7,
        })
      } catch {
        // visualization library not available
      }
    }
    loadHeatmap()
  }, [filteredLogs, isLoaded, showHeatmap])

  // Cleanup
  useEffect(() => {
    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
      }
      markersRef.current.forEach((m) => { m.map = null })
      polylinesRef.current.forEach((p) => p.setMap(null))
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null)
      }
    }
  }, [])

  if (isError) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl ${className}`}>
        <p className="text-zinc-500 text-sm">Google Maps를 불러올 수 없습니다</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse ${className}`}>
        <p className="text-zinc-400 text-sm">지도 로딩 중...</p>
      </div>
    )
  }

  return <div ref={mapRef} className={`rounded-2xl ${className}`} />
}
