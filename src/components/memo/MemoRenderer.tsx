// ============================================
// MemoRenderer - 메모 렌더링 컴포넌트
// ============================================

import { useState, useCallback, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import {
  parseLabelLine,
  parseChecklistItem,
  parseSectionHeader,
  cleanSectionTitle,
  preprocessMemoContent,
  COLOR_CLASSES,
  type MemoIconRule,
  type SectionHeaderRule,
  type ChecklistItemParsed,
} from '@/utils/memoIcons'
import { cn } from '@/utils/cn'

interface MemoRendererProps {
  content: string
  className?: string
}

export function MemoRenderer({ content, className = '' }: MemoRendererProps) {
  // 전처리: 마크다운 헤더 제거
  const preprocessed = preprocessMemoContent(content)
  // 섹션 헤더로 콘텐츠를 분할
  const sections = splitIntoSections(preprocessed)

  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((section, idx) => (
        <MemoBlock key={idx} content={section} />
      ))}
    </div>
  )
}

// 인라인 마크다운 렌더링: **bold** → <strong>, *italic* → <em>
function renderInlineMarkdown(text: string): ReactNode {
  // **bold** 와 *italic* 패턴이 없으면 그대로 반환
  if (!text.includes('*')) return text

  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // **bold** 패턴 (먼저 체크 — ** 가 * 보다 우선)
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1])
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[2]}</strong>)
      remaining = boldMatch[3]
      continue
    }

    // *italic* 패턴
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/)
    if (italicMatch) {
      if (italicMatch[1]) parts.push(italicMatch[1])
      parts.push(<em key={key++}>{italicMatch[2]}</em>)
      remaining = italicMatch[3]
      continue
    }

    // 더 이상 패턴 없음
    parts.push(remaining)
    break
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// 테이블 블록: | col | col | 패턴 감지
function TableBlock({ lines }: { lines: string[] }) {
  // 구분선(---|---) 제거하고 데이터만 파싱
  const dataLines = lines.filter((l) => !l.trim().match(/^[\s|:-]+$/))

  if (dataLines.length === 0) return null

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

  const headerCells = parseRow(dataLines[0])
  const bodyRows = dataLines.slice(1).map(parseRow)

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-800">
            {headerCells.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700"
              >
                {renderInlineMarkdown(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                ri % 2 === 0
                  ? 'bg-white dark:bg-zinc-900'
                  : 'bg-zinc-50 dark:bg-zinc-800/50'
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800"
                >
                  {renderInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 구분선 블록: ---
function SeparatorBlock() {
  return <hr className="border-t border-zinc-200 dark:border-zinc-700 my-2" />
}

// 인용 블록: > text
function BlockquoteBlock({ lines }: { lines: string[] }) {
  return (
    <blockquote className="border-l-4 border-primary-300 dark:border-primary-600 pl-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-r-lg">
      {lines.map((line, i) => (
        <p key={i} className="text-sm text-zinc-600 dark:text-zinc-400 italic leading-relaxed">
          {renderInlineMarkdown(line.replace(/^>\s*/, ''))}
        </p>
      ))}
    </blockquote>
  )
}

// 섹션 헤더를 감지하여 콘텐츠를 분할
function splitIntoSections(content: string): string[] {
  const lines = content.split('\n')
  const sections: string[] = []
  let currentSection: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // 빈 줄은 현재 섹션에 추가 (섹션 내 줄바꿈 유지)
    if (!trimmed) {
      if (currentSection.length > 0) {
        currentSection.push('')
      }
      continue
    }

    // --- 구분선은 별도 섹션으로 분리
    if (trimmed.match(/^-{3,}$/)) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n').trim())
        currentSection = []
      }
      sections.push('---')
      continue
    }

    // 섹션 헤더 감지
    const isHeader = parseSectionHeader(trimmed)

    if (isHeader && currentSection.length > 0) {
      // 이전 섹션 저장
      sections.push(currentSection.join('\n').trim())
      currentSection = [line]
    } else {
      currentSection.push(line)
    }
  }

  // 마지막 섹션 저장
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n').trim())
  }

  return sections.filter(s => s.trim())
}

function MemoBlock({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return null

  // 구분선 감지
  if (lines.length === 1 && lines[0].trim().match(/^-{3,}$/)) {
    return <SeparatorBlock />
  }

  // 테이블 블록 감지 (| col | col | 패턴)
  const isTable = lines.length >= 2 && lines.every((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
  if (isTable) {
    return <TableBlock lines={lines} />
  }

  // 인용 블록 감지 (> text)
  const isBlockquote = lines.every((l) => l.trim().startsWith('>'))
  if (isBlockquote) {
    return <BlockquoteBlock lines={lines} />
  }

  // 1. 섹션 헤더 감지
  const sectionHeader = parseSectionHeader(lines[0])
  if (sectionHeader) {
    const remainingLines = lines.slice(1)

    // 체크리스트 섹션인지 확인
    const checklistItems = remainingLines
      .map((line, idx) => {
        const parsed = parseChecklistItem(line)
        return parsed ? { id: `${idx}`, ...parsed } : null
      })
      .filter((item): item is { id: string } & ChecklistItemParsed => item !== null)

    if (checklistItems.length > 0) {
      return (
        <div className="space-y-3">
          <SectionHeaderBlock title={lines[0]} rule={sectionHeader} />
          <ChecklistBlock items={checklistItems} />
        </div>
      )
    }

    // 일반 섹션
    return (
      <div className="space-y-3">
        <SectionHeaderBlock title={lines[0]} rule={sectionHeader} />
        <div className="space-y-2">
          {remainingLines.map((line, idx) => (
            <MemoLine key={idx} line={line} />
          ))}
        </div>
      </div>
    )
  }

  // 2. 체크리스트 (헤더 없이)
  const allChecklist = lines.every((l) => parseChecklistItem(l) !== null)
  if (allChecklist) {
    const items = lines.map((line, idx) => {
      const parsed = parseChecklistItem(line)!
      return { id: `${idx}`, ...parsed }
    })
    return <ChecklistBlock items={items} />
  }

  // 3. 첫 줄이 라벨:값 형식인지 확인
  const firstLineParsed = parseLabelLine(lines[0])

  // 라벨 블록 (아이콘이 있는 경우)
  if (firstLineParsed?.rule) {
    // 여러 줄인 경우 그룹으로 처리
    if (lines.length > 1) {
      return (
        <LabelGroupBlock
          label={firstLineParsed.label}
          value={firstLineParsed.value}
          rule={firstLineParsed.rule}
          additionalLines={lines.slice(1)}
        />
      )
    }
    return (
      <LabelBlock
        label={firstLineParsed.label}
        value={firstLineParsed.value}
        rule={firstLineParsed.rule}
      />
    )
  }

  // 라벨:값 형식이지만 아이콘이 없는 경우
  if (firstLineParsed && !firstLineParsed.rule) {
    return <SimpleLabelBlock lines={lines} />
  }

  // 4. 리스트 블록 감지 (모든 줄이 -, *, 숫자.로 시작)
  const isListBlock = lines.every(
    (l) => l.trim().match(/^[-*]\s/) || l.trim().match(/^\d+\.\s/)
  )

  if (isListBlock) {
    return <ListBlock lines={lines} />
  }

  // 일반 문단
  return <ParagraphBlock content={content} />
}

// 아이콘이 있는 라벨 블록
function LabelBlock({
  label,
  value,
  rule,
}: {
  label: string
  value: string
  rule: MemoIconRule
}) {
  const colors = COLOR_CLASSES[rule.color]
  const Icon = rule.icon

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${colors.bg} ${colors.border}`}
    >
      <Icon className={`size-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${colors.label}`}>{label}:</span>{' '}
        <span className="text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(value)}</span>
      </div>
    </div>
  )
}

// 아이콘이 있는 라벨 그룹 블록 (여러 줄)
function LabelGroupBlock({
  label,
  value,
  rule,
  additionalLines,
}: {
  label: string
  value: string
  rule: MemoIconRule
  additionalLines: string[]
}) {
  const colors = COLOR_CLASSES[rule.color]
  const Icon = rule.icon

  return (
    <div className={`px-4 py-3 rounded-xl border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`size-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
        <div className="flex-1 min-w-0">
          <span className={`font-medium ${colors.label}`}>{label}:</span>{' '}
          <span className="text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(value)}</span>
        </div>
      </div>
      {additionalLines.length > 0 && (
        <div className="mt-2 ml-8 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {additionalLines.map((line, i) => (
            <div key={i}>{renderInlineMarkdown(line)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// 아이콘 없는 심플 라벨 블록
function SimpleLabelBlock({ lines }: { lines: string[] }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 space-y-1">
      {lines.map((line, i) => {
        const parsed = parseLabelLine(line)
        if (parsed) {
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="font-medium text-zinc-600 dark:text-zinc-400 min-w-fit">
                {parsed.label}:
              </span>
              <span className="text-zinc-800 dark:text-zinc-200">{renderInlineMarkdown(parsed.value)}</span>
            </div>
          )
        }
        return (
          <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
            {renderInlineMarkdown(line)}
          </div>
        )
      })}
    </div>
  )
}

// 리스트 블록
function ListBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {lines.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="text-primary-500 mt-1 select-none">•</span>
          <span className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {renderInlineMarkdown(item.trim().replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''))}
          </span>
        </li>
      ))}
    </ul>
  )
}

// 일반 문단
function ParagraphBlock({ content }: { content: string }) {
  return (
    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
      {renderInlineMarkdown(content)}
    </p>
  )
}

// 섹션 헤더 블록
function SectionHeaderBlock({
  title,
  rule,
}: {
  title: string
  rule: SectionHeaderRule
}) {
  const colors = COLOR_CLASSES[rule.color]
  const Icon = rule.icon
  const cleanTitle = cleanSectionTitle(title)

  return (
    <div
      className={cn(
        'flex items-center gap-2 pb-2 mb-1',
        'border-b-2',
        colors.border
      )}
    >
      <div className={cn('p-1.5 rounded-lg', colors.bg)}>
        <Icon className={cn('size-4', colors.icon)} />
      </div>
      <h3 className={cn('font-semibold text-base', colors.label)}>
        {cleanTitle}
      </h3>
    </div>
  )
}

// 체크리스트 블록
interface ChecklistItem {
  id: string
  checked: boolean
  text: string
}

function ChecklistBlock({
  items: initialItems,
}: {
  items: ChecklistItem[]
}) {
  const [items, setItems] = useState(initialItems)

  const handleToggle = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    )
  }, [])

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <label
          key={item.id}
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all',
            'border',
            item.checked
              ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'
              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
          )}
        >
          <input
            type="checkbox"
            checked={item.checked}
            onChange={() => handleToggle(item.id)}
            className={cn(
              'mt-0.5 size-5 rounded border-2 cursor-pointer appearance-none',
              'border-zinc-300 dark:border-zinc-600',
              'checked:bg-success-500 checked:border-success-500',
              'focus:ring-2 focus:ring-success-500/50',
              'relative'
            )}
            style={{
              backgroundImage: item.checked
                ? `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")`
                : 'none',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <span
            className={cn(
              'flex-1 text-sm leading-relaxed',
              item.checked
                ? 'text-zinc-500 dark:text-zinc-400 line-through'
                : 'text-zinc-700 dark:text-zinc-300'
            )}
          >
            {renderInlineMarkdown(item.text)}
          </span>
          {item.checked && (
            <Check className="size-4 text-success-500 flex-shrink-0" />
          )}
        </label>
      ))}
    </div>
  )
}

