import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant, IVoucher } from '@/types'
import { VOUCHER_TYPE } from '@/constants'

import { useCartVoucherGuard } from '../use-cart-voucher-guard'

// Giữ nguyên mọi export thật của `@/utils` (store cũng import từ đây), chỉ chặn hai hàm
// toast để (a) test không phụ thuộc i18next đã init, (b) khoá lại ĐÚNG mã lỗi hiện cho
// khách — mã sai thì khách đọc được thông báo không liên quan tới lý do voucher bị gỡ.
const showErrorToast = vi.fn()
const showErrorToastMessage = vi.fn()
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    showErrorToast: (code: number) => showErrorToast(code),
    showErrorToastMessage: (message: string) => showErrorToastMessage(message),
  }
})

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function addItem(slug: string, quantity: number, promotionDiscount = 0) {
  useOrderFlowStore.getState().addOrderingItem({
    id: 'seed',
    slug,
    image: '',
    name: slug,
    quantity,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    promotionDiscount,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
}

function makeVoucher(overrides: Partial<IVoucher>): IVoucher {
  return {
    slug: 'voucher-test',
    code: 'TEST',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    value: 10,
    minOrderValue: 0,
    maxItems: 0,
    ...overrides,
  } as unknown as IVoucher
}

function currentVoucher() {
  return useOrderFlowStore.getState().orderingData?.voucher ?? null
}

describe('useCartVoucherGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('gỡ voucher đồng giá khi giỏ không còn sản phẩm nào thuộc voucher', () => {
    addItem('tra-sua', 1)
    useOrderFlowStore.getState().addVoucher(
      makeVoucher({
        type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
        voucherProducts: [{ product: { slug: 'ca-phe' } }],
      } as Partial<IVoucher>),
    )

    renderHook(() => useCartVoucherGuard())

    expect(currentVoucher()).toBeNull()
    expect(showErrorToast).toHaveBeenCalledWith(143422)
  })

  it('gỡ voucher khi tổng tiền sau khuyến mãi thấp hơn minOrderValue', () => {
    // 1 × (50.000 − 10.000) = 40.000 < 100.000
    addItem('tra-sua', 1, 10000)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ minOrderValue: 100000 }))

    renderHook(() => useCartVoucherGuard())

    expect(currentVoucher()).toBeNull()
    expect(showErrorToast).toHaveBeenCalledWith(1004)
  })

  it('gỡ voucher khi tổng số lượng vượt maxItems', () => {
    addItem('tra-sua', 2)
    addItem('ca-phe', 2)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ maxItems: 3 }))

    renderHook(() => useCartVoucherGuard())

    expect(currentVoucher()).toBeNull()
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.voucherMaxItemsExceeded')
  })

  // Ca âm — quan trọng ngang ba ca trên: không có nó thì một guard gỡ voucher vô tội vạ
  // vẫn làm cả ba test kia xanh.
  it('KHÔNG gỡ voucher hợp lệ và không hiện lỗi nào (kể cả khi chạm đúng ngưỡng)', () => {
    // Cố tình đặt ở ĐÚNG BIÊN cả hai phía: tổng 2 × 50.000 = 100.000 = minOrderValue,
    // và số lượng 2 = maxItems. Cả hai ngưỡng đều là "bằng thì vẫn hợp lệ" — đặt biên
    // ở đây mới bắt được lỗi đổi `>` thành `>=` (hoặc `<` thành `<=`) sau này.
    addItem('tra-sua', 2)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ minOrderValue: 100000, maxItems: 2 }))

    renderHook(() => useCartVoucherGuard())

    expect(currentVoucher()?.slug).toBe('voucher-test')
    expect(showErrorToast).not.toHaveBeenCalled()
    expect(showErrorToastMessage).not.toHaveBeenCalled()
  })

  it('KHÔNG gỡ voucher đồng giá khi giỏ vẫn còn sản phẩm thuộc voucher', () => {
    addItem('tra-sua', 5)
    useOrderFlowStore.getState().addVoucher(
      makeVoucher({
        type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
        // minOrderValue lớn nhưng voucher đồng giá KHÔNG bị ràng buộc theo giá trị đơn.
        minOrderValue: 999999,
        voucherProducts: [{ product: { slug: 'tra-sua' } }],
      } as Partial<IVoucher>),
    )

    renderHook(() => useCartVoucherGuard())

    expect(currentVoucher()?.slug).toBe('voucher-test')
    expect(showErrorToast).not.toHaveBeenCalled()
  })
})
