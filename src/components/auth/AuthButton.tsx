// ============================================
// Auth Button Component
// Google 로그인/로그아웃 + 동기화 상태
// ============================================

import { useState, useRef, useEffect } from 'react'
import { LogIn, LogOut, Cloud, CloudOff, User } from 'lucide-react'
import { useAuthStore, useUser, useAuthLoading } from '@/stores/authStore'
import { syncManager } from '@/services/firestoreSync'
import { toast } from '@/stores/uiStore'

export function AuthButton() {
  const user = useUser()
  const isLoading = useAuthLoading()
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const logout = useAuthStore((s) => s.logout)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleLogin = async () => {
    try {
      await signInWithGoogle()
      toast.success('로그인 성공! 데이터 동기화를 시작합니다.')
    } catch {
      toast.error('로그인에 실패했습니다')
    }
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await logout()
    toast.info('로그아웃 되었습니다')
  }

  // Not logged in
  if (!user) {
    return (
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
          bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20
          disabled:opacity-50 disabled:cursor-not-allowed"
        title="Google 로그인으로 데이터 동기화"
      >
        {isLoading ? (
          <div className="size-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogIn className="size-3.5" />
        )}
        <span className="hidden sm:inline">로그인</span>
      </button>
    )
  }

  // Logged in
  const isSyncing = syncManager.isActive()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title={`${user.displayName || user.email} - 동기화 ${isSyncing ? '활성' : '비활성'}`}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="size-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="size-6 rounded-full bg-primary-500 flex items-center justify-center">
            <User className="size-3.5 text-white" />
          </div>
        )}
        {isSyncing ? (
          <Cloud className="size-3 text-success-500" />
        ) : (
          <CloudOff className="size-3 text-zinc-400" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 overflow-hidden animate-fade-in">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-[var(--border)]">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {user.displayName || '사용자'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {isSyncing ? (
                <>
                  <Cloud className="size-3 text-success-500" />
                  <span className="text-xs text-success-600 dark:text-success-400">동기화 활성</span>
                </>
              ) : (
                <>
                  <CloudOff className="size-3 text-zinc-400" />
                  <span className="text-xs text-zinc-500">동기화 비활성</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-1">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="size-4" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
