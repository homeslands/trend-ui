import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
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
} from '@/components/ui'
import {
  useIsMobile,
  usePagination,
  useViewportHeight,
  useSpecificVoucher,
  useValidateVoucher,
  useVouchersForOrder,
  useDebouncedValue,
} from '@/hooks'
import { formatCurrency, isVoucherApplicableToCartItems, showErrorToast, showToast } from '@/utils'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
import {
  IValidateVoucherRequest,
  IVoucher,
  IGetAllVoucherRequest,
} from '@/types'
import { useOrderFlowStore, useThemeStore, useUserStore } from '@/stores'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE, PaymentMethod, VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'

export default function StaffVoucherListSheetInUpdateOrderWithLocalStorage() {
  const isMobile = useIsMobile()
  const viewportHeight = useViewportHeight()
  const { getTheme } = useThemeStore()
  const { t } = useTranslation(['voucher'])
  const { t: tToast } = useTranslation('toast')
  const { userInfo } = useUserStore()
  const { updatingData, setDraftVoucher, removeDraftVoucher } = useOrderFlowStore()
  const { getUserInfo } = useUserStore()
  const { mutate: validateVoucher } = useValidateVoucher()
  // const { mutate: updateVoucherInOrder } = useUpdateVoucherInOrder()
  const { pagination } = usePagination()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [localVoucherList, setLocalVoucherList] = useState<IVoucher[]>([])
  const [selectedVoucher, setSelectedVoucher] = useState<string>('')
  const [appliedVoucher, setAppliedVoucher] = useState<string>('')
  const [removedVouchers, setRemovedVouchers] = useState<IVoucher[]>([])
  const isRemovingVoucherRef = useRef(false)
  // Pagination state for load more
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const voucher = updatingData?.updateDraft?.voucher || null
  const orderDraft = updatingData?.updateDraft

  // Ưu tiên method từ orderDraft, sau đó fallback method đầu tiên của voucher
  const paymentMethod = (
    (orderDraft?.paymentMethod as PaymentMethod | undefined) ??
    (voucher?.voucherPaymentMethods && voucher.voucherPaymentMethods.length > 0
      ? (voucher.voucherPaymentMethods[0].paymentMethod as PaymentMethod)
      : undefined)
  )

  // 1. Owner là khách hàng có tài khoản (Lấy theo userInfo của nhân viên)
  const isCustomerOwner =
    !!orderDraft?.owner &&
    orderDraft.ownerRole === Role.CUSTOMER &&
    orderDraft.ownerPhoneNumber !== 'default-customer';

  // Helper function để check xem item có phải là gift không
  // Sử dụng cùng logic filter isGift như trong update-order-content.tsx
  const isGiftItem = useCallback((item: { isGift?: boolean; product?: { isGift?: boolean }; variant?: { product?: { isGift?: boolean } } } | undefined) => {
    if (!item) return false
    return (
      item.isGift === true ||
      item.product?.isGift === true ||
      item.variant?.product?.isGift === true
    )
  }, [])

  // 💡 Step 2: Debounce orderItems để tránh spam API khi user đang chỉnh sửa
  // Tạo một key duy nhất từ orderItems để debounce (chỉ quantity, variant, promotion)
  // ✅ Tạo key để so sánh nội dung non-gift items (không phải reference)
  const nonGiftOrderItemsKey = useMemo(() => {
    const allItems = orderDraft?.orderItems || []
    const nonGiftItems = allItems.filter(item => !isGiftItem(item))
    return JSON.stringify(
      nonGiftItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        variant: item.variant?.slug,
        promotion: item.promotion?.slug,
        productSlug: item.productSlug,
        originalPrice: item.originalPrice,
        promotionDiscount: item.promotionDiscount,
      }))
    )
  }, [orderDraft?.orderItems, isGiftItem])

  // ✅ Memoize nonGiftOrderItems dựa trên key (chỉ tính lại khi nội dung thực sự thay đổi)
  const nonGiftOrderItems = useMemo(() => {
    const allItems = orderDraft?.orderItems || []
    return allItems.filter(item => !isGiftItem(item))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonGiftOrderItemsKey])

  // ✅ Tính minOrderValue chỉ từ nonGiftOrderItems (không tính gift items)
  const minOrderValue = useMemo(() => {
    return nonGiftOrderItems.reduce((total, item) => {
      const original = item.originalPrice || 0
      const promotionDiscount = item.promotionDiscount || 0
      return total + (original - promotionDiscount) * item.quantity
    }, 0)
  }, [nonGiftOrderItems])

  // ✅ Memoize orderItemsKey để tránh tính lại khi chỉ thêm gift items
  const orderItemsKey = useMemo(() => JSON.stringify(
    nonGiftOrderItems.map(item => ({
      quantity: item.quantity,
      variant: item.variant.slug,
      promotion: item.promotion ? item.promotion.slug : '',
    }))
  ), [nonGiftOrderItems])
  const debouncedOrderItemsKey = useDebouncedValue(orderItemsKey, 800)
  const debouncedMinOrderValue = useDebouncedValue(minOrderValue, 800)

  // 💡 Step 2: Tạo debounced voucherForOrderRequestParam để trigger refetch voucher list
  // Sử dụng useMemo để tạo param chỉ khi debouncedOrderItemsKey thay đổi
  const debouncedVoucherForOrderRequestParam: IGetAllVoucherRequest = useMemo(() => ({
    hasPaging: true,
    page: currentPage,
    size: pagination.pageSize,
    ...(isCustomerOwner ? { user: (orderDraft?.owner || getUserInfo()?.slug || '') } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    minOrderValue: debouncedMinOrderValue,
    orderItems: nonGiftOrderItems.map(item => ({
      quantity: item.quantity,
      variant: item.variant.slug,
      promotion: item.promotion ? item.promotion.slug : '',
      order: item.slug || '',
    })),
  }), [currentPage, pagination.pageSize, isCustomerOwner, orderDraft?.owner, nonGiftOrderItems, paymentMethod, getUserInfo, debouncedMinOrderValue])

  // 💡 Step 2: Dùng debounced param để refetch voucher list (chỉ khi sheet mở)
  // React Query sẽ tự động refetch khi debouncedVoucherForOrderRequestParam thay đổi
  const { data: voucherList } = useVouchersForOrder(
    sheetOpen ? debouncedVoucherForOrderRequestParam : undefined,
    !!sheetOpen
  );


  const { data: specificVoucher, refetch: refetchSpecificVoucher } = useSpecificVoucher(
    {
      code: selectedVoucher
    },
    !!sheetOpen && !!selectedVoucher && selectedVoucher.trim().length > 0
  )

  // Helper functions for voucher management
  const addVoucher = useCallback((voucher: IVoucher) => {
    setDraftVoucher(voucher)
  }, [setDraftVoucher])

  const removeVoucher = useCallback(() => {
    removeDraftVoucher()
  }, [removeDraftVoucher])

  const isVoucherSelected = useCallback((voucherSlug: string) => {
    return (
      orderDraft?.voucher?.slug === voucherSlug ||
      // selectedVoucher === voucherSlug
      appliedVoucher === voucherSlug
    )
  }, [orderDraft?.voucher?.slug, appliedVoucher])

  const handleToggleVoucher = useCallback((voucher: IVoucher) => {
    if (!orderDraft || !updatingData?.originalOrder) return

    // const orderSlug = updatingData.originalOrder.slug
    const isRemoving = isVoucherSelected(voucher.slug)

    if (isRemoving) {
      // Remove voucher - Update store immediately
      removeVoucher()
      setAppliedVoucher('')
      setSelectedVoucher('')

      // Add removed voucher to removedVouchers list to keep it available for reselection
      setRemovedVouchers(prev => {
        const existingIndex = prev.findIndex(v => v.slug === voucher.slug)
        if (existingIndex === -1) {
          return [voucher, ...prev]
        }
        return prev
      })

      // Remove voucher from order draft
      removeDraftVoucher()

      // Call API to update order with null voucher
      // updateVoucherInOrder({
      //   slug: orderSlug,
      //   voucher: null,
      //   orderItems: orderDraft.orderItems.map(item => ({
      //     quantity: item.quantity,
      //     variant: item.variant.slug,
      //     note: item.note,
      //     promotion: item.promotion ? item.promotion.slug : null,
      //   }))
      // }, {
      //   onSuccess: () => {
      //     showToast(tToast('toast.removeVoucherSuccess'))
      //   },
      //   onError: () => {
      //     // Rollback store changes on error
      //     addVoucher(voucher)
      //     setAppliedVoucher(voucher.slug)
      //     setSelectedVoucher(voucher.code)
      //     setRemovedVouchers(prev => prev.filter(v => v.slug !== voucher.slug))
      //     showErrorToast(1000)
      //   }
      // })
    } else {
      // Apply voucher - Check verification first
      if (voucher.isVerificationIdentity && !orderDraft.owner) {
        showErrorToast(1004) // Show error if voucher requires verification but no owner
        return
      }

      // Prepare parameters for validation
      const orderItemsParam = orderDraft.orderItems.map(item => ({
        quantity: item.quantity,
        variant: item.variant.slug,
        note: item.note,
        promotion: item.promotion ? item.promotion.slug : null,
      }))

      const validateVoucherParam: IValidateVoucherRequest = {
        voucher: voucher.slug,
        user: isCustomerOwner ? orderDraft.owner || '' : userInfo?.slug || '',
        orderItems: orderItemsParam
      }

      validateVoucher(validateVoucherParam, {
        onSuccess: () => {
          addVoucher(voucher)
          setAppliedVoucher(voucher.slug)
          setSelectedVoucher(voucher.code)
          setRemovedVouchers(prev => prev.filter(v => v.slug !== voucher.slug))
          setSheetOpen(false)
          showToast(tToast('toast.applyVoucherSuccess'))
        },
        onError: () => {
          showErrorToast(1000)
        }
      })
    }
  }, [orderDraft, updatingData?.originalOrder, isVoucherSelected, setAppliedVoucher, setSelectedVoucher, setRemovedVouchers, tToast, validateVoucher, addVoucher, removeVoucher, userInfo?.slug, isCustomerOwner, removeDraftVoucher])

  // 💡 Step 4: Auto-check voucher validity khi orderItems thay đổi (với debounce)
  // Chỉ check sau khi user dừng chỉnh sửa (800ms) để tránh remove quá sớm
  // ✅ Chỉ trigger khi orderItemsKey hoặc debouncedOrderItemsKey thay đổi (không trigger khi chỉ thêm gift)
  useEffect(() => {
    // Lấy orderDraft mới nhất từ store để tránh stale closure
    const currentOrderDraft = useOrderFlowStore.getState().updatingData?.updateDraft

    if (!currentOrderDraft?.voucher || !currentOrderDraft?.orderItems || isRemovingVoucherRef.current) {
      isRemovingVoucherRef.current = false
      return
    }

    // Chỉ check khi debouncedOrderItemsKey đã ổn định (user đã dừng chỉnh sửa)
    // Nếu orderItemsKey !== debouncedOrderItemsKey nghĩa là user vẫn đang chỉnh sửa
    if (orderItemsKey !== debouncedOrderItemsKey) {
      return
    }

    const { voucher } = currentOrderDraft
    // ✅ Chỉ tính với nonGiftOrderItems (không tính gift items)
    // Sử dụng cùng helper function isGiftItem đã được định nghĩa ở trên
    const nonGiftItems = currentOrderDraft.orderItems.filter(item => !isGiftItem(item))

    if (nonGiftItems.length === 0) {
      // Nếu không còn món nào (chỉ còn gift), remove voucher
      isRemovingVoucherRef.current = true
      // ✅ Sử dụng removeDraftVoucher trực tiếp thay vì handleToggleVoucher để tránh dependency
      removeDraftVoucher()
      setAppliedVoucher('')
      setSelectedVoucher('')
      return
    }

    const voucherProductSlugs = (voucher.voucherProducts?.map(vp => vp.product.slug) || []).filter((slug): slug is string => !!slug)
    // ✅ Chỉ tính với nonGiftOrderItems
    const cartProductSlugs = nonGiftItems
      .map(item => item.variant?.product?.slug || item.productSlug || '')
      .filter((slug): slug is string => !!slug)

    // ✅ Tính tổng tiền chỉ từ nonGiftOrderItems (sau promotion nhưng chưa áp voucher)
    const subtotalBeforeVoucher = nonGiftItems.reduce((acc, item) => {
      const original = item.originalPrice || 0
      const promotionDiscount = item.promotionDiscount || 0
      return acc + (original - promotionDiscount) * item.quantity
    }, 0)

    // ✅ Chỉ tính quantity từ nonGiftOrderItems
    const cartItemQuantity = nonGiftItems.reduce((total, item) => {
      return total + (item.quantity || 0)
    }, 0)

    let shouldRemove = false

    // Check applicability rule
    switch (voucher.applicabilityRule) {
      case APPLICABILITY_RULE.ALL_REQUIRED: {
        // ✅ Với ALL_REQUIRED: TẤT CẢ non-gift products trong cart PHẢI có trong voucher products
        // Nếu có bất kỳ non-gift product nào không có trong voucher products → remove
        const hasInvalidProducts = cartProductSlugs.some(slug => !voucherProductSlugs.includes(slug))
        if (hasInvalidProducts) {
          shouldRemove = true
        }
        break
      }
      case APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED: {
        // ✅ Với AT_LEAST_ONE_REQUIRED: ÍT NHẤT MỘT non-gift product trong cart phải có trong voucher products
        const hasAtLeastOne = cartProductSlugs.some(slug => voucherProductSlugs.includes(slug))
        if (!hasAtLeastOne) shouldRemove = true
        break
      }
      default:
        break
    }

    // Check minOrderValue (trừ type SAME_PRICE_PRODUCT)
    if (!shouldRemove && voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      if (subtotalBeforeVoucher < (voucher.minOrderValue || 0)) {
        shouldRemove = true
      }
    }

    if (!shouldRemove && voucher.maxItems && voucher.maxItems > 0) {
      if (cartItemQuantity > voucher.maxItems) {
        shouldRemove = true
      }
    }

    // Remove voucher nếu cần
    if (shouldRemove) {
      isRemovingVoucherRef.current = true
      // ✅ Sử dụng removeDraftVoucher trực tiếp thay vì handleToggleVoucher để tránh dependency
      removeDraftVoucher()
      // ✅ State setters là stable, không cần trong dependency nhưng vẫn dùng được
      setAppliedVoucher('')
      setSelectedVoucher('')
    }
    // ✅ Chỉ trigger khi orderItemsKey hoặc debouncedOrderItemsKey thay đổi
    // KHÔNG trigger khi orderDraft thay đổi (vì có thể chỉ là thêm gift items)
    // orderDraft được lấy từ store trong useEffect để tránh stale closure
    // ✅ Loại bỏ handleToggleVoucher khỏi dependency vì nó có orderDraft trong dependency
    // ✅ State setters (setAppliedVoucher, setSelectedVoucher) là stable, không cần trong dependency
    // ✅ isGiftItem là useCallback với empty dependency nên stable
  }, [orderItemsKey, debouncedOrderItemsKey, removeDraftVoucher, setAppliedVoucher, setSelectedVoucher, isGiftItem])

  // check if specificVoucher or specificPublicVoucher is not null, then set the voucher list to the local voucher list
  useEffect(() => {
    const vouchers = [specificVoucher?.result].filter((v): v is IVoucher => !!v)

    if (vouchers.length > 0) {
      setLocalVoucherList(prevList => {
        const newList = [...(prevList || [])];
        vouchers.forEach(voucher => {
          const existingIndex = newList.findIndex(v => v.slug === voucher.slug);
          if (existingIndex === -1) {
            newList.unshift(voucher);
          }
        });
        return newList;
      });
    }
  }, [userInfo, specificVoucher?.result]);

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

      // Add current voucher from order draft if it exists and not already in list
      if (orderDraft?.voucher) {
        const existingIndex = newList.findIndex(v => v.slug === orderDraft.voucher!.slug)
        if (existingIndex === -1) {
          newList = [orderDraft.voucher, ...newList]
        }
      }

      // Add removed vouchers back to list so user can reselect them
      removedVouchers.forEach(removedVoucher => {
        const existingIndex = newList.findIndex(v => v.slug === removedVoucher.slug)
        if (existingIndex === -1) {
          newList.push(removedVoucher)
        }
      })

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
        if (orderDraft?.voucher) {
          const existingIndex = unique.findIndex(v => v.slug === orderDraft.voucher!.slug)
          if (existingIndex === -1) {
            unique.unshift(orderDraft.voucher)
          }
        }
        // Add removed vouchers back
        removedVouchers.forEach(removedVoucher => {
          const existingIndex = unique.findIndex(v => v.slug === removedVoucher.slug)
          if (existingIndex === -1) {
            unique.push(removedVoucher)
          }
        })
        return unique
      })
    }
  }, [voucherList?.result, currentPage, specificVoucher?.result, orderDraft?.voucher, removedVouchers, localVoucherList.length])

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
  }, [sheetOpen, debouncedMinOrderValue, debouncedOrderItemsKey, paymentMethod, isCustomerOwner])

  useEffect(() => {
    if (orderDraft?.voucher) {
      const code = orderDraft.voucher.code;
      setSelectedVoucher(code);
      setAppliedVoucher(orderDraft.voucher.slug);

      if (orderDraft.voucher.isPrivate) {
        refetchSpecificVoucher();
      }
    } else {
      // Clear selected and applied voucher when cart voucher is removed
      setSelectedVoucher('');
      setAppliedVoucher('');
    }
  }, [orderDraft?.voucher, refetchSpecificVoucher]);

  // Auto-fetch current voucher when sheet opens if it's private
  useEffect(() => {
    if (sheetOpen && orderDraft?.voucher?.isPrivate && orderDraft.voucher.code) {
      setSelectedVoucher(orderDraft.voucher.code);
      refetchSpecificVoucher();
    }
  }, [sheetOpen, orderDraft?.voucher, refetchSpecificVoucher]);

  // Clear removed vouchers when sheet closes to avoid accumulating unnecessary vouchers
  useEffect(() => {
    if (!sheetOpen) {
      setRemovedVouchers([]);
    }
  }, [sheetOpen]);

  // check if voucher is private and user is logged in, then refetch specific voucher
  useEffect(() => {
    if (userInfo && specificVoucher?.result?.isPrivate) {
      refetchSpecificVoucher();
    }
  }, [
    userInfo,
    specificVoucher?.result?.isPrivate,
    refetchSpecificVoucher
  ]);

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

  const isVoucherValid = (voucher: IVoucher) => {
    // Nếu voucher đang được áp dụng cho đơn hàng, vẫn coi là hợp lệ (cho phép giữ voucher)
    const isCurrentlyApplied = orderDraft?.voucher?.slug === voucher.slug

    // Nếu voucher đang được áp dụng, bỏ qua một số validation để cho phép hiển thị ở khu vực hợp lệ
    if (isCurrentlyApplied) {
      return true
    }

    // Tính minOrderValue chỉ từ nonGiftOrderItems
    const currentMinOrderValue = nonGiftOrderItems.reduce((total, item) => {
      const original = item.originalPrice || 0
      const promotionDiscount = item.promotionDiscount || 0
      return total + (original - promotionDiscount) * item.quantity
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
        if (item.productSlug) acc.push(item.productSlug) // Slug của product
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
    const requiresLogin = voucher.isVerificationIdentity === true
    const isUserLoggedIn = !!orderDraft?.owner && orderDraft.ownerRole === Role.CUSTOMER
    const isIdentityValid = !requiresLogin || (requiresLogin && isUserLoggedIn)
    return isActive && !isExpired && hasUsage && isValidAmount && isValidDate && isIdentityValid && hasValidProducts && isInActiveWindow
  }

  // Filter and sort vouchers to get the best one
  // const getBestVoucher = () => {
  //   if (!Array.isArray(localVoucherList)) {
  //     return null
  //   }

  //   const currentDate = new Date()

  //   const validVouchers = localVoucherList
  //     .filter((voucher) => {
  //       const isValid = voucher.isActive &&
  //         moment(currentDate).isSameOrAfter(moment(voucher.startDate)) &&
  //         moment(currentDate).isSameOrBefore(moment(voucher.endDate)) &&
  //         voucher.remainingUsage > 0 &&
  //         (!userInfo ? voucher.isVerificationIdentity === false : true)
  //       return isValid
  //     })
  //     .sort((a, b) => {
  //       const endDateDiff = new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  //       if (endDateDiff !== 0) return endDateDiff
  //       if (a.minOrderValue !== b.minOrderValue) {
  //         return a.minOrderValue - b.minOrderValue
  //       }
  //       return b.value - a.value
  //     })

  //   return validVouchers.length > 0 ? validVouchers[0] : null
  // }

  // const bestVoucher = getBestVoucher()







  // const handleApplyVoucher = async () => {
  //   if (!selectedVoucher) return;

  //   if (appliedVoucher) {
  //     removeVoucher()
  //     setAppliedVoucher('')
  //     return
  //   }

  //   if (orderDraft?.ownerPhoneNumber) {
  //     const { data } = await refetchSpecificVoucher();
  //     const voucher = data?.result;

  //     if (voucher) {
  //       const validateVoucherParam: IValidateVoucherRequest = {
  //         voucher: voucher.slug,
  //         user: orderDraft?.owner || '',
  //       };

  //       validateVoucher(validateVoucherParam, {
  //         onSuccess: () => {
  //           addVoucher(voucher);
  //           setSheetOpen(false);
  //           showToast(tToast('toast.applyVoucherSuccess'));
  //         },
  //       });
  //     } else {
  //       showErrorToast(1000);
  //     }
  //   } else {
  //     const { data } = await refetchSpecificVoucher();
  //     const publicVoucher = data?.result;

  //     if (publicVoucher) {
  //       const validateVoucherParam: IValidateVoucherRequest = {
  //         voucher: publicVoucher.slug,
  //         user: '',
  //       };

  //       validatePublicVoucher(validateVoucherParam, {
  //         onSuccess: () => {
  //           addVoucher(publicVoucher);
  //           setSheetOpen(false);
  //           showToast(tToast('toast.applyVoucherSuccess'));
  //         },
  //       });
  //     } else {
  //       showErrorToast(1000);
  //     }
  //   }
  // };

  // const getVoucherErrorMessage = (voucher: IVoucher) => {
  //   if (voucher.isVerificationIdentity && !isCustomerOwner) {
  //     return t('voucher.needVerifyIdentity')
  //   }
  //   if (voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT && voucher.minOrderValue > ((cartTotals?.subTotalBeforeDiscount || 0) - (cartTotals?.promotionDiscount || 0))) {
  //     return t('voucher.minOrderNotMet')
  //   }
  //   if (voucher.remainingUsage === 0) {
  //     return t('voucher.outOfStock')
  //   }
  //   if (moment(voucher.endDate).isBefore(moment().set({ hour: 7, minute: 0, second: 0, millisecond: 0 }))) {
  //     return t('voucher.expired')
  //   }
  //   if (voucher.minOrderValue > (cartTotals?.subTotalBeforeDiscount || 0)) {
  //     return t('voucher.minOrderNotMet')
  //   }
  //   return ''
  // }

  const getVoucherErrorMessage = (voucher: IVoucher) => {
    // Chỉ tính với nonGiftOrderItems (không tính gift items)
    const cartProductSlugs = nonGiftOrderItems?.map((item) => item.productSlug || '') || []
    const voucherProductSlugs = voucher.voucherProducts?.map((vp) => vp.product?.slug) || []

    const allCartProductsInVoucher = cartProductSlugs.every(slug => voucherProductSlugs.includes(slug))
    const hasAnyCartProductInVoucher = cartProductSlugs.some(slug => voucherProductSlugs.includes(slug))

    // Tính subTotalAfterPromotion chỉ từ nonGiftOrderItems
    const subTotalAfterPromotion = nonGiftOrderItems.reduce((total, item) => {
      const original = item.originalPrice || 0
      const promotionDiscount = item.promotionDiscount || 0
      return total + (original - promotionDiscount) * item.quantity
    }, 0)

    // Kiểm tra xem voucher có đang được áp dụng cho đơn hàng không
    const isCurrentlyApplied = orderDraft?.voucher?.slug === voucher.slug

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
        // Chỉ báo hết hàng nếu voucher không đang được áp dụng
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
    // ✅ Kiểm tra xem voucher có đang được áp dụng cho đơn hàng không
    const isCurrentlyApplied = orderDraft?.voucher?.slug === voucher.slug

    const baseCardClass = `grid h-40 grid-cols-8 gap-2 p-2 rounded-md sm:h-36 relative
    ${isVoucherSelected(voucher.slug)
        ? `bg-${getTheme() === 'light' ? 'primary/10' : 'black'} border-primary`
        : `${getTheme() === 'light' ? 'bg-white' : 'border'}`
      }
    border border-muted-foreground/50
    ${voucher.remainingUsage === 0 && !isCurrentlyApplied ? 'opacity-50' : ''}
    ${!isValid && !isCurrentlyApplied ? 'opacity-60' : ''}
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
            <span className="text-xs italic text-destructive">
              {errorMessage}
            </span>
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
              {/* <div className="grid grid-cols-4 gap-2 items-center sm:grid-cols-5">
                <div className="relative col-span-3 p-1 sm:col-span-4">
                  <TicketPercent className="absolute left-2 top-1/2 text-gray-400 -translate-y-1/2" />
                  <Input
                    placeholder={t('voucher.enterVoucher')}
                    className="pl-10"
                    onChange={(e) => setSelectedVoucher(e.target.value)}
                    value={selectedVoucher}
                  />
                </div>
                <Button
                  className="col-span-1"
                  disabled={!selectedVoucher}
                  onClick={handleApplyVoucher}
                >
                  {t('voucher.apply')}
                </Button>
              </div> */}
              <div className="grid grid-cols-1 gap-2 items-center">
                <div className="relative p-1">
                  <TicketPercent className="absolute left-2 top-1/2 text-gray-400 -translate-y-1/2" />
                  <Input
                    placeholder={t('voucher.enterVoucher')}
                    className="pl-10"
                    onChange={(e) => setSelectedVoucher(e.target.value)}
                    value={selectedVoucher}
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
                            <div key={voucher.slug} className="relative">
                              {renderVoucherCard(voucher)}
                              {/* Button cho staff voucher - luôn hiển thị */}
                              <div className="absolute right-2 bottom-2">
                                <Button
                                  onClick={() => handleToggleVoucher(voucher)}
                                  variant={
                                    isVoucherSelected(voucher.slug) ? 'destructive' : 'default'
                                  }
                                  size="sm"
                                >
                                  {isVoucherSelected(voucher.slug)
                                    ? t('voucher.remove')
                                    : t('voucher.use')}
                                </Button>
                              </div>
                            </div>
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
                              <div key={voucher.slug}>
                                {renderVoucherCard(voucher)}
                              </div>
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
            <Button className="w-full" onClick={() => setSheetOpen(false)}>
              {t('voucher.complete')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
