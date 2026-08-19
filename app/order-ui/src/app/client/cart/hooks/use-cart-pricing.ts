import { useMemo } from 'react'

import { useBranchStore, useOrderFlowStore } from '@/stores'
import { IDisplayCartItem, OrderTypeEnum } from '@/types'
import {
  buildDisplayItemMap,
  calculateCartItemDisplay,
  calculateCartTotals,
  parseKm,
  useCalculateDeliveryFee,
} from '@/utils'

export interface ICartPricing {
  displayMap: Map<string, IDisplayCartItem>
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  deliveryFee: number
  finalTotal: number
  savedTotal: number
  /**
   * Đơn giao hàng đã có địa chỉ nhưng phí ship CHƯA tính xong (đang gọi API cấu hình
   * chi nhánh, hoặc gọi lỗi). `useCalculateDeliveryFee` trả 0 cho cả hai trường hợp
   * này, không phân biệt được với "miễn phí ship" — nên UI phải tự nói rõ là đang tính,
   * nếu không khách thấy tổng thiếu phí và một dòng gợi ý "nhập địa chỉ" trong khi họ
   * vừa nhập xong.
   */
  isDeliveryFeePending: boolean
}

export function useCartPricing(): ICartPricing {
  const { branch } = useBranchStore()
  const cart = useOrderFlowStore((state) => state.orderingData)

  const isDelivery = cart?.type === OrderTypeEnum.DELIVERY
  const hasAddress = !!cart?.deliveryAddress
  const chargesDelivery = isDelivery && hasAddress

  // branchSlug rỗng ⇒ query bị disable, không gọi API thừa cho đơn tại bàn/mang đi.
  const {
    deliveryFee: rawDeliveryFee,
    isLoading: isDeliveryFeeLoading,
    error: deliveryFeeError,
  } = useCalculateDeliveryFee(
    chargesDelivery ? parseKm(cart?.deliveryDistance) || 0 : 0,
    chargesDelivery ? branch?.slug || '' : '',
  )
  const deliveryFee = chargesDelivery ? Math.round(rawDeliveryFee || 0) : 0
  const isDeliveryFeePending =
    chargesDelivery && (isDeliveryFeeLoading || !!deliveryFeeError)

  const displayItems = useMemo(
    () => calculateCartItemDisplay(cart, cart?.voucher || null),
    [cart],
  )
  const displayMap = useMemo(() => buildDisplayItemMap(displayItems), [displayItems])
  const totals = useMemo(
    () => calculateCartTotals(displayItems, cart?.voucher || null),
    [displayItems, cart?.voucher],
  )

  return useMemo(
    () => ({
      displayMap,
      subTotalBeforeDiscount: totals.subTotalBeforeDiscount,
      promotionDiscount: totals.promotionDiscount,
      voucherDiscount: totals.voucherDiscount,
      deliveryFee,
      finalTotal: totals.finalTotal + deliveryFee,
      savedTotal: totals.promotionDiscount + totals.voucherDiscount,
      isDeliveryFeePending,
    }),
    [displayMap, totals, deliveryFee, isDeliveryFeePending],
  )
}
