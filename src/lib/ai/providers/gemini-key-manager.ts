/**
 * GeminiKeyManager
 * Manages 8 free-tier Gemini API keys in round-robin rotation.
 * Handles HTTP 429 throttling, automatic key release after 65s,
 * and FIFO queue when all keys are exhausted.
 *
 * Used for BOTH generation (gemini-2.5-flash) and embedding (text-embedding-004).
 * Single shared instance — do not instantiate directly, use getKeyManager().
 */

import { env } from '@/lib/env'

const THROTTLE_RELEASE_MS = 65_000  // 65 seconds
const MAX_QUEUE_WAIT_MS   = 120_000 // 120 seconds
const TOTAL_KEYS          = 8

type KeyState = {
  key: string
  throttled: boolean
  throttledAt: number | null
}

type QueuedRequest = {
  resolve: (key: { key: string; index: number }) => void
  reject: (error: Error) => void
  enqueuedAt: number
}

class GeminiKeyManager {
  private keys: KeyState[]
  private currentIndex: number = 0
  private queue: QueuedRequest[] = []
  private queueTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    // Load all 8 keys from environment — validated at startup
    this.keys = [
      env.GEMINI_API_KEY_1,
      env.GEMINI_API_KEY_2,
      env.GEMINI_API_KEY_3,
      env.GEMINI_API_KEY_4,
      env.GEMINI_API_KEY_5,
      env.GEMINI_API_KEY_6,
      env.GEMINI_API_KEY_7,
      env.GEMINI_API_KEY_8,
    ].map((key) => ({ key, throttled: false, throttledAt: null }))

    console.log(`[GeminiKeyManager] Initialised with ${TOTAL_KEYS} keys`)
  }

  /**
   * Get the next available API key in round-robin rotation.
   * If all keys are throttled, queues the request and waits.
   */
  async getKey(): Promise<{ key: string; index: number }> {
    this.releaseExpiredThrottles()

    // Find next non-throttled key starting from currentIndex
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const index = (this.currentIndex + i) % TOTAL_KEYS
      if (!this.keys[index].throttled) {
        this.currentIndex = (index + 1) % TOTAL_KEYS
        return { key: this.keys[index].key, index: index + 1 }
      }
    }

    // All keys throttled — enter queue mode
    return this.enqueue()
  }

  /**
   * Mark a key as throttled after receiving HTTP 429.
   * Automatically clears after THROTTLE_RELEASE_MS.
   */
  markThrottled(keyIndex: number): void {
    const idx = keyIndex - 1 // convert 1-based to 0-based
    this.keys[idx].throttled = true
    this.keys[idx].throttledAt = Date.now()

    console.log(
      `[GeminiKeyManager] Key ${keyIndex} throttled at ${new Date().toISOString()}. ` +
      `Will release in ${THROTTLE_RELEASE_MS / 1000}s.`
    )

    // Schedule automatic release
    setTimeout(() => {
      this.keys[idx].throttled = false
      this.keys[idx].throttledAt = null
      console.log(`[GeminiKeyManager] Key ${keyIndex} released from throttle.`)
      this.processQueue()
    }, THROTTLE_RELEASE_MS)
  }

  /**
   * Log every API call result for monitoring.
   */
  logCall(
    keyIndex: number,
    httpStatus: number,
    callType: 'generation' | 'embedding',
    outcome: 'success' | 'throttled' | 'error'
  ): void {
    console.log(
      `[GeminiKeyManager] ${new Date().toISOString()} | ` +
      `Key: ${keyIndex} | Status: ${httpStatus} | Type: ${callType} | Outcome: ${outcome}`
    )
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private releaseExpiredThrottles(): void {
    const now = Date.now()
    this.keys.forEach((keyState, idx) => {
      if (
        keyState.throttled &&
        keyState.throttledAt !== null &&
        now - keyState.throttledAt >= THROTTLE_RELEASE_MS
      ) {
        keyState.throttled = false
        keyState.throttledAt = null
        console.log(`[GeminiKeyManager] Key ${idx + 1} auto-released (expired throttle).`)
      }
    })
  }

  private enqueue(): Promise<{ key: string; index: number }> {
    return new Promise((resolve, reject) => {
      const enqueuedAt = Date.now()

      const request: QueuedRequest = {
        resolve,
        reject,
        enqueuedAt,
      }

      this.queue.push(request)
      console.log(
        `[GeminiKeyManager] All keys throttled. Request queued. ` +
        `Queue length: ${this.queue.length}. Max wait: ${MAX_QUEUE_WAIT_MS / 1000}s.`
      )

      // Set timeout for this request
      setTimeout(() => {
        const pos = this.queue.indexOf(request)
        if (pos !== -1) {
          this.queue.splice(pos, 1)
          reject(
            new Error(
              'Zahtjev nije mogao biti obrađen u predviđenom vremenu. Molimo pokušajte ponovo.'
            )
          )
        }
      }, MAX_QUEUE_WAIT_MS)

      this.scheduleQueueProcessing()
    })
  }

  private scheduleQueueProcessing(): void {
    if (this.queueTimer !== null) return

    // Find earliest key release time
    const now = Date.now()
    const releaseTimes = this.keys
      .filter((k) => k.throttled && k.throttledAt !== null)
      .map((k) => k.throttledAt! + THROTTLE_RELEASE_MS)

    if (releaseTimes.length === 0) {
      this.processQueue()
      return
    }

    const earliest = Math.min(...releaseTimes)
    const delay = Math.max(0, earliest - now + 1000) // +1s buffer

    this.queueTimer = setTimeout(() => {
      this.queueTimer = null
      this.releaseExpiredThrottles()
      this.processQueue()
    }, delay)
  }

  private processQueue(): void {
    if (this.queue.length === 0) return

    this.releaseExpiredThrottles()

    // Find available key
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const index = (this.currentIndex + i) % TOTAL_KEYS
      if (!this.keys[index].throttled) {
        const request = this.queue.shift()
        if (request) {
          this.currentIndex = (index + 1) % TOTAL_KEYS
          const waitMs = Date.now() - request.enqueuedAt
          console.log(
            `[GeminiKeyManager] Dequeued request. Wait: ${waitMs}ms. Using key ${index + 1}.`
          )
          request.resolve({ key: this.keys[index].key, index: index + 1 })
          // Process next in queue if available
          if (this.queue.length > 0) this.processQueue()
        }
        return
      }
    }

    // Still no available key — reschedule
    this.scheduleQueueProcessing()
  }
}

// Singleton instance
let instance: GeminiKeyManager | null = null

/**
 * Returns the singleton GeminiKeyManager instance.
 * Always use this function — never instantiate GeminiKeyManager directly.
 */
export function getKeyManager(): GeminiKeyManager {
  if (!instance) {
    instance = new GeminiKeyManager()
  }
  return instance
}
