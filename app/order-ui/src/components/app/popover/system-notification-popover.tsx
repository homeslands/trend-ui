import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkles, Package, Truck, Printer } from 'lucide-react'
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

import { NotificationMessageCode, Role, ROUTE, PrinterJobType } from '@/constants'
import { useUpdateNotificationStatus, useGetPrinterEvents, useNotification } from '@/hooks'
import { INotification, PrinterFailNotificationItem, IPrinterEvent } from '@/types'
import { useOrderTrackingStore, useSelectedOrderStore, useUserStore, useNotificationStore } from '@/stores'
import { useDialogContext } from '@/contexts/dialog-context'
import notificationSound from '@/assets/sound/notification.mp3'
import { PrinterFailDialog } from '@/components/app/dialog'

export default function SystemNotificationPopover() {
  const navigate = useNavigate()
  const { t } = useTranslation(['notification'])
  const { userInfo } = useUserStore()
  const { mutate: updateStatus } = useUpdateNotificationStatus()
  const {
    setOrderSlug,
  } = useSelectedOrderStore()
  const { clearSelectedItems } = useOrderTrackingStore()
  const { isPermissionDialogOpen } = useDialogContext()
  const lastPrinterNotificationRef = useRef<string | null>(null)
  const lastPrinterNotificationTimeRef = useRef<string | null>(null) // Track thời gian của notification cuối cùng
  const displayedPrinterSlugsRef = useRef<Set<string>>(new Set())
  const userClosedDialogRef = useRef<boolean>(false) // Track nếu user đóng dialog thủ công
  const autoFetchAttemptsRef = useRef<number>(0) // Track số lần auto-fetch để tránh infinite loop
  const pendingPrinterFailRef = useRef<boolean>(false) // Track nếu có printer fail đang chờ hiển thị
  const [printerDialogList, setPrinterDialogList] = useState<PrinterFailNotificationItem[]>([])
  const [isPrinterDialogOpen, setIsPrinterDialogOpen] = useState(false)
  // Track các slugs đã in lại thành công (tạm thời ẩn khỏi dialog)
  // Map: slug -> timestamp khi in thành công
  const hiddenPrinterFailSlugsRef = useRef<Map<string, number>>(new Map())
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>('all')
  // Track khi user vừa bấm mở popover (để tránh mở dialog ngay lúc đó)
  const justOpenedPopoverRef = useRef<boolean>(false)

  const notificationList = useNotificationStore((state) => state.notifications)
  
  // Helper function: kiểm tra notification có phải lỗi in không
  const isPrinterFailNotification = useCallback((message: string) => {
    return [
      NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
      NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
      NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
    ].includes(message as NotificationMessageCode)
  }, [])

  // Hook để get notifications với pagination cho tab "Tất cả"
  // ⚠️ QUAN TRỌNG: Dùng useNotification hook để get notifications từ API
  const {
    data: notificationsData,
    fetchNextPage: fetchNextNotificationsPage,
    hasNextPage: hasNextNotificationsPage,
    isFetchingNextPage: isFetchingNextNotificationsPage,
    isLoading: isLoadingNotificationsInfinite,
    refetch: refetchNotifications,
  } = useNotification({
    receiver: userInfo?.slug || '',
    page: 1,
    size: 50,
  })

  // Flatten notifications từ tất cả pages và filter bỏ printer fail
  const allNotifications = useMemo(() => {
    if (!notificationsData?.pages) return []
    
    return notificationsData.pages.flatMap((page) => {
      if (!page?.result?.items) return []
      return page.result.items
    })
  }, [notificationsData])

  // Filter notifications theo tab (loại bỏ printer fail)
  const filteredNotificationsFromApi = useMemo(() => {
    const filtered = allNotifications.filter(
      (notification) => !isPrinterFailNotification(notification.message),
    )
    return filtered
  }, [allNotifications, isPrinterFailNotification])

  // ⚠️ QUAN TRỌNG: Tự động fetch thêm pages nếu tất cả items đều là printer fail
  // Đảm bảo tab "Tất cả" luôn có data để hiển thị (nếu có)
  useEffect(() => {
    // Reset counter khi có filtered notifications hoặc khi switch tab
    if (filteredNotificationsFromApi.length > 0 || activeTab !== 'all') {
      autoFetchAttemptsRef.current = 0
      return
    }

    // Chỉ auto-fetch khi:
    // 1. Đã có data từ API
    // 2. Filtered notifications rỗng (tất cả đều là printer fail)
    // 3. Vẫn còn page tiếp theo
    // 4. Không đang fetch
    // 5. Đang ở tab "Tất cả"
    // 6. Chưa auto-fetch quá 5 lần (tránh infinite loop)
    if (
      allNotifications.length > 0 &&
      filteredNotificationsFromApi.length === 0 &&
      hasNextNotificationsPage &&
      !isFetchingNextNotificationsPage &&
      !isLoadingNotificationsInfinite &&
      activeTab === 'all' &&
      autoFetchAttemptsRef.current < 5
    ) {
      autoFetchAttemptsRef.current += 1
      fetchNextNotificationsPage()
    }
  }, [
    allNotifications.length,
    filteredNotificationsFromApi.length,
    hasNextNotificationsPage,
    isFetchingNextNotificationsPage,
    isLoadingNotificationsInfinite,
    activeTab,
    fetchNextNotificationsPage,
  ])
  
  // Hook để get printer events với pagination (cho tab "Lỗi")
  const {
    data: printerEventsData,
    refetch: refetchPrinterEvents,
    isLoading: isLoadingPrinterEvents,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    dataUpdatedAt,
  } = useGetPrinterEvents({
    size: 50, // Cùng size với tab "Tất cả"
    receiver: userInfo?.slug,
  })

  // Flatten printer events từ tất cả pages
  const printerEvents = useMemo(() => {
    if (!printerEventsData?.pages) return []
    
    return printerEventsData.pages.flatMap((page) => {
      if (!page?.result) return []
      
      // Handle cả 2 trường hợp: result là array hoặc object có items
      if (Array.isArray(page.result)) {
        return page.result
      } else if (typeof page.result === 'object' && 'items' in page.result && Array.isArray(page.result.items)) {
        return page.result.items
      }
      return []
    })
  }, [printerEventsData])

  // ⚠️ QUAN TRỌNG: Track khi printerEventsData được refetch để set lastRefetchTimeRef
  // Track theo dataUpdatedAt từ React Query để detect refetch chính xác
  const previousDataUpdatedAtRef = useRef<number>(0)
  
  useEffect(() => {
    // dataUpdatedAt là timestamp khi data được cập nhật lần cuối (từ React Query)
    const currentDataUpdatedAt = dataUpdatedAt || 0
    
    // Nếu dataUpdatedAt thay đổi và lớn hơn previous → đây là do refetch
    if (currentDataUpdatedAt > previousDataUpdatedAtRef.current && printerEvents.length > 0) {
      lastRefetchTimeRef.current = Date.now()
    }
    
    // Cập nhật previous ref
    previousDataUpdatedAtRef.current = currentDataUpdatedAt
  }, [dataUpdatedAt, printerEvents.length, isFetching, printerEventsData])

  // Map IPrinterEvent sang PrinterFailNotificationItem
  const mapPrinterEventToNotificationItem = useCallback((event: IPrinterEvent): PrinterFailNotificationItem | null => {
    // Kiểm tra event có đủ data không
    if (!event?.printerJob || !event?.metadata) {
      return null
    }

    // Map jobType sang NotificationMessageCode
    // jobType là enum PrinterJobType hoặc string
    const jobType = event.printerJob.jobType as string
    let messageCode: NotificationMessageCode
    if (jobType === PrinterJobType.INVOICE || jobType === 'invoice' || jobType?.toLowerCase() === 'invoice') {
      messageCode = NotificationMessageCode.ORDER_BILL_FAILED_PRINTING
    } else if (jobType === PrinterJobType.CHEF_ORDER || jobType === 'chef-order' || jobType?.toLowerCase() === 'chef-order') {
      messageCode = NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING
    } else {
      messageCode = NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING
    }

    return {
      isRead: false, // Printer events luôn là unread
      slug: event.printerJob.slug || event.slug || '',
      message: messageCode,
      metadata: {
        chefOrder: event.metadata.chefOrder,
        orderType: event.metadata.orderType,
        branchName: event.metadata.branchName,
        branch: event.metadata.branch,
        referenceNumber: event.metadata.referenceNumber?.toString() || event.metadata.order || '',
        table: event.metadata.table,
        tableName: event.metadata.tableName,
        order: event.metadata.order || '',
        createdAt: event.metadata.createdAt || event.printerJob.createdAt || event.createdAt || new Date().toISOString(),
      },
    }
  }, [])

  // Convert printer events sang PrinterFailNotificationItem
  const printerEventsAsNotificationItems = useMemo(() => {
    if (!Array.isArray(printerEvents) || printerEvents.length === 0) {
      return []
    }
    
    const mapped = printerEvents
      .map(mapPrinterEventToNotificationItem)
      .filter((item): item is PrinterFailNotificationItem => item !== null)
    
    const sorted = mapped.sort((a, b) => {
      const timeA = moment(a.metadata.createdAt).valueOf()
      const timeB = moment(b.metadata.createdAt).valueOf()
      return timeA - timeB
    })

    return sorted
  }, [printerEvents, mapPrinterEventToNotificationItem])

  // Filter notifications theo tab
  // Tab "Tất cả": dùng data từ API (đã filter bỏ printer fail)
  // Tab "Lỗi": dùng printer events
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'errors') {
      return []
    }
    // Tab "Tất cả": dùng notifications từ API (đã có pagination)
    return filteredNotificationsFromApi
  }, [filteredNotificationsFromApi, activeTab])

  // Step 3: Tính badge count
  // Tab "Tất cả": chỉ đếm notifications không phải printer fail từ API
  const unreadNotificationsCount = useMemo(() => {
    return filteredNotificationsFromApi.filter((n) => !n.isRead).length
  }, [filteredNotificationsFromApi])
  
  // Tab "Lỗi": đếm printer events
  const printerEventsCount = printerEventsAsNotificationItems.length
  
  // Badge tổng = unread notifications (không bao gồm printer fail) + printer events
  const totalUnreadCount = unreadNotificationsCount + printerEventsCount

  // ⚠️ REMOVED: Không cần hydrate vào store nữa vì tab "Tất cả" dùng useNotification hook trực tiếp
  // Tab "Tất cả" sẽ lấy data từ useNotification hook (đã có pagination)

  // ⚠️ PHƯƠNG ÁN 2: Pre-fetch cả 2 nguồn khi mở popover (không phụ thuộc tab)
  // → UX tốt nhất: User có thể switch tab ngay mà không cần đợi
  useEffect(() => {
    if (!userInfo?.slug) return
    if (!isPopoverOpen) return

    // Fetch notifications (cho tab "Tất cả")
    refetchNotifications()
    // Fetch printer events (cho tab "Lỗi")
    refetchPrinterEvents()
  }, [isPopoverOpen, userInfo?.slug, refetchNotifications, refetchPrinterEvents])

  // ⚠️ QUAN TRỌNG: Tự động refetch printer events khi có FCM notification mới là printer fail
  // Track các notification đã biết để detect notification mới
  const knownNotificationSlugsRef = useRef<Set<string>>(new Set())
  // Track thời gian refetch cuối cùng để detect khi có refetch mới (sau khi bấm in lại)
  const lastRefetchTimeRef = useRef<number>(0)
  
  useEffect(() => {
    // Khởi tạo known slugs từ notificationList hiện tại
    if (knownNotificationSlugsRef.current.size === 0 && notificationList.length > 0) {
      notificationList.forEach((notif) => {
        knownNotificationSlugsRef.current.add(notif.slug)
      })
      return
    }
    
    // Tìm notification mới (chưa có trong known slugs)
    const newNotifications = notificationList.filter(
      (notif) => !knownNotificationSlugsRef.current.has(notif.slug)
    )
    
    if (newNotifications.length > 0) {
      // Có notification mới → check xem có phải printer fail không
      const hasNewPrinterFail = newNotifications.some((notif) => 
        !notif.isRead && isPrinterFailNotification(notif.message)
      )
      
      if (hasNewPrinterFail) {
        // Có printer fail notification mới → refetch printer events
        lastRefetchTimeRef.current = Date.now()
        refetchPrinterEvents()
      }
      
      // Thêm các notification mới vào known slugs
      newNotifications.forEach((notif) => {
        knownNotificationSlugsRef.current.add(notif.slug)
      })
    }
  }, [notificationList, isPrinterFailNotification, refetchPrinterEvents])

  const buildNotificationTitle = (message: string, type?: string) => {
    // Ưu tiên tìm translation theo message code trong notificationTitle namespace
    // useTranslation(['notification']) nên key sẽ là: notification.notificationTitle.${message}
    const localizedByMessage = t(`notificationTitle.${message}`, {
      defaultValue: '',
    })
    // Kiểm tra xem có translation hay không (nếu không có, i18n sẽ trả về key hoặc defaultValue)
    if (localizedByMessage && localizedByMessage !== `notificationTitle.${message}` && localizedByMessage !== '') {
      return localizedByMessage
    }
    // Nếu không tìm thấy trong notificationTitle, thử dùng message trực tiếp
    const directMessage = t(`notification.${message}`, {
      defaultValue: '',
    })
    if (directMessage && directMessage !== `notification.${message}` && directMessage !== '') {
      return directMessage
    }
    // Nếu có type, fallback về type
    if (type) {
      const typeTranslation = t(`notification.${type}`, {
        defaultValue: '',
      })
      if (typeTranslation && typeTranslation !== `notification.${type}` && typeTranslation !== '') {
        return typeTranslation
      }
    }
    // Cuối cùng, dùng message code làm fallback
    return message
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

  const handleNotificationClick = (notification: INotification) => {
    if (notification.isRead === false) {
      updateStatus(notification.slug)
    }

    const orderSlug = notification.metadata.order || notification.slug

    if (isPrinterFailNotification(notification.message)) {
      navigate(`${ROUTE.STAFF_ORDER_MANAGEMENT}?order=${orderSlug}`)
      return
    }

    if (notification.type === 'order') {
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

  useEffect(() => {
    const printerFails = printerEventsAsNotificationItems

    if (printerFails.length === 0) {
      // Không còn đơn lỗi → đóng dialog nếu đang mở
      if (isPrinterDialogOpen) {
        setIsPrinterDialogOpen(false)
        setPrinterDialogList([])
        displayedPrinterSlugsRef.current.clear()
      }
      // Reset flag khi không còn printer fails
      userClosedDialogRef.current = false
      lastPrinterNotificationRef.current = null
      lastPrinterNotificationTimeRef.current = null
      hiddenPrinterFailSlugsRef.current.clear()
      return
    }

    // ⚠️ QUAN TRỌNG: Cleanup hidden slugs cũ (đã hidden > 5 phút và không còn trong API)
    // Hoặc reset hidden nếu item không còn trong API (đã in thành công và không còn lỗi)
    const currentSlugs = new Set(printerFails.map(item => item.slug))
    const now = Date.now()
    const HIDDEN_TIMEOUT = 5 * 60 * 1000 // 5 phút
    
    hiddenPrinterFailSlugsRef.current.forEach((timestamp, slug) => {
      // Nếu item không còn trong API → xóa khỏi hidden (đã in thành công và không còn lỗi)
      if (!currentSlugs.has(slug)) {
        hiddenPrinterFailSlugsRef.current.delete(slug)
      }
      // Nếu đã hidden quá lâu (> 5 phút) → xóa để hiển thị lại (có thể đã lỗi lại)
      else if (now - timestamp > HIDDEN_TIMEOUT) {
        hiddenPrinterFailSlugsRef.current.delete(slug)
      }
    })

    // ⚠️ QUAN TRỌNG: Detect notification mới
    // 1. So sánh slugs hiện tại với slugs đã được hiển thị
    const displayedSlugs = displayedPrinterSlugsRef.current
    const newSlugs = Array.from(currentSlugs).filter(slug => !displayedSlugs.has(slug))
    
    // 2. Tìm printer event mới nhất (theo printerJob.createdAt hoặc event.createdAt)
    //    Map từ printerFails về printerEvents để lấy printerJob.createdAt
    //    Tìm event có printerJob.createdAt mới nhất từ printerEvents
    let newestPrinterEvent: IPrinterEvent | null = null
    if (printerEvents.length > 0) {
      newestPrinterEvent = printerEvents.reduce((newest, current) => {
        const newestTime = moment(newest?.printerJob?.createdAt || newest?.createdAt || 0).valueOf()
        const currentTime = moment(current?.printerJob?.createdAt || current?.createdAt || 0).valueOf()
        return currentTime > newestTime ? current : newest
      }, printerEvents[0])
    }

    // 3. Kiểm tra có notification mới theo thời gian không
    //    So sánh printerJob.createdAt (thời gian tạo printer job mới) thay vì metadata.createdAt (thời gian tạo order)
    const lastTimeValue = lastPrinterNotificationTimeRef.current
      ? moment(lastPrinterNotificationTimeRef.current).valueOf()
      : 0
    const newestTimeValue = newestPrinterEvent
      ? moment(newestPrinterEvent?.printerJob?.createdAt || newestPrinterEvent?.createdAt || 0).valueOf()
      : 0
    const hasNewByTime = newestTimeValue > lastTimeValue

    // 4. ⚠️ QUAN TRỌNG: Kiểm tra xem có refetch gần đây không (sau khi bấm in lại)
    //    Nếu có refetch trong vòng 10 giây gần đây → coi như có notification mới
    const currentTime = Date.now()
    const timeSinceLastRefetch = currentTime - lastRefetchTimeRef.current
    const hasRecentRefetch = timeSinceLastRefetch > 0 && timeSinceLastRefetch < 10000 // 10 giây

    // 5. Tổng hợp điều kiện notification mới:
    //    - Có slug mới, HOẶC
    //    - Có printer job mới (printerJob.createdAt mới hơn), HOẶC
    //    - Có refetch gần đây (sau khi bấm in lại)
    const hasNewNotification = newSlugs.length > 0 || hasNewByTime || hasRecentRefetch

    // ⚠️ QUAN TRỌNG: Reset hidden slugs cho các orders có printer fail mới
    // Logic: Nếu có printer fail mới (slug mới) cho cùng một order → reset hidden để hiển thị lại TẤT CẢ items của order đó
    // Đơn giản hóa: Luôn reset hidden cho tất cả items có cùng order/chefOrder với bất kỳ item nào trong API response
    // (vì nếu item có trong API response, có nghĩa là nó vẫn lỗi, nên nên hiển thị lại)
    const allOrderSlugs = new Set(printerFails.map(item => item.metadata.order).filter(Boolean))
    const allChefOrderSlugs = new Set(printerFails.map(item => item.metadata.chefOrder).filter(Boolean))
    
    // Reset hidden cho TẤT CẢ items có cùng order hoặc chefOrder với bất kỳ item nào trong API response
    const slugsToUnhide = new Set<string>()
    printerFails.forEach((item) => {
      // Nếu item có order và order đó có trong API response → reset hidden
      if (item.metadata.order && allOrderSlugs.has(item.metadata.order)) {
        slugsToUnhide.add(item.slug)
      }
      // Nếu item có chefOrder và chefOrder đó có trong API response → reset hidden
      if (item.metadata.chefOrder && allChefOrderSlugs.has(item.metadata.chefOrder)) {
        slugsToUnhide.add(item.slug)
      }
    })
    
    // Xóa tất cả slugs cần unhide khỏi hidden
    slugsToUnhide.forEach((slug) => {
      hiddenPrinterFailSlugsRef.current.delete(slug)
    })
    
    // ⚠️ QUAN TRỌNG: Nếu có notification mới → reset userClosedDialogRef và cập nhật data
    if (hasNewNotification) {
      // Reset flag để cho phép mở dialog (chỉ khi có notification mới)
      userClosedDialogRef.current = false

      // Cập nhật ref với notification mới nhất
      if (newestPrinterEvent) {
        const newestSlug = newestPrinterEvent.printerJob?.slug || newestPrinterEvent.slug
        const newestCreatedAt = newestPrinterEvent.printerJob?.createdAt || newestPrinterEvent.createdAt
        lastPrinterNotificationRef.current = newestSlug
        lastPrinterNotificationTimeRef.current = newestCreatedAt
        // Thêm tất cả slugs mới vào displayedSlugs
        newSlugs.forEach(slug => displayedPrinterSlugsRef.current.add(slug))
      }
      // Reset refetch time sau khi đã xử lý notification mới
      lastRefetchTimeRef.current = 0

      // Cập nhật dialog list (filter bỏ các items đã in lại thành công)
      const filteredPrinterFails = printerFails.filter(
        (item) => !hiddenPrinterFailSlugsRef.current.has(item.slug)
      )
      setPrinterDialogList(filteredPrinterFails)

      // Phát âm thanh khi có notification mới
      try {
        const audio = new Audio(notificationSound)
        audio.volume = 0.8
        audio.play().catch(() => {
          // ignore autoplay errors
        })
      } catch {
        // ignore audio init error
      }
    } else {
      // Không có notification mới, nhưng vẫn cập nhật dialog list nếu cần
      setPrinterDialogList((prevList) => {
        const prevSlugs = new Set(prevList.map(item => item.slug))
        const changed = prevSlugs.size !== currentSlugs.size || ![...currentSlugs].every(slug => prevSlugs.has(slug))
        if (changed) {
          // Filter bỏ các items đã in lại thành công
          return printerFails.filter((item) => !hiddenPrinterFailSlugsRef.current.has(item.slug))
        }
        return prevList
      })
    }

    // ⚠️ QUAN TRỌNG: Mở dialog nếu:
    // 1. Có printer fail "mới" (hasNewNotification = true) → LUÔN mở dialog (bất chấp popover đang mở hay không)
    //    NHƯNG không mở nếu user vừa bấm mở popover (justOpenedPopoverRef)
    // 2. HOẶC lần đầu có printer fails (dialog chưa mở, user chưa đóng thủ công)
    //    Và không mở nếu user vừa bấm mở popover
    // 3. Và permission dialog không đang mở
    const visiblePrinterFails = printerFails.filter(
      (item) => !hiddenPrinterFailSlugsRef.current.has(item.slug)
    )
    
    if (hasNewNotification && visiblePrinterFails.length > 0 && !isPermissionDialogOpen && !justOpenedPopoverRef.current) {
      // Có printer fail mới (thường là sau FCM) → luôn mở dialog (bất chấp popover đang mở)
      // NHƯNG không mở nếu user vừa bấm mở popover
      if (!isPrinterDialogOpen) {
        setIsPrinterDialogOpen(true)
      }
      pendingPrinterFailRef.current = false
      // Cho phép mở lại lần sau khi có notification mới khác
      userClosedDialogRef.current = false
    } else if (visiblePrinterFails.length > 0 && isPermissionDialogOpen) {
      // Có printer fails nhưng permission dialog đang mở → đánh dấu pending
      pendingPrinterFailRef.current = true
    } else if (
      // Không có notification mới, nhưng đây là lần đầu có printer fails:
      !hasNewNotification &&
      !isPrinterDialogOpen &&
      !userClosedDialogRef.current &&
      visiblePrinterFails.length > 0 &&
      !isPermissionDialogOpen &&
      !justOpenedPopoverRef.current
    ) {
      setIsPrinterDialogOpen(true)
      pendingPrinterFailRef.current = false
    }
  }, [printerEventsAsNotificationItems, isPrinterDialogOpen, printerEvents, isPermissionDialogOpen])

  // ⚠️ QUAN TRỌNG: Khi permission dialog đóng, mở printer fail dialog nếu có pending
  useEffect(() => {
    if (!isPermissionDialogOpen && pendingPrinterFailRef.current && !isPrinterDialogOpen) {
      const visiblePrinterFails = printerEventsAsNotificationItems.filter(
        (item) => !hiddenPrinterFailSlugsRef.current.has(item.slug)
      )
      if (visiblePrinterFails.length > 0 && !userClosedDialogRef.current) {
        setIsPrinterDialogOpen(true)
        pendingPrinterFailRef.current = false
      }
    }
  }, [isPermissionDialogOpen, isPrinterDialogOpen, printerEventsAsNotificationItems])

  // ⚠️ QUAN TRỌNG: Khi permission dialog đóng, mở printer fail dialog nếu có pending
  useEffect(() => {
    if (!isPermissionDialogOpen && pendingPrinterFailRef.current && !isPrinterDialogOpen) {
      const visiblePrinterFails = printerEventsAsNotificationItems.filter(
        (item) => !hiddenPrinterFailSlugsRef.current.has(item.slug)
      )
      if (visiblePrinterFails.length > 0 && !userClosedDialogRef.current) {
        setIsPrinterDialogOpen(true)
        pendingPrinterFailRef.current = false
      }
    }
  }, [isPermissionDialogOpen, isPrinterDialogOpen, printerEventsAsNotificationItems])

  const handlePrinterDialogClose = (open: boolean) => {
    setIsPrinterDialogOpen(open)
    if (!open) {
      setPrinterDialogList([])
      userClosedDialogRef.current = true
    } else {
      userClosedDialogRef.current = false
    }
  }

  const handleGoToOrderManagement = (orderSlug?: string) => {
    const targetOrderSlug = orderSlug || printerDialogList[0]?.metadata.order
    if (!targetOrderSlug) {
      handlePrinterDialogClose(false)
      return
    }
    navigate(`${ROUTE.STAFF_ORDER_MANAGEMENT}?order=${targetOrderSlug}`)
    handlePrinterDialogClose(false)
  }

  // Callback khi in lại thành công → ẩn các items đã in thành công
  const handleReprintSuccess = (slugs: string[]) => {
    const now = Date.now()
    
    // Thêm slugs vào hidden với timestamp
    slugs.forEach((slug) => {
      hiddenPrinterFailSlugsRef.current.set(slug, now)
    })
    
    // Cập nhật dialog list để loại bỏ các items đã in thành công
    setPrinterDialogList((prevList) => {
      const filtered = prevList.filter((item) => !slugs.includes(item.slug))
      return filtered
    })
  }

  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open)
    // Khi user bấm mở popover → set flag để tránh mở dialog ngay lúc đó
    if (open) {
      justOpenedPopoverRef.current = true
      // Reset flag sau 500ms (đủ thời gian để popover mở xong)
      setTimeout(() => {
        justOpenedPopoverRef.current = false
      }, 500)
    } else {
      // Khi đóng popover → reset flag ngay
      justOpenedPopoverRef.current = false
    }
  }

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-primary/10 hover:text-primary"
          >
            <Bell className="h-[1.1rem] w-[1.1rem]" />
            {totalUnreadCount > 0 && (
              <Badge
                variant="destructive"
                className="flex absolute -top-1 -right-1 justify-center items-center p-0 w-5 h-5 text-xs rounded-full animate-pulse"
              >
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex flex-col w-[36rem] px-0 py-0 h-[44rem] text-center text-xs lg:min-w-[50%]">
          {/* Luôn hiển thị tabs, không phụ thuộc vào notificationList.length */}
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
                    {unreadNotificationsCount > 0 ? (
                      <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary text-[0.6rem] px-1 py-0">
                        {unreadNotificationsCount}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="errors">
                    {t('notification.tabs.errors', { defaultValue: 'Lỗi' })}
                    {printerEventsCount > 0 ? (
                      <Badge variant="destructive" className="ml-2 text-[0.6rem] px-1 py-0">
                        {printerEventsCount}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="flex-1 min-h-0 mt-0">
                  <div className="flex overflow-y-auto flex-col h-full">
                    {isLoadingNotificationsInfinite ? (
                      <div className="py-8 text-sm text-center text-muted-foreground">
                        {t('notification.loading', { defaultValue: 'Đang tải...' })}
                      </div>
                    ) : filteredNotifications.length > 0 ? (
                      <>
                        {filteredNotifications.map((notification) => (
                  <div
                    key={notification.slug}
                    onClick={() => handleNotificationClick(notification)}
                    className={`relative flex gap-3 items-center p-3 border-b transition-all border-muted-foreground/30 hover:bg-primary/10 cursor-pointer 
                 ${notification.isRead === false ? 'bg-primary/5' : ''}`}
                  >
                    {/* Icon Bell với dấu chấm nếu chưa đọc */}
                    <div className={`flex relative justify-center items-center w-9 h-9 rounded-full ${notification.isRead
                      ? 'bg-muted-foreground/15'
                      : notification.message === NotificationMessageCode.ORDER_NEEDS_PROCESSED
                        ? 'bg-primary/20'
                        : notification.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING ||
                          notification.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING ||
                          notification.message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                      }`}>
                      {notification.message === NotificationMessageCode.ORDER_NEEDS_PROCESSED ? (
                        <Package className={`w-4 h-4 ${notification.isRead ? 'text-muted-foreground/70' : 'text-orange-500'}`} />
                      ) : notification.message === NotificationMessageCode.ORDER_NEEDS_DELIVERED ? (
                        <Truck className={`w-4 h-4 ${notification.isRead ? 'text-muted-foreground/70' : 'text-blue-500'}`} />
                      ) : notification.message === NotificationMessageCode.ORDER_BILL_FAILED_PRINTING ||
                        notification.message === NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING ||
                        notification.message === NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING ? (
                        <Printer className={`w-4 h-4 ${notification.isRead ? 'text-muted-foreground/70' : 'text-red-500'}`} />
                      ) : (
                        <Bell className={`w-4 h-4 ${notification.isRead ? 'text-muted-foreground/70' : 'text-primary'}`} />
                      )}
                      {notification.isRead === false && (
                        <>
                          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 animate-pulse text-primary" />
                        </>
                      )}
                    </div>

                    {/* Nội dung thông báo */}
                    <div className="flex-1 min-w-0 text-sm text-left">
                      <div className="flex gap-2 items-center">
                        <p className='font-bold text-muted-foreground'>
                          {buildNotificationTitle(notification.message, notification.type)}
                        </p>
                        {notification.isRead === false && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary text-[0.5rem] px-1 py-0">
                            {t('notification.new')}
                          </Badge>
                        )}
                      </div>
                      <p className="overflow-hidden w-full text-xs truncate whitespace-nowrap text-muted-foreground/70">
                        {t(`notification.${notification.message}`)}
                      </p>
                      <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground/70 italic">
                          {calculateNotificationTime(notification)}
                        </span>
                                <span className={`text-xs ${notification.isRead ? 'text-muted-foreground/70' : 'text-primary font-medium'}`}>
                          {notification.isRead ? t('notification.read') : t('notification.unread')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                        {hasNextNotificationsPage && (
                          <div className="flex justify-center items-center p-4 border-t border-muted-foreground/30">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchNextNotificationsPage()}
                              disabled={isFetchingNextNotificationsPage}
                              className="w-full"
                            >
                              {isFetchingNextNotificationsPage
                                ? t('notification.loading', { defaultValue: 'Đang tải...' })
                                : t('notification.loadMore', { defaultValue: 'Tải thêm' })}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-sm text-center text-muted-foreground">
                        {t('notification.noNotification')}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="errors" className="flex-1 min-h-0 mt-0">
                  <div className="flex overflow-y-auto flex-col h-full">
                    {isLoadingPrinterEvents ? (
                      <div className="py-8 text-sm text-center text-muted-foreground">
                        {t('notification.loading', { defaultValue: 'Đang tải...' })}
                      </div>
                    ) : printerEventsAsNotificationItems.length > 0 ? (
                      <>
                        {printerEventsAsNotificationItems.map((item) => (
                          <div
                            key={item.slug}
                            onClick={() => handleGoToOrderManagement(item.metadata.order)}
                            className="relative flex gap-3 items-center p-3 border-b transition-all border-muted-foreground/30 hover:bg-primary/10 cursor-pointer bg-primary/5"
                          >
                            <div className="flex relative justify-center items-center w-9 h-9 rounded-full bg-red-100">
                              <Printer className="w-4 h-4 text-red-500" />
                              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 animate-pulse text-primary" />
                            </div>

                            <div className="flex-1 min-w-0 text-sm text-left">
                              <div className="flex gap-2 items-center">
                                <p className='font-bold text-muted-foreground'>
                                  {buildNotificationTitle(item.message)}
                                </p>
                                <Badge variant="secondary" className="bg-primary/20 text-primary text-[0.5rem] px-1 py-0">
                                  {t('notification.new')}
                                </Badge>
                              </div>
                              <p className="overflow-hidden w-full text-xs truncate whitespace-nowrap text-muted-foreground/70">
                                {t(`notification.${item.message}`)}
                              </p>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground/70 italic">
                                  {calculateNotificationTime({ metadata: { createdAt: item.metadata.createdAt } } as INotification)}
                                </span>
                                <span className="text-xs text-primary font-medium">
                                  {t('notification.unread')}
                                </span>
                </div>
              </div>
            </div>
                        ))}
                        {hasNextPage && (
                          <div className="flex justify-center items-center p-4 border-t border-muted-foreground/30">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchNextPage()}
                              disabled={isFetchingNextPage}
                              className="w-full"
                            >
                              {isFetchingNextPage
                                ? t('notification.loading', { defaultValue: 'Đang tải...' })
                                : t('notification.loadMore', { defaultValue: 'Tải thêm' })}
                            </Button>
                          </div>
                        )}
                      </>
          ) : (
            <div className="py-8 text-sm text-center text-muted-foreground">
              {t('notification.noNotification')}
            </div>
          )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
        </PopoverContent>
      </Popover>
      <PrinterFailDialog
        open={isPrinterDialogOpen}
        onOpenChange={handlePrinterDialogClose}
        printerDialogList={printerDialogList}
        onGoToOrderManagement={handleGoToOrderManagement}
        buildNotificationTitle={buildNotificationTitle}
        onReprintSuccess={handleReprintSuccess}
      />
    </>
  )
}
