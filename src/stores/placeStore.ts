// ============================================
// Place Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Place, PlanType } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'
import { syncManager } from '@/services/firestoreSync'
import { useUIStore } from '@/stores/uiStore'

const UNDO_TIMEOUT_MS = 30_000

export type PlaceSortBy = 'name' | 'date' | 'usage' | 'rating'
export type PlaceSortOrder = 'asc' | 'desc'

interface PlaceState {
  // State
  places: Place[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filterType: PlanType | 'all'
  sortBy: PlaceSortBy
  sortOrder: PlaceSortOrder

  // Actions
  initialize: () => Promise<void>
  loadPlaces: () => Promise<void>
  addPlace: (place: Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isFavorite'>) => Promise<number>
  updatePlace: (id: number, updates: Partial<Place>) => Promise<void>
  deletePlace: (id: number) => Promise<void>
  deletePlaces: (ids: number[]) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  incrementUsage: (id: number) => Promise<void>

  // Filters & Sorting
  setSearchQuery: (query: string) => void
  setFilterType: (type: PlanType | 'all') => void
  setSortBy: (sortBy: PlaceSortBy) => void
  setSortOrder: (sortOrder: PlaceSortOrder) => void
  getFilteredPlaces: () => Place[]

  // Duplicate check
  findPlaceByNameOrGoogleId: (name: string, googlePlaceId?: string) => Place | null
}

export const usePlaceStore = create<PlaceState>()(
  devtools(
    (set, get) => ({
      // Initial State
      places: [],
      isLoading: false,
      error: null,
      searchQuery: '',
      filterType: 'all',
      sortBy: 'date',
      sortOrder: 'desc',

      // Initialize
      initialize: async () => {
        set({ isLoading: true, error: null })
        try {
          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Load all places
      loadPlaces: async () => {
        set({ isLoading: true, error: null })
        try {
          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Add place
      addPlace: async (placeData) => {
        set({ isLoading: true, error: null })
        try {
          const place: Omit<Place, 'id'> = {
            ...placeData,
            isFavorite: false,
            usageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addPlace(place)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const savedPlace = await db.getPlace(id)
            if (savedPlace) {
              const firebaseId = await syncManager.uploadPlace(savedPlace)
              await db.updatePlace(id, { firebaseId })
            }
          }

          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_CREATED', { id })
          return id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      // Update place
      updatePlace: async (id, updates) => {
        set({ isLoading: true, error: null })
        try {
          await db.updatePlace(id, updates)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const updatedPlace = await db.getPlace(id)
            if (updatedPlace) {
              const firebaseId = await syncManager.uploadPlace(updatedPlace)
              if (!updatedPlace.firebaseId && firebaseId) {
                await db.updatePlace(id, { firebaseId })
              }
            }
          }

          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Delete place (with undo support)
      deletePlace: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const placeSnapshot = await db.getPlace(id)
          if (!placeSnapshot) {
            set({ isLoading: false })
            return
          }
          const firebaseId = placeSnapshot.firebaseId

          // Immediately delete from local DB
          await db.deletePlace(id)

          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_DELETED', { id })

          // Deferred Firestore deletion with undo
          let undone = false
          const timer = setTimeout(async () => {
            if (undone) return
            if (syncManager.isActive() && firebaseId) {
              syncManager.deleteRemotePlace(firebaseId).catch((e) =>
                console.error('[Sync] Failed to delete remote place:', e))
            }
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: `"${placeSnapshot.name}" 삭제됨`,
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undone = true
                clearTimeout(timer)
                await db.addPlace({ ...placeSnapshot, id: undefined } as Omit<Place, 'id'>)
                const restoredPlaces = await db.getAllPlaces()
                set({ places: restoredPlaces })
                sendBroadcast('PLACE_CREATED', {})
                useUIStore.getState().showToast({
                  type: 'success',
                  title: '장소가 복원되었습니다',
                })
              },
            },
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Batch delete places
      deletePlaces: async (ids) => {
        set({ isLoading: true, error: null })
        try {
          for (const id of ids) {
            const place = await db.getPlace(id)
            if (!place) continue
            await db.deletePlace(id)
            if (syncManager.isActive() && place.firebaseId) {
              syncManager.deleteRemotePlace(place.firebaseId).catch(console.error)
            }
          }
          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_DELETED', { ids })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Toggle favorite
      toggleFavorite: async (id) => {
        try {
          await db.togglePlaceFavorite(id)

          if (syncManager.isActive()) {
            const updatedPlace = await db.getPlace(id)
            if (updatedPlace) syncManager.uploadPlace(updatedPlace).catch(console.error)
          }

          const places = await db.getAllPlaces()
          set({ places })
          sendBroadcast('PLACE_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Increment usage count
      incrementUsage: async (id) => {
        try {
          await db.incrementPlaceUsage(id)

          if (syncManager.isActive()) {
            const updatedPlace = await db.getPlace(id)
            if (updatedPlace) syncManager.uploadPlace(updatedPlace).catch(console.error)
          }

          const places = await db.getAllPlaces()
          set({ places })
          sendBroadcast('PLACE_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Set search query
      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      // Set filter type
      setFilterType: (type) => {
        set({ filterType: type })
      },

      // Set sort field
      setSortBy: (sortBy) => {
        set({ sortBy })
      },

      // Set sort order
      setSortOrder: (sortOrder) => {
        set({ sortOrder })
      },

      // Get filtered and sorted places
      getFilteredPlaces: () => {
        const { places, searchQuery, filterType, sortBy, sortOrder } = get()

        const filtered = places.filter((place) => {
          const matchesSearch =
            searchQuery === '' ||
            place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            place.address?.toLowerCase().includes(searchQuery.toLowerCase())
          const matchesType = filterType === 'all' || place.type === filterType
          return matchesSearch && matchesType
        })

        const sorted = [...filtered].sort((a, b) => {
          let cmp = 0
          switch (sortBy) {
            case 'name':
              cmp = a.name.localeCompare(b.name, 'ko')
              break
            case 'date':
              cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              break
            case 'usage':
              cmp = (a.usageCount || 0) - (b.usageCount || 0)
              break
            case 'rating':
              cmp = (a.rating || 0) - (b.rating || 0)
              break
          }
          return sortOrder === 'asc' ? cmp : -cmp
        })

        return sorted
      },

      // Find place by name or Google Place ID (for duplicate check)
      findPlaceByNameOrGoogleId: (name, googlePlaceId) => {
        const { places } = get()
        return places.find((place) =>
          place.name === name ||
          (googlePlaceId && place.googlePlaceId === googlePlaceId) ||
          (googlePlaceId && place.mapUrl?.includes(googlePlaceId))
        ) || null
      },
    }),
    { name: 'place-store' }
  )
)

// Selector hooks
export const usePlaces = () => usePlaceStore((state) => state.places)
export const usePlaceLoading = () => usePlaceStore((state) => state.isLoading)
