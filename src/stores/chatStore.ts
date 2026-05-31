// ============================================
// Chat Store (Zustand) — AI Conversational Planner
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useSettingsStore } from '@/stores/settingsStore'
import { AI_MESSAGES } from '@/utils/constants'

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

let _activeAbortController: AbortController | null = null

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      isLoading: false,
      tripContext: null,

      sendMessage: async (content: string) => {
        if (get().isLoading) return

        _activeAbortController?.abort()
        const abortController = new AbortController()
        _activeAbortController = abortController

        const { tripContext, messages } = get()
        const { claudeApiKey, claudeModel, geminiApiKey, geminiModel, aiProvider, aiKeyMode } = useSettingsStore.getState()

        const provider = aiProvider || 'claude'
        const isServerKey = aiKeyMode !== 'custom'
        const apiKey = isServerKey ? undefined : (provider === 'gemini' ? geminiApiKey : claudeApiKey)
        const model = provider === 'gemini' ? (geminiModel || 'flash') : (claudeModel || 'sonnet')

        if (!isServerKey && !apiKey) {
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: AI_MESSAGES.API_KEY_MISSING,
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

        let accumulated = ''
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (apiKey) {
            if (provider === 'gemini') {
              headers['x-gemini-api-key'] = apiKey
            } else {
              headers['x-api-key'] = apiKey
            }
          }

          const response = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              message: content,
              tripContext,
              history,
              provider,
              model,
            }),
            signal: abortController.signal,
          })

          if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errData.error || `HTTP ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let buffer = ''
          let streamError: string | null = null

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
                if (parsed.error) {
                  // 서버가 스트리밍 중 보낸 에러를 외부 catch로 전달 (기존엔 무시되어 부분/빈 응답으로 처리됨)
                  streamError = typeof parsed.error === 'string' ? parsed.error : '생성 중 오류가 발생했습니다'
                  break
                }
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
            if (streamError) break
          }

          // 서버 스트리밍 에러를 외부 catch로 라우팅 (오류 메시지 렌더 + isLoading 해제)
          if (streamError) throw new Error(streamError)

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
          if (err instanceof DOMException && err.name === 'AbortError') {
            if (!accumulated) {
              set((state) => ({
                messages: state.messages.filter((m) => m.id !== assistantId),
              }))
            }
            return
          }
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
          if (_activeAbortController === abortController) {
            _activeAbortController = null
          }
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

      clearMessages: () => {
        _activeAbortController?.abort()
        _activeAbortController = null
        set({ messages: [], isLoading: false })
      },
    }),
    { name: 'chat-store' }
  )
)
