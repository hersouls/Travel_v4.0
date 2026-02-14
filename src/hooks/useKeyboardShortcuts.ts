// ============================================
// Global Keyboard Shortcuts
// Ctrl+K: Search, Ctrl+N: New trip, ?: Help
// ============================================

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+N / Cmd+N: New trip
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/trips/new')
        return
      }

      // Escape: Close any modal/overlay
      if (e.key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.isSearchOpen) {
          ui.setSearchOpen(false)
          return
        }
        if (ui.isMobileMenuOpen) {
          ui.setMobileMenuOpen(false)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
