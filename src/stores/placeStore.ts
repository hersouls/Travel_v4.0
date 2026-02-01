// ============================================
// Place Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Place, PlanType } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'

interface PlaceState {
  // State
  places: Place[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filterType: PlanType | 'all'

  // Actions
  initialize: () => Promise<void>
  loadPlaces: () => Promise<void>
  addPlace: (place: Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isFavorite'>) => Promise<number>
  updatePlace: (id: number, updates: Partial<Place>) => Promise<void>
  deletePlace: (id: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  incrementUsage: (id: number) => Promise<void>

  // Filters
  setSearchQuery: (query: string) => void
  setFilterType: (type: PlanType | 'all') => void
  getFilteredPlaces: () => Place[]
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
          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Delete place
      deletePlace: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await db.deletePlace(id)
          const places = await db.getAllPlaces()
          set({ places, isLoading: false })
          sendBroadcast('PLACE_DELETED', { id })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Toggle favorite
      toggleFavorite: async (id) => {
        try {
          await db.togglePlaceFavorite(id)
          const places = await db.getAllPlaces()
          set({ places })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Increment usage count
      incrementUsage: async (id) => {
        try {
          await db.incrementPlaceUsage(id)
          const places = await db.getAllPlaces()
          set({ places })
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

      // Get filtered places
      getFilteredPlaces: () => {
        const { places, searchQuery, filterType } = get()
        return places.filter((place) => {
          const matchesSearch =
            searchQuery === '' ||
            place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            place.address?.toLowerCase().includes(searchQuery.toLowerCase())
          const matchesType = filterType === 'all' || place.type === filterType
          return matchesSearch && matchesType
        })
      },
    }),
    { name: 'place-store' }
  )
)

// Selector hooks
export const usePlaces = () => usePlaceStore((state) => state.places)
export const usePlaceLoading = () => usePlaceStore((state) => state.isLoading)
