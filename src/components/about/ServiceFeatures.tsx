// ============================================
// ServiceFeatures Component
// 4-tier responsive feature grid for About page
// ============================================

import { clsx } from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Bookmark,
  CalendarDays,
  Camera,
  HardDriveDownload,
  Map,
  Moon,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { BadgeColor } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'

// --- Data ---

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  color: string
  badge?: string
  badgeColor?: BadgeColor
}

const FEATURES: Feature[] = [
  { icon: CalendarDays, title: '일정 관리', description: '여행 일정 관리 및 타임라인 보기', color: 'primary', badge: 'Core', badgeColor: 'primary' },
  { icon: Camera, title: '사진/메모', description: '장소별 사진, 메모, 링크 저장', color: 'purple' },
  { icon: Map, title: '지도 보기', description: '지도에서 일정 확인', color: 'blue', badge: 'Core', badgeColor: 'primary' },
  { icon: Bookmark, title: '장소 저장', description: '자주 가는 곳 라이브러리', color: 'orange' },
  { icon: WifiOff, title: '오프라인', description: '오프라인 지원 (PWA)', color: 'cyan', badge: 'PWA', badgeColor: 'cyan' },
  { icon: HardDriveDownload, title: '백업/복원', description: '데이터 백업 및 복원', color: 'success' },
  { icon: Moon, title: '다크 모드', description: '다크 모드 지원', color: 'pink' },
]

// --- Style Maps ---

const iconStyles: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-950/50', text: 'text-primary-500', border: 'border-t-primary-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/50', text: 'text-purple-500', border: 'border-t-purple-500' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-500', border: 'border-t-blue-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-500', border: 'border-t-orange-500' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/50', text: 'text-cyan-500', border: 'border-t-cyan-500' },
  success: { bg: 'bg-success-50 dark:bg-success-950/50', text: 'text-success-500', border: 'border-t-success-500' },
  pink: { bg: 'bg-pink-50 dark:bg-pink-950/50', text: 'text-pink-500', border: 'border-t-pink-500' },
}

// --- Animation ---

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
}

// --- FeatureItem ---

function FeatureItem({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  const styles = iconStyles[feature.color]

  return (
    <>
      {/* Fold (<360px): Icon-only + Tooltip */}
      <div className="block xs:hidden">
        <Tooltip content={feature.title} placement="bottom">
          <div
            className={clsx(
              'size-11 rounded-xl flex items-center justify-center',
              styles.bg,
            )}
            aria-label={feature.title}
          >
            <Icon className={clsx('size-5', styles.text)} aria-hidden="true" />
          </div>
        </Tooltip>
      </div>

      {/* Phone (360-639px): Icon + label row */}
      <div
        className={clsx(
          'hidden xs:flex sm:hidden items-center gap-2 p-2',
          'rounded-lg bg-[var(--card)] ring-1 ring-zinc-950/5 dark:ring-white/10',
        )}
      >
        <div className={clsx('size-8 rounded-lg flex items-center justify-center shrink-0', styles.bg)}>
          <Icon className={clsx('size-4', styles.text)} aria-hidden="true" />
        </div>
        <span className="text-sm font-medium text-[var(--foreground)] truncate">{feature.title}</span>
      </div>

      {/* Tablet (640-1023px): Vertical mini card */}
      <div
        className={clsx(
          'hidden sm:flex lg:hidden flex-col items-center text-center p-3',
          'rounded-xl bg-[var(--card)] ring-1 ring-zinc-950/5 dark:ring-white/10',
        )}
      >
        <div className={clsx('size-10 rounded-xl flex items-center justify-center mb-2', styles.bg)}>
          <Icon className={clsx('size-5', styles.text)} aria-hidden="true" />
        </div>
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{feature.title}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{feature.description}</p>
      </div>

      {/* Desktop (1024px+): Full showcase card */}
      <div
        className={clsx(
          'hidden lg:flex flex-col p-4',
          'rounded-xl bg-[var(--card)]',
          'ring-1 ring-zinc-950/5 dark:ring-white/10',
          'hover:ring-zinc-950/10 dark:hover:ring-white/20',
          'hover:shadow-md transition-all duration-200',
          'border-t-2', styles.border,
        )}
      >
        {feature.badge && feature.badgeColor && (
          <Badge color={feature.badgeColor} size="sm" className="self-start mb-2">
            {feature.badge}
          </Badge>
        )}
        <div className={clsx('size-10 rounded-xl flex items-center justify-center mb-2', styles.bg)}>
          <Icon className={clsx('size-5', styles.text)} aria-hidden="true" />
        </div>
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{feature.title}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{feature.description}</p>
      </div>
    </>
  )
}

// --- Main Component ---

export function ServiceFeatures() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={clsx(
        'flex flex-wrap gap-2 justify-center',
        'xs:grid xs:grid-cols-2',
        'sm:grid-cols-3 sm:gap-3',
        'lg:grid-cols-4 lg:gap-golden-md',
      )}
      variants={shouldReduceMotion ? undefined : containerVariants}
      initial={shouldReduceMotion ? undefined : 'hidden'}
      animate="visible"
    >
      {FEATURES.map((feature) => (
        <motion.div
          key={feature.title}
          variants={shouldReduceMotion ? undefined : itemVariants}
        >
          <FeatureItem feature={feature} />
        </motion.div>
      ))}
    </motion.div>
  )
}
