// ============================================
// useObjectUrl Hook
// BUG-07: Auto-revoke Object URLs on unmount/change
// Prevents memory leaks from un-revoked blob URLs
// ============================================

import { useEffect, useRef, useState } from 'react'
import { base64ToBlob } from '@/services/imageStorage'

/**
 * Convert a base64 string to an Object URL, automatically revoking
 * the previous URL when the input changes or the component unmounts.
 */
export function useObjectUrl(base64: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const prevUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Revoke previous URL
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current)
      prevUrlRef.current = null
    }

    if (!base64) {
      setUrl(null)
      return
    }

    try {
      const blob = base64ToBlob(base64)
      const objectUrl = URL.createObjectURL(blob)
      prevUrlRef.current = objectUrl
      setUrl(objectUrl)
    } catch {
      setUrl(null)
    }

    // Cleanup on unmount
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = null
      }
    }
  }, [base64])

  return url
}
