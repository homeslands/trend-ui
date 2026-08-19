// src/hooks/use-app-lifecycle.ts

import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'

export function useAppLifecycle(onResume: () => void) {
  useEffect(() => {
    // Validate onResume callback
    if (typeof onResume !== 'function') {
      // eslint-disable-next-line no-console
      console.error('[AppLifecycle] onResume must be a function')
      return
    }
    
    // Web platform: sử dụng Visibility API
    if (!Capacitor.isNativePlatform()) {
      let mounted = true
      
      const handleVisibilityChange = () => {
        if (!mounted) return
        
        try {
          if (document.visibilityState === 'visible') {
            onResume()
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[AppLifecycle] Error in onResume callback (web):', error)
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      return () => {
        mounted = false
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }

    // Native platform: sử dụng @capacitor/app (cần cài đặt)
    // Nếu muốn support native app, chạy: npm install @capacitor/app
    let mounted = true
    let listener: { remove: () => Promise<void> } | null = null
    let cleanupPromise: Promise<(() => void) | undefined> | null = null

    const setupNativeListener = async (): Promise<(() => void) | undefined> => {
      if (!mounted) {
        return undefined
      }

      try {
        const { App } = await import('@capacitor/app')
        
        if (!mounted) {
          return undefined
        }

        try {
          listener = await App.addListener('appStateChange', async (state) => {
            if (state.isActive && mounted) {
              try {
                onResume()
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[AppLifecycle] Error in onResume callback:', error)
              }
            }
          })
          
          return () => {
            if (listener) {
              listener.remove().catch(() => {
                // Ignore cleanup errors
              })
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[AppLifecycle] Failed to add appStateChange listener:', error)
          return () => {}
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[AppLifecycle] Failed to import @capacitor/app:', error)
        return () => {}
      }
    }

    cleanupPromise = setupNativeListener()

    return () => {
      mounted = false
      
      // Nếu promise đã resolve, cleanup ngay
      cleanupPromise?.then((cleanupFn) => {
        if (cleanupFn) {
          try {
            cleanupFn()
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[AppLifecycle] Cleanup error:', error)
          }
        }
      }).catch(() => {
        // Ignore errors
      })

      // Fallback: cleanup listener nếu có
      if (listener) {
        try {
          listener.remove().catch(() => {
            // Ignore cleanup errors
          })
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[AppLifecycle] Direct cleanup error:', error)
        }
      }
    }
  }, [onResume])
}