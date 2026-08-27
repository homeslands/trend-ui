import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
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
import { VoucherQrScanButton } from '@/components/app/button'

import {
  useIsMobile,
  usePagination,
  useViewportHeight,
  usePublicVouchersForOrder,
  useSpecificPublicVoucher,
  useSpecificVoucher,
  useValidatePublicVoucher,
  useValidateVoucher,
  useVouchersForOrder,
  useVoucherCartFix,
  useVoucherScanRejection,
} from '@/hooks'
import { calculateCartItemDisplay, calculateCartTotals, formatCurrency, isVoucherApplicableToCartItems, showErrorToast, showToast, normalizeVoucherCartLines } from '@/utils'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
import {
  IGetAllVoucherRequest,
  IValidateVoucherRequest,
  IVoucher,
} from '@/types'
import { useOrderFlowStore, useThemeStore, useUserStore } from '@/stores'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE, VOUCHER_USAGE_FREQUENCY_UNIT } from '@/constants'

export default function VoucherListSheet() {
  const isMobile = useIsMobile()
  const viewportHeight = useViewportHeight()
  const { getTheme } = useThemeStore()
  const { t } = useTranslation(['voucher'])
  const { t: tToast } = useTranslation('toast')
  const { userInfo } = useUserStore()
  const { getCartItems, addVoucher, removeVoucher, isHydrated } = useOrderFlowStore()
  const isRemovingVoucherRef = useRef(false)
  // const { cartItems, addVoucher, removeVoucher, isHydrated } = useCartItemStore()
  const { mutate: validateVoucher } = useValidateVoucher()
  const { mutate: validatePublicVoucher } = useValidatePublicVoucher()
  const { pagination } = usePagination()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [localVoucherList, setLocalVoucherList] = useState<IVoucher[]>([])
  const [selectedVoucher, setSelectedVoucher] = useState<string>('')
  const [tempSelectedVoucher, setTempSelectedVoucher] = useState<string>('')
  // Voucher vừa quét từ QR. Phải giữ riêng ra vì effect gom trang bên dưới có
  // `localVoucherList.length` trong deps: chính cú unshift của luồng quét làm length đổi
  // → effect chạy lại → nhánh "replace" dựng lại danh sách từ trang đã fetch và xoá mất
  // voucher vừa chèn. Giữ nó ở đây để nhánh replace chèn lại, y như `specificVoucher`.
  const [scannedVoucher, setScannedVoucher] = useState<IVoucher | null>(null)
  // Pagination state for load more
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const cartItems = getCartItems()
  // Add useEffect to check voucher validation
  const isVoucherSelected = useCallback((voucherSlug: string) => {
    return (
      cartItems?.voucher?.slug === voucherSlug ||
      selectedVoucher === voucherSlug
    )
  }, [cartItems?.voucher?.slug, selectedVoucher])
  useEffect(() => {
    if (cartItems?.voucher) {
      // If user is not logged in but voucher requires verification
      if (!userInfo && cartItems?.voucher.isVerificationIdentity) {
        showErrorToast(1003) // Show error toast
        removeVoucher() // Remove invalid voucher
      }
    }
  }, [userInfo, cartItems?.voucher, removeVoucher, getCartItems])

  // 1. Owner là khách hàng có tài khoản
  const isCustomerOwner =
    !!userInfo &&
    userInfo.role?.name === Role.CUSTOMER &&
    userInfo.phonenumber !== 'default-customer';

  const minOrderValue = useMemo(() => {
    return cartItems?.orderItems.reduce((acc, item) => {
      const original = item.originalPrice ?? 0
      const promotionDiscount = item.promotionDiscount ?? 0
      return acc + (original - promotionDiscount) * item.quantity
    }, 0) || 0
  }, [cartItems?.orderItems])

  const nonGiftOrderItems = useMemo(() => {
    return (cartItems?.orderItems || []).filter(item => !(item as { isGift?: boolean }).isGift)
  }, [cartItems?.orderItems])

  const voucherForOrderRequestParam: IGetAllVoucherRequest = useMemo(() => ({
    hasPaging: true,
    page: currentPage,
    size: pagination.pageSize,
    user: userInfo?.slug,
    paymentMethod: cartItems?.paymentMethod,
    minOrderValue: minOrderValue,
    orderItems: nonGiftOrderItems.map(item => ({
      quantity: item.quantity,
      variant: item.variant.slug,
      promotion: item.promotion ? item.promotion.slug : '',
      order: item.slug || '',
    })) || [],
  }), [currentPage, pagination.pageSize, userInfo?.slug, cartItems?.paymentMethod, minOrderValue, nonGiftOrderItems])

  const { data: voucherList } = useVouchersForOrder(
    isCustomerOwner // Nếu owner là khách có tài khoản
      ? voucherForOrderRequestParam
      : undefined,
    !!sheetOpen && isCustomerOwner
  )

  const { data: publicVoucherList } = usePublicVouchersForOrder(
    !isCustomerOwner
      ? voucherForOrderRequestParam
      : undefined,
    !!sheetOpen && !isCustomerOwner
  )

  const { data: specificVoucher, refetch: refetchSpecificVoucher } = useSpecificVoucher(
    {
      code: selectedVoucher
    },
    !!sheetOpen && !!selectedVoucher && selectedVoucher.trim().length > 0
  )

  const { data: specificPublicVoucher, refetch: refetchSpecificPublicVoucher } = useSpecificPublicVoucher(
    {
      code: selectedVoucher
    },
  )

  const handleToggleVoucher = useCallback((voucher: IVoucher) => {
    const isSelected = isVoucherSelected(voucher.slug)

    const handleRemove = () => {
      removeVoucher()
      setSelectedVoucher('')
      showToast(tToast('toast.removeVoucherSuccess'))
    }

    const handleApply = () => {
      addVoucher(voucher)
      setSelectedVoucher(voucher.slug)
      setSheetOpen(false)
      showToast(tToast('toast.applyVoucherSuccess'))
    }

    const validateVoucherParam: IValidateVoucherRequest = {
      voucher: voucher.slug,
      user: userInfo?.slug || '',
      orderItems: cartItems?.orderItems.map(item => ({
        quantity: item.quantity,
        variant: item.variant.slug,
        note: item.note,
        promotion: item.promotion ? item.promotion.slug : null,
        order: null, // hoặc bỏ nếu không cần
      })) || []
    }


    const onSuccess = () => handleApply()
    // const onError = () => handleRemove()

    if (isSelected) {
      handleRemove()
    } else {
      if (userInfo && voucher?.isVerificationIdentity) {
        validateVoucher(validateVoucherParam, { onSuccess })
      } else {
        validatePublicVoucher(validateVoucherParam, { onSuccess })
      }
    }
  }, [removeVoucher, addVoucher, setSelectedVoucher, setSheetOpen, tToast, userInfo, validateVoucher, validatePublicVoucher, cartItems, isVoucherSelected])

  // Auto-check voucher validity when orderItems change.
  //
  // CHỈ còn kiểm tra applicabilityRule (sản phẩm áp dụng) ở đây. minOrderValue và
  // maxItems đã chuyển hẳn sang `useCartVoucherGuard` (trang giỏ hàng, Task 18) — hook
  // đó và effect này cùng chạy mỗi khi trang giỏ hàng mở (component này chỉ được dùng ở
  // `src/app/client/cart/page.tsx`), nên giữ hai bản kiểm tra giống hệt nhau ở đây sẽ
  // gỡ voucher 2 lần liên tiếp và hiện 2 toast khác nội dung cho CÙNG một lý do: toast lỗi
  // cụ thể (1004) từ guard, rồi toast "Gỡ voucher thành công" chung chung từ
  // `handleToggleVoucher` bên dưới. Xem thêm ghi chú trong `useCartVoucherGuard`.
  useEffect(() => {
    if (!cartItems?.voucher || !cartItems?.orderItems || isRemovingVoucherRef.current) {
      isRemovingVoucherRef.current = false
      return
    }

    const { voucher, orderItems } = cartItems
    const voucherProductSlugs = voucher.voucherProducts?.map(vp => vp.product.slug) || []
    const cartProductSlugs = orderItems.map(item => item.productSlug || item.slug)

    let shouldRemove = false

    switch (voucher.applicabilityRule) {
      case APPLICABILITY_RULE.ALL_REQUIRED: {
        const hasInvalidProducts = cartProductSlugs.some(slug => !voucherProductSlugs.includes(slug))
        if (hasInvalidProducts) shouldRemove = true
        break
      }
      case APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED: {
        const hasAtLeastOne = cartProductSlugs.some(slug => voucherProductSlugs.includes(slug))
        if (!hasAtLeastOne) shouldRemove = true
        break
      }
      default:
        break
    }

    // Remove voucher nếu cần
    if (shouldRemove) {
      isRemovingVoucherRef.current = true
      handleToggleVoucher(voucher)
    }

  }, [cartItems, cartItems?.orderItems, cartItems?.voucher, handleToggleVoucher])


  // check if voucher is private, then refetch specific voucher, then set the voucher list to the local voucher list
  useEffect(() => {
    if (specificVoucher?.result?.isPrivate) {
      refetchSpecificVoucher()
    }
  }, [specificVoucher?.result?.isPrivate, refetchSpecificVoucher])

  // check if voucher is private and user is logged in, then refetch specific voucher
  useEffect(() => {
    if (userInfo && specificVoucher?.result?.isPrivate) {
      refetchSpecificVoucher();
    } else if (!userInfo && specificPublicVoucher?.result) {
      refetchSpecificPublicVoucher();
    }
  }, [
    userInfo,
    specificVoucher?.result?.isPrivate,
    specificPublicVoucher?.result,
    refetchSpecificVoucher,
    refetchSpecificPublicVoucher
  ]);

  // check if specificVoucher or specificPublicVoucher is not null, then set the voucher list to the local voucher list
  useEffect(() => {
    const vouchers = userInfo
      ? [specificVoucher?.result].filter((v): v is IVoucher => !!v)
      : [specificPublicVoucher?.result].filter((v): v is IVoucher => !!v);

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
  }, [userInfo, specificVoucher?.result, specificPublicVoucher?.result]);

  // Accumulate vouchers from multiple pages
  useEffect(() => {
    const isCustomer = userInfo?.role.name === Role.CUSTOMER || (!userInfo && cartItems?.owner !== '' && cartItems?.ownerRole === Role.CUSTOMER)
    const currentData = isCustomer ? voucherList?.result : publicVoucherList?.result

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

      if (userInfo && specificVoucher?.result) {
        const existingIndex = newList.findIndex(v => v.slug === specificVoucher.result.slug)
        if (existingIndex === -1) {
          newList = [specificVoucher.result, ...newList]
        }
      }

      if (!userInfo && specificPublicVoucher?.result) {
        const existingIndex = newList.findIndex(v => v.slug === specificPublicVoucher.result.slug)
        if (existingIndex === -1) {
          newList = [specificPublicVoucher.result, ...newList]
        }
      }

      // Voucher quét từ QR không nằm trong trang fetch được, nên nhánh replace này sẽ
      // xoá mất nó nếu không chèn lại — giống hệt cách `specificVoucher` được giữ ở trên.
      if (scannedVoucher) {
        const existingIndex = newList.findIndex(v => v.slug === scannedVoucher.slug)
        if (existingIndex === -1) {
          newList = [scannedVoucher, ...newList]
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
        if (userInfo && specificVoucher?.result) {
          const existingIndex = unique.findIndex(v => v.slug === specificVoucher.result.slug)
          if (existingIndex === -1) {
            unique.unshift(specificVoucher.result)
          }
        }
        if (!userInfo && specificPublicVoucher?.result) {
          const existingIndex = unique.findIndex(v => v.slug === specificPublicVoucher.result.slug)
          if (existingIndex === -1) {
            unique.unshift(specificPublicVoucher.result)
          }
        }
        if (scannedVoucher) {
          const existingIndex = unique.findIndex(v => v.slug === scannedVoucher.slug)
          if (existingIndex === -1) {
            unique.unshift(scannedVoucher)
          }
        }
        return unique
      })
    }
  }, [voucherList?.result, publicVoucherList?.result, currentPage, userInfo, cartItems?.ownerRole, cartItems?.owner, specificVoucher?.result, specificPublicVoucher?.result, scannedVoucher, localVoucherList.length])

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
      // Quên voucher đã quét ở lần mở trước, tránh nó dính lại ở phiên mở mới.
      setScannedVoucher(null)

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
  }, [sheetOpen, minOrderValue, nonGiftOrderItems, cartItems?.paymentMethod, isCustomerOwner])

  useEffect(() => {
    if (cartItems?.voucher) {
      const code = cartItems.voucher.code;
      setSelectedVoucher(code);
      setTempSelectedVoucher(cartItems.voucher.slug);

      if (cartItems.voucher.isPrivate) {
        refetchSpecificVoucher();
      }
    } else {
      setTempSelectedVoucher('');
    }
  }, [cartItems?.voucher, refetchSpecificVoucher]);

  // MỘT nguồn giỏ hàng cho cả bộ phân loại lẫn bộ dựng lời khuyên: hai
  // chỗ đọc hai field khác nhau từng khiến chúng nói hai chuyện khác nhau.
  const cartLines = useMemo(() => normalizeVoucherCartLines(cartItems?.orderItems), [cartItems?.orderItems])
  const voucherCartFix = useVoucherCartFix()
  const getVoucherCartFix = useCallback(
    (voucher: IVoucher) =>
      voucherCartFix(voucher, { cartItems: cartLines, subTotal: minOrderValue }),
    [voucherCartFix, cartLines, minOrderValue],
  )
  const buildScanRejection = useVoucherScanRejection({
    cartLines,
    subTotal: minOrderValue,
    // Định danh của KHÁCH trên đơn, không phải của người đang đăng nhập.
    isOrderOwnerIdentified: isCustomerOwner,
    canAddCustomer: false,
  })

  // If cartItems is not hydrated, return null
  if (!isHydrated) {
    // eslint-disable-next-line no-console
    console.warn('Cart items are not hydrated yet.')
    return null
  }

  // let subTotal = 0
  const voucher = cartItems?.voucher || null
  // calculate subtotal
  const displayItems = calculateCartItemDisplay(cartItems, voucher)
  const cartTotals = calculateCartTotals(displayItems, voucher)
  // const subTotal = cartItems?.orderItems.reduce((acc, item) => acc + (item.originalPrice || 0) * item.quantity, 0) || 0

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

  // `overrideVoucher`: voucher được truyền thẳng vào (luồng quét QR). Bắt buộc phải có
  // vì state React set ở cùng một tick chưa nhìn thấy được trong hàm gọi ngay sau đó —
  // đọc `tempSelectedVoucher` lúc ấy sẽ ra giá trị CŨ và áp nhầm voucher.
  // Lưu ý: mọi call site truyền hàm này vào `onClick` phải bọc `() => ...`, nếu không
  // React sẽ nhét MouseEvent vào tham số này (TypeScript không bắt được).
  const handleCompleteSelection = async (overrideVoucher?: IVoucher) => {
    const effectiveSlug = overrideVoucher?.slug ?? tempSelectedVoucher

    // Nếu không có voucher nào được chọn, chỉ đóng sheet
    if (!effectiveSlug) {
      // Nếu có voucher đang áp dụng, xóa nó
      if (cartItems?.voucher) {
        removeVoucher();
        showToast(tToast('toast.removeVoucherSuccess'));
      }
      setSheetOpen(false);
      return;
    }

    // Tìm voucher được chọn. Voucher quét từ QR gần như không nằm trong
    // `localVoucherList` (danh sách chỉ chứa các trang đã tải) nên phải ưu tiên bản
    // truyền thẳng vào, không thì luôn rơi vào nhánh lỗi 1000 bên dưới.
    const selectedVoucherData = overrideVoucher ?? localVoucherList.find(v => v.slug === effectiveSlug);

    if (!selectedVoucherData) {
      showErrorToast(1000);
      return;
    }

    // Nếu voucher được chọn giống với voucher hiện tại, chỉ đóng sheet
    if (cartItems?.voucher?.slug === effectiveSlug) {
      setSheetOpen(false);
      return;
    }

    // Validate và áp dụng voucher mới
    const validateVoucherParam: IValidateVoucherRequest = {
      voucher: selectedVoucherData.slug,
      user: userInfo?.slug || '',
      orderItems: cartItems?.orderItems.map(item => ({
        quantity: item.quantity,
        variant: item.variant.slug,
        note: item.note,
        promotion: item.promotion ? item.promotion.slug : null,
        order: null,
      })) || []
    }

    const onValidated = () => {
      addVoucher(selectedVoucherData);
      setSheetOpen(false);
      showToast(tToast('toast.applyVoucherSuccess'));
    }

    if (userInfo?.slug) {
      validateVoucher(validateVoucherParam, { onSuccess: onValidated })
    } else {
      validatePublicVoucher(validateVoucherParam, { onSuccess: onValidated })
    }
  };

  const handleQrResolved = (voucher: IVoucher) => {
    if (cartItems?.voucher?.slug === voucher.slug) {
      showToast(tToast('toast.voucherAlreadyApplied'))
      return
    }

    // Chặn tại máy trước khi phiền tới server, và nói RÕ lý do thay vì để toast
    // lỗi chung chung từ handler toàn cục. Trả `false` để màn quét ở lại cho
    // khách thử phiếu khác ngay.
    if (!isVoucherValid(voucher)) {      return buildScanRejection(voucher, getVoucherErrorMessage(voucher))
    }

    // Nhớ lại voucher này để effect gom trang chèn nó vào mỗi lần dựng lại danh sách.
    setScannedVoucher(voucher)

    // Chèn vào danh sách để thẻ voucher hiện ra ngay sau khi áp — cùng khuôn với effect
    // tra cứu theo code ở trên.
    setLocalVoucherList((prevList) => {
      const newList = [...(prevList || [])]
      if (!newList.some((v) => v.slug === voucher.slug)) {
        newList.unshift(voucher)
      }
      return newList
    })
    setTempSelectedVoucher(voucher.slug)

    // Truyền thẳng voucher: hai state vừa set ở trên CHƯA thấy được trong lượt render này.
    handleCompleteSelection(voucher)
  }

  const isVoucherValid = (voucher: IVoucher) => {
    const isValidAmount =
      voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
        ? true
        : (voucher?.minOrderValue || 0) <= ((cartTotals?.subTotalBeforeDiscount || 0) - (cartTotals?.promotionDiscount || 0))
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
      if (!cartItems?.orderItems || cartItems.orderItems.length === 0) {
        return false
      }

      // Check if at least one cart item matches voucher products
      const voucherProductSlugs = voucher.voucherProducts.map(vp => vp.product.slug)
      const cartProductSlugs = cartItems.orderItems.reduce((acc, item) => {
        if (item.slug) acc.push(item.slug) // Slug của product
        return acc
      }, [] as string[])

      const hasValidProducts = isVoucherApplicableToCartItems(cartProductSlugs, voucherProductSlugs, voucher.applicabilityRule)

      return hasValidProducts
    })()
    const sevenAmToday = moment().set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
    const isValidDate = sevenAmToday.isSameOrBefore(moment(voucher.endDate));
    const requiresLogin = voucher.isVerificationIdentity === true
    const isUserLoggedIn = !!userInfo?.slug
    const isIdentityValid = !requiresLogin || (requiresLogin && isUserLoggedIn)
    return isActive && !isExpired && hasUsage && isValidAmount && isValidDate && isIdentityValid && hasValidProducts && isInActiveWindow
  }


  const getVoucherErrorMessage = (voucher: IVoucher) => {
    const cartFix = getVoucherCartFix(voucher)

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
        condition: voucher.remainingUsage === 0,
        message: t('voucher.outOfStock'),
      },
      {
        // Thiếu món, thừa món, chưa đủ tiền — gộp làm một, vì cả ba đều trả
        // lời cùng câu hỏi "sửa đơn thế nào".
        condition: !!cartFix,
        message: cartFix?.message || '',
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
    const cartFixHint = getVoucherCartFix(voucher)?.hint
    const isOutOfStockError = errorMessage === t('voucher.outOfStock')
    const baseCardClass = `grid h-40 grid-cols-8 gap-2 p-2 rounded-md sm:h-36 relative
    ${isVoucherSelected(voucher.slug)
        ? `bg-${getTheme() === 'light' ? 'primary/10' : 'black'} border-primary`
        : `${getTheme() === 'light' ? 'bg-white' : 'border'}`
      }
    border border-muted-foreground/50
    ${voucher.remainingUsage === 0 ? 'opacity-50' : ''}
    ${!isValid ? 'opacity-60' : ''}
  `

    return (
      <div className={baseCardClass} key={voucher.slug}>
        {/* Overlay mờ cho voucher không hợp lệ */}
        {!isValid && (
          <div className="absolute inset-0 z-10 rounded-md pointer-events-none bg-muted-foreground/10" />
        )}
        {/* {isBest && (
          <div className="absolute -top-0 -left-0 px-2 py-1 text-xs text-white rounded-tl-md rounded-br-md bg-primary">
            {t('voucher.bestChoice')}
          </div>
        )} */}
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
            {/* <span className="text-xs italic text-primary">
              {(() => {
                const { type, value, applicabilityRule: rule } = voucher

                const discountValueText =
                  type === VOUCHER_TYPE.PERCENT_ORDER
                    ? t('voucher.percentDiscount', { value })
                    : type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                      ? t('voucher.samePriceProduct', { value: formatCurrency(value) })
                      : t('voucher.fixedDiscount', { value: formatCurrency(value) })

                const ruleText =
                  rule === APPLICABILITY_RULE.ALL_REQUIRED
                    ? t(
                      type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                        ? 'voucher.requireAllSamePrice'
                        : 'voucher.requireAll'
                    )
                    : t(
                      type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
                        ? 'voucher.requireAtLeastOneSamePrice'
                        : 'voucher.requireAtLeastOne'
                    )

                return `${discountValueText} ${ruleText}`
              })()}
            </span> */}
            {/* <span className="flex gap-1 items-center text-sm text-muted-foreground">
              {voucher.code}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6"
                      onClick={() => handleCopyCode(voucher?.code)}
                    >
                      <Copy className="w-4 h-4 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('voucher.copyCode')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span> */}
            <span className="text-xs italic text-destructive">
              {errorMessage}
              {/* {voucher?.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT && voucher?.minOrderValue > subTotal
                ? t('voucher.minOrderNotMet')
                : moment(voucher.endDate).isBefore(moment().set({ hour: 7, minute: 0, second: 0, millisecond: 0 }))
                  ? t('voucher.expired')
                  : voucher.isVerificationIdentity && !userInfo?.slug
                    ? t('voucher.needVerifyIdentity')
                    : ''} */}
            </span>
            {cartFixHint && (
              <span className="text-xs italic text-muted-foreground">
                {cartFixHint}
              </span>
            )}
            <span className="hidden text-muted-foreground/60 sm:text-xs">
              {t('voucher.minOrderValue')}: {formatCurrency(voucher.minOrderValue)}
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
              {voucher.remainingUsage > 0 && (
                <Progress value={usagePercentage} className="h-1" />
              )}
            </div>
            <Checkbox
              id={voucher.slug}
              checked={tempSelectedVoucher === voucher.slug}
              onCheckedChange={(checked) => {
                setTempSelectedVoucher(checked ? voucher.slug : '')
              }}
              disabled={!isValid || voucher.remainingUsage === 0}
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
                              {t('voucher.maxItems')}: {voucher.maxItems}
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
                            {t('voucher.maxItems')}: {voucher.maxItems}
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
        <Button variant="ghost" className="px-0 w-full bg-primary/15 hover:bg-primary/20">
          <div className="flex gap-1 justify-between items-center p-2 w-full rounded-md cursor-pointer">
            <div className="flex gap-1 items-center">
              <TicketPercent className="icon text-primary" />
              <span className="text-sm text-primary">
                {t('voucher.useVoucher')}
              </span>
            </div>
            <div>
              <ChevronRight className="icon text-primary" />
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
              <div className="grid grid-cols-1 gap-2">
                <div className="flex gap-2 items-center p-1">
                  <div className="relative flex-1">
                    <TicketPercent className="absolute left-2 top-1/2 text-gray-400 -translate-y-1/2" />
                    <Input
                      placeholder={t('voucher.enterVoucher')}
                      className="pl-10"
                      onChange={(e) => setSelectedVoucher(e.target.value)}
                      value={selectedVoucher}
                    />
                  </div>
                  <VoucherQrScanButton
                    isPublic={!userInfo}
                    onResolved={handleQrResolved}
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
            {/* Bọc `() => ...`: truyền thẳng hàm sẽ khiến React nhét MouseEvent vào
                tham số `overrideVoucher` và nó được coi như một voucher hợp lệ. */}
            <Button className="w-full" onClick={() => handleCompleteSelection()}>
              {t('voucher.complete')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
