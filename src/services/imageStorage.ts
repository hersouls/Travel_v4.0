// ============================================
// Image Storage Service (Base64)
// WebP Support & Quality Optimization
// ============================================

type ImageFormat = 'auto' | 'webp' | 'jpeg'

interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: ImageFormat
  targetSizeKB?: number
}

// Cache WebP support check result
let webpSupportCache: boolean | null = null

/**
 * Check if browser supports WebP format
 */
export async function checkWebPSupport(): Promise<boolean> {
  if (webpSupportCache !== null) {
    return webpSupportCache
  }

  if (typeof document === 'undefined') {
    webpSupportCache = false
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  const dataUrl = canvas.toDataURL('image/webp')
  webpSupportCache = dataUrl.startsWith('data:image/webp')

  return webpSupportCache
}

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
 * @param options - Compression options
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'auto',
    targetSizeKB = 500,
  } = options

  // Determine output format
  const supportsWebP = await checkWebPSupport()
  const outputFormat =
    format === 'auto'
      ? supportsWebP
        ? 'webp'
        : 'jpeg'
      : format

  const mimeType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg'

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = async () => {
      let width = img.width
      let height = img.height

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width
        const heightRatio = maxHeight / height
        const ratio = Math.min(widthRatio, heightRatio)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // BUG-10: Use canvas.toBlob() (async) instead of toDataURL() (sync)
      // to avoid blocking the main thread during iterative quality reduction
      const targetSize = targetSizeKB * 1024

      const canvasToBase64Async = (q: number): Promise<string> =>
        new Promise((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { rej(new Error('toBlob returned null')); return }
              const reader = new FileReader()
              reader.onload = () => res(reader.result as string)
              reader.onerror = rej
              reader.readAsDataURL(blob)
            },
            mimeType,
            q,
          )
        })

      try {
        let currentQuality = quality
        let base64 = await canvasToBase64Async(currentQuality)
        let currentSize = getBase64Size(base64)
        let attempts = 0

        while (currentSize > targetSize && currentQuality > 0.3 && attempts < 5) {
          currentQuality -= 0.1
          // Yield to main thread between iterations
          await new Promise(r => requestAnimationFrame(r))
          base64 = await canvasToBase64Async(currentQuality)
          currentSize = getBase64Size(base64)
          attempts++
        }

        resolve(base64)
      } catch (e) {
        reject(e)
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
 * Legacy compressImage signature for backwards compatibility
 */
export async function compressImageLegacy(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<string> {
  return compressImage(file, { maxWidth, quality })
}

/**
 * Convert Base64 string to Blob
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',')
  const header = parts[0]
  const data = parts[1]
  if (!data) {
    // No comma in string — treat entire input as raw base64
    const binary = atob(base64)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
    return new Blob([array], { type: 'image/jpeg' })
  }
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
  if (bytes <= 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Process multiple images for upload
 */
export async function processImages(
  files: FileList | File[],
): Promise<string[]> {
  const fileArray = Array.from(files)
  const imageFiles = fileArray.filter((file) => file.type.startsWith('image/'))

  const results = await Promise.all(
    imageFiles.map((file) => fileToBase64(file))
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

/**
 * Get image format from base64 string
 */
export function getImageFormat(base64: string): string {
  if (base64.startsWith('data:image/webp')) return 'webp'
  if (base64.startsWith('data:image/png')) return 'png'
  if (base64.startsWith('data:image/gif')) return 'gif'
  return 'jpeg'
}
