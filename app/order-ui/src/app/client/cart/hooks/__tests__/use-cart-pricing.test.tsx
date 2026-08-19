import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum, IOrderItem, IProductVariant, IVoucher } from '@/types'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { useCartPricing } from '../use-cart-pricing'

// Trạng thái của hàm tính phí, đổi được từng test để mô phỏng lúc API đang tải / lỗi.
const feeState: { isLoading: boolean; error: Error | null } = { isLoading: false, error: null }

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    // 3.2km x 5.000đ/km. Khi đang tải hoặc lỗi, hàm thật trả về fee = 0 (xem
    // `src/utils/google-map.ts`) — mock phải giữ đúng đặc điểm đó, vì chính nó là lý do
    // UI không phân biệt được "miễn phí ship" với "chưa tính xong".
    useCalculateDeliveryFee: (distance: number) => ({
      deliveryFee: feeState.isLoading || feeState.error ? 0 : distance * 5000,
      isLoading: feeState.isLoading,
      error: feeState.error,
    }),
  }
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
    quantity: 2,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
}

describe('useCartPricing', () => {
  beforeEach(() => {
    feeState.isLoading = false
    feeState.error = null
    seed()
  })

  it('không cộng phí giao hàng cho đơn tại bàn dù còn khoảng cách cũ', () => {
    // Không dùng setOrderingType ở đây: hàm đó tự dọn deliveryDistance/deliveryAddress
    // khi đổi sang loại đơn khác DELIVERY, nên sẽ không bao giờ tái tạo được trạng thái
    // lệch của giỏ hàng cũ trong localStorage (type=AT_TABLE nhưng vẫn còn deliveryDistance
    // từ trước khi code dọn dẹp được thêm vào). Ghi thẳng qua setOrderingData để mô phỏng
    // đúng dữ liệu cũ đó.
    const store = useOrderFlowStore.getState()
    const current = store.orderingData!
    store.setOrderingData({
      ...current,
      type: OrderTypeEnum.AT_TABLE,
      deliveryDistance: 3.2,
      deliveryAddress: '12 Nguyễn Huệ',
    })

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(0)
    expect(result.current.finalTotal).toBe(100000)
  })

  it('đơn giao hàng có khoảng cách cũ nhưng chưa có địa chỉ thì phí giao hàng bằng 0', () => {
    const store = useOrderFlowStore.getState()
    const current = store.orderingData!
    store.setOrderingData({
      ...current,
      type: OrderTypeEnum.DELIVERY,
      deliveryDistance: 3.2,
      deliveryAddress: undefined,
    })

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(0)
    expect(result.current.finalTotal).toBe(100000)
  })

  it('cộng phí giao hàng khi là đơn giao hàng và đã có địa chỉ', () => {
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(16000)
    expect(result.current.finalTotal).toBe(116000)
  })

  it('chưa có địa chỉ thì phí giao hàng bằng 0', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.deliveryFee).toBe(0)
  })

  it('trả về map tra cứu theo id của dòng', () => {
    const id = useOrderFlowStore.getState().orderingData!.orderItems[0].id
    const { result } = renderHook(() => useCartPricing())

    expect(result.current.displayMap.get(id)?.finalPrice).toBe(50000)
  })

  it('promotion giảm đúng theo promotionValue, phản ánh trong promotionDiscount/savedTotal/finalTotal', () => {
    // calculateCartItemDisplay (src/utils/cart.ts) đọc item.promotionDiscount trước
    // (nullish-coalescing); chỉ khi field đó là undefined mới tự tính từ
    // promotionValue (%): promotionDiscount = round(original * (promotionValue/100)).
    // Ở đây cố tình KHÔNG set promotionDiscount để bài test đi qua đúng nhánh promotionValue.
    const store = useOrderFlowStore.getState()
    store.clearOrderingData()
    store.initializeOrdering()
    store.addOrderingItem({
      id: 'y',
      slug: 'ca-phe-sua',
      image: '',
      name: 'Cà phê sữa',
      quantity: 1,
      size: 'm',
      allVariants: [variant],
      variant,
      originalPrice: 100000,
      promotionValue: 10, // 10% x 100.000đ = 10.000đ
      description: '',
      isLimit: false,
      isGift: false,
    } as IOrderItem)

    const { result } = renderHook(() => useCartPricing())

    // subTotalBeforeDiscount = 100000 x 1 = 100000
    // promotionDiscount = round(100000 x 0.10) = 10000
    expect(result.current.subTotalBeforeDiscount).toBe(100000)
    expect(result.current.promotionDiscount).toBe(10000)
    expect(result.current.savedTotal).toBe(10000)
    expect(result.current.finalTotal).toBe(
      result.current.subTotalBeforeDiscount - result.current.promotionDiscount,
    )
    expect(result.current.finalTotal).toBe(90000)
  })

  it('voucher PERCENT_ORDER + ALL_REQUIRED giảm đúng % trên toàn đơn', () => {
    // calculateCartTotals (src/utils/cart.ts): với type=PERCENT_ORDER và
    // applicabilityRule=ALL_REQUIRED, voucherDiscount = round((value/100) x
    // (subTotalBeforeDiscount - promotionDiscount)) — tính ở cấp đơn hàng, không
    // phụ thuộc voucherProducts (để trống mảng này vẫn coi là "áp dụng cho tất cả",
    // theo isVoucherApplicable khi requiredSlugs.length === 0).
    const store = useOrderFlowStore.getState()
    const voucher = {
      slug: 'v1',
      title: 'Giảm 10%',
      code: 'GIAM10',
      type: VOUCHER_TYPE.PERCENT_ORDER,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      value: 10,
      minOrderValue: 0,
      voucherProducts: [],
    } as unknown as IVoucher
    store.setOrderingVoucher(voucher)

    const { result } = renderHook(() => useCartPricing())

    // seed(): originalPrice 50000 x quantity 2, không promotion.
    // subTotalBeforeDiscount = 100000, promotionDiscount = 0
    // voucherDiscount = round(0.10 x (100000 - 0)) = 10000
    expect(result.current.subTotalBeforeDiscount).toBe(100000)
    expect(result.current.promotionDiscount).toBe(0)
    expect(result.current.voucherDiscount).toBe(10000)
    expect(result.current.savedTotal).toBe(
      result.current.promotionDiscount + result.current.voucherDiscount,
    )
    expect(result.current.savedTotal).toBe(10000)
    expect(result.current.finalTotal).toBe(90000)
  })

  it('giỏ rỗng: không throw, mọi số hạng về 0', () => {
    useOrderFlowStore.getState().clearOrderingData()

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.displayMap.size).toBe(0)
    expect(result.current.subTotalBeforeDiscount).toBe(0)
    expect(result.current.promotionDiscount).toBe(0)
    expect(result.current.voucherDiscount).toBe(0)
    expect(result.current.deliveryFee).toBe(0)
    expect(result.current.finalTotal).toBe(0)
    expect(result.current.savedTotal).toBe(0)
  })

  it('đơn giao hàng đã có địa chỉ mà phí đang tải thì báo đang tính, không báo miễn phí', () => {
    feeState.isLoading = true
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.isDeliveryFeePending).toBe(true)
    expect(result.current.deliveryFee).toBe(0)
  })

  it('gọi phí lỗi cũng tính là chưa xong, không phải miễn phí', () => {
    feeState.error = new Error('network')
    const store = useOrderFlowStore.getState()
    store.setOrderingType(OrderTypeEnum.DELIVERY)
    store.setDeliveryAddress('12 Nguyễn Huệ')
    store.setDeliveryDistanceDuration(3.2, 20)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.isDeliveryFeePending).toBe(true)
  })

  it('đơn KHÔNG phải giao hàng thì không bao giờ ở trạng thái đang tính phí', () => {
    feeState.isLoading = true
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    const { result } = renderHook(() => useCartPricing())

    expect(result.current.isDeliveryFeePending).toBe(false)
  })

  it('memo hoá: rerender không đụng store thì displayMap giữ nguyên reference', () => {
    const { result, rerender } = renderHook(() => useCartPricing())
    const firstMap = result.current.displayMap

    rerender()

    expect(result.current.displayMap).toBe(firstMap)
  })
})
