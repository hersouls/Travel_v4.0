// ============================================
// Google Maps Custom Styles
// ============================================

export const lightMapStyle: google.maps.MapTypeStyle[] = [
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
]

export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9e9e9e' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#181818' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#373737' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#757575' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d3d' }],
  },
]

export function getMapStyles(isDark: boolean): google.maps.MapTypeStyle[] {
  return isDark ? darkMapStyle : lightMapStyle
}

// Route polyline colors by travel mode
export const ROUTE_COLORS = {
  DRIVE: '#3b82f6', // blue
  WALK: '#22c55e', // green
  TRANSIT: '#f97316', // orange
  BICYCLE: '#a855f7', // purple
} as const

// Marker colors by plan type
export const MARKER_COLORS = {
  attraction: '#8b5cf6',
  restaurant: '#f97316',
  hotel: '#3b82f6',
  transport: '#6b7280',
  car: '#84cc16',
  plane: '#06b6d4',
  airport: '#0ea5e9',
  other: '#a1a1aa',
} as const

/** Get marker color for a plan type, with fallback */
export function getMarkerColor(type: string): string {
  return MARKER_COLORS[type as keyof typeof MARKER_COLORS] || MARKER_COLORS.other
}

// TravelLog marker colors by log type
export const LOG_MARKER_COLORS = {
  photo: '#8b5cf6', // violet
  receipt: '#f97316', // orange
  memo: '#3b82f6', // blue
} as const

// Day track line palette (cyclic)
export const DAY_TRACK_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
] as const

/** Get track line color for a given day */
export function getDayTrackColor(day: number): string {
  return DAY_TRACK_COLORS[(day - 1) % DAY_TRACK_COLORS.length]
}

/** Get log marker color for a travel log type */
export function getLogMarkerColor(type: string): string {
  return LOG_MARKER_COLORS[type as keyof typeof LOG_MARKER_COLORS] || LOG_MARKER_COLORS.memo
}
