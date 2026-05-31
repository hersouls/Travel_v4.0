// ============================================
// GPX Exporter
// Exports travel logs as GPX XML format
// Compatible with Google Earth, GPS devices
// ============================================

import type { TravelLog } from '@/types'
import { safeIsoString } from '@/utils/format'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate GPX XML from travel logs
 */
export function exportToGPX(logs: TravelLog[], tripTitle: string): string {
  const withCoords = logs
    .filter((l) => l.latitude != null && l.longitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (withCoords.length === 0) return ''

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="TravelLog"',
    '  xmlns="http://www.topografix.com/GPX/1/1"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(tripTitle)}</name>`,
    `    <time>${new Date().toISOString()}</time>`,
    '  </metadata>',
  ]

  // Waypoints
  for (const log of withCoords) {
    const name = log.placeName || log.address || `${log.type} - Day ${log.day}`
    const desc =
      log.memo ||
      (log.expense
        ? `${log.expense.storeName}: ${log.expense.totalAmount} ${log.expense.currency}`
        : '')

    lines.push(`  <wpt lat="${log.latitude}" lon="${log.longitude}">`)
    lines.push(`    <name>${escapeXml(name)}</name>`)
    lines.push(`    <time>${safeIsoString(log.timestamp)}</time>`)
    if (desc) {
      lines.push(`    <desc>${escapeXml(desc)}</desc>`)
    }
    lines.push(`    <type>${log.type}</type>`)
    lines.push('  </wpt>')
  }

  // Track
  lines.push('  <trk>')
  lines.push(`    <name>${escapeXml(tripTitle)} Track</name>`)

  // Group by day for track segments
  const days = new Map<number, TravelLog[]>()
  for (const log of withCoords) {
    const dayLogs = days.get(log.day) || []
    dayLogs.push(log)
    days.set(log.day, dayLogs)
  }

  for (const [day, dayLogs] of [...days.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push('    <trkseg>')
    lines.push(`      <!-- Day ${day} -->`)
    for (const log of dayLogs) {
      lines.push(`      <trkpt lat="${log.latitude}" lon="${log.longitude}">`)
      lines.push(`        <time>${safeIsoString(log.timestamp)}</time>`)
      lines.push('      </trkpt>')
    }
    lines.push('    </trkseg>')
  }

  lines.push('  </trk>')
  lines.push('</gpx>')

  return lines.join('\n')
}
