import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Search, Plus, Settings, X, WifiOff } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { useUIStore, toast } from '@/stores/uiStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { APP_NAME } from '@/utils/constants'

export function Header() {
  const navigate = useNavigate()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to dashboard with search query
      navigate(`/dashboard?q=${encodeURIComponent(searchQuery.trim())}`)
      setIsSearchOpen(false)
      setSearchQuery('')
    }
  }

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

          {/* Offline Indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded-md text-xs font-medium">
              <WifiOff className="size-3.5" />
              <span className="hidden sm:inline">오프라인</span>
            </div>
          )}
        </div>

        {/* Center: Search (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="search"
              placeholder="여행 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <IconButton
            plain
            color="secondary"
            className="md:hidden"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label={isSearchOpen ? '검색 닫기' : '검색 열기'}
          >
            {isSearchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </IconButton>

          {/* New Trip Button */}
          <Button
            to="/trips/new"
            color="primary"
            size="sm"
            leftIcon={<Plus className="size-4" />}
            className="hidden sm:inline-flex"
          >
            새 여행
          </Button>
          <IconButton color="primary" className="sm:hidden" to="/trips/new" aria-label="새 여행">
            <Plus className="size-5" />
          </IconButton>

          {/* Settings */}
          <IconButton plain color="secondary" to="/settings" aria-label="설정">
            <Settings className="size-5" />
          </IconButton>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="absolute left-0 right-0 top-16 border-b border-[var(--border)] bg-[var(--background)] p-4 md:hidden animate-fade-in">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="search"
              placeholder="여행 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </form>
        </div>
      )}
    </header>
  )
}
