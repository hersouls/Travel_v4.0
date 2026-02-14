// ============================================
// AI Chat Panel — Right-side slide-in panel
// Conversational travel planner
// ============================================

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useShallow } from 'zustand/react/shallow'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  tripId: number
  tripTitle: string
  tripCountry: string
}

const EXAMPLE_PROMPTS = [
  '이 여행의 추천 일정을 만들어줘',
  '현지 맛집을 추천해줘',
  '예산을 알려줘',
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:0ms]" />
        <span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:150ms]" />
        <span className="size-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function AIChatPanel({ isOpen, onClose, tripId, tripTitle, tripCountry }: AIChatPanelProps) {
  const { messages, isLoading, sendMessage, setTripContext, clearMessages } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      isLoading: s.isLoading,
      sendMessage: s.sendMessage,
      setTripContext: s.setTripContext,
      clearMessages: s.clearMessages,
    }))
  )

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Set trip context when panel opens or trip changes
  useEffect(() => {
    if (isOpen) {
      setTripContext({ tripId, title: tripTitle, country: tripCountry })
    }
  }, [isOpen, tripId, tripTitle, tripCountry, setTripContext])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptClick = (prompt: string) => {
    if (isLoading) return
    sendMessage(prompt)
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] max-w-full bg-[var(--card)] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-[var(--card)]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">AI 여행 플래너</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearMessages}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded"
              disabled={messages.length === 0}
            >
              대화 초기화
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="닫기"
            >
              <X className="size-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="size-16 rounded-full bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mb-4">
                <MessageSquare className="size-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                여행에 대해 무엇이든 물어보세요!
              </h3>
              <p className="text-sm text-zinc-500 mb-6">
                {tripTitle} ({tripCountry}) 여행을 도와드릴게요
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="px-3 py-2 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white rounded-br-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)] rounded-bl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-[var(--card)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-colors max-h-32"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 size-10 rounded-xl bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="전송"
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