// 개별 메모 라인 (섹션 내부용)
function MemoLine({ line }: { line: string }) {
  // 라벨:값 형식인지 확인
  const parsed = parseLabelLine(line)
  if (parsed) {
    if (parsed.rule) {
      const colors = COLOR_CLASSES[parsed.rule.color]
      const Icon = parsed.rule.icon
      return (
        <div className="flex items-start gap-2 text-sm">
          <Icon className={cn('size-4 flex-shrink-0 mt-0.5', colors.icon)} />
          <span className={cn('font-medium', colors.label)}>{parsed.label}:</span>
          <span className="text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(parsed.value)}</span>
        </div>
      )
    }
    return (
      <div className="flex gap-2 text-sm">
        <span className="font-medium text-zinc-600 dark:text-zinc-400">
          {parsed.label}:
        </span>
        <span className="text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(parsed.value)}</span>
      </div>
    )
  }

  // 리스트 아이템인지 확인
  const listMatch = line.trim().match(/^[-*]\s*(.+)$/)
  if (listMatch) {
    return (
      <div className="flex gap-2 text-sm">
        <span className="text-primary-500 select-none">•</span>
        <span className="text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(listMatch[1])}</span>
      </div>
    )
  }

  // 일반 텍스트
  return (
    <p className="text-sm text-zinc-700 dark:text-zinc-300">{renderInlineMarkdown(line)}</p>
  )
}
