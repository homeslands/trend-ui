import { useMemo, useEffect, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkles, Package, Truck, Printer, Ticket, CircleCheck, Gift, Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { NOTIFICATION_TYPE, NotificationMessageCode, Role, ROUTE } from '@/constants'
import { useNotification } from '@/hooks'
import { useNotificationStore, useOrderTrackingStore, useSelectedOrderStore, useUserStore } from '@/stores'
import type { INotification } from '@/types'

export default function ClientNotificationPopover() {
  const navigate = useNavigate()
  const { t } = useTranslation(['notification'])
  const { userInfo } = useUserStore()
  const { clearSelectedItems } = useOrderTrackingStore()
  const { setOrderSlug } = useSelectedOrderStore()
  const notifications = useNotificationStore((state) => state.notifications)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const hydrateFromApi = useNotificationStore((state) => state.hydrateFromApi)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>('all')

  const unreadCount = useNotificationStore((state) => state.getUnreadCount())

  // Dùng useNotification hook để get notifications từ API
  const { data: notificationsData, refetch: refetchNotifications } =
    useNotification({
      receiver: userInfo?.slug || '',
      page: 1,
      size: 50,
    })

  // Hydrate store từ data của hook
  useEffect(() => {
    const items = notificationsData?.pages.flatMap(
      (page) => page?.result?.items ?? [],
    )
    if (!items || items.length === 0) return

    hydrateFromApi(items)
  }, [notificationsData, hydrateFromApi])

  // Filter notifications theo tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'errors') {
      return notifications.filter((n) =>
        [
          NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
          NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
          NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
        ].includes(n.message as NotificationMessageCode),
      )
    }
    return notifications.filter(
      (n) =>
        ![
          NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
          NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
          NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
        ].includes(n.message as NotificationMessageCode),
    )
  }, [notifications, activeTab])

  const buildNotificationTitle = (message: string, type: string) => {
    const localizedByMessage = t(`notificationTitle.${message}`, {
      defaultValue: '',
    })
    if (localizedByMessage) {
      return localizedByMessage
    }
    return t(`notification.${type}`, {
      defaultValue: type,
    })
  }

  const buildNotificationMessage = (message: string, type: string) => {
    const localizedByMessage = t(`notification.${message}`, {
      defaultValue: '',
    })
    if (localizedByMessage) {
      return localizedByMessage
    }
    return t(`notification.${type}`, {
      defaultValue: message,
    })
  }

  const calculateNotificationTime = (notification: INotification) => {
    const now = moment()
    const createdAt = moment(notification.createdAt)
    const diffMinutes = now.diff(createdAt, 'minutes')
    const diffHours = now.diff(createdAt, 'hours')
    const diffDays = now.diff(createdAt, 'days')
    const diffWeeks = now.diff(createdAt, 'weeks')
    const diffMonths = now.diff(createdAt, 'months')
    const diffYears = now.diff(createdAt, 'years')

    if (diffMinutes < 1) {
      return t('notification.time.justNow')
    } else if (diffHours < 1) {
      return t('notification.time.minutesAgo', { minutes: diffMinutes })
    } else if (diffDays < 1) {
      return t('notification.time.hoursAgo', { hours: diffHours })
    } else if (diffWeeks < 1) {
      return t('notification.time.daysAgo', { days: diffDays })
    } else if (diffMonths < 1) {
      return t('notification.time.weeksAgo', { weeks: diffWeeks })
    } else if (diffYears < 1) {
      return t('notification.time.monthsAgo', { months: diffMonths })
    } else {
      return t('notification.time.yearsAgo', { years: diffYears })
    }
  }

  const isPrinterFailNotification = (message: string) => {
    return [
      NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
      NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
      NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
    ].includes(message as NotificationMessageCode)
  }

  const handleNotificationClick = (notification: INotification) => {
    if (!notification.isRead) {
      markAsRead(notification.slug)
    }

    const orderSlug = notification.metadata.order || notification.slug

    if (isPrinterFailNotification(notification.message)) {
      navigate(`${ROUTE.STAFF_CHEF_ORDER}?slug=${orderSlug}`)
      return
    }

    if (notification.type === NOTIFICATION_TYPE.ORDER) {
      clearSelectedItems()
      setOrderSlug(notification.slug)
      if (userInfo?.role.name === Role.STAFF) {
        navigate(`${ROUTE.STAFF_ORDER_MANAGEMENT}?slug=${orderSlug}`)
      } else if (userInfo?.role.name === Role.CHEF) {
        navigate(`${ROUTE.STAFF_CHEF_ORDER}?slug=${orderSlug}`)
      } else if (userInfo?.role.name === Role.CUSTOMER) {
        navigate(`${ROUTE.CLIENT_ORDER_HISTORY}?order=${orderSlug}`)
      }
    }
  }

  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open)
    if (open && userInfo?.slug) {
      refetchNotifications()
    }
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-primary/10 hover:text-primary"
        >
          <Bell className="h-[1.1rem] w-[1.1rem]" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="flex absolute -top-1 -right-1 justify-center items-center p-0 w-5 h-5 text-xs rounded-full animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col w-[28rem] px-0 py-0 h-[44rem] text-center text-xs lg:min-w-[35%]">
        {notifications.length > 0 ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center px-4 py-3 border-b border-muted-foreground/30 flex-shrink-0">
              <h3 className="w-full text-sm font-semibold text-muted-foreground">
                {t('notification.notificationList')}
              </h3>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'errors')} className="flex flex-col flex-1 min-h-0 w-full">
              <TabsList className="grid w-full grid-cols-2 px-4 py-2 flex-shrink-0">
                <TabsTrigger value="all">
                  {t('notification.tabs.all', { defaultValue: 'Tất cả' })}
                  {(() => {
                    const unreadCount = notifications
                      .filter(
                        (n) =>
                          !n.isRead &&
                          ![
                            NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
                            NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
                            NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
                          ].includes(n.message as NotificationMessageCode),
                      ).length
                    return unreadCount > 0 ? (
                      <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary text-[0.6rem] px-1 py-0">
                        {unreadCount}
                      </Badge>
                    ) : null
                  })()}
                </TabsTrigger>
                <TabsTrigger value="errors">
                  {t('notification.tabs.errors', { defaultValue: 'Lỗi' })}
                  {(() => {
                    const unreadCount = notifications
                      .filter(
                        (n) =>
                          !n.isRead &&
                          [
                            NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
                            NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
                            NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
                          ].includes(n.message as NotificationMessageCode),
                      ).length
                    return unreadCount > 0 ? (
                      <Badge variant="destructive" className="ml-2 text-[0.6rem] px-1 py-0">
                        {unreadCount}
                      </Badge>
                    ) : null
                  })()}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="flex-1 min-h-0 mt-0">
                <div className="flex overflow-y-auto flex-col h-full">
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => (
                      <div
                        key={notification.slug}
                        onClick={() => handleNotificationClick(notification)}
                        className={`relative flex gap-3 items-center p-3 border-b transition-all border-muted-foreground/30 hover:bg-primary/10 cursor-pointer 
                     ${notification.isRead === false ? 'bg-primary/5' : ''}`}
                      >
                        <div
                          className={`flex relative justify-center items-center w-9 h-9 rounded-full ${
                            notification.isRead
                              ? 'bg-muted-foreground/15'
                              : notification.message === NotificationMessageCode.ORDER_NEEDS_PROCESSED
                              ? 'bg-primary/20'
                              : notification.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING ||
                                notification.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING ||
                                notification.message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING
                              ? 'bg-red-100'
                              : notification.message === NotificationMessageCode.VOUCHER_BIRTHDAY_RECEIVED ||
                                notification.message === NotificationMessageCode.VOUCHER_NEW_USER_RECEIVED
                              ? 'bg-violet-100'
                              : notification.message === NotificationMessageCode.GIFT_BIRTHDAY_RECEIVED
                              ? 'bg-pink-100'
                              : notification.message === NotificationMessageCode.COIN_NEW_USER_RECEIVED ||
                                notification.message === NotificationMessageCode.COIN_CAMPAIGN_BUDGET_EXHAUSTED
                              ? 'bg-amber-100'
                              : notification.message === NotificationMessageCode.ORDER_PAID
                              ? 'bg-green-100'
                              : 'bg-blue-100'
                          }`}
                        >
                          {notification.message === NotificationMessageCode.ORDER_NEEDS_PROCESSED ? (
                            <Package
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-orange-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.ORDER_NEEDS_DELIVERED ? (
                            <Truck
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-blue-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING ||
                            notification.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING ||
                            notification.message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING ? (
                            <Printer
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-red-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.VOUCHER_BIRTHDAY_RECEIVED ||
                            notification.message === NotificationMessageCode.VOUCHER_NEW_USER_RECEIVED ? (
                            <Ticket
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-violet-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.GIFT_BIRTHDAY_RECEIVED ? (
                            <Gift
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-pink-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.COIN_NEW_USER_RECEIVED ||
                            notification.message === NotificationMessageCode.COIN_CAMPAIGN_BUDGET_EXHAUSTED ? (
                            <Coins
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-amber-500'
                              }`}
                            />
                          ) : notification.message === NotificationMessageCode.ORDER_PAID ? (
                            <CircleCheck
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-green-500'
                              }`}
                            />
                          ) : (
                            <Bell
                              className={`w-4 h-4 ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-primary'
                              }`}
                            />
                          )}
                          {notification.isRead === false && (
                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 animate-pulse text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 text-sm text-left">
                          <div className="flex gap-2 items-center">
                            <p className="font-bold text-muted-foreground">
                              {buildNotificationTitle(notification.message, notification.type)}
                            </p>
                            {notification.isRead === false && (
                              <Badge variant="secondary" className="bg-primary/20 text-primary text-[0.5rem] px-1 py-0">
                                {t('notification.new')}
                              </Badge>
                            )}
                          </div>
                          <p className="overflow-hidden w-full text-xs truncate whitespace-nowrap text-muted-foreground/70">
                            {buildNotificationMessage(notification.message, notification.type)}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-[0.5rem] text-muted-foreground/70">
                              {calculateNotificationTime(notification)}
                            </span>
                            <span
                              className={`text-[0.5rem] ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-primary font-medium'
                              }`}
                            >
                              {notification.isRead ? t('notification.read') : t('notification.unread')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-sm text-center text-muted-foreground">
                      {t('notification.noNotification')}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="errors" className="flex-1 min-h-0 mt-0">
                <div className="flex overflow-y-auto flex-col h-full">
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => (
                      <div
                        key={notification.slug}
                        onClick={() => handleNotificationClick(notification)}
                        className={`relative flex gap-3 items-center p-3 border-b transition-all border-muted-foreground/30 hover:bg-primary/10 cursor-pointer 
                     ${notification.isRead === false ? 'bg-primary/5' : ''}`}
                      >
                        <div
                          className={`flex relative justify-center items-center w-9 h-9 rounded-full ${
                            notification.isRead
                              ? 'bg-muted-foreground/15'
                              : 'bg-red-100'
                          }`}
                        >
                          <Printer
                            className={`w-4 h-4 ${
                              notification.isRead ? 'text-muted-foreground/70' : 'text-red-500'
                            }`}
                          />
                          {notification.isRead === false && (
                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 animate-pulse text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 text-sm text-left">
                          <div className="flex gap-2 items-center">
                            <p className="font-bold text-muted-foreground">
                              {buildNotificationTitle(notification.message, notification.type)}
                            </p>
                            {notification.isRead === false && (
                              <Badge variant="secondary" className="bg-primary/20 text-primary text-[0.5rem] px-1 py-0">
                                {t('notification.new')}
                              </Badge>
                            )}
                          </div>
                          <p className="overflow-hidden w-full text-xs truncate whitespace-nowrap text-muted-foreground/70">
                            {buildNotificationMessage(notification.message, notification.type)}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-[0.5rem] text-muted-foreground/70">
                              {calculateNotificationTime(notification)}
                            </span>
                            <span
                              className={`text-[0.5rem] ${
                                notification.isRead ? 'text-muted-foreground/70' : 'text-primary font-medium'
                              }`}
                            >
                              {notification.isRead ? t('notification.read') : t('notification.unread')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-sm text-center text-muted-foreground">
                      {t('notification.noNotification')}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-8 text-sm text-center text-muted-foreground">
            {t('notification.noNotification')}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
