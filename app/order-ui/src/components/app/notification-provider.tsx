// src/components/app/notification-provider.tsx
import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { useUserStore } from '@/stores'
import { useAppLifecycle, useFirebaseNotification, useNotificationListener } from '@/hooks'
import { fcmTokenManager } from '@/services/fcm-token-manager'
import { navigateToNotificationUrl } from '@/utils'
import notificationSound from '@/assets/sound/notification.mp3'
import { NotificationMessageCode, QUERYKEY } from '@/constants'
import { NotificationPermissionDialog } from '@/components/app/dialog'
import { useDialogContext } from '@/contexts/dialog-context'

/**
 * Helper function để play audio một cách an toàn
 */
function playNotificationSound(volume: number = 0.5): void {
  try {
    // Check xem Audio API có available không
    if (typeof Audio === 'undefined') {
      return
    }
    
    // Check xem notificationSound có tồn tại không
    if (!notificationSound) {
      return
    }
    
    const audio = new Audio(notificationSound)
    
    // Set volume với validation
    if (volume >= 0 && volume <= 1) {
      audio.volume = volume
    }
    
    // Play với error handling
    audio.play().catch((error) => {
      // Ignore autoplay errors (cần user interaction trên một số browser)
      // eslint-disable-next-line no-console
      console.debug('[Notification] Audio play error (ignored):', error)
    })
  } catch (error) {
    // Ignore audio initialization errors
    // eslint-disable-next-line no-console
    console.debug('[Notification] Audio initialization error (ignored):', error)
  }
}

const printerFailMessages: NotificationMessageCode[] = [
  NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
  NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
  NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
]

/**
 * Extract message code từ nhiều nguồn có thể
 * Backend có thể gửi message code ở các field khác nhau
 */
/**
 * Map backend message code sang frontend message code
 * Backend có thể gửi format khác với frontend
 */
function mapBackendMessageCode(backendMessage: string): string {
  const messageMap: Record<string, string> = {
    'invoice-failed-printing': NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
    'chef-order-failed-printing': NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
    'label-ticket-failed-printing': NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
  }
  return messageMap[backendMessage] || backendMessage
}

function extractMessageCode(
  data?: Record<string, string>,
  notificationBody?: string,
): NotificationMessageCode | undefined {
  // ⚠️ QUAN TRỌNG: Parse data.payload nếu có (backend gửi message code trong payload JSON string)
  let parsedPayload: Record<string, string> = {}
  if (data?.payload && typeof data.payload === 'string') {
    try {
      parsedPayload = JSON.parse(data.payload)
    } catch {
      // Ignore parse errors
    }
  }
  
  // Merge parsed payload vào data (parsed payload có priority cao hơn)
  const mergedData = { ...data, ...parsedPayload }

  // 1. Check mergedData.message (từ payload hoặc data trực tiếp)
  if (mergedData.message) {
    // Map backend message code sang frontend format
    const mappedMessage = mapBackendMessageCode(mergedData.message)
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mappedMessage,
    )
    if (code) {
      return code
    }
  }

  // 2. Check data.message (fallback nếu không có trong parsed payload)
  if (data?.message && !parsedPayload.message) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === data.message,
    )
    if (code) return code
  }

  // 3. Check data.type
  if (mergedData.type) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mergedData.type,
    )
    if (code) return code
  }

  // 4. Check data.notificationType
  if (mergedData.notificationType) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mergedData.notificationType,
    )
    if (code) return code
  }

  // 5. Try extract từ notification body (fallback)
  if (notificationBody) {
    const code = Object.values(NotificationMessageCode).find((code) =>
      notificationBody.toLowerCase().includes(code.toLowerCase()),
    )
    if (code) return code
  }

  return undefined
}

