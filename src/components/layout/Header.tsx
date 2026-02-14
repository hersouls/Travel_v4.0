import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, Plus, Settings, WifiOff, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, IconButton } from '@/components/ui/Button'
import { useUIStore, toast } from '@/stores/uiStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { APP_NAME } from '@/utils/constants'
import { AuthButton } from '@/components/auth/AuthButton'

// Enhanced Offline/Online Indicator Component
function ConnectionIndicator({ isOnline }: { isOnline: boolean }) {
  const [showReconnected, setShowReconnected] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    // Show "온라인" indicator when coming back online
    if (isOnline && !prevOnlineRef.current) {
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(timer)
    }
    prevOnlineRef.current = isOnline
  }, [isOnline])

  // Don't show anything when online and not just reconnected
  if (isOnline && !showReconnected) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isOnline ? 'online' : 'offline'}
        initial={{ opacity: 0, scale: 0.9, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: -10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
          isOnline
            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
            : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="size-3.5" />
            <span className="hidden sm:inline">온라인</span>
          </>
        ) : (
          <>
            <WifiOff className="size-3.5 animate-pulse" />
            <span className="hidden sm:inline">오프라인</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export function Header() {
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen)
  const { isOnline } = useOnlineStatus()
  const prevOnlineRef = useRef(isOnline)

  // Show toast when coming back online
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      toast.success('온라인으로 연결되었습니다')
    }
    prevOnlineRef.current = isOnline
  }, [isOnline])

  // Reset toast ref on mount
  useEffect(() => {
    prevOnlineRef.current = isOnline
  }, [])

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <IconButton
            plain
            color="secondary"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu className="size-5" />
          </IconButton>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <span className="hidden sm:block text-lg font-semibold text-[var(--foreground)]">
              {APP_NAME}
            </span>
          </Link>

          {/* Connection Indicator */}
          <ConnectionIndicator isOnline={isOnline} />
        </div>

        {/* Center: Search Trigger (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-[40%] lg:max-w-md mx-4">
          <button
            type="button"
            onClick={() => useUIStore.getState().setSearchOpen(true)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-zinc-400 text-left relative hover:border-primary-500/50 transition-colors"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" />
            여행 검색...
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 items-center gap-1 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-1.5 text-[10px] font-medium">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <IconButton
            plain
            color="secondary"
            className="md:hidden"
            onClick={() => useUIStore.getState().setSearchOpen(true)}
            aria-label="검색 열기"
          >
            <Search className="size-5" />
          </IconButton>

          {/* New Trip Button */}
          <Button
            to="/trips/new"
            color="primary"
            size="sm"
            leftIcon={<Plus className="size-4" />}
          >
            <span className="hidden sm:inline">새 여행</span>
          </Button>

          {/* Auth / Sync */}
          <AuthButton />

          {/* Settings */}
          <IconButton plain color="secondary" to="/settings" aria-label="설정">
            <Settings className="size-5" />
          </IconButton>
        </div>
      </div>

    </header>
  )
}
