// src/hooks/use-firebase-notification.ts
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { getNativeFcmToken } from '@/utils/getNativeFcmToken'
import { getWebFcmToken } from '@/utils/getWebFcmToken'
import type { UseFirebaseNotificationReturn } from '@/types/notification.types'
import { useUserStore } from '@/stores'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
import { unregisterDeviceToken } from '@/api/notification'
/**
 * Get platform name for token registration
 * Normalize platform name to match backend expectations
 */
function getPlatformName(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform()
  
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web' // 'web' or any other platform
}

export function useFirebaseNotification(
  userId?: string,
): UseFirebaseNotificationReturn {
  const { getDeviceToken, setDeviceToken } = useUserStore()
  const [fcmToken, setFcmToken] = useState<string | null>(getDeviceToken() || null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (!userId) {
      return
    }

    let mounted = true

    const setup = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Lấy token cũ từ store (nếu có)
        const oldToken = getDeviceToken()
        
        // ✅ Lấy token tùy theo platform
        let newToken: string | null = null
        
        const platformName = getPlatformName()

        if (Capacitor.isNativePlatform()) {
          // Native platform (iOS/Android)
          newToken = await getNativeFcmToken()
        } else {
          // Web platform
          newToken = await getWebFcmToken()
        }

        if (!mounted) return

        if (newToken) {
          // ✅ Reset permission denied flag khi có token
          setPermissionDenied(false)
          
          // ✅ Nếu token thay đổi, unregister token cũ trước
          if (oldToken && oldToken !== newToken) {
            try {
              await unregisterDeviceToken(oldToken)
            } catch {
              // Ignore unregister errors (token có thể đã bị xóa)
            }
          }
          
          // Save token mới vào store
          setDeviceToken(newToken)
          setFcmToken(newToken)
          
          // ✅ Đăng ký token mới với backend qua queue
          await tokenRegistrationQueue.enqueue({
            token: newToken,
            platform: platformName,
            userAgent: navigator.userAgent,
            userId,
          })
          
        } else {
          // ✅ Check permission status
          if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'denied') {
              setPermissionDenied(true)
              setError('Notification permission denied')
            } else {
              setPermissionDenied(false)
              setError('Failed to get FCM token')
            }
          } else {
            setPermissionDenied(false)
            setError('Failed to get FCM token')
          }
          
        }
      } catch (err: unknown) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    setup()

    return () => {
      mounted = false
    }
  }, [userId, setDeviceToken, getDeviceToken])

  return { fcmToken, error, isLoading, permissionDenied }
}