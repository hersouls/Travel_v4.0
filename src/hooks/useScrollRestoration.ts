// ============================================
// Scroll Position Restoration Hook
// Saves scroll position per route and restores on back/forward navigation
// ============================================

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const SCROLL_KEY_PREFIX = 'scroll_'

export function useScrollRestoration() {
  const location = useLocation()
  const isPopState = useRef(false)

  // Detect browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      isPopState.current = true
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const key = SCROLL_KEY_PREFIX + location.key

    if (isPopState.current) {
      // Restore scroll position on back/forward
      const savedPosition = sessionStorage.getItem(key)
      if (savedPosition) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedPosition, 10))
        })
      }
      isPopState.current = false
    } else {
      // New navigation: scroll to top
      window.scrollTo(0, 0)
    }

    // Save scroll position on scroll (debounced)
    let timeoutId: number
    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        const currentKey = SCROLL_KEY_PREFIX + location.key
        sessionStorage.setItem(currentKey, String(window.scrollY))
      }, 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      // Save final position before leaving
      const currentKey = SCROLL_KEY_PREFIX + location.key
      sessionStorage.setItem(currentKey, String(window.scrollY))
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [location])
}
