// ============================================
// Error Boundary Component
// ============================================

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { captureError } from '@/services/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error)
    console.error('Component stack:', errorInfo.componentStack)

    // Report to Sentry (no-op if DSN not configured)
    captureError(error, { componentStack: errorInfo.componentStack })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-900/30 mb-6">
              <AlertTriangle className="size-8 text-danger-600 dark:text-danger-400" />
            </div>

            <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
              문제가 발생했습니다
            </h1>

            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              예상치 못한 오류가 발생했습니다.
              <br />
              페이지를 새로고침하거나 홈으로 이동해주세요.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-left overflow-auto">
                <p className="text-sm font-mono text-danger-600 dark:text-danger-400 break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-xs text-zinc-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                color="primary"
                onClick={this.handleReload}
                leftIcon={<RefreshCw className="size-4" />}
              >
                새로고침
              </Button>
              <Button
                color="secondary"
                onClick={this.handleGoHome}
                leftIcon={<Home className="size-4" />}
              >
                홈으로
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
