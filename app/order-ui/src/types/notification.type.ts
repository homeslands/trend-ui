import { NOTIFICATION_TYPE, NotificationMessageCode } from '@/constants'
import { IBase } from './base.type'

export interface IAllNotificationRequest {
  receiver?: string
  isRead?: boolean
  type?: NOTIFICATION_TYPE
  page?: number
  size?: number
}

export interface INotificationMetadata {
  order: string
  chefOrder?: string
  orderType: string
  tableName: string
  table: string // slug of the table
  referenceNumber?: string // Reference number from API/Firebase
  branchName: string
  branch: string // slug of the branch
  createdAt: string
  // Campaign notifications (voucher/coin): metadata backend gửi kèm
  campaignSlug?: string
  voucherCode?: string // voucher-new-user-received
  points?: number // coin-new-user-received
  remainingCoin?: number // coin-campaign-budget-exhausted
  coinPerUser?: number // coin-campaign-budget-exhausted
}

export interface INotification extends IBase {
  message: string
  senderId: string
  receiverId: string
  // Mirror của NotificationType phía backend: order | card-order | voucher | gift | coin
  type: NOTIFICATION_TYPE
  isRead: boolean
  metadata: INotificationMetadata
}

export interface IRegisterDeviceTokenRequest {
  token: string
  platform: string
  userAgent: string
}

export interface IRegisterDeviceTokenResponse extends IBase {
  platform: string
}

export interface PrinterFailNotificationItem {
  isRead: boolean
  slug: string
  message: NotificationMessageCode
  metadata: INotificationMetadata
}
