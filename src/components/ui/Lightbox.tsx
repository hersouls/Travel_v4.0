// ============================================
// Lightbox Component - Fullscreen Image Viewer
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { Transition, TransitionChild } from '@headlessui/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface LightboxProps {
    images: string[]
    initialIndex: number
    onClose: () => void
    open: boolean
}

export function Lightbox({ images, initialIndex, onClose, open }: LightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)

    // Sync currentIndex when initialIndex or open state changes
    useEffect(() => {
        if (open) {
            setCurrentIndex(initialIndex)
        }
    }, [initialIndex, open])

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
    }, [images.length])

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
    }, [images.length])

    // Keyboard navigation
    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    onClose()
                    break
                case 'ArrowLeft':
                    goToPrevious()
                    break
                case 'ArrowRight':
                    goToNext()
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose, goToPrevious, goToNext])

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    if (images.length === 0) return null

    return (
        <Transition show={open}>
            {/* Backdrop */}
            <TransitionChild
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <div
                    className="fixed inset-0 z-[100] bg-black/95"
                    onClick={onClose}
                    aria-hidden="true"
                />
            </TransitionChild>

            {/* Content */}
            <TransitionChild
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <div
                    className="fixed inset-0 z-[101] flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-label="이미지 뷰어"
                >
                    {/* Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 flex items-center justify-center size-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                        aria-label="닫기"
                    >
                        <X className="size-6" />
                    </button>

                    {/* Image Counter */}
                    {images.length > 1 && (
                        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium">
                            {currentIndex + 1} / {images.length}
                        </div>
                    )}

                    {/* Previous Button */}
                    {images.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goToPrevious()
                            }}
                            className="absolute left-2 sm:left-4 z-10 flex items-center justify-center size-12 sm:size-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                            aria-label="이전 사진"
                        >
                            <ChevronLeft className="size-7 sm:size-8" />
                        </button>
                    )}

                    {/* Image */}
                    <div
                        className="w-full h-full flex items-center justify-center p-12 sm:p-16"
                        onClick={onClose}
                    >
                        <img
                            src={images[currentIndex]}
                            alt={`사진 ${currentIndex + 1}`}
                            className="max-w-full max-h-full object-contain select-none"
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                        />
                    </div>

                    {/* Next Button */}
                    {images.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goToNext()
                            }}
                            className="absolute right-2 sm:right-4 z-10 flex items-center justify-center size-12 sm:size-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                            aria-label="다음 사진"
                        >
                            <ChevronRight className="size-7 sm:size-8" />
                        </button>
                    )}
                </div>
            </TransitionChild>
        </Transition>
    )
}
