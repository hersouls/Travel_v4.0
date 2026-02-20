// ============================================
// Location Group View Component
// Shows logs grouped by geographic proximity
// ============================================

import type { TravelLog } from '@/types'
import { clusterLogsByLocation } from '@/utils/locationClustering'
import { Camera, ChevronDown, ChevronUp, FileText, MapPin, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TimelineCard } from './TimelineCard'

interface LocationGroupViewProps {
  logs: TravelLog[]
  onEdit: (log: TravelLog) => void
  onDelete: (id: number) => void
  onPhotoClick: (photo: string) => void
}

const typeIcons = {
  photo: Camera,
  receipt: Receipt,
  memo: FileText,
} as const

export function LocationGroupView({
  logs,
  onEdit,
  onDelete,
  onPhotoClick,
}: LocationGroupViewProps) {
  const clusters = useMemo(() => clusterLogsByLocation(logs, 100), [logs])
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(
    () => new Set(clusters.length > 0 ? [0] : []),
  )

  const toggleCluster = (idx: number) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (clusters.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">위치 정보가 있는 기록이 없습니다</div>
    )
  }

  return (
    <div className="space-y-2">
      {clusters.map((cluster, idx) => {
        const isExpanded = expandedClusters.has(idx)
        const typeCounts = {
          photo: cluster.logs.filter((l) => l.type === 'photo').length,
          receipt: cluster.logs.filter((l) => l.type === 'receipt').length,
          memo: cluster.logs.filter((l) => l.type === 'memo').length,
        }

        return (
          <div key={`${cluster.centroid.lat}-${cluster.centroid.lng}`}>
            <button
              type="button"
              onClick={() => toggleCluster(idx)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <MapPin className="size-4 text-violet-500 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <span className="text-sm font-medium text-[var(--foreground)] truncate block">
                  {cluster.placeName}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <span>{cluster.count}개 기록</span>
                  {Object.entries(typeCounts).map(([type, count]) => {
                    if (count === 0) return null
                    const Icon = typeIcons[type as keyof typeof typeIcons]
                    return (
                      <span key={type} className="flex items-center gap-0.5">
                        <Icon className="size-2.5" />
                        {count}
                      </span>
                    )
                  })}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-4 text-zinc-400" />
              ) : (
                <ChevronDown className="size-4 text-zinc-400" />
              )}
            </button>

            {isExpanded && (
              <div className="border border-t-0 border-[var(--border)] rounded-b-xl bg-[var(--card)] px-3 py-3 -mt-1">
                {cluster.logs.map((log) => (
                  <TimelineCard
                    key={log.id}
                    log={log}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPhotoClick={onPhotoClick}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
