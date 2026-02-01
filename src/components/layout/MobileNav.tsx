// ============================================
// Mobile Navigation Component
// Slide-in menu bar (MCA v2.0 style)
// ============================================

import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { LayoutDashboard, MapPin, Plus, Settings, Info, X, Star, Plane } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useTrips } from '@/stores/tripStore'
import { APP_NAME, APP_VERSION } from '@/utils/constants'

const mainNavItems = [
  { path: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { path: '/places', label: '장소 라이브러리', icon: MapPin },
  { path: '/settings', label: '설정', icon: Settings },
  { path: '/about', label: '정보', icon: Info },
]

const bottomNavItems = [
  { path: '/dashboard', label: '홈', icon: LayoutDashboard },
  { path: '/places', label: '장소', icon: MapPin },
  { path: '/trips/new', label: '추가', icon: Plus, highlight: true },
  { path: '/settings', label: '설정', icon: Settings },
]

export function MobileNav() {
  const location = useLocation()
  const isMobileMenuOpen = useUIStore((state) => state.isMobileMenuOpen)
  const setMobileMenuOpen = useUIStore((state) => state.setMobileMenuOpen)
  const trips = useTrips()

  const favoriteTrips = trips.filter((t) => t.isFavorite).slice(0, 5)
  const recentTrips = trips.filter((t) => !t.isFavorite).slice(0, 5)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <>
      {/* Slide-in Menu Drawer */}
      <Transition show={isMobileMenuOpen} as={Fragment}>
        <Dialog onClose={closeMobileMenu} className="relative z-50 lg:hidden">
          {/* Backdrop */}
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm" aria-hidden="true" />
          </TransitionChild>

          {/* Drawer */}
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="fixed inset-y-0 left-0 w-full max-w-xs bg-[var(--background)] shadow-xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border)] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary-500 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary-foreground">T</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[var(--foreground)]">{APP_NAME}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">v{APP_VERSION}</span>
                  </div>
                </div>
                <button
                  onClick={closeMobileMenu}
                  className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="메뉴 닫기"
                >
                  <X className="size-5 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto py-4">
                {/* Main Navigation */}
                <nav className="px-2" aria-label="모바일 메인 메뉴">
                  <ul className="space-y-1">
                    {mainNavItems.map((item) => {
                      const isActive = location.pathname === item.path
                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            onClick={closeMobileMenu}
                            className={clsx(
                              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[44px]',
                              isActive
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            )}
                          >
                            <item.icon className="size-5" />
                            <span className="font-medium">{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </nav>

                {/* Add Trip Button */}
                <div className="px-2 mt-4">
                  <Link
                    to="/trips/new"
                    onClick={closeMobileMenu}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors min-h-[44px]"
                  >
                    <Plus className="size-5" />
                    <span className="font-medium">새 여행 만들기</span>
                  </Link>
                </div>

                {/* Favorites */}
                {favoriteTrips.length > 0 && (
                  <section className="mt-6 px-2">
                    <h2 className="px-4 mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      즐겨찾기
                    </h2>
                    <ul className="space-y-0.5">
                      {favoriteTrips.map((trip) => {
                        const isActive = location.pathname === `/trips/${trip.id}`
                        return (
                          <li key={trip.id}>
                            <Link
                              to={`/trips/${trip.id}`}
                              onClick={closeMobileMenu}
                              className={clsx(
                                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left min-h-[44px]',
                                isActive
                                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                              )}
                            >
                              <Star className="size-4 text-warning-500 fill-warning-500 flex-shrink-0" />
                              <span className="truncate">{trip.title}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {/* Recent Trips */}
                {recentTrips.length > 0 && (
                  <section className="mt-6 px-2">
                    <h2 className="px-4 mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      최근 여행
                    </h2>
                    <ul className="space-y-0.5">
                      {recentTrips.map((trip) => {
                        const isActive = location.pathname === `/trips/${trip.id}`
                        return (
                          <li key={trip.id}>
                            <Link
                              to={`/trips/${trip.id}`}
                              onClick={closeMobileMenu}
                              className={clsx(
                                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left min-h-[44px]',
                                isActive
                                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                              )}
                            >
                              <Plane className="size-4 flex-shrink-0" />
                              <span className="truncate">{trip.title}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>

      {/* Bottom Navigation Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/95 backdrop-blur-lg border-t border-[var(--border)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="하단 메인 네비게이션"
      >
        <ul className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <li key={item.path} className="flex-1">
                <Link
                  to={item.path}
                  className={clsx(
                    'w-full flex flex-col items-center justify-center gap-1 py-2 transition-colors min-h-[44px]',
                    item.highlight
                      ? 'text-white'
                      : isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.highlight ? (
                    <div className="size-12 rounded-full bg-primary-500 flex items-center justify-center -mt-4 shadow-lg">
                      <item.icon className="size-6" />
                    </div>
                  ) : (
                    <>
                      <item.icon className="size-5" />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
