import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageContainer } from '@/components/layout'
import { APP_NAME, APP_VERSION } from '@/utils/constants'
import { ServiceFeatures } from '@/components/about/ServiceFeatures'

export function About() {
  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">정보</h1>

      {/* App Info */}
      <Card padding="lg">
        <div className="text-center mb-6">
          <div className="size-20 mx-auto mb-4 rounded-2xl bg-primary-500 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">T</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">{APP_NAME}</h2>
          <Badge color="primary" className="mt-2">
            v{APP_VERSION}
          </Badge>
        </div>

        <p className="text-center text-zinc-500 dark:text-zinc-400">
          여행의 모든 순간을 담다
        </p>
      </Card>

      {/* Features */}
      <Card padding="lg">
        <CardHeader title="주요 기능" />
        <CardContent>
          <ServiceFeatures />
        </CardContent>
      </Card>

      {/* Tech Stack */}
      <Card padding="lg">
        <CardHeader title="기술 스택" />
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge color="blue">React 19</Badge>
            <Badge color="blue">TypeScript</Badge>
            <Badge color="purple">Tailwind CSS v4</Badge>
            <Badge color="success">Zustand</Badge>
            <Badge color="warning">Dexie (IndexedDB)</Badge>
            <Badge color="pink">Framer Motion</Badge>
            <Badge color="cyan">Leaflet</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card padding="lg">
        <CardHeader title="크레딧" />
        <CardContent>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Moonwave Travel은 MCA v2.0의 UI/UX를 기반으로 제작되었습니다.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            지도 데이터: © OpenStreetMap contributors
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-center text-sm text-zinc-400">
        © 2024 Moonwave. All rights reserved.
      </p>
      </div>
    </PageContainer>
  )
}
