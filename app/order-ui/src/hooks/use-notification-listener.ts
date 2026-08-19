// src/hooks/use-notification-listener.ts
import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useNavigate } from 'react-router-dom'
import { navigateToNotificationUrl, setupWebMessageListener } from '@/utils'
import type {
  NotificationPayload,
  UseNotificationListenerReturn,
} from '@/types/notification.types'
import { useNotificationStore } from '@/stores'

/**
 * Hook để lắng nghe thông báo (Native & Web)
 */
export function useNotificationListener(): UseNotificationListenerReturn {
  const navigate = useNavigate()
  // Use ref để tránh dependency issues và đảm bảo luôn có latest navigate function
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  
  // Stable navigate function để dùng trong callbacks
  const safeNavigate = useCallback((url: string) => {
    if (!url || typeof url !== 'string') {
      return
    }
    try {
      navigateToNotificationUrl(url, navigateRef.current)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Notification] Error navigating to URL:', error)
    }
  }, [])
  const [latestNotification, setLatestNotification] =
    useState<NotificationPayload | null>(null)

  useEffect(() => {
    const { addNotification, markAsRead } = useNotificationStore.getState()
    let mounted = true
    let unsubscribeWebListener: (() => void) | null = null
    let serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null

    // Setup Web Platform Listeners
    if (!Capacitor.isNativePlatform()) {
      
      // 1. Setup foreground message listener (when app is open)
      unsubscribeWebListener = setupWebMessageListener((payload) => {
        if (!mounted) return

        const notificationPayload: NotificationPayload = {
          notification: {
            title: payload.notification?.title || '',
            body: payload.notification?.body || '',
          },
          data: (payload.data as Record<string, string>) || {},
          messageId: payload.messageId || payload.fcmMessageId || Date.now().toString(),
        }

        addNotification(notificationPayload, { markAsRead: false })
        setLatestNotification(notificationPayload)
      })

      // 2. Listen for service worker messages (background notification clicks)
      if ('serviceWorker' in navigator) {
        serviceWorkerMessageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'NOTIFICATION_NAVIGATION') {
            const url = event.data.url
            if (url && typeof url === 'string') {
              safeNavigate(url)
            }
          }
        }
        navigator.serviceWorker.addEventListener('message', serviceWorkerMessageHandler)
      }

      return () => {
        mounted = false
        if (unsubscribeWebListener) {
          unsubscribeWebListener()
        }
        if (serviceWorkerMessageHandler && 'serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', serviceWorkerMessageHandler)
        }
      }
    }

    // Setup Native Platform Listeners (iOS/Android)
    let pushReceivedListener: { remove: () => Promise<void> } | null = null
    let pushActionListener: { remove: () => Promise<void> } | null = null
    let localNotificationListener: { remove: () => Promise<void> } | null = null

    const setupNativeListener = async () => {
      try {
        // Request permissions với error handling
        try {
          await LocalNotifications.requestPermissions()
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[Notification] Failed to request permissions:', error)
          // Tiếp tục setup listeners dù permission fail
        }

        // Foreground notification  
        try {
          pushReceivedListener = await PushNotifications.addListener(
            'pushNotificationReceived',
            async (notification) => {
              if (!mounted) return

              const payload: NotificationPayload = {
                notification: {
                  title: notification.title,
                  body: notification.body,
                },
                data: notification.data as Record<string, string>,
                messageId: notification.id,
              }

              addNotification(payload, { markAsRead: false })
              setLatestNotification(payload)

              try {
                // Generate unique ID: timestamp + random number để tránh conflict
                const uniqueId = Date.now() + Math.floor(Math.random() * 1000000)
                
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      title: notification.title || 'Thông báo mới',
                      body: notification.body || '',
                      id: uniqueId,
                      extra: notification.data,
                      smallIcon: 'ic_stat_icon_config_sample',
                      iconColor: '#488AFF',
                    },
                  ],
                })
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[Notification] Failed to schedule local notification:', error)
              }
            },
          )
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[Notification] Failed to add pushNotificationReceived listener:', error)
        }

        // Background notification click
        try {
          pushActionListener = await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            async (action) => {
              const data = action.notification.data as Record<string, string> | undefined
              const notificationUrl = data?.url || data?.route

              const payload: NotificationPayload = {
                notification: {
                  title: action.notification.title,
                  body: action.notification.body,
                },
                data: data ?? {},
                messageId: action.notification.id,
              }

              addNotification(payload, { markAsRead: true })
              if (payload.data?.slug) {
                markAsRead(payload.data.slug)
              }

              if (notificationUrl && typeof notificationUrl === 'string') {
                safeNavigate(notificationUrl)
              }
            },
          )
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[Notification] Failed to add pushNotificationActionPerformed listener:', error)
        }

        // Local notification click
        try {
          localNotificationListener = await LocalNotifications.addListener(
            'localNotificationActionPerformed',
            async (notification) => {
              const data = notification.notification.extra as
                | Record<string, string>
                | undefined
              const notificationUrl = data?.url || data?.route

              const payload: NotificationPayload = {
                notification: {
                  title: notification.notification.title,
                  body: notification.notification.body,
                },
                data: data ?? {},
                messageId: notification.notification.id?.toString(),
              }

              addNotification(payload, { markAsRead: true })
              if (payload.data?.slug) {
                markAsRead(payload.data.slug)
              }

              if (notificationUrl && typeof notificationUrl === 'string') {
                safeNavigate(notificationUrl)
              }
            },
          )
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[Notification] Failed to add localNotificationActionPerformed listener:', error)
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Notification] Failed to setup native listeners:', error)
      }
    }

    setupNativeListener().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[Notification] Setup error:', error)
    })

    return () => {
      mounted = false
      
      // Cleanup listeners một cách an toàn
      try {
        if (pushReceivedListener) {
          pushReceivedListener.remove().catch(() => {
            // Ignore cleanup errors
          })
        }
        if (pushActionListener) {
          pushActionListener.remove().catch(() => {
            // Ignore cleanup errors
          })
        }
        if (localNotificationListener) {
          localNotificationListener.remove().catch(() => {
            // Ignore cleanup errors
          })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Notification] Cleanup error:', error)
      }
      
      // Fallback: remove all listeners nếu individual cleanup fail
      try {
        PushNotifications.removeAllListeners().catch(() => {
          // Ignore
        })
        LocalNotifications.removeAllListeners().catch(() => {
          // Ignore
        })
      } catch {
        // Ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Không include navigate để tránh re-setup listeners

  const clearNotification = () => {
    setLatestNotification(null)
  }

  return {
    latestNotification,
    clearNotification,
  }
}
