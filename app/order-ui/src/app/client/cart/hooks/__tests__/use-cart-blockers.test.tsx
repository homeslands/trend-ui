import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBranchStore, useOrderFlowStore } from '@/stores'
import { IBranch, OrderTypeEnum, IOrderItem, IProductVariant } from '@/types'
import { useCartBlockers } from '../use-cart-blockers'

// Không khởi tạo i18next thật trong test: react-i18next gọi t() sẽ trả về chính khoá
// (kỳ vọng, test không assert chuỗi đã dịch). Nếu để react-i18next tự trả về "notReadyT"
// mặc định (chưa init instance), nó cấp một hàm t MỚI mỗi lần gọi useTranslation, làm
// useMemo trong hook luôn bị vô hiệu hoá dù đã memo hoá soldOutItemIds — mock ở đây giữ
// t ổn định qua các lần render để bài test kiểm tra tham chiếu memo phản ánh đúng hành vi
// production (nơi i18next đã init nên t cũng ổn định).
vi.mock('react-i18next', () => {
  const t = (key: string) => key
  return { useTranslation: () => ({ t }) }
})

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed() {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'x',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0].id
}

describe('useCartBlockers', () => {
  beforeEach(() => {
    // Mọi test dưới đây kiểm điều kiện KHÁC chi nhánh, nên phải có chi nhánh sẵn —
    // nếu không blocker NO_BRANCH sẽ chen vào và làm nhiễu mọi assertion.
    useBranchStore.getState().setBranch({ slug: 'chi-nhanh-1', name: 'Chi nhánh 1' } as IBranch)
    seed()
  })

  it('chưa chọn chi nhánh thì chặn, và đứng trước mọi lý do khác', () => {
    useBranchStore.setState({ branch: undefined })
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    const { result } = renderHook(() => useCartBlockers([]))

    // AT_TABLE chưa chọn bàn nên cũng có NO_TABLE — NO_BRANCH phải đứng đầu vì thiếu
    // chi nhánh thì bàn cũng không có nghĩa.
    expect(result.current.map((b) => b.code)).toEqual(['NO_BRANCH', 'NO_TABLE'])
    // Không có ô nhập nào để nhảy tới: dialog chọn chi nhánh là của layout toàn cục.
    expect(result.current[0].targetId).toBeUndefined()
  })

  it('đơn tại bàn chưa chọn bàn thì báo thiếu bàn', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current.map((b) => b.code)).toEqual(['NO_TABLE'])
    expect(result.current[0].targetId).toBe('cart-field-table')
  })

  it('đơn giao hàng thiếu địa chỉ và sai số điện thoại thì báo cả hai', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryPhone('123')

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current.map((b) => b.code)).toEqual(['NO_ADDRESS', 'BAD_PHONE'])
  })

  it('đơn giao hàng đủ thông tin thì không còn điều kiện chặn', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryPhone('0901234567')

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current).toHaveLength(0)
  })

  it('có món hết hàng thì chặn và trỏ tới đúng dòng', () => {
    const id = useOrderFlowStore.getState().orderingData!.orderItems[0].id
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.TAKE_OUT)

    const { result } = renderHook(() => useCartBlockers([id]))

    expect(result.current[0].code).toBe('SOLD_OUT')
    expect(result.current[0].targetId).toBe(`cart-row-${id}`)
  })

  it('chặn khi có món giá tùy chỉnh chưa nhập giá', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.TAKE_OUT)
    const id = useOrderFlowStore.getState().orderingData!.orderItems[0].id
    store.updateOrderingItemCustomPrice(id, 0)
    // đánh dấu món là giá tùy chỉnh
    const current = useOrderFlowStore.getState().orderingData!
    store.setOrderingData({
      ...current,
      orderItems: current.orderItems.map((i) =>
        i.id === id ? { ...i, isCustomPrice: true, customPrice: undefined } : i,
      ),
    })

    const { result } = renderHook(() => useCartBlockers([]))

    expect(result.current.map((b) => b.code)).toEqual(['UNPRICED_CUSTOM'])
    expect(result.current[0].targetId).toBe(`cart-row-${id}`)
  })

  it('giữ nguyên tham chiếu khi render lại với cùng nội dung soldOutItemIds', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.TAKE_OUT)
    const { result, rerender } = renderHook(() => useCartBlockers(['a', 'b']))
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
