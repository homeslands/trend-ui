import { useMemo } from 'react'
import moment from 'moment'

import { useSpecificMenu } from '@/hooks'
import { useBranchStore, useOrderFlowStore } from '@/stores'

/**
 * Giỏ hàng nằm trong localStorage nhiều ngày. Đối chiếu với menu hôm nay để báo
 * hết hàng ngay tại giỏ thay vì để đơn thất bại ở bước tạo đơn (P1-9).
 *
 * `getSpecificMenu` luôn trả về đúng một menu bọc trong `result.items[0]`
 * (xem `flattenSpecificMenuPages` trong `src/hooks/use-menu.ts` và cách
 * `client-menu.tabscontent.tsx` đọc `specificMenu?.result?.items?.[0]?.menuItems`)
 * — KHÔNG phải `result.menuItems` phẳng.
 */
export function useCartRevalidation(): { soldOutItemIds: string[]; isChecking: boolean } {
  const { branch } = useBranchStore()
  const cart = useOrderFlowStore((state) => state.orderingData)
  const branchSlug = branch?.slug || ''

  const { data, isLoading } = useSpecificMenu(
    { branch: branchSlug, date: moment().format('YYYY-MM-DD') },
    !!branchSlug && !!cart?.orderItems?.length,
  )

  const soldOutItemIds = useMemo(() => {
    const menuItems = data?.result?.items?.[0]?.menuItems
    if (!menuItems || !cart?.orderItems?.length) return []

    return cart.orderItems
      .filter((item) => {
        const menuItem = menuItems.find((mi) => mi.product?.slug === item.slug)
        if (!menuItem) return false // không có trong menu hôm nay ⇒ để server quyết định
        const available =
          !menuItem.isLocked && (menuItem.currentStock > 0 || !menuItem.product?.isLimit)
        return !available
      })
      .map((item) => item.id)
  }, [data, cart])

  return { soldOutItemIds, isChecking: isLoading }
}
