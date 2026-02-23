// ============================================
// useNavItems Hook
// Centralized navigation items for sidebar,
// mobile drawer, and bottom navigation bar
// ============================================

import { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Wallet,
  MapPin,
  Settings,
  Info,
  Home,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useClosestTrip } from './useClosestTrip'
import { toast } from '@/stores/uiStore'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  path: string | null
  isActive: boolean
  isDynamic: boolean
}

export interface NavItemsResult {
  sideNavItems: NavItem[]
  bottomNavItems: NavItem[]
  closestTripId: number | null
  handleNoTripFallback: () => void
}

export function useNavItems(): NavItemsResult {
  const { closestTripId } = useClosestTrip()
  const location = useLocation()
  const navigate = useNavigate()

  const handleNoTripFallback = useCallback(() => {
    toast.info('여행을 먼저 만들어주세요')
    navigate('/trips/new')
  }, [navigate])

  const pathname = location.pathname

  const sideNavItems: NavItem[] = useMemo(() => {
    const isTripDetailPage = /^\/trips\/\d+$/.test(pathname)
    const isTripLogPage = /^\/trips\/\d+\/log$/.test(pathname)
    const isExpensePage = /^\/trips\/\d+\/expenses$/.test(pathname)

    return [
      {
        id: 'dashboard',
        label: '대시보드',
        icon: LayoutDashboard,
        path: '/dashboard',
        isActive: pathname === '/dashboard',
        isDynamic: false,
      },
      {
        id: 'schedule',
        label: '여행일정',
        icon: CalendarDays,
        path: closestTripId ? `/trips/${closestTripId}` : null,
        isActive: isTripDetailPage,
        isDynamic: true,
      },
      {
        id: 'log',
        label: '여행 기록',
        icon: BookOpen,
        path: closestTripId ? `/trips/${closestTripId}/log` : null,
        isActive: isTripLogPage,
        isDynamic: true,
      },
      {
        id: 'expense',
        label: '여행 경비',
        icon: Wallet,
        path: closestTripId ? `/trips/${closestTripId}/expenses` : null,
        isActive: isExpensePage,
        isDynamic: true,
      },
      {
        id: 'places',
        label: '장소 라이브러리',
        icon: MapPin,
        path: '/places',
        isActive: pathname === '/places',
        isDynamic: false,
      },
      {
        id: 'settings',
        label: '설정',
        icon: Settings,
        path: '/settings',
        isActive: pathname === '/settings',
        isDynamic: false,
      },
      {
        id: 'about',
        label: '정보',
        icon: Info,
        path: '/about',
        isActive: pathname === '/about',
        isDynamic: false,
      },
    ]
  }, [closestTripId, pathname])

  const bottomNavItems: NavItem[] = useMemo(() => {
    const isTripDetailPage = /^\/trips\/\d+$/.test(pathname)
    const isTripLogPage = /^\/trips\/\d+\/log$/.test(pathname)
    const isExpensePage = /^\/trips\/\d+\/expenses$/.test(pathname)

    return [
      {
        id: 'home',
        label: '홈',
        icon: Home,
        path: '/dashboard',
        isActive: pathname === '/dashboard',
        isDynamic: false,
      },
      {
        id: 'schedule',
        label: '일정',
        icon: CalendarDays,
        path: closestTripId ? `/trips/${closestTripId}` : null,
        isActive: isTripDetailPage,
        isDynamic: true,
      },
      {
        id: 'log',
        label: '기록',
        icon: BookOpen,
        path: closestTripId ? `/trips/${closestTripId}/log` : null,
        isActive: isTripLogPage,
        isDynamic: true,
      },
      {
        id: 'expense',
        label: '경비',
        icon: Wallet,
        path: closestTripId ? `/trips/${closestTripId}/expenses` : null,
        isActive: isExpensePage,
        isDynamic: true,
      },
      {
        id: 'settings',
        label: '설정',
        icon: Settings,
        path: '/settings',
        isActive: pathname === '/settings',
        isDynamic: false,
      },
    ]
  }, [closestTripId, pathname])

  return { sideNavItems, bottomNavItems, closestTripId, handleNoTripFallback }
}
