// Firebase configuration
// These values should be set in environment variables
// Supports separate app IDs for web, android, and ios platforms

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

/**
 * Get Firebase configuration from environment variables
 * Supports separate app IDs for different platforms (web, android, ios)
 */
export function getFirebaseConfig(): FirebaseConfig {
  // Detect platform để chọn app ID đúng
  // Trong web build, luôn dùng web app ID
  // Trong native build, Capacitor sẽ handle riêng qua google-services.json
  // getFirebaseConfig() chỉ được gọi từ web code, nên luôn dùng web app ID
  const isWeb = typeof window !== 'undefined'
  
  // Ưu tiên env var riêng cho web (VITE_FIREBASE_APP_ID_WEB)
  // Nếu không có, fallback về VITE_FIREBASE_APP_ID chung, NHƯNG chỉ dùng nếu nó là Web app ID
  // Không dùng Android/iOS app ID cho web platform
  const webAppId = import.meta.env.VITE_FIREBASE_APP_ID_WEB
  const commonAppId = import.meta.env.VITE_FIREBASE_APP_ID || ''
  
  // Kiểm tra commonAppId có phải Android/iOS app ID không
  const isAndroidOrIosAppId = commonAppId.includes(':android:') || commonAppId.includes(':ios:')
  
  // Chỉ dùng commonAppId nếu nó không phải Android/iOS app ID (tức là Web app ID)
  const appId = webAppId || (isAndroidOrIosAppId ? '' : commonAppId)
  
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  }

  // Validate appId format cho web platform TRƯỚC khi validate required fields
  if (isWeb) {
    if (isAndroidOrIosAppId && !webAppId) {
      throw new Error('For web platform, appId must be Web app ID, not Android/iOS app ID')
    }
  }

  // Validate required fields
  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
    throw new Error('Missing required Firebase configuration. Please set env vars')
  }

  return config
}

/**
 * Get VAPID key for web push notifications
 */
export function getVapidKey(): string {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
}

/**
 * Check và debug Firebase Project ID từ các nguồn
 * Dùng để debug khi có conflict project ID
 * 
 * @returns Object chứa project ID từ các nguồn và thông tin conflict
 */
export function checkFirebaseProjectId(): {
  envVar: string
  config: string
  allMatch: boolean
  conflicts: string[]
  recommendations: string[]
  expectedValues: {
    envVar: string
    config: string
    firebaseConfigJs: string
    googleServicesJson: string
  }
} {
  const envVar = import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
  const config = getFirebaseConfig().projectId

  // Expected values từ các file config (reference only)
  const expectedValues = {
    envVar,
    config,
    firebaseConfigJs: 'order-notification-dev-v2', // Reference: public/firebase-config.js
    googleServicesJson: 'order-notification-dev-v2', // Reference: android/app/google-services.json
  }

  // Collect all project IDs
  const projectIds = [
    { source: 'Env Var (VITE_FIREBASE_PROJECT_ID)', value: envVar },
    { source: 'getFirebaseConfig()', value: config },
  ].filter((item) => item.value)

  // Check if all match
  const uniqueIds = new Set(projectIds.map((item) => item.value))
  const allMatch = uniqueIds.size <= 1 && projectIds.length > 0
  const conflicts: string[] = []
  const recommendations: string[] = []

  if (!allMatch) {
    projectIds.forEach((item) => {
      const others = projectIds.filter((other) => other.value !== item.value)
      if (others.length > 0) {
        conflicts.push(
          `${item.source}: "${item.value}" conflicts with ${others.map((o) => `"${o.value}" (${o.source})`).join(', ')}`,
        )
      }
    })

    recommendations.push('1. Kiểm tra file .env có VITE_FIREBASE_PROJECT_ID đúng không')
    recommendations.push('2. Clear browser cache và hard reload (Ctrl+Shift+R / Cmd+Shift+R)')
    recommendations.push('3. Restart dev server nếu đang development')
    recommendations.push('4. Kiểm tra không có code nào khác initialize Firebase với project ID khác')
  } else if (projectIds.length > 0) {
    const projectId = projectIds[0].value
    recommendations.push(`✅ Project ID từ env vars và config đều khớp: "${projectId}"`)
    
    // Check với expected values
    if (projectId !== expectedValues.firebaseConfigJs) {
      recommendations.push(`⚠️ Khác với firebase-config.js: "${expectedValues.firebaseConfigJs}"`)
    }
    if (projectId !== expectedValues.googleServicesJson) {
      recommendations.push(`⚠️ Khác với google-services.json: "${expectedValues.googleServicesJson}"`)
    }
  } else {
    recommendations.push('⚠️ Không tìm thấy project ID nào. Kiểm tra env vars.')
  }

  return {
    envVar,
    config,
    allMatch,
    conflicts,
    recommendations,
    expectedValues,
  }
}

