// ============================================
// LangChain/LangGraph Travel Chat API
// Multi-turn conversational planner with SSE streaming
// Phase 3: StateGraph agent with tool calling
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { createWebSearchTool } from './tools/webSearch'
import { createWeatherTool } from './tools/weather'
import { createCurrencyTool } from './tools/currency'

export const config = { maxDuration: 60 }

// Inline rate limiter (Vercel can't resolve local TS imports in some configs)
const _rlStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now()
  for (const [k, e] of _rlStore) { if (e.resetAt <= now) _rlStore.delete(k) }
  if (_rlStore.size > 1000) {
    const entries = Array.from(_rlStore.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = Math.ceil(entries.length / 2)
    for (let i = 0; i < toRemove; i++) _rlStore.delete(entries[i][0])
  }
  const entry = _rlStore.get(key)
  if (!entry || entry.resetAt <= now) {
    _rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }
  entry.count++
  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt }
}

const ALLOWED_ORIGINS = [
  'https://travel1.moonwave.kr',
  'https://moonwave-travel.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const MAX_BODY_SIZE = 512 * 1024

const CLAUDE_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-6',
}

const GEMINI_MODEL_MAP: Record<string, string> = {
  flash: 'gemini-2.0-flash',
  pro: 'gemini-2.5-pro-preview-05-06',
}

function resolveClaudeModel(model?: string): string {
  return CLAUDE_MODEL_MAP[model || 'sonnet'] || CLAUDE_MODEL_MAP.sonnet
}

function resolveGeminiModel(model?: string): string {
  return GEMINI_MODEL_MAP[model || 'flash'] || GEMINI_MODEL_MAP.flash
}

function buildSystemPrompt(tripContext?: { title?: string; country?: string }): string {
  const country = tripContext?.country || '해외'
  const title = tripContext?.title || '여행'

  return `당신은 친절하고 전문적인 한국어 여행 플래닝 어시스턴트입니다.
사용자는 "${title}" (${country}) 여행을 계획하고 있습니다.

역할:
- 여행 일정 제안 및 최적화
- 현지 맛집, 관광지, 숙소 추천
- 교통편 안내
- 현지 문화, 날씨, 주의사항 정보 제공
- 여행 팁 및 실용적 조언

규칙:
- 항상 한국어로 답변하세요
- 구체적이고 실용적인 정보를 제공하세요
- 가능하면 장소명, 주소, 가격 등 실제 정보를 포함하세요
- 친근하고 따뜻한 톤으로 대화하세요
- 불확실한 정보는 솔직하게 알려주세요
- 도구(웹 검색, 날씨, 환율)를 활용하여 최신 정보를 제공할 수 있습니다`
}

// Collect available tools (graceful degradation: null → filtered out)
function getAvailableTools() {
  return [
    createWebSearchTool(),
    createWeatherTool(),
    createCurrencyTool(),
  ].filter((t): t is NonNullable<typeof t> => t !== null)
}

