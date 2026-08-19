import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// i18next chưa init trong môi trường test — t() trả thẳng key. Component gọi
// t('menu.increaseQuantity') / t('menu.decreaseQuantity') / t('menu.removeItem'),
// các key này đã chứa sẵn "increase"/"remove" nên vẫn khớp regex /tăng|increase/i
// và /xoá|remove/i dùng để tìm nút theo accessible name (aria-label).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'
import QuantitySelector, { MAX_ITEM_QUANTITY } from '../quantity-selector'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed(quantity: number): IOrderItem {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'seed',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0]
}

describe('QuantitySelector', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().clearOrderingData()
  })

  it('tăng số lượng và ghi vào store', async () => {
    const item = seed(1)
    render(<QuantitySelector cartItem={item} onRequestRemove={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /tăng|increase/i }))

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].quantity).toBe(2)
  })

  it('ở số lượng 1 thì nút giảm gọi onRequestRemove thay vì giảm tiếp', async () => {
    const item = seed(1)
    const onRequestRemove = vi.fn()
    render(<QuantitySelector cartItem={item} onRequestRemove={onRequestRemove} />)

    await userEvent.click(screen.getByRole('button', { name: /xoá|remove/i }))

    expect(onRequestRemove).toHaveBeenCalledTimes(1)
    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].quantity).toBe(1)
  })

  it('chặn ở trần 20', async () => {
    const item = seed(20)
    render(<QuantitySelector cartItem={item} onRequestRemove={vi.fn()} />)

    expect(screen.getByRole('button', { name: /tăng|increase/i })).toBeDisabled()
  })

  it('không truyền onRequestRemove: giữ icon giảm (khong đổi qua nút xoá) và không làm gì ở số lượng 1', async () => {
    const item = seed(1)
    render(<QuantitySelector cartItem={item} />)

    // Không có nút "xoá/remove" khi không có callback — vẫn là nút giảm số lượng.
    expect(screen.queryByRole('button', { name: /xoá|remove/i })).toBeNull()
    const decreaseButton = screen.getByRole('button', { name: /giảm|decrease/i })

    await userEvent.click(decreaseButton)

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].quantity).toBe(1)
  })

  it('maxQuantity tuỳ chỉnh: ở trần mặc định (20) nhưng maxQuantity cao hơn thì nút tăng vẫn bật', () => {
    const item = seed(MAX_ITEM_QUANTITY)
    render(<QuantitySelector cartItem={item} onRequestRemove={vi.fn()} maxQuantity={50} />)

    expect(screen.getByRole('button', { name: /tăng|increase/i })).not.toBeDisabled()
  })
})
