// ============================================
// Map Location Picker Component
// Interactive map with click/drag marker, PlacesAutocomplete, and manual lat/lng input
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader'
import { reverseGeocode } from '@/services/geocodingService'
import { PlacesAutocomplete } from './PlacesAutocomplete'
import type { PlaceDetails } from '@/services/placesAutocomplete'

interface PickedLocation {
  latitude: number
  longitude: number
  address: string
  placeName: string
}

interface MapLocationPickerProps {
  initialCenter?: { lat: number; lng: number }
  onLocationChange: (location: PickedLocation | null) => void
  height?: string
  className?: string
}

export function MapLocationPicker({
  initialCenter,
  onLocationChange,
  height = '300px',
  className,
}: MapLocationPickerProps) {
  const { isLoaded, isError } = useGoogleMapsLoader()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [address, setAddress] = useState('')
  const [_placeName, setPlaceName] = useState('')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [latError, setLatError] = useState('')
  const [lngError, setLngError] = useState('')

  // Stable ref for onLocationChange
  const onLocationChangeRef = useRef(onLocationChange)
  onLocationChangeRef.current = onLocationChange

  const defaultCenter = initialCenter || { lat: 37.5665, lng: 126.978 }

  // Debounced reverse geocode
  const debouncedReverseGeocode = useCallback((lat: number, lng: number, name?: string) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(async () => {
      setIsGeocoding(true)
      try {
        const addr = await reverseGeocode(lat, lng)
        const resolvedAddr = addr || ''
        const resolvedName = name || addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        setAddress(resolvedAddr)
        if (!name) setPlaceName(resolvedName)
        onLocationChangeRef.current({
          latitude: lat,
          longitude: lng,
          address: resolvedAddr,
          placeName: name || resolvedName,
        })
      } catch {
        const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        setAddress('')
        if (!name) setPlaceName(fallback)
        onLocationChangeRef.current({
          latitude: lat,
          longitude: lng,
          address: '',
          placeName: name || fallback,
        })
      } finally {
        setIsGeocoding(false)
      }
    }, 500)
  }, [])

  // Place/update marker on map
  const placeMarker = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return

    const position = { lat, lng }

    if (markerRef.current) {
      markerRef.current.position = position
    } else {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        gmpDraggable: true,
        title: '선택한 위치',
      })

      marker.addListener('dragend', () => {
        const pos = marker.position
        if (!pos) return
        const newLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
        const newLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
        setLatInput(String(newLat.toFixed(6)))
        setLngInput(String(newLng.toFixed(6)))
        setLatError('')
        setLngError('')
        debouncedReverseGeocode(newLat, newLng)
      })

      markerRef.current = marker
    }
  }, [debouncedReverseGeocode])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return

    const map = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      mapId: 'moonwave-location-picker',
    })

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()

      setLatInput(String(lat.toFixed(6)))
      setLngInput(String(lng.toFixed(6)))
      setLatError('')
      setLngError('')
      setPlaceName('')
      placeMarker(lat, lng)
      debouncedReverseGeocode(lat, lng)
    })

    mapRef.current = map

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null
        markerRef.current = null
      }
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // Handle PlacesAutocomplete selection
  const handlePlaceSelect = useCallback((details: PlaceDetails) => {
    const { latitude, longitude, name, address: addr } = details

    setLatInput(String(latitude.toFixed(6)))
    setLngInput(String(longitude.toFixed(6)))
    setLatError('')
    setLngError('')
    setPlaceName(name)
    setAddress(addr)

    placeMarker(latitude, longitude)
    mapRef.current?.panTo({ lat: latitude, lng: longitude })
    mapRef.current?.setZoom(15)

    onLocationChangeRef.current({
      latitude,
      longitude,
      address: addr,
      placeName: name,
    })
  }, [placeMarker])

  // Validate and apply lat/lng input
  const validateAndApplyCoords = useCallback((latStr: string, lngStr: string) => {
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    let hasError = false

    if (latStr && (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90)) {
      setLatError('위도: -90 ~ 90')
      hasError = true
    } else {
      setLatError('')
    }

    if (lngStr && (isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180)) {
      setLngError('경도: -180 ~ 180')
      hasError = true
    } else {
      setLngError('')
    }

    if (hasError || !latStr || !lngStr) {
      // Clear location when coordinates are incomplete or invalid
      onLocationChangeRef.current(null)
      return
    }

    placeMarker(lat, lng)
    mapRef.current?.panTo({ lat, lng })
    setPlaceName('')
    debouncedReverseGeocode(lat, lng)
  }, [placeMarker, debouncedReverseGeocode])

  const handleLatChange = useCallback((val: string) => {
    setLatInput(val)
    validateAndApplyCoords(val, lngInput)
  }, [lngInput, validateAndApplyCoords])

  const handleLngChange = useCallback((val: string) => {
    setLngInput(val)
    validateAndApplyCoords(latInput, val)
  }, [latInput, validateAndApplyCoords])

  if (isError) {
    return (
      <div className={clsx('flex items-center justify-center rounded-xl border border-[var(--border)] bg-zinc-50 dark:bg-zinc-900', className)} style={{ height }}>
        <p className="text-sm text-zinc-500">지도를 불러올 수 없습니다</p>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-3', className)}>
      {/* PlacesAutocomplete search */}
      <PlacesAutocomplete
        placeholder="장소 검색..."
        onPlaceSelect={(details) => handlePlaceSelect(details)}
      />

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-xl border border-[var(--border)] overflow-hidden"
        style={{ height }}
      >
        {!isLoaded && (
          <div className="flex items-center justify-center h-full bg-zinc-50 dark:bg-zinc-900">
            <Loader2 className="size-6 text-primary-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Lat/Lng manual input */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">위도 (Latitude)</label>
          <input
            type="number"
            step="any"
            placeholder="예: 37.5665"
            value={latInput}
            onChange={(e) => handleLatChange(e.target.value)}
            className={clsx(
              'w-full text-sm px-3 py-2 rounded-lg border bg-transparent transition-colors',
              'text-zinc-950 dark:text-white placeholder:text-zinc-400',
              latError
                ? 'border-danger-500 focus:outline-danger-500'
                : 'border-zinc-950/10 dark:border-white/10 focus:outline-primary-500',
              'focus:outline focus:outline-2 focus:-outline-offset-1',
            )}
          />
          {latError && <p className="mt-1 text-xs text-danger-500">{latError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">경도 (Longitude)</label>
          <input
            type="number"
            step="any"
            placeholder="예: 126.978"
            value={lngInput}
            onChange={(e) => handleLngChange(e.target.value)}
            className={clsx(
              'w-full text-sm px-3 py-2 rounded-lg border bg-transparent transition-colors',
              'text-zinc-950 dark:text-white placeholder:text-zinc-400',
              lngError
                ? 'border-danger-500 focus:outline-danger-500'
                : 'border-zinc-950/10 dark:border-white/10 focus:outline-primary-500',
              'focus:outline focus:outline-2 focus:-outline-offset-1',
            )}
          />
          {lngError && <p className="mt-1 text-xs text-danger-500">{lngError}</p>}
        </div>
      </div>

      {/* Address display */}
      {(address || isGeocoding) && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {isGeocoding ? (
            <Loader2 className="size-3.5 animate-spin flex-shrink-0" />
          ) : (
            <MapPin className="size-3.5 flex-shrink-0 text-primary-500" />
          )}
          <span className="truncate">{isGeocoding ? '주소 확인 중...' : address}</span>
        </div>
      )}
    </div>
  )
}
