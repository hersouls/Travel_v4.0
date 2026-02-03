// ============================================
// Places Autocomplete Component
// ============================================

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { clsx } from 'clsx'
import { MapPin, Loader2, Search } from 'lucide-react'
import { searchPlaces, getPlaceDetails, type PlacePrediction, type PlaceDetails } from '@/services/placesAutocomplete'
import { Label } from './Input'

interface PlacesAutocompleteProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onPlaceSelect?: (place: PlaceDetails, prediction: PlacePrediction) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function PlacesAutocomplete({
  label,
  placeholder = '장소 검색...',
  value = '',
  onChange,
  onPlaceSelect,
  error,
  disabled,
  className,
}: PlacesAutocompleteProps) {
  const inputId = useId()
  const [query, setQuery] = useState(value)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query || query.length < 2) {
      setPredictions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const results = await searchPlaces(query)
        setPredictions(results)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setQuery(newValue)
      onChange?.(newValue)
    },
    [onChange]
  )

  const handleSelect = useCallback(
    async (prediction: PlacePrediction | null) => {
      if (!prediction) return

      setQuery(prediction.mainText || prediction.description)
      onChange?.(prediction.mainText || prediction.description)
      setPredictions([])

      if (onPlaceSelect) {
        setIsLoadingDetails(true)
        try {
          const details = await getPlaceDetails(prediction.placeId)
          if (details) {
            onPlaceSelect(details, prediction)
          }
        } finally {
          setIsLoadingDetails(false)
        }
      }
    },
    [onChange, onPlaceSelect]
  )

  return (
    <div className={className}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Combobox
        value={null}
        onChange={handleSelect}
        disabled={disabled}
      >
        <div className="relative mt-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 dark:text-zinc-400">
              {isLoading || isLoadingDetails ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </span>
            <ComboboxInput
              id={inputId}
              value={query}
              onChange={handleInputChange}
              placeholder={placeholder}
              autoComplete="off"
              className={clsx(
                'relative block w-full appearance-none rounded-lg pl-10 pr-4 py-2.5 sm:py-1.5',
                'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
                'border border-zinc-950/10 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20',
                'bg-transparent dark:bg-white/5',
                'focus:outline-none focus:outline-2 focus:-outline-offset-1 focus:outline-primary-500',
                error && 'border-danger-500 hover:border-danger-500 focus:outline-danger-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>

          <ComboboxOptions
            anchor="bottom start"
            className={clsx(
              'w-[var(--input-width)] rounded-lg border border-zinc-200 dark:border-zinc-700',
              'bg-white dark:bg-zinc-900 shadow-lg',
              'max-h-60 overflow-auto',
              'z-50 mt-1',
              '[--anchor-gap:4px]',
              'empty:hidden'
            )}
          >
            {predictions.length === 0 && query.length >= 2 && !isLoading && (
              <div className="px-4 py-3 text-sm text-zinc-500">
                검색 결과가 없습니다
              </div>
            )}
            {predictions.map((prediction) => (
              <ComboboxOption
                key={prediction.placeId}
                value={prediction}
                className={({ focus }) =>
                  clsx(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer',
                    focus
                      ? 'bg-primary-50 dark:bg-primary-950/50'
                      : 'bg-transparent'
                  )
                }
              >
                <MapPin className="size-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {prediction.mainText || prediction.description}
                  </p>
                  {prediction.secondaryText && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {prediction.secondaryText}
                    </p>
                  )}
                </div>
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </div>
      </Combobox>
      {error && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
      {isLoadingDetails && (
        <p className="mt-2 text-sm text-zinc-500 flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" />
          장소 정보를 가져오는 중...
        </p>
      )}
    </div>
  )
}
