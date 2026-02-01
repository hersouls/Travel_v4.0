// ============================================
// Image Storage Service (Base64)
// ============================================

/**
 * Convert File to Base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Compress image and convert to Base64
 * @param file - Image file to compress
 * @param maxWidth - Maximum width (default: 1200px)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let width = img.width
      let height = img.height

      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', quality)
        resolve(base64)
      } else {
        reject(new Error('Failed to get canvas context'))
      }
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    // Read file as data URL
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Convert Base64 string to Blob
 */
export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(data)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

/**
 * Create object URL from Base64 for display
 */
export function base64ToObjectUrl(base64: string): string {
  const blob = base64ToBlob(base64)
  return URL.createObjectURL(blob)
}

/**
 * Revoke object URL to free memory
 */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * Get file size from Base64 string (in bytes)
 */
export function getBase64Size(base64: string): number {
  const base64Data = base64.split(',')[1] || base64
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
  return (base64Data.length * 3) / 4 - padding
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Process multiple images for upload
 */
export async function processImages(
  files: FileList | File[],
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<string[]> {
  const fileArray = Array.from(files)
  const imageFiles = fileArray.filter((file) => file.type.startsWith('image/'))

  const results = await Promise.all(
    imageFiles.map((file) => compressImage(file, maxWidth, quality))
  )

  return results
}

/**
 * Fetch image from URL and convert to Base64
 * (Used for Firebase Storage migration)
 */
export async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    throw new Error(`Failed to fetch image from URL: ${url}`)
  }
}
