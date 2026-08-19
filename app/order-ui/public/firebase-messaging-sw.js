// Firebase Cloud Messaging Service Worker
// This file runs in the background to handle push notifications

importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
)
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
)

// firebaseConfig sẽ được set từ firebase-config.js hoặc từ main thread
// Không khai báo ở đây để tránh conflict với importScripts
let firebaseConfig = null
let messaging = null
let isInitialized = false
let backgroundMessageHandler = null

/**
 * Initialize Firebase with config received from main thread
 */
function initializeFirebase(config) {
  if (isInitialized) {
    return
  }

  if (!config || !config.apiKey || !config.projectId) {
    return
  }

  try {
    // ⚠️ QUAN TRỌNG: Validate config trước khi initialize
    if (!config.projectId || !config.apiKey || !config.appId) {
      return
    }
    
    // ⚠️ Validate appId là Web app ID (không phải Android/iOS)
      if (config.appId && (config.appId.includes(':android:') || config.appId.includes(':ios:'))) {
      return
    }
    
    firebase.initializeApp(config)
    messaging = firebase.messaging()
    isInitialized = true  
    
    // Setup background message handler after initialization
    setupBackgroundMessageHandler()
  } catch{
    return
  }
}

/**
 * Setup background message handler
 */
function setupBackgroundMessageHandler() {
  if (!messaging || backgroundMessageHandler) {
    return
  }

  messaging.onBackgroundMessage((payload) => {

    const notificationTitle = payload.notification?.title || 'New Notification'
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/icon.png',
      badge: '/badge.png',
      data: payload.data,
    }

    self.registration.showNotification(notificationTitle, notificationOptions)
  })
  
  backgroundMessageHandler = true
}

// Listen for config from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config
    initializeFirebase(firebaseConfig)
  } else {
    return
  }
})

// Try to load config from firebase-config.js (fallback)
// ⚠️ LƯU Ý: Chỉ dùng fallback nếu main thread chưa gửi config
// Nếu main thread đã gửi config, KHÔNG dùng fallback để tránh conflict
try {
  importScripts('/firebase-config.js')
  // Sau khi importScripts, firebaseConfigFromFile từ file sẽ được set vào global scope
  // Kiểm tra xem có giá trị không
  const configFromFile = typeof firebaseConfigFromFile !== 'undefined' && firebaseConfigFromFile && !isInitialized ? firebaseConfigFromFile : null
  
  if (configFromFile && configFromFile.apiKey && configFromFile.projectId) {
    firebaseConfig = configFromFile  // Gán vào biến firebaseConfig của service worker
    initializeFirebase(configFromFile)
  }
} catch {
  // Config will be sent from main thread
}

// Get messaging instance (will be null until initialized)
function getMessaging() {
  if (!messaging && isInitialized) {
    messaging = firebase.messaging()
  }
  return messaging
}

// Background message handler will be setup after Firebase initialization

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Handle click action (e.g., open a URL)
  const urlToOpen = event.notification.data?.url || event.notification.data?.route || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to find and focus existing window
        if (windowClients.length > 0) {
          // Prefer to focus the first available window and navigate
          const client = windowClients[0]
          
          // Post message to client để navigate (thay vì open new window)
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATION',
            url: urlToOpen
          })
          
          return client.focus()
        }
        
        // If no window open, open new one
        if (clients.openWindow) {
          // Convert relative URL to absolute for openWindow
          const absoluteUrl = new URL(urlToOpen, self.location.origin).href
          return clients.openWindow(absoluteUrl)
        }
      }),
  )
})

