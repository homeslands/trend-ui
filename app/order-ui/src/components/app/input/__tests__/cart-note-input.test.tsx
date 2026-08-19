import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// i18next chưa init trong môi trường test — t() trả thẳng key, dùng để tìm input
// theo placeholder (giống convention ở customer-analytics-panel.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'
import CartNoteInput from '../cart-note-input'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function seed(note = ''): IOrderItem {
  const store = useOrderFlowStore.getState()
  store.initializeOrdering()
  store.addOrderingItem({
    id: 'seed',
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
    note,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0]
}

function getNote() {
  return useOrderFlowStore.getState().orderingData!.orderItems[0].note
}

describe('CartNoteInput', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().clearOrderingData()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounce 300ms: không ghi ngay khi gõ, chỉ ghi đúng 1 lần với giá trị cuối sau khi hết debounce', () => {
    const item = seed()
    const addNoteSpy = vi.spyOn(useOrderFlowStore.getState(), 'addNote')
    render(<CartNoteInput cartItem={item} />)

    const input = screen.getByPlaceholderText('order.enterNote') as HTMLInputElement

    act(() => {
      fireEvent.change(input, { target: { value: 'Ít đá' } })
    })
    act(() => {
      fireEvent.change(input, { target: { value: 'Ít đá, nhiều đường' } })
    })

    // Chưa hết debounce: chưa ghi vào store.
    expect(addNoteSpy).not.toHaveBeenCalled()
    expect(getNote()).toBe('')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(addNoteSpy).toHaveBeenCalledTimes(1)
    expect(addNoteSpy).toHaveBeenCalledWith(item.id, 'Ít đá, nhiều đường')
    expect(getNote()).toBe('Ít đá, nhiều đường')
  })

  it('unmount trước khi hết 300ms vẫn ghi nốt giá trị đang gõ (không mất ghi chú)', () => {
    const item = seed()
    const { unmount } = render(<CartNoteInput cartItem={item} />)

    const input = screen.getByPlaceholderText('order.enterNote') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'Không đường' } })
    })

    // Rời trang / đóng drawer trước khi debounce timer tự chạy (< 300ms).
    act(() => {
      vi.advanceTimersByTime(100)
    })
    unmount()

    expect(getNote()).toBe('Không đường')
  })

  it('mất focus (blur) ghi nốt giá trị đang chờ ngay, không cần đợi debounce', () => {
    const item = seed()
    render(<CartNoteInput cartItem={item} />)

    const input = screen.getByPlaceholderText('order.enterNote') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'Thêm trân châu' } })
    })
    act(() => {
      fireEvent.blur(input)
    })

    expect(getNote()).toBe('Thêm trân châu')
  })

  it('ghi chú cũ dài hơn 120 ký tự vẫn hiển thị đầy đủ, không bị cắt', () => {
    const longNote = 'a'.repeat(150)
    const item = seed(longNote)
    render(<CartNoteInput cartItem={item} />)

    const input = screen.getByPlaceholderText('order.enterNote') as HTMLInputElement
    expect(input.value).toBe(longNote)
    expect(input.value.length).toBe(150)
  })
})
