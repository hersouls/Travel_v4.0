// ============================================
// KML Exporter
// Exports travel logs as KML XML format
// Compatible with Google Earth
// ============================================

import type { TravelLog } from '@/types'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const TYPE_ICONS: Record<string, string> = {
  photo: 'http://maps.google.com/mapfiles/kml/shapes/camera.png',
  receipt: 'http://maps.google.com/mapfiles/kml/shapes/dollar.png',
  memo: 'http://maps.google.com/mapfiles/kml/shapes/info.png',
}

/**
 * Generate KML XML from travel logs
 */
export function exportToKML(logs: TravelLog[], tripTitle: string): string {
  const withCoords = logs
    .filter((l) => l.latitude != null && l.longitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (withCoords.length === 0) return ''

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${escapeXml(tripTitle)}</name>`,
  ]

  // Style definitions
  for (const [type, icon] of Object.entries(TYPE_ICONS)) {
    lines.push(`    <Style id="style-${type}">`)
    lines.push('      <IconStyle>')
    lines.push(`        <Icon><href>${icon}</href></Icon>`)
    lines.push('      </IconStyle>')
    lines.push('    </Style>')
  }

  // Placemarks
  for (const log of withCoords) {
    const name = log.placeName || log.address || `Day ${log.day} ${log.type}`
    const desc =
      log.memo ||
      (log.expense
        ? `${log.expense.storeName}: ${log.expense.totalAmount} ${log.expense.currency}`
        : '')
    const time = new Date(log.timestamp).toISOString()

    lines.push('    <Placemark>')
    lines.push(`      <name>${escapeXml(name)}</name>`)
    if (desc) {
      lines.push(`      <description>${escapeXml(desc)}</description>`)
    }
    lines.push(`      <styleUrl>#style-${log.type}</styleUrl>`)
    lines.push(`      <TimeStamp><when>${time}</when></TimeStamp>`)
    lines.push('      <Point>')
    lines.push(`        <coordinates>${log.longitude},${log.latitude},0</coordinates>`)
    lines.push('      </Point>')
    lines.push('    </Placemark>')
  }

  // Route LineString
  if (withCoords.length > 1) {
    const coords = withCoords.map((l) => `${l.longitude},${l.latitude},0`).join(' ')

    lines.push('    <Placemark>')
    lines.push(`      <name>${escapeXml(tripTitle)} Route</name>`)
    lines.push('      <Style>')
    lines.push('        <LineStyle>')
    lines.push('          <color>ff0000ff</color>')
    lines.push('          <width>3</width>')
    lines.push('        </LineStyle>')
    lines.push('      </Style>')
    lines.push('      <LineString>')
    lines.push(`        <coordinates>${coords}</coordinates>`)
    lines.push('      </LineString>')
    lines.push('    </Placemark>')
  }

  lines.push('  </Document>')
  lines.push('</kml>')

  return lines.join('\n')
}
