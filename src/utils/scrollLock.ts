// ============================================
// Body Scroll Lock Counter
// Prevents multiple overlays from interfering
// ============================================

let _lockCount = 0

export function lockBodyScroll() {
  _lockCount++
  if (_lockCount === 1) {
    document.body.style.overflow = 'hidden'
  }
}

export function unlockBodyScroll() {
  _lockCount = Math.max(0, _lockCount - 1)
  if (_lockCount === 0) {
    document.body.style.overflow = ''
  }
}
