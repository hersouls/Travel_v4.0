// ============================================
// Settings Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { ThemeMode, ColorPalette, Settings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'
import { syncManager } from '@/services/firestoreSync'

interface SettingsState extends Settings {
  // Actions
  initialize: () => Promise<void>
  setTheme: (theme: ThemeMode) => void
  setColorPalette: (palette: ColorPalette) => void
  setLanguage: (language: 'ko' | 'en') => void
  setMusicPlayerEnabled: (enabled: boolean) => void
  updateLastBackupDate: () => void
  // Timezone actions
  setTimezoneAutoDetect: (enabled: boolean) => void
  updateDetectedTimezone: (timezone: string) => void
  setMapProvider: (provider: import('@/types').MapProvider) => void
  setDefaultTravelMode: (mode: import('@/types').TravelMode) => void
  saveToDatabase: () => Promise<void>
}

// Apply theme to document
function applyTheme(theme: ThemeMode) {
  const root = document.documentElement

  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', systemDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

// Apply color palette to document (light mode only)
function applyColorPalette(palette: ColorPalette) {
  const root = document.documentElement
  if (palette === 'default') {
    root.removeAttribute('data-palette')
  } else {
    root.setAttribute('data-palette', palette)
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = useSettingsStore.getState().theme
    if (currentTheme === 'system') {
      document.documentElement.classList.toggle('dark', e.matches)
    }
  })
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State from defaults
        ...DEFAULT_SETTINGS,

        // Initialize from database
        initialize: async () => {
          try {
            const settings = await db.getSettings()
            set(settings)
            applyTheme(settings.theme)
            applyColorPalette(settings.colorPalette)
          } catch (error) {
            console.error('Failed to load settings:', error)
          }
        },

        // Set theme
        setTheme: (theme) => {
          set({ theme })
          applyTheme(theme)
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'theme', value: theme })
        },

        // Set color palette
        setColorPalette: (colorPalette) => {
          set({ colorPalette })
          applyColorPalette(colorPalette)
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'colorPalette', value: colorPalette })
        },

        // Set language
        setLanguage: (language) => {
          set({ language })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'language', value: language })
        },

        // Toggle music player
        setMusicPlayerEnabled: (enabled) => {
          set({ isMusicPlayerEnabled: enabled })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'isMusicPlayerEnabled', value: enabled })
        },

        // Update last backup date
        updateLastBackupDate: () => {
          set({ lastBackupDate: new Date() })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'lastBackupDate' })
        },

        // Set timezone auto-detect
        setTimezoneAutoDetect: (enabled) => {
          set({ timezoneAutoDetect: enabled })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'timezoneAutoDetect', value: enabled })
        },

        // Update detected timezone
        updateDetectedTimezone: (timezone) => {
          set({ detectedTimezone: timezone })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'detectedTimezone', value: timezone })
        },

        // Set map provider
        setMapProvider: (mapProvider) => {
          set({ mapProvider })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'mapProvider', value: mapProvider })
        },

        // Set default travel mode
        setDefaultTravelMode: (defaultTravelMode) => {
          set({ defaultTravelMode })
          get().saveToDatabase()
          sendBroadcast('SETTINGS_CHANGED', { field: 'defaultTravelMode', value: defaultTravelMode })
        },

        // Save to database
        saveToDatabase: async () => {
          const state = get()
          const settings = {
            id: 'main',
            theme: state.theme,
            colorPalette: state.colorPalette,
            language: state.language,
            isMusicPlayerEnabled: state.isMusicPlayerEnabled,
            lastBackupDate: state.lastBackupDate,
            timezoneAutoDetect: state.timezoneAutoDetect,
            detectedTimezone: state.detectedTimezone,
            mapProvider: state.mapProvider,
            defaultTravelMode: state.defaultTravelMode,
          }
          await db.updateSettings(settings)

          // Sync to Firestore
          if (syncManager.isActive()) {
            syncManager.uploadSettings(settings as import('@/types').Settings).catch(console.error)
          }
        },
      }),
      {
        name: 'travel-settings',
        partialize: (state) => ({
          theme: state.theme,
          colorPalette: state.colorPalette,
          language: state.language,
          isMusicPlayerEnabled: state.isMusicPlayerEnabled,
          timezoneAutoDetect: state.timezoneAutoDetect,
          mapProvider: state.mapProvider,
          defaultTravelMode: state.defaultTravelMode,
        }),
      }
    ),
    { name: 'settings-store' }
  )
)

// Selector hooks
export const useTheme = () => useSettingsStore((state) => state.theme)
export const useColorPalette = () => useSettingsStore((state) => state.colorPalette)
export const useLanguage = () => useSettingsStore((state) => state.language)
export const useMusicPlayerEnabled = () => useSettingsStore((state) => state.isMusicPlayerEnabled)
export const useTimezoneAutoDetect = () => useSettingsStore((state) => state.timezoneAutoDetect)
export const useMapProvider = () => useSettingsStore((state) => state.mapProvider)
export const useDefaultTravelMode = () => useSettingsStore((state) => state.defaultTravelMode)
