// ============================================
// Cross-Tab Broadcast Service
// BroadcastChannel + localStorage fallback
// ============================================

type MessageType =
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  | 'TRIP_DELETED'
  | 'PLAN_CREATED'
  | 'PLAN_UPDATED'
  | 'PLAN_DELETED'
  | 'PLANS_REORDERED'
  | 'PLACE_CREATED'
  | 'PLACE_UPDATED'
  | 'PLACE_DELETED'
  | 'SETTINGS_CHANGED'
  | 'DATA_IMPORTED'
  | 'DATA_CLEARED'

interface BroadcastMessage {
  type: MessageType
  payload?: unknown
  tabId: string
  timestamp: number
}

type MessageHandler = (message: BroadcastMessage) => void

// Generate unique tab ID
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

// Storage key for localStorage fallback
const STORAGE_KEY = 'travel-broadcast'

class BroadcastService {
  private channel: BroadcastChannel | null = null
  private handlers: Set<MessageHandler> = new Set()
  private useFallback: boolean = false
  private lastProcessedTimestamp: number = 0

  constructor() {
    this.init()
  }

  private init() {
    // Try BroadcastChannel first
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('travel-sync')
        this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
          this.handleMessage(event.data)
        }
        console.log('[Broadcast] Using BroadcastChannel API')
      } catch {
        this.useFallback = true
      }
    } else {
      this.useFallback = true
    }

    // Fallback to localStorage events
    if (this.useFallback && typeof window !== 'undefined') {
      console.log('[Broadcast] Using localStorage fallback')
      window.addEventListener('storage', this.handleStorageEvent)
    }
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return

    try {
      const message: BroadcastMessage = JSON.parse(event.newValue)
      this.handleMessage(message)
    } catch {
      console.warn('[Broadcast] Failed to parse storage event')
    }
  }

  private handleMessage(message: BroadcastMessage) {
    // Ignore messages from this tab
    if (message.tabId === TAB_ID) return

    // Ignore already processed messages (for localStorage which may fire multiple times)
    if (message.timestamp <= this.lastProcessedTimestamp) return
    this.lastProcessedTimestamp = message.timestamp

    console.log('[Broadcast] Received:', message.type)

    // Notify all handlers
    this.handlers.forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        console.error('[Broadcast] Handler error:', error)
      }
    })
  }

  /**
   * Send a broadcast message to other tabs
   */
  send(type: MessageType, payload?: unknown): void {
    const message: BroadcastMessage = {
      type,
      payload,
      tabId: TAB_ID,
      timestamp: Date.now(),
    }

    if (this.channel) {
      this.channel.postMessage(message)
    } else if (this.useFallback) {
      // Use localStorage for fallback
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
        // Clear immediately to allow same message to be sent again
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        console.warn('[Broadcast] Failed to send via localStorage')
      }
    }

    console.log('[Broadcast] Sent:', type)
  }

  /**
   * Subscribe to broadcast messages
   */
  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    if (this.useFallback && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent)
    }
    this.handlers.clear()
  }

  /**
   * Get current tab ID
   */
  getTabId(): string {
    return TAB_ID
  }
}

// Singleton instance
export const broadcast = new BroadcastService()

// Convenience methods
export const sendBroadcast = (type: MessageType, payload?: unknown) =>
  broadcast.send(type, payload)

export const subscribeToBroadcast = (handler: MessageHandler) =>
  broadcast.subscribe(handler)

export type { MessageType, BroadcastMessage, MessageHandler }
