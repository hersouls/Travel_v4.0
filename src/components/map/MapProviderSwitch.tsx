// ============================================
// Map Provider Switch Component
// ============================================

import type { MapProvider } from '@/types'

interface MapProviderSwitchProps {
  value: MapProvider
  onChange: (provider: MapProvider) => void
  className?: string
}

export function MapProviderSwitch({
  value,
  onChange,
  className = '',
}: MapProviderSwitchProps) {
  return (
    <div
      className={`inline-flex rounded-lg bg-zinc-200 dark:bg-zinc-800 p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange('google')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          value === 'google'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        Google
      </button>
      <button
        type="button"
        onClick={() => onChange('leaflet')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          value === 'leaflet'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        Leaflet
      </button>
    </div>
  )
}
