// ============================================
// Timezone Alert Component
// 시간대 변경 감지 시 표시되는 알림
// ============================================

import { motion, AnimatePresence } from 'framer-motion'
import { Globe, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { getTimezoneDisplayName, getTimezoneDifference } from '@/utils/timezone'

interface TimezoneAlertProps {
  isVisible: boolean
  previousTimezone: string | null
  currentTimezone: string
  onConfirm: () => void
  onDismiss: () => void
}

export function TimezoneAlert({
  isVisible,
  previousTimezone,
  currentTimezone,
  onConfirm,
  onDismiss,
}: TimezoneAlertProps) {
  const timeDiff = previousTimezone
    ? getTimezoneDifference(previousTimezone, currentTimezone)
    : ''

  return (
    <AnimatePresence>
      {isVisible && previousTimezone && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-24 lg:bottom-20 left-4 right-4 z-40 mx-auto max-w-md"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center flex-shrink-0">
                <Globe className="size-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[var(--foreground)]">
                  위치가 변경되었습니다
                </h4>
                <p className="text-sm text-zinc-500 mt-1">
                  {getTimezoneDisplayName(previousTimezone)} → {getTimezoneDisplayName(currentTimezone)}
                </p>
                {timeDiff && timeDiff !== '동일' && (
                  <p className="text-xs text-zinc-400 mt-0.5">{timeDiff}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" color="primary" onClick={onConfirm}>
                    확인
                  </Button>
                  <Button size="sm" color="secondary" outline onClick={onDismiss}>
                    무시
                  </Button>
                </div>
              </div>
              <IconButton plain color="secondary" onClick={onDismiss} aria-label="닫기">
                <X className="size-4" />
              </IconButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
