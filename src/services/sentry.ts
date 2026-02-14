// ============================================
// Sentry Error Tracking
// Activated only when VITE_SENTRY_DSN is set
// ============================================

import * as Sentry from '@sentry/react'
import { APP_VERSION } from '@/utils/constants'

let initialized = false

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || initialized) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `travel@${APP_VERSION}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })

  initialized = true
  console.log('[Sentry] Initialized')
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) {
    console.error('[Error]', error, context)
    return
  }

  Sentry.captureException(error, {
    extra: context,
  })
}
