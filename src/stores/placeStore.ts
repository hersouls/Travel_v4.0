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
              // Upload place photos in background if present
              if (savedPlace.photos?.length && firebaseId) {
                const updatedPlace = await db.getPlace(id)
                if (updatedPlace) {
                  import('@/services/imageSync').then(({ uploadPlacePhotos }) => {
                    import('@/stores/authStore').then(({ useAuthStore }) => {
                      const userId = useAuthStore.getState().user?.uid
                      if (userId) uploadPlacePhotos(userId, updatedPlace)
                    })
                  }).catch(console.error)
                }
              }
            }
          }

          // Partial update: prepend new place instead of full reload
          const newPlace = await db.getPlace(id)
          if (newPlace) {
            set(state => ({ places: [newPlace, ...state.places], isLoading: false }))
          } else {
            set({ isLoading: false })
          }
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
          // photos 변경 시 재업로드 트리거를 위해 storage paths를 비운다 (호출자 인자 비변형)
          const updatesToApply = 'photos' in updates
            ? ({ ...updates, photoPaths: undefined } as Partial<Place>)
            : updates
          await db.updatePlace(id, updatesToApply)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const updatedPlace = await db.getPlace(id)
            if (updatedPlace) {
              const firebaseId = await syncManager.uploadPlace(updatedPlace)
              if (!updatedPlace.firebaseId && firebaseId) {
                await db.updatePlace(id, { firebaseId })
              }
              // Upload place photos in background if changed
              if ('photos' in updates && updatedPlace.photos?.length && updatedPlace.firebaseId) {
                import('@/services/imageSync').then(({ uploadPlacePhotos }) => {
                  import('@/stores/authStore').then(({ useAuthStore }) => {
                    const userId = useAuthStore.getState().user?.uid
                    if (userId) uploadPlacePhotos(userId, updatedPlace)
                  })
                }).catch(console.error)
              }
            }
          }

          // Partial update: replace single place in-place
          const updatedPlace = await db.getPlace(id)
          set(state => ({
            places: updatedPlace
              ? state.places.map(p => p.id === id ? updatedPlace : p)
              : state.places.filter(p => p.id !== id),
            isLoading: false,
          }))
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

          // Mark as pending delete to prevent listener re-creation during undo window
          if (firebaseId) syncManager.addPendingDelete(firebaseId)

          // Immediately delete from local DB
          await db.deletePlace(id)

          // Partial update: filter out deleted place
          set(state => ({
            places: state.places.filter(p => p.id !== id),
            isLoading: false,
          }))
          sendBroadcast('PLACE_DELETED', { id })

          // Deferred Firestore deletion with undo
          const undoController = new AbortController()
          const timer = setTimeout(async () => {
            if (undoController.signal.aborted) return
            if (syncManager.isActive() && firebaseId) {
              try { await syncManager.deleteRemotePlace(firebaseId) }
              catch (e) {
                if (undoController.signal.aborted) return
                console.error('[Sync] Failed to delete remote place:', e)
              }
            }
            if (firebaseId) syncManager.removePendingDelete(firebaseId)
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: `"${placeSnapshot.name}" 삭제됨`,
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undoController.abort()
                clearTimeout(timer)
                if (firebaseId) syncManager.removePendingDelete(firebaseId)
                const newId = await db.addPlace({ ...placeSnapshot, id: undefined } as Omit<Place, 'id'>)
                // Partial update: re-insert restored place
                const restoredPlace = await db.getPlace(newId)
                if (restoredPlace) {
                  set(state => ({ places: [restoredPlace, ...state.places] }))
                }
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
          // Partial update: filter out deleted places
          const deletedSet = new Set(ids)
          set(state => ({
            places: state.places.filter(p => !deletedSet.has(p.id!)),
            isLoading: false,
          }))
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

          // Partial update: toggle in-place
          set(state => ({
            places: state.places.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p),
          }))
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

          // Partial update: increment in-place
          set(state => ({
            places: state.places.map(p => p.id === id ? { ...p, usageCount: (p.usageCount || 0) + 1 } : p),
          }))
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
