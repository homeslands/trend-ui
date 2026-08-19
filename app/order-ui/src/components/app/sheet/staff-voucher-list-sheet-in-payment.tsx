import { useEffect, useState, useCallback, useMemo } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  Copy,
  Ticket,
  TicketPercent,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Button,
  ScrollArea,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Label,
  SheetFooter,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Progress,
  Badge,
  Checkbox,
} from '@/components/ui'
import {
  useIsMobile,
  usePagination,
  useViewportHeight,
  useSpecificVoucher,
  useValidateVoucher,
  useVouchersForOrder,
  useUpdateVoucherInOrder,
} from '@/hooks'
import { formatCurrency, isVoucherApplicableToCartItems, showErrorToast, showToast } from '@/utils'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
import {
  IValidateVoucherRequest,
  IVoucher,
  IGetAllVoucherRequest,
  IOrder,
} from '@/types'
import { useOrderFlowStore, useThemeStore, useUserStore } from '@/stores'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'

export default function StaffVoucherListSheetInPayment({
  onSuccess,
  order,
}: {
  onSuccess: () => void
  order?: IOrder | null
}) {
  const isMobile = useIsMobile()
  const viewportHeight = useViewportHeight()
  const { getTheme } = useThemeStore()
  const { t } = useTranslation(['voucher'])
  const { t: tToast } = useTranslation('toast')
  const { userInfo } = useUserStore()
  const { paymentData, setOrderFromAPI } = useOrderFlowStore()
  const { mutate: validateVoucher } = useValidateVoucher()
  const { mutate: updateVoucherInOrder } = useUpdateVoucherInOrder()
  const { pagination } = usePagination()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [localVoucherList, setLocalVoucherList] = useState<IVoucher[]>([])
  const [selectedVoucher, setSelectedVoucher] = useState<string>('')
  const [inputValue, setInputValue] = useState<string>('')
  // Pagination state for load more
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const storeOrderSlug = paymentData?.orderSlug
  const storedOrderDataSlug = paymentData?.orderData?.slug
  const storedVoucherSlug = paymentData?.orderData?.voucher?.slug || null
  const storedUpdatedAt =
    (paymentData?.orderData as { updatedAt?: string })?.updatedAt || null

  useEffect(() => {
    if (!order || !storeOrderSlug) return
    if (storeOrderSlug !== order.slug) return

    const currentVoucherSlug = order.voucher?.slug || null
    const currentUpdatedAt = (order as { updatedAt?: string })?.updatedAt || null
    const shouldSync =
      !paymentData?.orderData ||
      storedOrderDataSlug !== order.slug ||
      storedVoucherSlug !== currentVoucherSlug ||
      (storedUpdatedAt && currentUpdatedAt ? storedUpdatedAt !== currentUpdatedAt : false)

    if (shouldSync) {
      setOrderFromAPI(order)
    }
  }, [
    order,
    paymentData?.orderData,
    setOrderFromAPI,
    storeOrderSlug,
    storedOrderDataSlug,
    storedUpdatedAt,
    storedVoucherSlug,
  ])

  const orderData = paymentData?.orderData || order || null
  const voucher = orderData?.voucher || null

  // Ưu tiên method đang được chọn trong store, sau đó fallback sang method đầu tiên của voucher
  const paymentMethod = useMemo(() => {
    if (paymentData?.paymentMethod) return paymentData.paymentMethod
    if (voucher?.voucherPaymentMethods?.length && voucher.voucherPaymentMethods.length > 0) {
      return voucher.voucherPaymentMethods[0].paymentMethod
    }
    return undefined
  }, [paymentData?.paymentMethod, voucher?.voucherPaymentMethods])

  // const displayItems = calculateOrderItemDisplay(orderData?.orderItems || [], voucher) // Không dùng nữa vì tính từ nonGiftOrderItems

  // 1. Owner là khách hàng có tài khoản (Lấy theo userInfo của nhân viên)
  const isCustomerOwner =
    !!orderData?.owner &&
    orderData.owner.role.name === Role.CUSTOMER &&
    orderData.owner.phonenumber !== 'default-customer';

  const nonGiftOrderItems = useMemo(() => {
    return (orderData?.orderItems || []).filter(item => {
      const legacyGiftFlag = (item as { isGift?: boolean }).isGift
      const productGiftFlag = (item.variant?.product as { isGift?: boolean })?.isGift
      return !(legacyGiftFlag ?? productGiftFlag)
    })
  }, [orderData?.orderItems])

  // ✅ Tính minOrderValue chỉ từ nonGiftOrderItems (không tính gift items)
  const minOrderValue = useMemo(() => {
    return nonGiftOrderItems.reduce((total, item) => {
      const original = item.variant.price || 0
      // Tính promotion discount từ promotion.value (IOrderDetail không có promotionDiscount property)
      const promotionDiscount = item.promotion?.value
        ? original * item.quantity * (item.promotion.value / 100)
        : 0
      return total + (original * item.quantity - promotionDiscount)
    }, 0)
  }, [nonGiftOrderItems])

  const voucherForOrderRequestParam: IGetAllVoucherRequest = useMemo(() => ({
    hasPaging: true,
    page: currentPage,
    size: pagination.pageSize,
    ...(isCustomerOwner ? { user: orderData?.owner?.slug || '' } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    minOrderValue: minOrderValue,
    orderItems: nonGiftOrderItems.map(item => ({
      quantity: item.quantity,
      variant: item.variant.slug,
      promotion: item.promotion ? item.promotion.slug : '',
      order: item.slug || '',
    })),
  }), [currentPage, pagination.pageSize, isCustomerOwner, orderData?.owner?.slug, paymentMethod, minOrderValue, nonGiftOrderItems])

  const { data: voucherList, refetch: refetchVoucherList } = useVouchersForOrder(
    voucherForOrderRequestParam,
    !!sheetOpen
  );

  const { data: specificVoucher, refetch: refetchSpecificVoucher } = useSpecificVoucher(
    {
      code: inputValue
    },
    !!sheetOpen && !!inputValue && inputValue.trim().length > 0
  )

  const isVoucherSelected = (voucherSlug: string) => {
    // Nếu user đã chọn voucher mới, chỉ hiển thị voucher đó là selected
    if (selectedVoucher && selectedVoucher !== '') {
      return selectedVoucher === voucherSlug
    }
    // Nếu chưa chọn voucher mới, hiển thị voucher hiện tại của order
    return orderData?.voucher?.slug === voucherSlug
  }

  const handleCompleteSelection = async () => {
    if (!orderData) return

    const orderSlug = orderData.slug

    // Nếu không có voucher nào được chọn, xóa voucher hiện tại nếu có
    if (!selectedVoucher) {
      if (orderData.voucher && orderData.voucher !== null) {
        const orderItemsPayload = orderData.orderItems.map((item) => ({
          quantity: item.quantity,
          variant: item.variant.slug,
          note: item.note,
          promotion: item.promotion ? item.promotion.slug : null,
        }))

        const successCallback = () => {
          showToast(tToast('toast.removeVoucherSuccess'))
          if (isCustomerOwner) {
            refetchVoucherList()
          } else if (userInfo) {
            refetchVoucherList()
          }
          setSelectedVoucher('') // Clear selected voucher state
          setSheetOpen(false)
          onSuccess()
        }
        // For logged in users
        updateVoucherInOrder({
          slug: orderSlug,
          voucher: null,
          orderItems: orderItemsPayload
        }, {
          onSuccess: successCallback,
        })
        return
      } else {
        setSheetOpen(false)
      }
      return
    }

    // Tìm voucher được chọn
    const selectedVoucherData = localVoucherList.find(v => v.slug === selectedVoucher)

    if (!selectedVoucherData) {
      showErrorToast(1000)
      return
    }

    // Kiểm tra lại voucher có hợp lệ không trước khi apply
    if (!isVoucherValid(selectedVoucherData)) {
      showToast(t('voucher.notValid'))
      setSelectedVoucher('') // Reset selection
      return
    }

    // Nếu voucher được chọn giống với voucher hiện tại, chỉ đóng sheet
    if (orderData.voucher?.slug === selectedVoucher) {
      setSheetOpen(false)
      return
    }

    const orderItemsParam = orderData.orderItems.map((item) => ({
      quantity: item.quantity,
      variant: item.variant.slug,
      note: item.note,
      promotion: item.promotion ? item.promotion.slug : null,
    }))

    const successCallback = () => {
      if (userInfo) {
        refetchVoucherList()
      } else {
        refetchVoucherList()
      }
      setSheetOpen(false)
      showToast(tToast('toast.applyVoucherSuccess'))
      onSuccess()
    }

    const errorCallback = () => {
      showErrorToast(1000)
    }
    const validateVoucherParam: IValidateVoucherRequest = {
      voucher: selectedVoucherData.slug,
      user: isCustomerOwner ? orderData.owner.slug : userInfo?.slug || '',
      orderItems: orderData.orderItems.map((item) => ({
        quantity: item.quantity,
        variant: item.variant.slug,
        note: item.note,
        promotion: item.promotion ? item.promotion.slug : null,
      }))
    }

    validateVoucher(validateVoucherParam, {
      onSuccess: () => {
        updateVoucherInOrder({
          slug: orderSlug,
          voucher: selectedVoucherData.slug,
          orderItems: orderItemsParam
        }, {
          onSuccess: successCallback,
          onError: errorCallback
        })
      },
      onError: () => {
        showErrorToast(1000)
      }
    })
  }

  // Set initial selected voucher when order has a voucher OR when sheet opens
  useEffect(() => {
    if (sheetOpen) {
      // Reset input value mỗi khi mở sheet
      setInputValue('')

      if (orderData?.voucher && orderData.voucher !== null) {
        const slug = orderData.voucher.slug
        setSelectedVoucher(slug)

        if (orderData.voucher.isPrivate) {
          refetchSpecificVoucher()
        }
      } else {
        setSelectedVoucher('')
      }
    }
  }, [orderData?.voucher, refetchSpecificVoucher, sheetOpen])

  // Clear selectedVoucher when orderData.voucher becomes null (voucher removed)
  // But only if we're not in the middle of selecting a new voucher
  useEffect(() => {
    if (!orderData?.voucher && selectedVoucher && !sheetOpen) {
      setSelectedVoucher('')
    }
  }, [orderData?.voucher, selectedVoucher, sheetOpen])

  // check if specificVoucher is not null, then set the voucher list to the local voucher list
  useEffect(() => {
    const vouchers = [specificVoucher?.result].filter((v): v is IVoucher => !!v)

    if (vouchers.length > 0) {
      setLocalVoucherList(prevList => {
        const newList = [...(prevList || [])]
        vouchers.forEach(voucher => {
          const existingIndex = newList.findIndex(v => v.slug === voucher.slug)
          if (existingIndex === -1) {
            newList.unshift(voucher)
          }
        })
        return newList
      })

      // Nếu tìm thấy voucher từ input code, tự động select nó
      if (specificVoucher?.result && inputValue.trim() !== '') {
        setSelectedVoucher(specificVoucher.result.slug)
      }
    }
  }, [specificVoucher?.result, inputValue])

  // Accumulate vouchers from multiple pages
  useEffect(() => {
    const currentData = voucherList?.result

    if (!currentData) return

    // Only process data if it matches the current page (avoid stale data)
    // Nhưng nếu localVoucherList đang rỗng (khi mở sheet mới), cho phép update để tránh trường hợp
    // cached data từ page khác ngăn không cho hiển thị danh sách khi mở lại sheet
    if (currentData.page !== currentPage) {
      // Chỉ bỏ qua nếu list đã có data (đang ở giữa pagination)
      // Nếu list rỗng, cho phép update để hiển thị data (kể cả page không khớp do cache)
      if (localVoucherList.length > 0) return
    }

    // Update hasMore based on API response
    setHasMore(currentData.hasNext || false)
    setIsLoadingMore(false)

    // If it's page 1 or list is empty (force update when reopening sheet), replace the list; otherwise append
    if (currentPage === 1 || localVoucherList.length === 0) {
      let newList = [...(currentData.items || [])]

      // Add specific voucher from search
      if (specificVoucher?.result) {
        const existingIndex = newList.findIndex(v => v.slug === specificVoucher.result.slug)
        if (existingIndex === -1) {
          newList = [specificVoucher.result, ...newList]
        }
      }

      // Add current voucher from order if it exists and not already in list
      if (orderData?.voucher) {
        const existingIndex = newList.findIndex(v => v.slug === orderData.voucher!.slug)
        if (existingIndex === -1) {
          newList = [orderData.voucher, ...newList]
        }
      }

      setLocalVoucherList(newList)
    } else {
      // Append new items to existing list
      setLocalVoucherList(prevList => {
        const newItems = currentData.items || []
        const combined = [...prevList, ...newItems]
        // Remove duplicates based on slug
        const unique = combined.filter((v, index, self) =>
          index === self.findIndex(t => t.slug === v.slug)
        )
        // Add specific vouchers if needed
        if (specificVoucher?.result) {
          const existingIndex = unique.findIndex(v => v.slug === specificVoucher.result.slug)
          if (existingIndex === -1) {
            unique.unshift(specificVoucher.result)
          }
        }
        if (orderData?.voucher) {
          const existingIndex = unique.findIndex(v => v.slug === orderData.voucher!.slug)
          if (existingIndex === -1) {
            unique.unshift(orderData.voucher)
          }
        }
        return unique
      })
    }
  }, [voucherList?.result, currentPage, specificVoucher?.result, orderData?.voucher, localVoucherList.length])

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || !sheetOpen) return
    setIsLoadingMore(true)
    setCurrentPage(prev => prev + 1)
  }, [isLoadingMore, hasMore, sheetOpen])

  // Reset pagination and voucher list when sheet opens
  useEffect(() => {
    if (sheetOpen) {
      // Reset pagination
      setCurrentPage(1)
      setHasMore(true)
      setIsLoadingMore(false)
      // Reset voucher list để lấy danh sách mới nhất
      setLocalVoucherList([])

      // Không cần invalidate hoặc refetch thủ công ở đây vì:
      // - React Query sẽ tự động refetch khi enabled thay đổi từ false -> true
      // - Invalidate hoặc refetch thủ công sẽ gây gọi API 2 lần (1 lần từ enabled, 1 lần từ invalidate/refetch)
      // - Chỉ cần reset localVoucherList và pagination, React Query sẽ tự fetch khi enabled = true
    }
  }, [sheetOpen])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (sheetOpen) {
      setCurrentPage(1)
      setHasMore(true)
      setIsLoadingMore(false)
      // Don't clear list here - let the accumulate effect handle it when new data arrives
    }
  }, [sheetOpen, minOrderValue, nonGiftOrderItems, paymentMethod, isCustomerOwner])

  // check if voucher is private and user is logged in, then refetch specific voucher
  useEffect(() => {
    if (userInfo && specificVoucher?.result?.isPrivate) {
      refetchSpecificVoucher()
    }
  }, [
    userInfo,
    specificVoucher?.result?.isPrivate,
    refetchSpecificVoucher
  ])

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    showToast(tToast('toast.copyCodeSuccess'))
  }

  const getUsageFrequencyText = (voucher: IVoucher) => {
    if (!voucher.usageFrequencyUnit || !voucher.usageFrequencyValue) return null

    const unitText =
      voucher.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.HOUR
        ? t('voucher.hour')
        : voucher.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.DAY
          ? t('voucher.day')
          : voucher.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.WEEK
            ? t('voucher.week')
            : voucher.usageFrequencyUnit === VOUCHER_USAGE_FREQUENCY_UNIT.MONTH
              ? t('voucher.month')
              : t('voucher.year')

    return `${voucher.usageFrequencyValue} ${t('voucher.times')}/${unitText}`
  }

  const isVoucherValid = useCallback((voucher: IVoucher) => {
    // Nếu voucher đang được áp dụng cho đơn hàng, vẫn coi là hợp lệ (cho phép giữ voucher)
    const isCurrentlyApplied = orderData?.voucher?.slug === voucher.slug

    // Nếu voucher đang được áp dụng, bỏ qua một số validation để cho phép hiển thị ở khu vực hợp lệ
    if (isCurrentlyApplied) {
      return true
    }

    // Tính minOrderValue chỉ từ nonGiftOrderItems
    const currentMinOrderValue = nonGiftOrderItems.reduce((total, item) => {
      const original = item.variant.price || 0
      // Tính promotion discount từ promotion.value (IOrderDetail không có promotionDiscount property)
      const promotionDiscount = item.promotion?.value
        ? original * item.quantity * (item.promotion.value / 100)
        : 0
      return total + (original * item.quantity - promotionDiscount)
    }, 0)

    const isValidAmount =
      voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
        ? true
        : (voucher?.minOrderValue || 0) <= currentMinOrderValue
    const isActive = voucher.isActive
    const isExpired = isVoucherExpired(voucher)
    const isInActiveWindow = isVoucherInActiveTimeWindow(voucher)
    const hasUsage = (voucher.remainingUsage || 0) > 0
    // Check if voucher has voucherProducts and if cart items match
    const hasValidProducts = (() => {
      // If voucher doesn't have voucherProducts or it's empty, return false
      if (!voucher.voucherProducts || voucher.voucherProducts.length === 0) {
        return false
      }

      // If cart is empty, return false
      if (!nonGiftOrderItems || nonGiftOrderItems.length === 0) {
        return false
      }

      // Chỉ check với nonGiftOrderItems (không tính gift items)
      const voucherProductSlugs = voucher.voucherProducts.map(vp => vp.product.slug)

      const cartProductSlugs = nonGiftOrderItems.reduce((acc, item) => {
        if (item.variant.product.slug) acc.push(item.variant.product.slug) // Slug của product
        return acc
      }, [] as string[])
      return isVoucherApplicableToCartItems(
        cartProductSlugs,
        voucherProductSlugs,
        voucher.applicabilityRule
      )
    })()

    const sevenAmToday = moment().set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
    const isValidDate = sevenAmToday.isSameOrBefore(moment(voucher.endDate));
    const requiresIdentity = voucher.isVerificationIdentity === true
    const hasValidIdentity = isCustomerOwner // Chỉ coi là valid khi owner là khách có tài khoản
    const isIdentityValid = !requiresIdentity || (requiresIdentity && hasValidIdentity)
    return isActive && !isExpired && hasUsage && isValidAmount && isValidDate && isIdentityValid && hasValidProducts && isInActiveWindow
  }, [nonGiftOrderItems, isCustomerOwner, orderData?.voucher?.slug])

  // Auto-deselect voucher if it becomes invalid (out of stock or other conditions)
  useEffect(() => {
    if (selectedVoucher && localVoucherList.length > 0) {
      const currentSelectedVoucher = localVoucherList.find(v => v.slug === selectedVoucher)

      if (currentSelectedVoucher && !isVoucherValid(currentSelectedVoucher)) {
        // Không deselect nếu voucher đang được áp dụng cho đơn hàng
        const isCurrentlyApplied = orderData?.voucher?.slug === currentSelectedVoucher.slug
        if (isCurrentlyApplied) {
          return
        }

        // Auto-deselect invalid voucher
        setSelectedVoucher('')

        // Show warning notification - use showToast instead of showErrorToast for messages
        if (currentSelectedVoucher.remainingUsage === 0) {
          showToast(t('voucher.outOfStock'))
        } else {
          showToast(t('voucher.becameInvalid'))
        }
      }
    }
  }, [selectedVoucher, localVoucherList, t, isVoucherValid, orderData?.voucher?.slug])

  const getVoucherErrorMessage = (voucher: IVoucher) => {
    // Chỉ tính với nonGiftOrderItems (không tính gift items)
    const cartProductSlugs = nonGiftOrderItems?.map((item) => item.variant.product.slug) || []
    const voucherProductSlugs = voucher.voucherProducts?.map((vp) => vp.product.slug) || []

    const allCartProductsInVoucher = cartProductSlugs.every((slug: string) => voucherProductSlugs.includes(slug))
    const hasAnyCartProductInVoucher = cartProductSlugs.some((slug: string) => voucherProductSlugs.includes(slug))

    // Tính subTotalAfterPromotion chỉ từ nonGiftOrderItems
    const subTotalAfterPromotion = nonGiftOrderItems.reduce((total, item) => {
      const original = item.variant.price || 0
      // Tính promotion discount từ promotion.value (IOrderDetail không có promotionDiscount property)
      const promotionDiscount = item.promotion?.value
        ? original * item.quantity * (item.promotion.value / 100)
        : 0
      return total + (original * item.quantity - promotionDiscount)
    }, 0)
    const isCurrentlyApplied = orderData?.voucher?.slug === voucher.slug

    const errorChecks: Array<{ condition: boolean; message: string }> = [
      {
        condition: !!voucher.isVerificationIdentity && !isCustomerOwner,
        message: t('voucher.needVerifyIdentity'),
      },
      {
        condition: isVoucherExpired(voucher),
        message: t('voucher.expired'),
      },
      {
        condition: !isVoucherInActiveTimeWindow(voucher),
        message: voucher.activeStartTime && voucher.activeEndTime
          ? t('voucher.notInActiveTimeWindow', {
              start: voucher.activeStartTime,
              end: voucher.activeEndTime,
            })
          : t('voucher.invalidVoucher'),
      },
      {
        condition: voucher.remainingUsage === 0 && !isCurrentlyApplied,
        message: t('voucher.outOfStock'),
      },
      {
        condition:
          voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
          voucher.minOrderValue > subTotalAfterPromotion,
        message: t('voucher.minOrderNotMet'),
      },
      {
        condition:
          (voucher.voucherProducts?.length || 0) > 0 &&
          voucher.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED &&
          !allCartProductsInVoucher,
        message: t('voucher.requireOnlyApplicableProducts'),
      },
      {
        condition:
          (voucher.voucherProducts?.length || 0) > 0 &&
          voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED &&
          !hasAnyCartProductInVoucher,
        message: t('voucher.requireSomeApplicableProducts'),
      },
    ]

    const firstError = errorChecks.find(error => error.condition)
    return firstError?.message || ''
  }

  const renderVoucherCard = (voucher: IVoucher) => {
    const usagePercentage = (voucher.remainingUsage / voucher.maxUsage) * 100

    // Hiển thị thời gian theo endDate thực tế (cho badge)
    const expiryTextForBadge = (endDate: string) => {
      const now = moment()
      const end = moment.utc(endDate).local() // Convert UTC to local timezone
      const diff = moment.duration(end.diff(now))

      if (diff.asSeconds() <= 0) {
        // Hết hạn thì fix cứng 0h 0m
        return t('voucher.expiresInHoursMinutes', { hours: 0, minutes: 0 })
      }

      if (diff.asHours() < 24) {
        // Dưới 24h: hiển thị "X giờ Y phút"
        const hours = Math.floor(diff.asHours())
        const minutes = Math.floor(diff.asMinutes()) % 60
        return t('voucher.expiresInHoursMinutes', { hours, minutes })
      }

      // Từ 24h trở lên: hiển thị "X ngày Y giờ Z phút"
      const days = Math.floor(diff.asDays())
      const hours = Math.floor(diff.asHours()) % 24
      const minutes = Math.floor(diff.asMinutes()) % 60
      return t('voucher.expiresInDaysHoursMinutes', { days, hours, minutes })
    }

    // Hiển thị thời gian cộng thêm 30 phút (cho list - có thể dùng sau)
    // const _expiryText = (endDate: string) => {
    //   const now = moment()
    //   const end = moment.utc(endDate).local().add(30, 'minutes') // Cộng thêm 30 phút
    //   const diff = moment.duration(end.diff(now))

    //   if (diff.asSeconds() <= 0) {
    //     // Hết hạn thì fix cứng 0h 0m
    //     return t('voucher.expiresInHoursMinutes', { hours: 0, minutes: 0 })
    //   }

    //   if (diff.asHours() < 24) {
    //     // Dưới 24h: hiển thị "X giờ Y phút"
    //     const hours = Math.floor(diff.asHours())
    //     const minutes = Math.floor(diff.asMinutes()) % 60
    //     return t('voucher.expiresInHoursMinutes', { hours, minutes })
    //   }

    //   // Từ 24h trở lên: hiển thị "X ngày Y giờ Z phút"
    //   const days = Math.floor(diff.asDays())
    //   const hours = Math.floor(diff.asHours()) % 24
    //   const minutes = Math.floor(diff.asMinutes()) % 60
    //   return t('voucher.expiresInDaysHoursMinutes', { days, hours, minutes })
    // }
    const isValid = isVoucherValid(voucher)
    const errorMessage = getVoucherErrorMessage(voucher)
    const isOutOfStockError = errorMessage === t('voucher.outOfStock')
    const isSelected = isVoucherSelected(voucher.slug)
    const isSelectedButInvalid = isSelected && !isValid
    const isCurrentlyApplied = orderData?.voucher?.slug === voucher.slug

    const baseCardClass = `grid h-40 grid-cols-8 gap-2 p-2 rounded-md sm:h-36 relative
    ${isSelected
        ? isSelectedButInvalid
          ? `bg-destructive/10 border-destructive`
          : `bg-${getTheme() === 'light' ? 'primary/10' : 'black'} border-primary`
        : `${getTheme() === 'light' ? 'bg-white' : 'border'}`
      }
    border border-muted-foreground/50
    ${voucher.remainingUsage === 0 && !isCurrentlyApplied ? 'opacity-50' : ''}
    ${!isValid && !isSelected && !isCurrentlyApplied ? 'opacity-60' : ''}
  `

    // const needsLogin = voucher.isVerificationIdentity && !orderDraft?.ownerPhoneNumber
    // const isVoucherUsable = isVoucherValid(voucher) && !needsLogin


    return (
      <div className={baseCardClass} key={voucher.slug}>
        {/* Overlay mờ cho voucher không hợp lệ - NHƯNG KHÔNG áp dụng cho voucher đang được sử dụng */}
        {!isValid && !isCurrentlyApplied && (
          <div className="absolute inset-0 z-10 rounded-md pointer-events-none bg-muted-foreground/10" />
        )}
        <div
          className={`flex col-span-2 justify-center items-center w-full rounded-md bg-primary`}
        >
          <Ticket size={56} className="text-white" />
        </div>
        <div className="flex flex-col col-span-6 justify-between w-full">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-muted-foreground">
              {voucher.title}
            </span>
            <span className="text-xs text-muted-foreground/80">
              {t('voucher.minOrderValue')}: {formatCurrency(voucher.minOrderValue)}
            </span>
            <div className="flex gap-2 items-center">
              <span className="text-xs italic text-destructive">
                {errorMessage}
              </span>
              {voucher.isVerificationIdentity && !isCustomerOwner && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs text-primary"
                  onClick={() => {
                    // Redirect to login page or open login modal
                    // Implement based on your authentication flow
                  }}
                >
                  {t('voucher.loginToUse')}
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-between items-center">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-xs text-muted-foreground">
                {isOutOfStockError
                  ? <span className="text-xs italic text-destructive">
                    {t('voucher.outOfStock')}
                  </span>
                  : `${t('voucher.remainingUsage')}: ${Math.round(usagePercentage)}%`}
              </span>
              {(voucher.remainingUsage > 0 || isCurrentlyApplied) && (
                <Progress value={usagePercentage} className="h-1" />
              )}
            </div>
            <Checkbox
              id={voucher.slug}
              checked={selectedVoucher === voucher.slug}
              onCheckedChange={(checked) => {
                setSelectedVoucher(checked ? voucher.slug : '')
              }}
              disabled={(!isValid || voucher.remainingUsage === 0) && !isCurrentlyApplied}
              className="w-5 h-5 rounded-full"
            />
          </div>
          <div className="flex gap-2 items-center w-full">
            <Badge variant="outline" className="text-xs font-normal truncate text-primary border-primary w-fit">
              {expiryTextForBadge(voucher.endDate)}
            </Badge>
            {!isMobile ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-thin text-muted-foreground/80">
                      {t('voucher.condition')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className={`w-[18rem] p-4 bg-${getTheme() === 'light' ? 'white' : 'black'} rounded-md text-muted-foreground shadow-md`}
                  >
                    <div className="flex flex-col gap-4 justify-between">
                      <div className="grid grid-cols-5">
                        <span className="col-span-2 text-muted-foreground/70">
                          {t('voucher.code')}
                        </span>
                        <span className="flex col-span-3 gap-1 items-center">
                          {voucher.code}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4"
                            onClick={() => handleCopyCode(voucher?.code)}
                          >
                            <Copy className="w-4 h-4 text-primary" />
                          </Button>
                        </span>
                      </div>
                      <div className="grid grid-cols-5">
                        <span className="col-span-2 text-muted-foreground/70">
                          {t('voucher.endDate')}
                        </span>
                        <span className="col-span-3">
                          {moment(voucher.endDate).format('HH:mm DD/MM/YYYY')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground/70">
                          {t('voucher.condition')}
                        </span>
                        <ul className="col-span-3 pl-4 list-disc">
                          <li>
                            {t('voucher.minOrderValue')}:{' '}
                            {formatCurrency(voucher.minOrderValue)}
                          </li>
                          {voucher.isVerificationIdentity && (
                            <li>
                              {t('voucher.needVerifyIdentity')}
                            </li>
                          )}
                          {voucher.numberOfUsagePerUser && (
                            <li>
                              {t('voucher.numberOfUsagePerUser')}:{' '}
                              {voucher.numberOfUsagePerUser}
                            </li>
                          )}
                          {voucher.voucherProducts && voucher.voucherProducts.length > 0 && (
                            <li>
                              {t('voucher.products')}: {voucher.voucherProducts.map(vp => vp.product.name).join(', ')}
                            </li>
                          )}
                          {voucher.maxItems && voucher.maxItems > 0 && (
                            <li>
                              {t('voucher.maxItemsDetail', { value: voucher.maxItems })}
                            </li>
                          )}
                          {getUsageFrequencyText(voucher) && (
                            <li>
                              {t('voucher.usageFrequencyUnit')}: {getUsageFrequencyText(voucher)}
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="text-xs font-thin text-muted-foreground/80">
                    {t('voucher.condition')}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  className={`mr-2 w-[20rem] p-4 bg-${getTheme() === 'light' ? 'white' : 'black'} rounded-md text-muted-foreground shadow-md`}
                >
                  <div className="flex flex-col gap-4 justify-between text-xs sm:text-sm">
                    <div className="grid grid-cols-5">
                      <span className="col-span-2 text-muted-foreground/70">
                        {t('voucher.code')}
                      </span>
                      <span className="flex col-span-3 gap-1 items-center">
                        {voucher.code}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-4 h-4"
                          onClick={() => handleCopyCode(voucher?.code)}
                        >
                          <Copy className="w-4 h-4 text-primary" />
                        </Button>
                      </span>
                    </div>
                    <div className="grid grid-cols-5">
                      <span className="col-span-2 text-muted-foreground/70">
                        {t('voucher.endDate')}
                      </span>
                      <span className="col-span-3">
                        {moment(voucher.endDate).format('HH:mm DD/MM/YYYY')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground/70">
                        {t('voucher.condition')}
                      </span>
                      <ul className="col-span-3 pl-4 list-disc">
                        <li>
                          {t('voucher.minOrderValue')}:{' '}
                          {formatCurrency(voucher.minOrderValue)}
                        </li>
                        {voucher.isVerificationIdentity && (
                          <li>
                            {t('voucher.needVerifyIdentity')}
                          </li>
                        )}
                        {voucher.numberOfUsagePerUser && (
                          <li>
                            {t('voucher.numberOfUsagePerUser')}:{' '}
                            {voucher.numberOfUsagePerUser}
                          </li>
                        )}
                        {voucher.voucherProducts && voucher.voucherProducts.length > 0 && (
                          <li>
                            {t('voucher.products')}: {voucher.voucherProducts.map(vp => vp.product.name).join(', ')}
                          </li>
                        )}
                        {voucher.maxItems && voucher.maxItems > 0 && (
                          <li>
                            {t('voucher.maxItemsDetail', { value: voucher.maxItems })}
                          </li>
                        )}
                        {getUsageFrequencyText(voucher) && (
                          <li>
                            {t('voucher.usageFrequencyUnit')}: {getUsageFrequencyText(voucher)}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

        </div>
      </div>
    )
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="px-0 mt-3 w-full bg-primary/15 hover:bg-primary/20">
          <div className="flex gap-3 items-center p-2 w-full rounded-md cursor-pointer">
            <div className="flex gap-1 items-center">
              <TicketPercent className="icon text-primary" />
              <span className="text-xs text-muted-foreground">
                {t('voucher.useVoucher')}
              </span>
            </div>
            {/* {orderDraft?.voucher && (
              <div className="flex justify-start w-full">
                <span className="px-2 py-[0.1rem] text-[0.5rem] xl:text-xs font-semibold text-white rounded-full bg-primary/60">
                  -{`${formatCurrency(orderDraft?.voucher?.value || 0)}`}
                </span>
              </div>
            )} */}
            {/* {orderDraft?.voucher && (
              <div className="flex justify-start w-full">
                <div className="flex gap-2 items-center w-full">
                  <span className="px-2 py-[0.1rem] text-[0.5rem] xl:text-xs font-semibold text-white rounded-full bg-primary/60">
                    -{`${formatCurrency(discount || 0)}`}
                  </span>
                </div>
              </div>
            )} */}
            <div>
              <ChevronRight className="icon text-muted-foreground" />
            </div>
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('voucher.list')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-transparent backdrop-blur-md">
          <ScrollArea
            className={`min-h-0 flex-1 gap-4 p-4 bg-${getTheme() === 'light' ? 'white' : 'black'}`}
            style={{ maxHeight: viewportHeight > 0 ? `${viewportHeight - 8 * 16}px` : undefined }}
          >
            {/* Voucher search */}
            <div className="flex flex-col flex-1">
              <div className="grid grid-cols-1 gap-2 items-center">
                <div className="relative p-1">
                  <TicketPercent className="absolute left-2 top-1/2 text-gray-400 -translate-y-1/2" />
                  <Input
                    placeholder={t('voucher.enterVoucher')}
                    className="pl-10"
                    onChange={(e) => setInputValue(e.target.value)}
                    value={inputValue}
                  />
                </div>
              </div>
            </div>
            {/* Voucher list */}
            <div>
              <div className="flex justify-between items-center py-4">
                <Label className="text-md text-muted-foreground">
                  {t('voucher.list')}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t('voucher.maxApply')}: 1
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 pb-4">
                {localVoucherList && localVoucherList.length > 0 ? (
                  (() => {
                    // Sắp xếp voucher: hợp lệ trước, không hợp lệ sau
                    const validVouchers = localVoucherList.filter(voucher => isVoucherValid(voucher))
                    const invalidVouchers = localVoucherList.filter(voucher => !isVoucherValid(voucher))

                    return (
                      <>
                        {/* Voucher hợp lệ */}
                        {validVouchers.length > 0 ? (
                          validVouchers.map((voucher) =>
                            renderVoucherCard(voucher)
                          )
                        ) : (
                          <div className="py-4 text-center text-muted-foreground">
                            {t('voucher.noVoucher')}
                          </div>
                        )}

                        {/* Voucher không khả dụng */}
                        {invalidVouchers.length > 0 && (
                          <>
                            <div className="flex items-center py-2 mt-4">
                              <Label className="text-sm text-muted-foreground/70">
                                {t('voucher.invalidVoucher')}
                              </Label>
                            </div>
                            {invalidVouchers.map((voucher) =>
                              renderVoucherCard(voucher)
                            )}
                          </>
                        )}
                      </>
                    )
                  })()
                ) : (
                  <div>{t('voucher.noVoucher')}</div>
                )}
              </div>
              {/* Load More Button */}
              {hasMore && localVoucherList.length > 0 && (
                <div className="flex justify-center py-4">
                  <Button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {isLoadingMore ? t('voucher.loading') || 'Đang tải...' : t('voucher.loadMore') || 'Tải thêm'}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button
              className="w-full"
              onClick={handleCompleteSelection}
              disabled={!!selectedVoucher && localVoucherList.length > 0 &&
                (() => {
                  const selected = localVoucherList.find(v => v.slug === selectedVoucher)
                  return selected ? !isVoucherValid(selected) : false
                })()
              }
            >
              {t('voucher.complete')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
