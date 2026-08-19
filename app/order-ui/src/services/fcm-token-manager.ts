// src/services/fcm-token-manager.ts
import { unregisterDeviceToken } from '@/api/notification'
import { Capacitor } from '@capacitor/core'
import { getNativeFcmToken } from '@/utils/getNativeFcmToken'
import { getWebFcmToken } from '@/utils/getWebFcmToken'
import { useUserStore } from '@/stores'
import { TOKEN_CHECK_INTERVAL, TOKEN_REFRESH_THRESHOLD } from '@/constants'
import { tokenRegistrationQueue } from './token-registration-queue'

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

class FCMTokenManager {
  private intervalId: NodeJS.Timeout | null = null
  private visibilityHandler: (() => void) | null = null

  startScheduler() {
    // ✅ Setup visibility listener khi start scheduler (user đã login)
    this.setupVisibilityListener()
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    
    this.intervalId = setInterval(async () => {
      await this.checkAndRefreshToken()
    }, TOKEN_CHECK_INTERVAL.INTERVAL)
  }
  
  async checkAndRefreshToken() {
    // ✅ Lấy token từ userStore (persisted)
    const savedToken = useUserStore.getState().getDeviceToken()
    const registeredAt = localStorage.getItem('fcm_token_registered_at')
    
    if (!savedToken || !registeredAt) return
    
    const elapsed = Date.now() - parseInt(registeredAt)
    
    // Nếu token đã đăng ký > threshold (48h), refresh
    if (elapsed > TOKEN_REFRESH_THRESHOLD.THRESHOLD) {
      try {
        // ✅ Lấy token tùy theo platform
        let newToken: string | null = null
        
        if (Capacitor.isNativePlatform()) {
          // Native platform (iOS/Android)
          newToken = await getNativeFcmToken()
        } else {
          // Web platform
          newToken = await getWebFcmToken()
        }
        
        if (newToken && newToken !== savedToken) {
          // Token thay đổi → Unregister cũ, register mới
          await unregisterDeviceToken(savedToken)
          
          // ✅ Dùng queue để register (có retry logic)
          const userInfo = useUserStore.getState().getUserInfo()
          await tokenRegistrationQueue.enqueue({
            token: newToken,
            platform: getPlatformName(),
            userAgent: navigator.userAgent,
            userId: userInfo?.slug,
          })
          
          // ✅ Update vào userStore (auto persist)
          useUserStore.getState().setDeviceToken(newToken)
          
          // Update timestamp
          localStorage.setItem('fcm_token_registered_at', Date.now().toString())
        } else if (newToken === savedToken) {
          // Token không đổi → Chỉ update timestamp
          localStorage.setItem('fcm_token_registered_at', Date.now().toString())
        }
      } catch {
        // Token refresh failed - silent fail
      }
    }
  }

  private setupVisibilityListener() {
    // ✅ Chỉ setup 1 lần, skip nếu đã có
    if (this.visibilityHandler || typeof document === 'undefined') {
      return
    }
    
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.checkAndRefreshToken()
      }
    }
    
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }
  
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }
  
  destroy() {
    this.stopScheduler()
  }
}

export const fcmTokenManager = new FCMTokenManager()