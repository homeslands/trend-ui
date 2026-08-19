// src/services/notification-listener-service.ts
// Service singleton để setup notification listeners SỚM, không phụ thuộc React lifecycle
// Giúp tránh miss notification khi app mở từ cold start

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { navigateToNotificationUrl } from '@/utils'

type NavigationCallback = (path: string) => void

class NotificationListenerService {
  private isSetup = false
  private navigationCallback: NavigationCallback | null = null
  private pendingNotification: { url: string } | null = null

  /**
   * Setup listeners sớm, không cần đợi React component mount
   * ⚠️ Setup phải NHANH để catch notification click khi cold start
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      return
    }

    if (!Capacitor.isNativePlatform()) {
      return
    }

    try {
      // ✅ KHÔNG request permissions ở đây để setup nhanh hơn
      // LocalNotifications.requestPermissions() sẽ được gọi trong hook

      // Setup background notification click listener
      // ⚠️ Đây là sync operation trong Capacitor → RẤT NHANH
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        async (action) => {
          try {
            // Delay để đảm bảo app đã mở
            await new Promise(resolve => setTimeout(resolve, 500))

          const data = action.notification.data as Record<string, string> | undefined
          // Extract route/url từ data object
          // ⚠️ Không dùng click_action vì đó là intent action name, không phải URL
          const notificationUrl = data?.url || data?.route

            if (notificationUrl) {
              // Nếu navigation callback đã sẵn sàng, navigate ngay
              if (this.navigationCallback) {
                await navigateToNotificationUrl(notificationUrl, this.navigationCallback)
              } else {
                // Nếu chưa có callback, lưu lại để navigate sau
                this.pendingNotification = { url: notificationUrl }
              }
            }
          } catch {
            // ignore errors
          }
        }
      )

      this.isSetup = true

      // Nếu có pending notification, xử lý ngay
      if (this.pendingNotification && this.navigationCallback) {
        await navigateToNotificationUrl(
          this.pendingNotification.url,
          this.navigationCallback
        )
        this.pendingNotification = null
      }
    } catch {
      // ignore errors
    }
  }

  /**
   * Register navigation callback từ React component
   * Được gọi khi component mount và có navigate function
   */
  registerNavigationCallback(callback: NavigationCallback): void {
    this.navigationCallback = callback

    // Nếu có pending notification, xử lý ngay
    if (this.pendingNotification) {
      navigateToNotificationUrl(this.pendingNotification.url, callback)
        .then(() => {
          this.pendingNotification = null
        })
        .catch(() => {
          // ignore errors
        })
    }
  }

  /**
   * Unregister navigation callback
   */
  unregisterNavigationCallback(): void {
    this.navigationCallback = null
  }
}

export const notificationListenerService = new NotificationListenerService()

