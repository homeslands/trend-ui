// src/utils/getNativeFcmToken.ts
/* eslint-disable no-console */
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

function getPlatformName(): 'ios' | 'android' {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' ? 'ios' : 'android'
}

export async function getNativeFcmToken(): Promise<string | null> {
  // Check platform first
  if (!Capacitor.isNativePlatform()) {
    console.error('[getNativeFcmToken] ❌ Not a native platform')
    return null
  }

  const platform = getPlatformName()

  try {
    // 1. Request permissions với error handling
    let permission
    try {
      permission = await PushNotifications.requestPermissions()
    } catch (error) {
      console.error(`[getNativeFcmToken] ❌ Failed to request permissions for ${platform}:`, error)
      return null
    }
    
    if (permission.receive !== 'granted') {
      console.error(`[getNativeFcmToken] ❌ Push notification permission not granted for ${platform}:`, permission)
      return null
    }

    // 2. Register with FCM với error handling
    try {
      await PushNotifications.register()
    } catch (error) {
      console.error(`[getNativeFcmToken] ❌ Failed to register for ${platform}:`, error)
      return null
    }

    // 3. Wait for token via listener
    return new Promise((resolve, reject) => {
      let isResolved = false
      let isRejected = false
      
      // Helper để đảm bảo Promise chỉ resolve/reject một lần
      const safeResolve = (value: string) => {
        if (!isResolved && !isRejected) {
          isResolved = true
          clearTimeout(timeout)
          resolve(value)
        }
      }
      
      const safeReject = (error: unknown) => {
        if (!isResolved && !isRejected) {
          isRejected = true
          clearTimeout(timeout)
          reject(error)
        }
      }
      
      const timeout = setTimeout(() => {
        console.error(`[getNativeFcmToken] ❌ Token registration timeout for ${platform}`)
        // Cleanup listeners nếu có
        if (registrationListener) {
          registrationListener.remove().catch(() => {
            // Ignore cleanup errors
          })
        }
        if (errorListener) {
          errorListener.remove().catch(() => {
            // Ignore cleanup errors
          })
        }
        safeReject(new Error('Token registration timeout'))
      }, 10000) // 10s timeout

      // Khai báo listeners trước để có thể dùng trong callbacks
      let registrationListener: { remove: () => Promise<void> } | null = null
      let errorListener: { remove: () => Promise<void> } | null = null

      // Setup listeners (async operations)
      const setupListeners = async () => {
        try {
          // Setup registration listener
          try {
            registrationListener = await PushNotifications.addListener('registration', (token) => {
              const tokenValue = token.value
              
              // Cleanup listeners
              if (registrationListener) {
                registrationListener.remove().catch(() => {
                  // Ignore cleanup errors
                })
              }
              if (errorListener) {
                errorListener.remove().catch(() => {
                  // Ignore cleanup errors
                })
              }
              
              safeResolve(tokenValue)
            })
          } catch (error) {
            console.error(`[getNativeFcmToken] ❌ Failed to add registration listener for ${platform}:`, error)
            // Cleanup nếu có
            if (registrationListener) {
              registrationListener.remove().catch(() => {
                // Ignore cleanup errors
              })
            }
            safeReject(error)
            return
          }

          // Setup error listener
          try {
            errorListener = await PushNotifications.addListener('registrationError', (error) => {
              console.error(`[getNativeFcmToken] ❌ Registration error for ${platform}:`, {
                error: error,
                errorString: String(error),
                platform,
              })
              
              // Cleanup listeners
              if (registrationListener) {
                registrationListener.remove().catch(() => {
                  // Ignore cleanup errors
                })
              }
              if (errorListener) {
                errorListener.remove().catch(() => {
                  // Ignore cleanup errors
                })
              }
              
              safeReject(error)
            })
          } catch (error) {
            console.error(`[getNativeFcmToken] ❌ Failed to add error listener for ${platform}:`, error)
            // Cleanup registration listener nếu đã setup
            if (registrationListener) {
              registrationListener.remove().catch(() => {
                // Ignore cleanup errors
              })
            }
            safeReject(error)
          }
        } catch (error) {
          console.error(`[getNativeFcmToken] ❌ Error in setupListeners for ${platform}:`, error)
          safeReject(error)
        }
      }
      
      // Start listener setup với safety catch
      setupListeners().catch((err) => {
        console.error(`[getNativeFcmToken] ❌ Error setting up listeners for ${platform}:`, err)
        safeReject(err)
      })
    })
  } catch (error) {
    console.error(`[getNativeFcmToken] ❌ Error getting FCM token for ${platform}:`, {
      error: error instanceof Error ? error.message : String(error),
      platform,
    })
    return null
  }
}