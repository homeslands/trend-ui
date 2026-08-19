// src/services/token-registration-queue.ts

import { registerDeviceToken } from '@/api/notification'
import { RETRY_DELAYS, MAX_RETRIES } from '@/constants'
import { useUserStore } from '@/stores'
import { showErrorToastMessage } from '@/utils'

interface QueueItem {
  token: string
  platform: string
  userAgent: string
  attempts: number
  lastAttempt: number
  userId?: string
}

enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTH = 'auth',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

interface ErrorClassification {
  type: ErrorType
  shouldRetry: boolean
  retryDelay?: number
  userMessage?: string
}

/**
 * Classify error để quyết định có nên retry không
 */
function classifyError(error: unknown): ErrorClassification {
  const axiosError = error as {
    response?: {
      status: number
      data?: { message?: string }
      headers?: Record<string, string>
    }
    code?: string
    message?: string
  }

  // Network errors (no response)
  if (!axiosError.response) {
    const isTimeout = axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT'
    return {
      type: ErrorType.NETWORK,
      shouldRetry: true,
      userMessage: isTimeout
        ? 'Kết nối quá lâu. Đang thử lại...'
        : 'Không thể kết nối. Đang thử lại...',
    }
  }

  const status = axiosError.response.status
  const errorMessage = (axiosError.response.data?.message || '').toLowerCase()

  // Validation errors (400, 422) - không retry
  if (status === 400 || status === 422) {
    const isInvalidToken = errorMessage.includes('invalid token') || errorMessage.includes('expired')
    return {
      type: isInvalidToken ? ErrorType.VALIDATION : ErrorType.VALIDATION,
      shouldRetry: false,
      userMessage: isInvalidToken
        ? 'Token không hợp lệ. Vui lòng đăng nhập lại.'
        : 'Dữ liệu không hợp lệ. Vui lòng thử lại.',
    }
  }

  // Authentication errors (401, 403) - không retry
  if (status === 401 || status === 403) {
    return {
      type: ErrorType.AUTH,
      shouldRetry: false,
      userMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    }
  }

  // Rate limit (429) - retry với delay dài hơn
  if (status === 429) {
    const retryAfter = axiosError.response.headers?.['retry-after']
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000 // 1 minute default
    return {
      type: ErrorType.RATE_LIMIT,
      shouldRetry: true,
      retryDelay: delay,
      userMessage: 'Quá nhiều yêu cầu. Đang thử lại sau...',
    }
  }

  // Server errors (500, 502, 503, 504) - retry
  if (status >= 500 && status < 600) {
    return {
      type: ErrorType.SERVER,
      shouldRetry: true,
      userMessage: 'Lỗi server. Đang thử lại...',
    }
  }

  // Unknown errors - retry
  return {
    type: ErrorType.UNKNOWN,
    shouldRetry: true,
    userMessage: 'Đã xảy ra lỗi. Đang thử lại...',
  }
}

class TokenRegistrationQueue {
  private queue: QueueItem[] = []
  private isProcessing = false
  private onlineHandler: (() => void) | null = null
  private lastToastTime = 0
  private readonly TOAST_DEBOUNCE = 5000 // 5 seconds - tránh spam toast

  constructor() {
    this.setupOnlineListener()
  }

  /**
   * Show error toast với debounce để tránh spam
   */
  private showErrorToast(message: string) {
    const now = Date.now()
    if (now - this.lastToastTime < this.TOAST_DEBOUNCE) {
      return // Skip nếu quá sớm
    }
    this.lastToastTime = now
    showErrorToastMessage(message)
  }

  /**
   * Add token to registration queue
   */
  async enqueue(item: Omit<QueueItem, 'attempts' | 'lastAttempt'>) {
    const queueItem: QueueItem = {
      ...item,
      attempts: 0,
      lastAttempt: 0,
    }

    // Check if token already in queue
    const existingIndex = this.queue.findIndex((q) => q.token === item.token)
    if (existingIndex >= 0) {
      this.queue[existingIndex] = queueItem
    } else {
      this.queue.push(queueItem)
    }

    await this.process()
  }

  /**
   * Process queue with retry logic
   */
  private async process() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue[0]

      try {
        // Call API để register token
        const payload = {
          token: item.token,
          platform: item.platform,
          userAgent: item.userAgent,
        }

        await registerDeviceToken(payload)

        // Success - remove from queue
        this.queue.shift()

        // ✅ Save to userStore (auto persist) + timestamp
        useUserStore.getState().setDeviceToken(item.token)
        localStorage.setItem('fcm_token_registered_at', Date.now().toString())

      } catch (error) {
        item.attempts++
        item.lastAttempt = Date.now()

        // Classify error
        const errorClassification = classifyError(error)

        // Show toast cho user (chỉ khi retry hoặc final failure)
        if (errorClassification.userMessage) {
          if (item.attempts >= MAX_RETRIES.MAX_RETRIES) {
            // Final failure - show error
            this.showErrorToast(
              errorClassification.userMessage || 'Không thể đăng ký thông báo. Vui lòng thử lại sau.',
            )
          } else if (errorClassification.shouldRetry && item.attempts === 1) {
            // First retry - show info (không spam)
            this.showErrorToast(errorClassification.userMessage)
          }
        }

        // Check if should retry
        if (!errorClassification.shouldRetry || item.attempts >= MAX_RETRIES.MAX_RETRIES) {
          // Max retries reached hoặc không nên retry - remove from queue
          this.queue.shift()

        } else {
          // Schedule retry với delay từ error classification hoặc exponential backoff
          let delay: number
          if (errorClassification.retryDelay) {
            delay = errorClassification.retryDelay
          } else if (item.attempts === 1) {
            delay = RETRY_DELAYS.RETRY_DELAY_1
          } else if (item.attempts === 2) {
            delay = RETRY_DELAYS.RETRY_DELAY_2
          } else {
            delay = RETRY_DELAYS.RETRY_DELAY_3
          }
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    this.isProcessing = false
  }

  /**
   * Retry all failed items (call when back online)
   */
  async retryAll() {
    if (this.queue.length > 0) {
      // Reset attempts for items that failed due to network
      this.queue.forEach((item) => {
        if (item.attempts > 0) {
          item.attempts = 0
        }
      })

      await this.process()
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      length: this.queue.length,
      isProcessing: this.isProcessing,
      items: this.queue.map((item) => ({
        platform: item.platform,
        attempts: item.attempts,
        lastAttempt: item.lastAttempt,
      })),
    }
  }

  /**
   * Clear queue (useful for logout)
   */
  clearQueue() {
    this.queue = []
  }

  /**
   * Setup online event listener
   */
  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        this.retryAll()
      }

      window.addEventListener('online', this.onlineHandler)
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }
    this.clearQueue()
  }
}

export const tokenRegistrationQueue = new TokenRegistrationQueue()

