// ============================================
// Date Range Picker Component
// ============================================

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseDateAsLocal, getTripDurationSafe } from '@/utils/timezone'

interface DateRangePickerProps {
  startDate: string // YYYY-MM-DD format
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  className?: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (startDate) return parseDateAsLocal(startDate)
    return new Date()
  })
  const [selectingEnd, setSelectingEnd] = useState(false)

  // Calculate duration (timezone-safe)
  const duration = useMemo(() => {
    if (!startDate || !endDate) return null
    return getTripDurationSafe(startDate, endDate)
  }, [startDate, endDate])

  // Format date for display (timezone-safe)
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = parseDateAsLocal(dateStr)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  // Get calendar days
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()

    const days: (number | null)[] = []

    // Add empty slots for days before the 1st
    for (let i = 0; i < startWeekday; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }, [viewDate])

  const handleDateClick = (day: number) => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (!selectingEnd) {
      onStartDateChange(dateStr)
      onEndDateChange('')
      setSelectingEnd(true)
    } else {
      if (dateStr < startDate) {
        // If clicked date is before start, reset
        onStartDateChange(dateStr)
        onEndDateChange('')
      } else {
        onEndDateChange(dateStr)
        setSelectingEnd(false)
        setIsOpen(false)
      }
    }
  }

  const isInRange = (day: number) => {
    if (!startDate || !day) return false
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    if (endDate) {
      return dateStr >= startDate && dateStr <= endDate
    }
    return dateStr === startDate
  }

  const isStart = (day: number) => {
    if (!startDate || !day) return false
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === startDate
  }

  const isEnd = (day: number) => {
    if (!endDate || !day) return false
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateStr === endDate
  }

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  return (
    <div className={clsx('relative', className)}>
      {/* Display Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center gap-3 p-3 rounded-lg',
          'border border-zinc-950/10 dark:border-white/10',
          'bg-transparent hover:border-zinc-950/20 dark:hover:border-white/20',
          'focus:outline-none focus:ring-2 focus:ring-primary-500',
          'transition-colors text-left'
        )}
      >
        <Calendar className="size-5 text-zinc-400" />
        <div className="flex-1">
          {startDate && endDate ? (
            <div>
              <span className="text-[var(--foreground)]">
                {formatDisplayDate(startDate)} ~ {formatDisplayDate(endDate)}
              </span>
              <span className="ml-2 text-sm text-primary-500 font-medium">
                ({duration}일)
              </span>
            </div>
          ) : startDate ? (
            <span className="text-[var(--foreground)]">
              {formatDisplayDate(startDate)} ~ <span className="text-zinc-400">종료일 선택</span>
            </span>
          ) : (
            <span className="text-zinc-400">날짜를 선택하세요</span>
          )}
        </div>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="size-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <span className="font-semibold text-[var(--foreground)]">
              {viewDate.getFullYear()}년 {MONTHS[viewDate.getMonth()]}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ChevronRight className="size-5 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={clsx(
                  'text-center text-xs font-medium py-1',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-zinc-500'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                type="button"
                disabled={!day}
                onClick={() => day && handleDateClick(day)}
                className={clsx(
                  'h-9 rounded-lg text-sm transition-colors',
                  !day && 'invisible',
                  day && 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  isInRange(day!) && !isStart(day!) && !isEnd(day!) && 'bg-primary-100 dark:bg-primary-900/30',
                  isStart(day!) && 'bg-primary-500 text-white rounded-r-none',
                  isEnd(day!) && 'bg-primary-500 text-white rounded-l-none',
                  isStart(day!) && isEnd(day!) && 'rounded-lg',
                  !isInRange(day!) && 'text-[var(--foreground)]'
                )}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Help Text */}
          <p className="mt-3 text-xs text-zinc-500 text-center">
            {selectingEnd ? '종료 날짜를 선택하세요' : '시작 날짜를 선택하세요'}
          </p>
        </div>
      )}
    </div>
  )
}
