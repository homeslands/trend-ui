import { useEffect } from 'react'

import { useOrderFlowStore } from '@/stores'

/** Khoá localStorage của `order-flow-store` (xem `persist({ name })` trong store). */
const ORDER_FLOW_STORAGE_KEY = 'order-flow-store'

/**
 * Đồng bộ giỏ hàng giữa các tab đang mở.
 *
 * Zustand `persist` GHI vào localStorage nhưng không ĐỌC lại khi tab khác ghi — nó chỉ
 * hydrate đúng một lần lúc khởi tạo store. Hệ quả: khách mở /cart ở hai tab, xoá món ở
 * tab A, thì tab B vẫn hiển thị món đó và đặt được đơn với dữ liệu đã cũ. Trình duyệt có
 * bắn sự kiện `storage` cho các tab CÒN LẠI mỗi lần localStorage đổi, nên chỉ cần nghe
 * nó rồi gọi `persist.rehydrate()`.
 *
 * Phạm vi cố ý hẹp — chỉ trang giỏ hàng dùng hook này, không gắn toàn cục:
 * `rehydrate()` ghi đè state trong bộ nhớ bằng bản trên đĩa, nên chỉ nên chạy ở nơi mà
 * "bản mới nhất thắng" là hành vi đúng. Ở màn đang soạn dở (sửa đơn, thanh toán) thì
 * không phải vậy.
 */
export function useCrossTabCartSync() {
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      // `key === null` là khi có ai đó gọi localStorage.clear(); bỏ qua các khoá khác.
      if (event.key !== ORDER_FLOW_STORAGE_KEY) return
      // Tab vừa ghi không nhận sự kiện của chính nó, nên tới đây chắc chắn là tab khác.
      void useOrderFlowStore.persist.rehydrate()
    }

    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
}
