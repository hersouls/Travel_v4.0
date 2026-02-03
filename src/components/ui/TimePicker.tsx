// ============================================
// TimePicker Component
// ============================================

import { clsx } from 'clsx'
import { Clock } from 'lucide-react'
import { useId, useState, useRef, useEffect } from 'react'

interface TimePickerProps {
  label?: string
  value: string // "HH:MM" format
  onChange: (value: string) => void
  minTime?: string // Optional minimum time (for endTime)
  className?: string
  required?: boolean
}

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const minutes = ['00', '15', '30', '45']

export function TimePicker({ label, value, onChange, minTime, className, required }: TimePickerProps) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [selectedHour, selectedMinute] = value ? value.split(':') : ['09', '00']

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTimeSelect = (hour: string, minute: string) => {
    const newTime = `${hour}:${minute}`
    onChange(newTime)
    setIsOpen(false)
  }

  // Quick select options
  const now = new Date()
  const currentHour = now.getHours()
  const quickOptions = [
    { label: '지금', hour: currentHour.toString().padStart(2, '0'), minute: (Math.ceil(now.getMinutes() / 15) * 15 % 60).toString().padStart(2, '0') },
    { label: '+1시간', hour: ((currentHour + 1) % 24).toString().padStart(2, '0'), minute: '00' },
    { label: '+2시간', hour: ((currentHour + 2) % 24).toString().padStart(2, '0'), minute: '00' },
  ]

  // Check if time is valid (after minTime if provided)
  const isTimeValid = (hour: string, minute: string) => {
    if (!minTime) return true
    const time = `${hour}:${minute}`
    return time > minTime
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full h-10 pl-10 pr-3 text-left rounded-lg',
            'border border-zinc-950/10 dark:border-white/10',
            'bg-transparent dark:bg-white/5',
            'text-[var(--foreground)] text-sm',
            'hover:border-zinc-950/20 dark:hover:border-white/20',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            'transition-colors'
          )}
        >
          {value || '시간 선택'}
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
          {/* Quick Select */}
          <div className="flex gap-1 p-2 border-b border-zinc-200 dark:border-zinc-700">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleTimeSelect(opt.hour, opt.minute)}
                disabled={!isTimeValid(opt.hour, opt.minute)}
                className={clsx(
                  'flex-1 px-2 py-1 text-xs rounded',
                  'bg-zinc-100 dark:bg-zinc-800 hover:bg-primary-100 dark:hover:bg-primary-900',
                  'text-zinc-700 dark:text-zinc-300 hover:text-primary-700 dark:hover:text-primary-300',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Time Grid */}
          <div className="p-2 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-4 gap-1">
              {hours.map((hour) =>
                minutes.map((minute) => {
                  const time = `${hour}:${minute}`
                  const isSelected = time === value
                  const isValid = isTimeValid(hour, minute)

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeSelect(hour, minute)}
                      disabled={!isValid}
                      className={clsx(
                        'px-2 py-1.5 text-xs rounded transition-colors',
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                        !isValid && 'opacity-30 cursor-not-allowed'
                      )}
                    >
                      {time}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
