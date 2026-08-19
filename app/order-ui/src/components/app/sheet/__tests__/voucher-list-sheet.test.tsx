import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant, IVoucher } from '@/types'
import { VOUCHER_TYPE } from '@/constants'
import { useCartVoucherGuard } from '@/app/client/cart/hooks/use-cart-voucher-guard'

import VoucherListSheet from '../voucher-list-sheet'

// Task 19: trước bản sửa này, `VoucherListSheet` có một effect tự kiểm tra lại
// `minOrderValue`/`maxItems` (dòng ~238-249 bản cũ) TRÙNG với 2 trong 3 effect của
// `useCartVoucherGuard` (Task 18). Trang giỏ hàng render CẢ HAI cùng lúc
// (`src/app/client/cart/page.tsx`: `useCartVoucherGuard()` + `<VoucherListSheet />`),
// nên khi một voucher hết điều kiện, khách thấy 2 toast khác nội dung cho cùng một sự
// kiện: toast lỗi cụ thể (vd. mã 1004) từ guard, RỒI toast "Gỡ voucher thành công" chung
// chung từ `handleToggleVoucher` bên trong sheet — gây hiểu lầm giống như khách tự gỡ.
// Test này khoá lại: sau khi trang mở với voucher không còn hợp lệ, CHỈ MỘT toast hiện ra.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Component chỉ dùng đúng 9 hook này từ `@/hooks` (xem import ở đầu voucher-list-sheet.tsx).
// Thay toàn bộ module (không dùng importOriginal) để tránh kéo theo mọi hook khác trong
// barrel `@/hooks` (nhiều hook phụ thuộc Firebase/Capacitor không chạy được trong jsdom).
vi.mock('@/hooks', () => ({
  useIsMobile: () => false,
  useViewportHeight: () => 800,
  usePagination: () => ({ pagination: { pageIndex: 1, pageSize: 10 } }),
  usePublicVouchersForOrder: () => ({ data: undefined }),
  useSpecificPublicVoucher: () => ({ data: undefined, refetch: vi.fn() }),
  useSpecificVoucher: () => ({ data: undefined, refetch: vi.fn() }),
  useValidatePublicVoucher: () => ({ mutate: vi.fn() }),
  useValidateVoucher: () => ({ mutate: vi.fn() }),
  useVouchersForOrder: () => ({ data: undefined }),
}))

const showErrorToast = vi.fn()
const showErrorToastMessage = vi.fn()
const showToast = vi.fn()
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    showErrorToast: (code: number) => showErrorToast(code),
    showErrorToastMessage: (message: string) => showErrorToastMessage(message),
    showToast: (message: string) => showToast(message),
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
    voucherProducts: [],
    ...overrides,
  } as unknown as IVoucher
}

// Trang giỏ hàng thật render `useCartVoucherGuard()` và `<VoucherListSheet />` cùng lúc
// trong cùng cây component (page.tsx) — dựng lại đúng cấu trúc đó để bài test phản ánh
// đúng tình huống gây toast kép (mỗi component test riêng lẻ sẽ không bắt được lỗi).
function Harness() {
  useCartVoucherGuard()
  return <VoucherListSheet />
}

function renderHarness() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VoucherListSheet + useCartVoucherGuard (Task 19: chỉ một toast khi gỡ voucher tự động)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('gỡ voucher do KHÔNG đạt minOrderValue: chỉ hiện đúng một toast (lỗi 1004), không có toast thành công', () => {
    // 1 × 50.000 = 50.000 < 100.000 (minOrderValue)
    addItem('tra-sua', 1)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ minOrderValue: 100000 }))

    renderHarness()

    expect(useOrderFlowStore.getState().orderingData?.voucher).toBeNull()
    // Đúng một toast lỗi, với đúng mã lý do (1004 = chưa đạt giá trị đơn tối thiểu).
    expect(showErrorToast).toHaveBeenCalledTimes(1)
    expect(showErrorToast).toHaveBeenCalledWith(1004)
    // Không có toast "Gỡ voucher thành công" chung chung từ effect trùng trong sheet.
    expect(showToast).not.toHaveBeenCalled()
  })

  it('gỡ voucher do vượt maxItems: chỉ hiện đúng một toast, không có toast thành công', () => {
    addItem('tra-sua', 2)
    addItem('ca-phe', 2)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ maxItems: 3 }))

    renderHarness()

    expect(useOrderFlowStore.getState().orderingData?.voucher).toBeNull()
    expect(showErrorToastMessage).toHaveBeenCalledTimes(1)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.voucherMaxItemsExceeded')
    expect(showToast).not.toHaveBeenCalled()
  })
})
