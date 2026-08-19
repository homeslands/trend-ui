import { create } from 'zustand'
import moment from 'moment'
import type { NotificationPayload } from '@/types/notification.types'
import type { INotification, INotificationMetadata, PrinterFailNotificationItem } from '@/types/notification.type'
import { NotificationMessageCode } from '@/constants'

interface NotificationStore {
  notifications: INotification[]
  addNotification: (payload: NotificationPayload, options?: { markAsRead?: boolean }) => void
  markAsRead: (slug: string) => void
  markAllAsRead: () => void
  clearAll: () => void

  // Selector helpers
  getUnreadCount: () => number
  getUnreadPrinterFails: () => PrinterFailNotificationItem[]

  // Hydrate từ API (initial load)
  hydrateFromApi: (items: INotification[]) => void
}

const MAX_NOTIFICATIONS = 50

// Helper: xác định thông báo là lỗi in
const isPrinterFailNotification = (message: string): boolean => {
  return [
    NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
    NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
    NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
  ].includes(message as NotificationMessageCode)
}

const transformPayloadToNotification = (
  payload: NotificationPayload,
  markAsRead = false,
): INotification => {
  const data = payload.data ?? {}
  
  // ⚠️ QUAN TRỌNG: Parse data.payload nếu có (backend gửi message code trong payload JSON string)
  let parsedPayload: Record<string, string> = {}
  if (data.payload && typeof data.payload === 'string') {
    try {
      parsedPayload = JSON.parse(data.payload)
    } catch {
      // Ignore parse errors
    }
  }
  
  // Merge parsed payload vào data (parsed payload có priority cao hơn)
  const mergedData = { ...data, ...parsedPayload }
  
  const slug = mergedData.slug || data.slug || payload.messageId || `${Date.now()}`
  const createdAt = mergedData.createdAt || data.createdAt || new Date().toISOString()
  const message = mergedData.message || data.message || payload.notification?.body || ''
  const type = mergedData.type || data.type || 'system'

  const metadata: INotificationMetadata = {
    order: mergedData.order || data.order || '',
    orderType: mergedData.orderType || data.orderType || '',
    tableName: mergedData.tableName || data.tableName || '',
    table: mergedData.table || data.table || '',
    branchName: mergedData.branchName || data.branchName || '',
    branch: mergedData.branch || data.branch || '',
    referenceNumber: mergedData.referenceNumber || data.referenceNumber || '',
    createdAt: mergedData.createdAt || data.createdAt,
  }

  return {
    slug,
    createdAt,
    message,
    senderId: mergedData.senderId || data.senderId || '',
    receiverId: mergedData.receiverId || data.receiverId || '',
    type,
    isRead: markAsRead,
    metadata,
  }
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  addNotification: (payload, options) => {
    set((state) => {
      const item = transformPayloadToNotification(payload, options?.markAsRead ?? false)
      const filtered = state.notifications.filter((notif) => notif.slug !== item.slug)
      const notifications = [item, ...filtered].slice(0, MAX_NOTIFICATIONS)
      return { notifications }
    })
  },
  markAsRead: (slug) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.slug === slug ? { ...notif, isRead: true } : notif,
      ),
    }))
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notif) => ({ ...notif, isRead: true })),
    }))
  },
  clearAll: () => set({ notifications: [] }),

  // Đếm số notification chưa đọc
  getUnreadCount: () => {
    const state = get()
    return state.notifications.filter((notif) => !notif.isRead).length
  },

  // Lấy danh sách thông báo lỗi in chưa đọc, đã map về PrinterFailNotificationItem và sort theo thời gian đặt (cũ nhất trước)
  getUnreadPrinterFails: () => {
    const state = get()

    const printerFails: PrinterFailNotificationItem[] = state.notifications
      .filter((notification) => !notification.isRead && isPrinterFailNotification(notification.message))
      .map((notification) => {
        const metadata = notification.metadata as INotificationMetadata

        return {
          isRead: notification.isRead,
          slug: notification.slug,
          message: notification.message as NotificationMessageCode,
          metadata,
        }
      })
      .sort((a, b) => {
        const timeA = moment(a.metadata.createdAt).valueOf()
        const timeB = moment(b.metadata.createdAt).valueOf()
        return timeA - timeB // Cũ nhất trước
      })

    return printerFails
  },

  // Hydrate danh sách notification từ API (giữ lại các notification hiện tại, merge theo slug)
  hydrateFromApi: (items: INotification[]) => {
    if (!items || items.length === 0) return

    set((state) => {
      const map = new Map<string, INotification>()

      // Ưu tiên dữ liệu hiện tại
      state.notifications.forEach((n) => {
        map.set(n.slug, n)
      })

      // Merge dữ liệu từ API (lưu tất cả, không filter)
      items.forEach((n) => {
        map.set(n.slug, n)
      })

      const merged = Array.from(map.values())
        .sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime()
          const timeB = new Date(b.createdAt).getTime()
          return timeB - timeA // Mới nhất trước
        })
        .slice(0, MAX_NOTIFICATIONS)

      return { notifications: merged }
    })
  },
}))
