// ============================================
// Scroll To Top FAB
// Shows when scrolled down, scrolls to top
// ============================================

import { clsx } from 'clsx'
import { ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const SCROLL_THRESHOLD = 400

export function ScrollToTopFAB() {
  const [visible, setVisible] = useState(false)
  const [scrollEl, setScrollEl] = useState<Element | null>(null)

  // Find the scroll container (PageContainer's <main>)
  useEffect(() => {
    const main = document.querySelector('main')
    if (main) {
      setScrollEl(main)
    }
  }, [])

  // Track scroll position
  useEffect(() => {
    if (!scrollEl) return

    const handleScroll = () => {
      setVisible(scrollEl.scrollTop > SCROLL_THRESHOLD)
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [scrollEl])

  const scrollToTop = useCallback(() => {
    scrollEl?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [scrollEl])

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={clsx(
        'fixed bottom-40 lg:bottom-20 right-4 lg:right-8 z-40',
        'size-10 rounded-full shadow-lg',
        'flex items-center justify-center',
        'bg-zinc-700/80 dark:bg-zinc-300/80 text-white dark:text-zinc-900',
        'hover:bg-zinc-600 dark:hover:bg-zinc-200',
        'active:scale-95 transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
      aria-label="맨 위로 스크롤"
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
