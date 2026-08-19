import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useOrderFlowStore } from '@/stores'
import { useTables } from '@/hooks/use-table'

/**
 * Quét mã QR tại bàn mở /cart?branch=...&table=... Trước đây bàn được ghi vào
 * useCartItemStore (store cũ) trong khi trang giỏ hàng đọc từ useOrderFlowStore,
 * nên bàn không bao giờ được chọn (P0-4).
 */
export function useSyncTableFromUrl() {
  const [searchParams] = useSearchParams()
  const branchSlug = searchParams.get('branch') || undefined
  const tableSlug = searchParams.get('table')
  const { data: tableRes } = useTables(branchSlug)
  const addTable = useOrderFlowStore((state) => state.addTable)

  useEffect(() => {
    if (!tableSlug || !tableRes?.result) return
    const table = tableRes.result.find((item) => item.slug === tableSlug)
    if (!table) return

    // `setOrderingTable` no-op khi chưa có orderingData. Khách quét QR lúc giỏ còn
    // trống là ca phổ biến nhất, nên phải khởi tạo giỏ trước, nếu không bàn bị mất
    // đúng vào tình huống P0-4 định sửa.
    if (!useOrderFlowStore.getState().orderingData) {
      useOrderFlowStore.getState().initializeOrdering()
    }
    // Quét QR tại bàn cũng chuyển đơn sang loại "tại bàn" — đây là ý đồ sản phẩm,
    // không phải tác dụng phụ: khách đang ngồi tại bàn đó.
    addTable(table)
  }, [tableSlug, tableRes, addTable])
}
