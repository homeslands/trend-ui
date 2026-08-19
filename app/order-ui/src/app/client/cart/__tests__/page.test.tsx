import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OrderFlowStep, useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'

// i18next chưa được khởi tạo trong môi trường test.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('react-helmet', () => ({ Helmet: () => null }))

// Các component/hook con của trang có chuỗi phụ thuộc nặng (react-query, dialog,
// sheet...) không liên quan tới guard đang được khoá ở đây — thay bằng stand-in để test
// tập trung đúng một điều: guard theo `currentStep` có chặn đúng lúc hay không.
vi.mock('@/components/app/dialog', () => ({ DeleteAllCartDialog: () => null }))
vi.mock('@/components/app/input', () => ({ OrderNoteInput: () => null }))
vi.mock('@/components/app/sheet', () => ({ VoucherListSheet: () => null }))
vi.mock('../components', () => ({
  CartActions: () => <div>stub-cart-actions</div>,
  CartEmpty: () => <div data-testid="cart-empty">stub-cart-empty</div>,
  CartErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CartItemRow: () => <div>stub-cart-item-row</div>,
  CartSummary: () => <div>stub-cart-summary</div>,
  FulfillmentFields: () => <div>stub-fulfillment-fields</div>,
  OrderTypeTabs: () => <div>stub-order-type-tabs</div>,
}))
vi.mock('../hooks/use-cart-blockers', () => ({ useCartBlockers: () => [] }))
vi.mock('../hooks/use-cart-pricing', () => ({
  useCartPricing: () => ({
    displayMap: new Map(),
    subTotalBeforeDiscount: 0,
    promotionDiscount: 0,
    voucherDiscount: 0,
    deliveryFee: 0,
    finalTotal: 0,
    savedTotal: 0,
  }),
}))
vi.mock('../hooks/use-cart-revalidation', () => ({
  useCartRevalidation: () => ({ soldOutItemIds: [], isChecking: false }),
}))
vi.mock('../hooks/use-cart-voucher-guard', () => ({ useCartVoucherGuard: () => undefined }))
vi.mock('../hooks/use-undo-remove', () => ({
  UNDO_WINDOW_MS: 5000,
  useUndoRemove: () => ({ removeWithUndo: () => null, undo: () => false }),
}))

import ClientCartPage from '../page'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seedItem() {
  useOrderFlowStore.getState().addOrderingItem({
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
}

describe('ClientCartPage — guard theo currentStep', () => {
  beforeEach(() => {
    // jsdom không implement window.scrollTo; page.tsx gọi nó trong một effect không
    // liên quan tới guard đang test — stub để log không nhiễu.
    window.scrollTo = vi.fn()
    useOrderFlowStore.getState().initializeOrdering()
    seedItem()
  })

  // Đúng kịch bản gây lỗi: `initializeUpdating` (bước sửa một đơn cũ) không xoá
  // `orderingData`, nên nếu trang chỉ dựa vào "giỏ có món hay không" thì khách đang sửa
  // đơn cũ mở /cart sẽ vẫn thấy giỏ hàng và đặt được đơn mới đè lên luồng sửa đơn.
  it('hiện CartEmpty khi currentStep là UPDATING dù orderingData còn món', () => {
    useOrderFlowStore.getState().setCurrentStep(OrderFlowStep.UPDATING)

    render(<ClientCartPage />)

    expect(screen.getByTestId('cart-empty')).toBeInTheDocument()
    expect(screen.queryByText('stub-order-type-tabs')).toBeNull()
  })

  it('hiện nội dung giỏ hàng khi currentStep là ORDERING và giỏ còn món', () => {
    render(<ClientCartPage />)

    expect(screen.queryByTestId('cart-empty')).toBeNull()
    expect(screen.getByText('stub-order-type-tabs')).toBeInTheDocument()
  })
})
