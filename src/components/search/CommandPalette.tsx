// ============================================
// Command Palette (cmdk-based global search)
// Ctrl+K to open, search trips/places/actions
// ============================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { Search, MapPin, Globe, Plus, Settings, Star, BookOpen } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { db as dexieDb } from '@/services/database'
import type { Plan } from '@/types'

export function CommandPalette() {
  const navigate = useNavigate()
  const isOpen = useUIStore((s) => s.isSearchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)

  const trips = useTripStore((s) => s.trips)
  const places = usePlaceStore((s) => s.places)

  const [searchPlans, setSearchPlans] = useState<Plan[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState('')

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!isOpen)
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, setOpen])

  // Debounced plan search
  const searchPlansDebounced = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!q || q.length < 2) {
        setSearchPlans([])
        return
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await dexieDb.plans
            .filter((p) => p.placeName.toLowerCase().includes(q.toLowerCase()))
            .limit(10)
            .toArray()
          setSearchPlans(results)
        } catch {
          setSearchPlans([])
        }
      }, 300)
    },
    []
  )

  useEffect(() => {
    searchPlansDebounced(query)
  }, [query, searchPlansDebounced])

  const handleSelect = (value: string) => {
    setOpen(false)
    setQuery('')
    setSearchPlans([])
    navigate(value)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command dialog */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg mx-4">
        <Command
          className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-zinc-200 dark:border-zinc-700">
            <Search className="size-5 text-zinc-400 flex-shrink-0" />
            <Command.Input
              placeholder="여행, 장소, 일정 검색..."
              value={query}
              onValueChange={setQuery}
              autoFocus
              className="flex-1 h-12 bg-transparent text-[var(--foreground)] placeholder:text-zinc-400 outline-none text-sm"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-1.5 text-[10px] font-medium text-zinc-500">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-zinc-500">
              검색 결과가 없습니다
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="빠른 작업" className="text-xs font-medium text-zinc-400 px-2 py-1.5">
              <Command.Item
                value="새 여행 만들기"
                onSelect={() => handleSelect('/trips/new')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
              >
                <Plus className="size-4 text-primary-500" />
                새 여행 만들기
              </Command.Item>
              <Command.Item
                value="설정"
                onSelect={() => handleSelect('/settings')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
              >
                <Settings className="size-4 text-zinc-500" />
                설정
              </Command.Item>
              <Command.Item
                value="장소 라이브러리"
                onSelect={() => handleSelect('/places')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
              >
                <BookOpen className="size-4 text-zinc-500" />
                장소 라이브러리
              </Command.Item>
            </Command.Group>

            {/* Trips */}
            {trips.length > 0 && (
              <Command.Group heading="여행" className="text-xs font-medium text-zinc-400 px-2 py-1.5">
                {trips.slice(0, 8).map((trip) => (
                  <Command.Item
                    key={`trip-${trip.id}`}
                    value={`${trip.title} ${trip.country}`}
                    onSelect={() => handleSelect(`/trips/${trip.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
                  >
                    <Globe className="size-4 text-primary-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{trip.title}</span>
                        {trip.isFavorite && <Star className="size-3 text-amber-500 fill-current flex-shrink-0" />}
                      </div>
                      <span className="text-xs text-zinc-400">{trip.country} · {trip.startDate}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Plans (searched) */}
            {searchPlans.length > 0 && (
              <Command.Group heading="일정" className="text-xs font-medium text-zinc-400 px-2 py-1.5">
                {searchPlans.map((plan) => (
                  <Command.Item
                    key={`plan-${plan.id}`}
                    value={`plan ${plan.placeName} ${plan.address || ''}`}
                    onSelect={() => handleSelect(`/trips/${plan.tripId}/plans/${plan.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
                  >
                    <MapPin className="size-4 text-violet-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate font-medium">{plan.placeName}</span>
                      <span className="text-xs text-zinc-400 ml-2">Day {plan.day} · {plan.startTime}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Places */}
            {places.length > 0 && (
              <Command.Group heading="장소 라이브러리" className="text-xs font-medium text-zinc-400 px-2 py-1.5">
                {places.slice(0, 8).map((place) => (
                  <Command.Item
                    key={`place-${place.id}`}
                    value={`place ${place.name} ${place.address || ''}`}
                    onSelect={() => handleSelect('/places')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)] cursor-pointer data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-primary-950/30"
                  >
                    <MapPin className="size-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate font-medium">{place.name}</span>
                      {place.address && (
                        <span className="text-xs text-zinc-400 ml-2 truncate">{place.address}</span>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-[10px]">↑↓</kbd> 이동
              <kbd className="ml-2 px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-[10px]">↵</kbd> 선택
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-[10px]">Ctrl+K</kbd> 검색
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
