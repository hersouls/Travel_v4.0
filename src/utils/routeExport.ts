// ============================================
// GPX / KML Route Export
// ============================================

import type { Plan, Trip } from '@/types'

interface Waypoint {
  name: string
  lat: number
  lon: number
  description?: string
  type?: string
  time?: string
}

function plansToWaypoints(plans: Plan[]): Waypoint[] {
  return plans
    .filter((p) => p.latitude && p.longitude)
    .map((p) => ({
      name: p.placeName,
      lat: p.latitude!,
      lon: p.longitude!,
      description: p.address || undefined,
      type: p.type,
      time: p.startTime,
    }))
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate GPX XML from trip plans
 */
export function generateGPX(trip: Trip, plans: Plan[]): string {
  const waypoints = plansToWaypoints(plans)
  const now = new Date().toISOString()

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     version="1.1"
     creator="Moonwave Travel">
  <metadata>
    <name>${escapeXml(trip.title)}</name>
    <desc>${escapeXml(trip.country)} (${trip.startDate} ~ ${trip.endDate})</desc>
    <time>${now}</time>
  </metadata>
`

  // Waypoints
  for (const wp of waypoints) {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lon}">
    <name>${escapeXml(wp.name)}</name>`
    if (wp.description) {
      gpx += `
    <desc>${escapeXml(wp.description)}</desc>`
    }
    if (wp.type) {
      gpx += `
    <type>${escapeXml(wp.type)}</type>`
    }
    gpx += `
  </wpt>
`
  }

  // Route (ordered waypoints)
  if (waypoints.length > 1) {
    gpx += `  <rte>
    <name>${escapeXml(trip.title)} Route</name>
`
    for (const wp of waypoints) {
      gpx += `    <rtept lat="${wp.lat}" lon="${wp.lon}">
      <name>${escapeXml(wp.name)}</name>
    </rtept>
`
    }
    gpx += `  </rte>
`
  }

  gpx += `</gpx>`
  return gpx
}

/**
 * Generate KML XML from trip plans
 */
export function generateKML(trip: Trip, plans: Plan[]): string {
  const waypoints = plansToWaypoints(plans)

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(trip.title)}</name>
    <description>${escapeXml(trip.country)} (${trip.startDate} ~ ${trip.endDate})</description>
`

  // Style for pins
  kml += `    <Style id="tripPin">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
`

  // Placemarks
  for (const wp of waypoints) {
    kml += `    <Placemark>
      <name>${escapeXml(wp.name)}</name>`
    if (wp.description) {
      kml += `
      <description>${escapeXml(wp.description)}</description>`
    }
    kml += `
      <styleUrl>#tripPin</styleUrl>
      <Point>
        <coordinates>${wp.lon},${wp.lat},0</coordinates>
      </Point>
    </Placemark>
`
  }

  // Route line
  if (waypoints.length > 1) {
    const coords = waypoints
      .map((wp) => `${wp.lon},${wp.lat},0`)
      .join('\n          ')
    kml += `    <Placemark>
      <name>${escapeXml(trip.title)} Route</name>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>3</width>
        </LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${coords}
        </coordinates>
      </LineString>
    </Placemark>
`
  }

  kml += `  </Document>
</kml>`
  return kml
}

/**
 * Download GPX file
 */
export function downloadGPX(trip: Trip, plans: Plan[]): void {
  const gpx = generateGPX(trip, plans)
  downloadFile(gpx, `${trip.title}.gpx`, 'application/gpx+xml')
}

/**
 * Download KML file
 */
export function downloadKML(trip: Trip, plans: Plan[]): void {
  const kml = generateKML(trip, plans)
  downloadFile(kml, `${trip.title}.kml`, 'application/vnd.google-earth.kml+xml')
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
