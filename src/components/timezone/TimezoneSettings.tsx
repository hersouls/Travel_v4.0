// ============================================
// Timezone Settings Component
// 설정 페이지에서 시간대 관련 설정 표시
// ============================================

import { Globe } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSettingsStore } from '@/stores/settingsStore'
import { getTimezoneDisplayName, getSystemTimezone } from '@/utils/timezone'

export function TimezoneSettings() {
  const timezoneAutoDetect = useSettingsStore((s) => s.timezoneAutoDetect)
  const setTimezoneAutoDetect = useSettingsStore((s) => s.setTimezoneAutoDetect)
  const currentTimezone = getSystemTimezone()

  return (
    <Card padding="lg">
      <CardHeader
        title="시간대"
        description="현재 위치 기반 시간대 설정"
        icon={<Globe className="size-5" />}
      />
      <CardContent className="space-y-4">
        {/* 현재 시간대 표시 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">현재 시간대</span>
          <Badge color="primary" size="md">
            {getTimezoneDisplayName(currentTimezone)}
          </Badge>
        </div>

        {/* 자동 감지 토글 */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-[var(--foreground)]">자동 감지</span>
            <p className="text-xs text-zinc-500 mt-0.5">
              시간대 변경 시 알림 받기
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={timezoneAutoDetect}
            onClick={() => setTimezoneAutoDetect(!timezoneAutoDetect)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              timezoneAutoDetect ? 'bg-primary-500' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                timezoneAutoDetect ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
