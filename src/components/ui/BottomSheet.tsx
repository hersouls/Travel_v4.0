// ============================================
// BottomSheet Component
// 모바일: 하단 부착 슬라이드업 시트(드래그 핸들 + safe-area + 내부 스크롤 + overscroll 격리)
// 데스크톱: 중앙 모달로 자동 폴백(useIsDesktop)
// 맵 마커 정보, 필터, 빠른추가, 컨텍스트 메뉴 등 범용 그릇.
// 코드베이스의 검증된 Headless Transition 패턴(Dialog/MobileNav) 기반.
// ============================================

import { Fragment, type ReactNode } from 'react'
import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import { clsx } from 'clsx'
import { useIsDesktop } from '@/hooks/useMediaQuery'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  className?: string
  /** 데스크톱에서 중앙 모달로 폴백할지 (기본 true). false면 항상 하단 시트 */
  desktopAsModal?: boolean
  'aria-label'?: string
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  className,
  desktopAsModal = true,
  'aria-label': ariaLabel,
}: BottomSheetProps) {
  const isDesktop = useIsDesktop()
  const asModal = isDesktop && desktopAsModal

  return (
    <Transition show={open} as={Fragment}>
      <HeadlessDialog onClose={onClose} className="relative z-[2000]" aria-label={ariaLabel}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-zinc-950/30 dark:bg-zinc-950/60 backdrop-blur-sm" />
        </TransitionChild>

        <div className={clsx('fixed inset-0 flex', asModal ? 'items-center justify-center p-4' : 'items-end')}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom={asModal ? 'opacity-0 scale-95' : 'translate-y-full'}
            enterTo={asModal ? 'opacity-100 scale-100' : 'translate-y-0'}
            leave="ease-in duration-200"
            leaveFrom={asModal ? 'opacity-100 scale-100' : 'translate-y-0'}
            leaveTo={asModal ? 'opacity-0 scale-95' : 'translate-y-full'}
          >
            <DialogPanel
              className={clsx(
                'w-full bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-950/5 dark:ring-white/10 flex flex-col will-change-transform',
                asModal
                  ? 'max-w-md rounded-2xl max-h-[85dvh]'
                  : 'rounded-t-2xl max-h-[88dvh] pb-[env(safe-area-inset-bottom)]',
                className,
              )}
            >
              {/* 드래그 핸들 (모바일) */}
              {!asModal && (
                <div className="flex-shrink-0 flex justify-center pt-2.5 pb-1" aria-hidden>
                  <div className="h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                </div>
              )}
              {title && (
                <div className="flex-shrink-0 px-4 pt-1 pb-2 text-base font-semibold text-zinc-900 dark:text-white">
                  {title}
                </div>
              )}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </HeadlessDialog>
    </Transition>
  )
}
