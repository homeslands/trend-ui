import { useEffect } from 'react'

import { VOUCHER_TYPE } from '@/constants'
import { useOrderFlowStore } from '@/stores'
import { showErrorToast, showErrorToastMessage } from '@/utils'

/**
 * Ba phép kiểm tra voucher vốn nằm trực tiếp trong `page.tsx` cũ (dòng 56-113). Chúng
 * KHÔNG được lặp lại ở nơi nào khác trong luồng giỏ hàng của khách: `VoucherListSheet`
 * (Task 19) đã bỏ phần kiểm tra `minOrderValue`/`maxItems` trùng với hook này, chỉ còn
 * giữ riêng phần kiểm tra sản phẩm áp dụng (`applicabilityRule`) mà hook này không có;
 * còn `DeleteCartItemDialog` (đã bị thay bằng toast hoàn tác) chỉ kiểm tra lúc xoá qua
 * dialog. Nếu bỏ đi, một voucher hết điều kiện sẽ nằm lại trong giỏ sau khi khách
 * xoá/giảm số lượng món, và giá hiển thị sẽ lệch với giá backend tính lúc tạo đơn.
 *
 * Được tách thành hook (thay vì để trong page) để trang chỉ còn là khung lắp ráp, và
 * để ba quy tắc này nằm cạnh nhau thay vì rải giữa JSX.
 */
export function useCartVoucherGuard() {
  const cart = useOrderFlowStore((state) => state.orderingData)
  const removeVoucher = useOrderFlowStore((state) => state.removeVoucher)

  const voucherSlug = cart?.voucher?.slug
  const voucherMaxItems = cart?.voucher?.maxItems || 0
  const cartItemQuantity =
    cart?.orderItems?.reduce((total, item) => total + (item.quantity || 0), 0) || 0

  // Voucher đồng giá chỉ có nghĩa khi giỏ còn ít nhất một sản phẩm thuộc voucher.
  useEffect(() => {
    if (cart?.voucher && cart.voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      const voucherProductSlugs = cart.voucher.voucherProducts?.map((vp) => vp.product.slug) || []
      const hasValidProducts = cart.orderItems.some((item) =>
        voucherProductSlugs.includes(item.slug),
      )

      if (!hasValidProducts) {
        showErrorToast(143422)
        removeVoucher()
      }
    }
  }, [cart, removeVoucher])

  // Tổng tiền sau khuyến mãi phải còn đạt `minOrderValue` của voucher.
  useEffect(() => {
    if (cart && cart.voucher) {
      const { voucher, orderItems } = cart

      // Voucher đồng giá không ràng buộc theo giá trị đơn.
      const shouldCheckMinOrderValue = voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT

      if (shouldCheckMinOrderValue) {
        // Tính trực tiếp từ orderItems sau khuyến mãi, không dùng useCartPricing để
        // tránh phụ thuộc vòng (giá lại phụ thuộc voucher).
        const subtotalAfterPromotion = orderItems.reduce((total, item) => {
          const original = item?.originalPrice
          const afterPromotion = (original || 0) - (item.promotionDiscount || 0)
          return total + afterPromotion * item.quantity
        }, 0)

        if (subtotalAfterPromotion < (voucher.minOrderValue || 0)) {
          removeVoucher()
          showErrorToast(1004)
        }
      }
    }
  }, [cart, removeVoucher])

  // Tổng số lượng sản phẩm không được vượt `maxItems` của voucher.
  useEffect(() => {
    if (!voucherSlug || !voucherMaxItems) return
    if (cartItemQuantity > voucherMaxItems) {
      removeVoucher()
      showErrorToastMessage('toast.voucherMaxItemsExceeded')
    }
  }, [voucherSlug, voucherMaxItems, cartItemQuantity, removeVoucher])
}
