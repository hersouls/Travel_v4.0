import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, MapPin, Settings, Info, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { clsx } from 'clsx'
import { IconButton } from '@/components/ui/Button'
import { useUIStore } from '@/stores/uiStore'
import { useTrips } from '@/stores/tripStore'
import { APP_VERSION } from '@/utils/constants'

const navItems = [
  { path: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { path: '/places', label: '장소 라이브러리', icon: MapPin },
  { path: '/settings', label: '설정', icon: Settings },
  { path: '/about', label: '정보', icon: Info },
]

export function Sidebar() {
  const location = useLocation()
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed)
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed)
  const trips = useTrips()

  // Get favorite trips (max 5)
  const favoriteTrips = trips.filter((t) => t.isFavorite).slice(0, 5)

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col fixed left-0 top-16 bottom-0 z-30',
        'border-r border-[var(--border)] bg-[var(--background)]',
        'transition-all duration-300',
        isSidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              <item.icon className="size-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          )
        })}

        {/* Favorites Section */}
        {!isSidebarCollapsed && favoriteTrips.length > 0 && (
          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              즐겨찾기
            </h3>
            {favoriteTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  location.pathname === `/trips/${trip.id}`
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                )}
              >
                <Star className="size-4 flex-shrink-0 fill-warning-400 text-warning-400" />
                <span className="text-sm truncate">{trip.title}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          {!isSidebarCollapsed && (
            <span className="text-xs text-zinc-400">v{APP_VERSION}</span>
          )}
          <IconButton
            plain
            color="secondary"
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </IconButton>
        </div>
      </div>
    </aside>
  )
}
