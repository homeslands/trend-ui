import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useBranchStore, useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { PHONE_NUMBER_REGEX } from '@/constants'

export type TBlockerCode =
  | 'NO_BRANCH'
  | 'SOLD_OUT'
  | 'NO_TABLE'
  | 'NO_ADDRESS'
  | 'BAD_PHONE'
  | 'UNPRICED_CUSTOM'

export interface ICartBlocker {
  code: TBlockerCode
  label: string
  /**
   * `id` của ô nhập cần cuộn tới khi khách bấm vào lý do. Bỏ trống khi lý do không có
   * ô nào để sửa (ví dụ chưa chọn chi nhánh — việc đó do dialog toàn cục xử lý); lúc đó
   * người gọi phải hiện dạng chữ chứ đừng dựng một nút bấm vào không làm gì.
   */
  targetId?: string
}

/**
 * Nguồn duy nhất quyết định nút đặt hàng có bị chặn hay không. Trước đây điều kiện
 * này được viết lại ở nhánh mobile, nhánh desktop và trong dialog nên đã trôi lệch
 * nhau, khiến mobile mở được dialog cho đơn giao hàng thiếu địa chỉ (P1-5).
 *
 * Hook KHÔNG chặn khi giỏ rỗng hoặc `orderingData` null — trang tự render màn hình
 * giỏ trống trước khi tới nút đặt hàng. Người gọi phải giữ nguyên guard đó.
 *
 * Hook KHÔNG thay thế guard `!branchSlug` trong `handleSubmit` của `CreateOrderDialog`
 * (toast mã 11000) — đó là lưới an toàn lúc submit. Nhưng blocker `NO_BRANCH` ở đây mới
 * là thứ khách nhìn thấy: không có nó, nút "Đặt hàng" sáng bình thường rồi bấm vào chỉ
 * nhận một mã lỗi không nói được phải làm gì.
 */
export function useCartBlockers(soldOutItemIds: string[]): ICartBlocker[] {
  const { t } = useTranslation('menu')
  const cart = useOrderFlowStore((state) => state.orderingData)
  const branch = useBranchStore((state) => state.branch)
  // So sánh theo nội dung: người gọi thường truyền mảng literal mới mỗi render,
  // đưa thẳng mảng vào dependency sẽ làm memo mất tác dụng.
  const soldOutKey = soldOutItemIds.join(',')

  return useMemo(() => {
    const blockers: ICartBlocker[] = []
    if (!cart) return blockers

    // Chi nhánh đứng đầu danh sách: thiếu nó thì không món nào, không bàn nào, không
    // địa chỉ nào có nghĩa. `ChooseBranchDialog` tự mở khi chưa chọn nhưng khách đóng
    // được, nên `/cart` phải tự phòng thủ.
    if (!branch?.slug) {
      blockers.push({ code: 'NO_BRANCH', label: t('menu.blockerNoBranch') })
    }

    const firstSoldOut = cart.orderItems.find((item) => soldOutItemIds.includes(item.id))
    if (firstSoldOut) {
      blockers.push({
        code: 'SOLD_OUT',
        label: t('menu.blockerSoldOut'),
        targetId: `cart-row-${firstSoldOut.id}`,
      })
    }

    const unpriced = cart.orderItems.find(
      (item) => item.isCustomPrice === true && !(item.customPrice != null && item.customPrice > 0),
    )
    if (unpriced) {
      blockers.push({
        code: 'UNPRICED_CUSTOM',
        label: t('menu.blockerUnpricedCustom'),
        targetId: `cart-row-${unpriced.id}`,
      })
    }

    if (cart.type === OrderTypeEnum.AT_TABLE && !cart.table) {
      blockers.push({
        code: 'NO_TABLE',
        label: t('menu.blockerNoTable'),
        targetId: 'cart-field-table',
      })
    }

    if (cart.type === OrderTypeEnum.DELIVERY) {
      if (!cart.deliveryAddress) {
        blockers.push({
          code: 'NO_ADDRESS',
          label: t('menu.blockerNoAddress'),
          targetId: 'cart-field-address',
        })
      }
      if (!cart.deliveryPhone || !PHONE_NUMBER_REGEX.test(cart.deliveryPhone)) {
        blockers.push({
          code: 'BAD_PHONE',
          label: t('menu.blockerBadPhone'),
          targetId: 'cart-field-phone',
        })
      }
    }

    return blockers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, branch?.slug, soldOutKey, t])
}
