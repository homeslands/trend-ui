// src/services/deep-link-handler.ts
// Deep Link Handler - Xử lý navigation từ nhiều nguồn:
// 1. Deep links (trendcoffee://...)
// 2. Universal links (https://order.cmsiot.net/...)
// 3. Notification clicks
// 4. App URL open events

import { App, URLOpenListenerEvent } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

type NavigationCallback = (path: string) => void

interface PendingNavigation {
  path: string
  timestamp: number
}

class DeepLinkHandler {
  private navigationCallback: NavigationCallback | null = null
  private pendingNavigation: PendingNavigation | null = null
  private isSetup = false

  /**
   * Initialize deep link handler
   * Phải gọi SỚM trong app lifecycle (trước React Router mount)
   */
  async initialize(): Promise<void> {
    if (this.isSetup) {
      return
    }

    if (!Capacitor.isNativePlatform()) {
      return
    }

    try {
      // ─────────────────────────────────────────────────────
      // Listen for app URL open events (deep links + universal links)
      // ─────────────────────────────────────────────────────
      try {
        await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          this.handleAppUrlOpen(event)
        })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('🔗 [DeepLink] Failed to add appUrlOpen listener:', error)
        // Không throw để app vẫn có thể tiếp tục hoạt động
      }

      // ─────────────────────────────────────────────────────
      // Check if app was launched with a URL
      // ─────────────────────────────────────────────────────
      try {
        const launchUrl = await App.getLaunchUrl()
        if (launchUrl?.url) {
          this.handleAppUrlOpen({ url: launchUrl.url })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('🔗 [DeepLink] Failed to get launch URL:', error)
        // Không throw vì đây là optional operation
      }

      this.isSetup = true
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('🔗 [DeepLink] Failed to initialize:', error)
      // Vẫn mark as setup để tránh retry loop
      this.isSetup = true
    }
  }

  /**
   * Register navigation callback từ React component
   * Được gọi khi React Router đã ready
   */
  registerNavigationCallback(callback: NavigationCallback): void {
    // Validate callback
    if (typeof callback !== 'function') {
      return
    }
    
    this.navigationCallback = callback

    // Nếu có pending navigation, xử lý ngay
    if (this.pendingNavigation) {
      const { path, timestamp } = this.pendingNavigation
      const age = Date.now() - timestamp

      // Chỉ navigate nếu pending < 30s (tránh stale navigation) và path hợp lệ
      if (age < 30000 && this.isValidPath(path)) {
        try {
          callback(path)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('🔗 [DeepLink] Error navigating to pending path:', error)
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn('🔗 [DeepLink] Skipping stale or invalid pending navigation')
      }

      this.pendingNavigation = null
    }
  }

  /**
   * Unregister navigation callback
   */
  unregisterNavigationCallback(): void {
    this.navigationCallback = null
  }

  /**
   * Validate path trước khi navigate
   */
  private isValidPath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false
    }
    
    // Path phải bắt đầu với / và không chứa các ký tự nguy hiểm
    if (!path.startsWith('/')) {
      return false
    }
    
    // Kiểm tra độ dài hợp lý (tránh path quá dài)
    if (path.length > 2048) {
      return false
    }
    
    // Kiểm tra không chứa các ký tự đặc biệt nguy hiểm
    // Cho phép: chữ cái, số, /, ?, &, =, -, _, ., ~
    const dangerousChars = /[<>"']/g
    if (dangerousChars.test(path)) {
      return false
    }
    
    return true
  }

  /**
   * Navigate programmatically từ bất kỳ đâu trong app
   * Support cả full URL và relative path
   */
  navigate(url: string): void {
    if (!url || typeof url !== 'string') {
      return
    }

    const path = this.extractPath(url)
    
    // Validate path trước khi navigate
    if (!this.isValidPath(path)) {
      // eslint-disable-next-line no-console
      console.warn('🔗 [DeepLink] Invalid path, skipping navigation:', path)
      return
    }

    if (this.navigationCallback) {
      try {
        this.navigationCallback(path)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('🔗 [DeepLink] Error during navigation:', error)
      }
    } else {
      this.pendingNavigation = {
        path,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Handle app URL open event
   * Called when:
   * - App launched with deep link: trendcoffee://history?order=123
   * - App launched with universal link: https://order.cmsiot.net/history?order=123
   * - App brought to foreground by URL
   */
  private handleAppUrlOpen(event: URLOpenListenerEvent): void {
    try {
      const path = this.extractPath(event.url)

      if (!path || path === '/') {  
        return
      }

      // Navigate (hoặc save as pending)
      this.navigate(path)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('🔗 [DeepLink] Error handling URL open:', error)
    }
  }

  /**
   * Extract path from URL
   * Support multiple formats:
   * - Deep link: trendcoffee://history?order=123 → /history?order=123
   * - Universal link: https://order.cmsiot.net/history?order=123 → /history?order=123
   * - Relative: /history?order=123 → /history?order=123
   */
  private extractPath(url: string): string {
    if (!url) return '/'

    try {
      // Remove custom scheme nếu có
      let cleanUrl = url

      // Handle custom scheme: trendcoffee://path
      if (url.includes('trendcoffee://')) {
        cleanUrl = url.replace('trendcoffee://', 'https://dummy/')
      }

      // Parse URL
      const urlObj = new URL(cleanUrl)
      const path = urlObj.pathname + urlObj.search + urlObj.hash

      // Ensure starts with /
      return path.startsWith('/') ? path : `/${path}`
    } catch {
      // Fallback: treat as relative path
      const path = url.startsWith('/') ? url : `/${url}`
      return path
    }
  }

  /**
   * Get pending navigation info (for debugging)
   */
  getPendingNavigation(): PendingNavigation | null {
    return this.pendingNavigation
  }

  /**
   * Clear pending navigation
   */
  clearPendingNavigation(): void {
    this.pendingNavigation = null
  }
}

// Export singleton
export const deepLinkHandler = new DeepLinkHandler()

