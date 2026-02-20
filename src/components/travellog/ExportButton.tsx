// ============================================
// Export Button Component
// GPX / KML download for travel logs
// ============================================

import { IconButton } from '@/components/ui/Button'
import { toast } from '@/stores/uiStore'
import type { TravelLog } from '@/types'
import { exportToGPX } from '@/utils/gpxExporter'
import { exportToKML } from '@/utils/kmlExporter'
import { Download, FileDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ExportButtonProps {
  logs: TravelLog[]
  tripTitle: string
}

export function ExportButton({ logs, tripTitle }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const coordLogs = logs.filter((l) => l.latitude != null && l.longitude != null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportGPX = () => {
    const gpx = exportToGPX(logs, tripTitle)
    if (!gpx) {
      toast.error('좌표가 있는 기록이 없습니다')
      return
    }
    const safeName = tripTitle.replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'travel-log'
    downloadFile(gpx, `${safeName}.gpx`, 'application/gpx+xml')
    toast.success('GPX 파일이 다운로드되었습니다')
    setOpen(false)
  }

  const handleExportKML = () => {
    const kml = exportToKML(logs, tripTitle)
    if (!kml) {
      toast.error('좌표가 있는 기록이 없습니다')
      return
    }
    const safeName = tripTitle.replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim() || 'travel-log'
    downloadFile(kml, `${safeName}.kml`, 'application/vnd.google-earth.kml+xml')
    toast.success('KML 파일이 다운로드되었습니다')
    setOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <IconButton
        plain
        color="secondary"
        onClick={() => setOpen(!open)}
        aria-label="내보내기"
        title="내보내기"
        disabled={coordLogs.length === 0}
      >
        <Download className="size-5" />
      </IconButton>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden min-w-[140px]">
          <button
            type="button"
            onClick={handleExportGPX}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FileDown className="size-4 text-green-500" />
            GPX 내보내기
          </button>
          <button
            type="button"
            onClick={handleExportKML}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FileDown className="size-4 text-blue-500" />
            KML 내보내기
          </button>
          <div className="px-3 py-1.5 text-[10px] text-zinc-400 border-t border-[var(--border)]">
            좌표 있는 기록: {coordLogs.length}개
          </div>
        </div>
      )}
    </div>
  )
}