// Build LangGraph StateGraph for the chat agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChatGraph(model: any, tools: ReturnType<typeof getAvailableTools>) {
  if (tools.length === 0) {
    // No tools: simple streaming without graph overhead
    return null
  }

  const modelWithTools = model.bindTools(tools)
  const toolNode = new ToolNode(tools)

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1]
    if (
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      return 'tools'
    }
    return '__end__'
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', async (state) => {
      const response = await modelWithTools.invoke(state.messages)
      return { messages: [response] }
    })
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      __end__: '__end__',
    })
    .addEdge('tools', 'agent')
    .compile()

  return graph
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ''
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-gemini-api-key')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Request body too large (max 512KB)' })
  }
  // content-length 헤더는 위조 가능하므로 실제 파싱된 본문 크기로 한 번 더 검증
  if (Buffer.byteLength(req.body ? JSON.stringify(req.body) : '', 'utf8') > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Request body too large (max 512KB)' })
  }

  const { message, tripContext, history = [], model, provider = 'claude' } = req.body || {}

  // Resolve API key based on provider
  let apiKey: string | undefined
  if (provider === 'gemini') {
    apiKey = (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(401).json({ error: 'Gemini API key required' })
    }
  } else {
    apiKey = (req.headers['x-api-key'] as string) || process.env.CLAUDE_API_KEY
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return res.status(401).json({ error: 'Valid Anthropic API key required (sk-ant-...)' })
    }
  }

  // Rate limiting — use IP for server keys, API key suffix for custom keys
  const isServerKey = !req.headers['x-api-key'] && !req.headers['x-gemini-api-key']
  const rateLimitKey = isServerKey
    ? `srv-${(req.headers['x-forwarded-for'] as string || 'unknown').split(',')[0].trim()}`
    : apiKey.slice(-8)
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, 30, 60_000)
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  // catch 블록에서도 접근할 수 있도록 try 바깥에 선언
  let clientConnected = true

  try {
    let chatModel: BaseChatModel
    if (provider === 'gemini') {
      chatModel = new ChatGoogleGenerativeAI({
        model: resolveGeminiModel(model),
        maxOutputTokens: 4096,
        apiKey,
      })
    } else {
      chatModel = new ChatAnthropic({
        model: resolveClaudeModel(model),
        maxTokens: 4096,
        anthropicApiKey: apiKey,
      })
    }

    const systemPrompt = buildSystemPrompt(tripContext)

    // Convert history to LangChain message objects
    const langchainMessages: (HumanMessage | AIMessage)[] = []
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === 'user' && msg.content?.trim()) {
          langchainMessages.push(new HumanMessage(msg.content))
        } else if (msg.role === 'assistant' && msg.content?.trim()) {
          langchainMessages.push(new AIMessage(msg.content))
        }
      }
    }

    // Ensure proper alternation
    const lastMsg = langchainMessages[langchainMessages.length - 1]
    if (!lastMsg || !(lastMsg instanceof HumanMessage) || lastMsg.content !== message) {
      if (lastMsg && lastMsg instanceof HumanMessage) {
        langchainMessages.push(new AIMessage('네, 계속 말씀해주세요.'))
      }
      langchainMessages.push(new HumanMessage(message))
    }

    // Ensure starts with user message
    if (langchainMessages.length > 0 && !(langchainMessages[0] instanceof HumanMessage)) {
      langchainMessages.shift()
    }

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // 클라이언트가 연결을 끊으면 상류 LLM 스트림 요청까지 취소하여 토큰/리소스 낭비 방지
    const abortController = new AbortController()
    res.on('close', () => {
      clientConnected = false
      abortController.abort()
    })

    const tools = getAvailableTools()
    const graph = buildChatGraph(chatModel, tools)

    const allMessages = [
      new SystemMessage(systemPrompt),
      ...langchainMessages,
    ]

    if (graph) {
      // LangGraph agent with tools
      const eventStream = graph.streamEvents(
        { messages: allMessages },
        { version: 'v2', recursionLimit: 6, signal: abortController.signal },
      )

      for await (const event of eventStream) {
        if (!clientConnected) break

        // Stream text chunks from the model
        if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
          const chunk = event.data.chunk
          const text = typeof chunk.content === 'string'
            ? chunk.content
            : Array.isArray(chunk.content)
              ? chunk.content.filter((c: { type: string }) => c.type === 'text').map((c: unknown) => (c as { text: string }).text).join('')
              : ''
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`)
          }
        }

        // Send tool results to client
        if (event.event === 'on_tool_end' && event.data?.output) {
          // 도구 출력은 문자열이 아니라 ToolMessage/객체일 수 있어 String()이 '[object Object]'를 내므로 content를 추출
          const out = event.data.output
          const result =
            typeof out === 'string'
              ? out
              : out && typeof out === 'object' && 'content' in out
                ? typeof (out as { content: unknown }).content === 'string'
                  ? (out as { content: string }).content
                  : JSON.stringify((out as { content: unknown }).content)
                : String(out)
          res.write(`data: ${JSON.stringify({
            toolUse: { name: event.name, result },
          })}\n\n`)
        }
      }
    } else {
      // Simple streaming without tools
      const stream = await chatModel.stream(allMessages, { signal: abortController.signal })

      for await (const chunk of stream) {
        if (!clientConnected) break
        const text = typeof chunk.content === 'string'
          ? chunk.content
          : Array.isArray(chunk.content)
            ? chunk.content.filter((c: { type: string }) => c.type === 'text').map((c: unknown) => (c as { text: string }).text).join('')
            : ''
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      }
    }

    if (clientConnected) {
      res.write('data: [DONE]\n\n')
    }
    res.end()
  } catch (err: unknown) {
    // 클라이언트 연결 종료로 인한 의도된 중단이면 별도 보고 없이 종료
    if (!clientConnected) {
      try { res.end() } catch { /* already closed */ }
      return
    }
    console.error('[LangChain Chat] Error:', err)
    const errMsg = err instanceof Error ? err.message : 'LangChain chat error'
    const status = errMsg.includes('authentication') || errMsg.includes('api_key') ? 401 : 500

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.status(status).json({ error: errMsg })
    }
  }
}
