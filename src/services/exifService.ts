// ============================================
// EXIF Metadata Extraction Service
// Uses 'exifr' library for client-side parsing
// CRITICAL: Must run BEFORE image compression
//   (Canvas-based compression destroys EXIF data)
// ============================================

import type { ExifMetadata } from '@/types'

/**
 * Extract EXIF metadata from a File before compression.
 * Returns null if no EXIF data found.
 */
export async function extractExif(file: File): Promise<ExifMetadata | null> {
  try {
    const exifr = await import('exifr')

    const data = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'GPSLatitude',
        'GPSLongitude',
        'Make',
        'Model',
        'Orientation',
      ],
      gps: true,
    })

    if (!data) return null

    const result: ExifMetadata = {}

    // DateTime
    const dateTime = data.DateTimeOriginal || data.CreateDate
    if (dateTime instanceof Date) {
      result.dateTime = dateTime.toISOString()
    } else if (typeof dateTime === 'string') {
      const parsed = new Date(dateTime)
      if (!isNaN(parsed.getTime())) {
        result.dateTime = parsed.toISOString()
      }
    }

    // GPS coordinates (exifr auto-resolves to decimal degrees with gps:true)
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      result.latitude = data.latitude
      result.longitude = data.longitude
    }

    // Camera info
    if (data.Make) result.cameraMake = String(data.Make).trim()
    if (data.Model) result.cameraModel = String(data.Model).trim()

    // Only return if we got meaningful data
    if (Object.keys(result).length === 0) return null

    return result
  } catch (error) {
    console.warn('[EXIF] Failed to extract metadata:', error)
    return null
  }
}

/**
 * Calculate which trip day a photo belongs to based on EXIF date.
 * Returns null if date is outside trip range.
 */
export function calculateDayFromExif(
  exifDateTime: string,
  tripStartDate: string,
  tripEndDate: string,
): number | null {
  const photoDate = new Date(exifDateTime)
  if (isNaN(photoDate.getTime())) return null

  const startDate = new Date(tripStartDate + 'T00:00:00')
  const endDate = new Date(tripEndDate + 'T23:59:59')

  if (photoDate < startDate || photoDate > endDate) return null

  const diffMs = photoDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return diffDays + 1
}

/**
 * Extract EXIF from multiple files in parallel.
 */
export async function extractExifBatch(
  files: File[],
): Promise<Array<{ file: File; exif: ExifMetadata | null }>> {
  return Promise.all(
    files.map(async (file) => ({
      file,
      exif: await extractExif(file),
    })),
  )
}

/**
 * Format EXIF timestamp to display time (HH:mm)
 */
export function formatExifTime(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
