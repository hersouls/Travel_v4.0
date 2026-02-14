// ============================================
// Chat Store (Zustand) — AI Conversational Planner
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ClaudeModel } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  tripContext: { tripId: number; title: string; country: string } | null

  sendMessage: (content: string) => Promise<void>
  setTripContext: (context: ChatState['tripContext']) => void
  clearMessages: () => void
}

const CHAT_API_URL = '/api/claude/chat'

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      isLoading: false,
      tripContext: null,

      sendMessage: async (content: string) => {
        const { tripContext, messages } = get()
        const { claudeApiKey, claudeModel } = useSettingsStore.getState()

        if (!claudeApiKey) {
          // Add error as assistant message
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'API 키가 설정되지 않았습니다. 설정에서 Claude API 키를 입력해주세요.',
            timestamp: new Date(),
          }
          set((state) => ({ messages: [...state.messages, errorMsg] }))
          return
        }

        // Add user message
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date(),
        }

        set((state) => ({
          messages: [...state.messages, userMessage],
          isLoading: true,
        }))

        // Prepare history (last 10 messages)
        const history = [...messages, userMessage]
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))

        // Create placeholder assistant message
        const assistantId = crypto.randomUUID()
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }

        set((state) => ({
          messages: [...state.messages, assistantMessage],
        }))

        try {
          const response = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeApiKey,
            },
            body: JSON.stringify({
              message: content,
              tripContext,
              history,
              model: claudeModel || 'sonnet',
            }),
          })

          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errData.error || `HTTP ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let buffer = ''
          let accumulated = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulated += parsed.text
                  // Update the assistant message in place
                  set((state) => ({
                    messages: state.messages.map((m) =>
                      m.id === assistantId ? { ...m, content: accumulated } : m
                    ),
                  }))
                }
              } catch {
                // skip malformed chunks
              }
            }
          }

          // If no content was received, show fallback
          if (!accumulated) {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: '응답을 받지 못했습니다. 다시 시도해주세요.' }
                  : m
              ),
            }))
          }
        } catch (err) {
          const errorText =
            err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: `오류: ${errorText}` }
                : m
            ),
          }))
        } finally {
          set({ isLoading: false })
        }
      },

      setTripContext: (context) => {
        const { tripContext } = get()
        // If trip context changed, clear messages
        if (
          context?.tripId !== tripContext?.tripId
        ) {
          set({ tripContext: context, messages: [] })
        } else {
          set({ tripContext: context })
        }
      },

      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'chat-store' }
  )
)