export function NotificationProvider() {
  const { userInfo } = useUserStore()
  const navigate = useNavigate()
  const { t } = useTranslation(['notification'])
  const queryClient = useQueryClient()

  // ⚠️ REMOVED: Printer fail dialog đã được xử lý bởi SystemNotificationPopover
  // Không cần dialog riêng ở đây nữa để tránh trùng lặp

  // Start/stop scheduler
  useEffect(() => {
    if (userInfo?.slug) {
      fcmTokenManager.startScheduler()
    }
    return () => fcmTokenManager.stopScheduler()
  }, [userInfo?.slug])

  // Check token when app resumes
  useAppLifecycle(async () => {
    await fcmTokenManager.checkAndRefreshToken()
  })

  // 1️⃣ Lấy FCM token (Native & Web)
  const { permissionDenied } = useFirebaseNotification(userInfo?.slug ?? '')
  const { isPermissionDialogOpen, setIsPermissionDialogOpen } = useDialogContext()
  const [userDismissedDialog, setUserDismissedDialog] = useState(false)

  // Show permission dialog khi permission denied (chỉ nếu user chưa đóng trước đó)
  useEffect(() => {
    if (permissionDenied && !isPermissionDialogOpen && !userDismissedDialog) {
      setIsPermissionDialogOpen(true)
    }
  }, [permissionDenied, isPermissionDialogOpen, userDismissedDialog, setIsPermissionDialogOpen])

  const handlePermissionDialogChange = (open: boolean) => {
    setIsPermissionDialogOpen(open)
    if (!open) {
      // User đã đóng dialog → đánh dấu để không tự động mở lại
      setUserDismissedDialog(true)
    }
  }


  // 2️⃣ Lắng nghe notifications (Native & Web)
  const { latestNotification, clearNotification } = useNotificationListener()

  const buildNotificationTitle = useCallback((messageCode?: string, fallbackTitle?: string) => {
    if (messageCode) {
      const localized = t(`notificationTitle.${messageCode}`, {
        defaultValue: '',
      })
      if (localized) {
        return localized
      }
    }
    return fallbackTitle || t('notification.defaultTitle')
  }, [t])

  // 3️⃣ Xử lý foreground notification
  useEffect(() => {
    if (latestNotification) {
      // ✅ Extract message code từ nhiều nguồn
      const messageCode = extractMessageCode(
        latestNotification.data,
        latestNotification.notification?.body,
      )

      const isPrinterFail = messageCode && printerFailMessages.includes(messageCode)

      // ⚠️ QUAN TRỌNG: Khi có FCM printer fail → trigger refetch printer events
      if (isPrinterFail) {
        // Invalidate và refetch printer events để cập nhật danh sách lỗi in
        // Bỏ exact: true để match tất cả queries có prefix QUERYKEY.printerEvents (kể cả có params)
        queryClient.invalidateQueries({
          queryKey: [QUERYKEY.printerEvents],
        })
        // ⚠️ QUAN TRỌNG: Return sớm để KHÔNG hiển thị toast
        // Chỉ phát âm thanh và clear notification
        playNotificationSound(0.8)
        clearNotification()
        return
      }

      // ⚠️ QUAN TRỌNG: Không hiển thị toast cho printer fail notifications
      // Vì SystemNotificationPopover đã có dialog list lỗi in
      // Chỉ hiển thị toast cho các notification khác
      if (!isPrinterFail) {
        const notifTitle = buildNotificationTitle(
          messageCode,
          latestNotification.notification?.title,
        )
        const notifBody = latestNotification.notification?.body || ''
        const hasUrl = !!latestNotification.data?.url

        // Custom toast (chỉ cho non-printer-fail notifications)
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-in slide-in-from-top-5' : 'animate-out slide-out-to-top-5'
                } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xl">🔔</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{notifTitle}</p>
                    {notifBody && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{notifBody}</p>
                    )}

                    {hasUrl && (
                      <button
                        onClick={async () => {
                          toast.dismiss(t.id)
                          await navigateToNotificationUrl(latestNotification.data?.url ?? '', navigate)
                        }}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Xem chi tiết →
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ),
          {
            duration: 6000,
            position: 'top-right',
          },
        )

        // Play sound (skip for new order notifications)
        if (messageCode !== NotificationMessageCode.ORDER_NEEDS_PROCESSED) {
          playNotificationSound(0.5)
        }
      }

      // ⚠️ QUAN TRỌNG: Không hiển thị dialog riêng cho printer fail
      // Vì SystemNotificationPopover đã có dialog list lỗi in
      // Chỉ hiển thị toast và phát âm thanh
      if (isPrinterFail && messageCode) {
        // Chỉ phát âm thanh, không mở dialog (dialog sẽ được mở bởi SystemNotificationPopover)
        playNotificationSound(0.8)
      }

      clearNotification()
    }
  }, [latestNotification, clearNotification, navigate, buildNotificationTitle, queryClient])

  // ⚠️ REMOVED: Printer fail dialog đã được xử lý bởi SystemNotificationPopover
  // Không cần dialog riêng ở đây nữa để tránh trùng lặp

  return (
    <>
      <NotificationPermissionDialog
        open={isPermissionDialogOpen}
        onOpenChange={handlePermissionDialogChange}
      />
    </>
  )
}