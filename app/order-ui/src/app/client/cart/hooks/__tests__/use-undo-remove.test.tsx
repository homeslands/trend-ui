import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant, IVoucher } from '@/types'
import { VOUCHER_TYPE } from '@/constants'

import { useUndoRemove } from '../use-undo-remove'

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function addItem(name: string, slug: string, quantity: number) {
  useOrderFlowStore.getState().addOrderingItem({
    id: 'seed',
    slug,
    image: '',
    name,
    quantity,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
}

/** Ba món để có một món NẰM GIỮA — vị trí duy nhất chứng minh được "về đúng chỗ cũ". */
function seedThreeItems() {
  useOrderFlowStore.getState().initializeOrdering()
  addItem('Trà sữa', 'tra-sua', 1)
  addItem('Cà phê', 'ca-phe', 3)
  addItem('Nước ép', 'nuoc-ep', 2)
  return useOrderFlowStore.getState().orderingData!.orderItems
}

function currentItems() {
  return useOrderFlowStore.getState().orderingData!.orderItems
}

describe('useUndoRemove', () => {
  beforeEach(() => {
    seedThreeItems()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hoàn tác món ở giữa danh sách thì món quay lại ĐÚNG VỊ TRÍ CŨ, đúng số lượng và ghi chú', () => {
    const items = currentItems()
    const middle = items[1]
    useOrderFlowStore.getState().addOrderingNote(middle.id, 'ít đường')
    const middleWithNote = currentItems()[1]

    const { result } = renderHook(() => useUndoRemove())

    let key = ''
    act(() => {
      key = result.current.removeWithUndo(middleWithNote)!.key
    })

    expect(currentItems().map((i) => i.name)).toEqual(['Trà sữa', 'Nước ép'])

    let undone = false
    act(() => {
      undone = result.current.undo(key)
    })

    expect(undone).toBe(true)
    const restored = currentItems()
    expect(restored.map((i) => i.name)).toEqual(['Trà sữa', 'Cà phê', 'Nước ép'])
    // Đúng vị trí (index 1), đúng dòng (cùng id), và không mất dữ liệu của dòng đó.
    expect(restored[1].id).toBe(middle.id)
    expect(restored[1].quantity).toBe(3)
    expect(restored[1].note).toBe('ít đường')
  })

  it('xoá hai món liên tiếp trong cùng cửa sổ thì hoàn tác được CẢ HAI', () => {
    const items = currentItems()
    const { result } = renderHook(() => useUndoRemove())

    let firstKey = ''
    let secondKey = ''
    act(() => {
      firstKey = result.current.removeWithUndo(items[0])!.key
      secondKey = result.current.removeWithUndo(items[2])!.key
    })

    expect(currentItems().map((i) => i.name)).toEqual(['Cà phê'])

    // Hoàn tác theo thứ tự ngược lại với lúc xoá — cả hai đều phải còn sống.
    act(() => {
      expect(result.current.undo(secondKey)).toBe(true)
      expect(result.current.undo(firstKey)).toBe(true)
    })

    expect(currentItems().map((i) => i.name)).toEqual(['Trà sữa', 'Cà phê', 'Nước ép'])
  })

  it('không chèn trùng khi món đã được thêm lại vào giỏ trước lúc bấm hoàn tác', () => {
    const items = currentItems()
    const { result } = renderHook(() => useUndoRemove())

    let key = ''
    act(() => {
      key = result.current.removeWithUndo(items[0])!.key
    })

    // Khách tự thêm lại đúng dòng đó (vd. từ trang menu) trong lúc toast còn hiện.
    act(() => {
      const store = useOrderFlowStore.getState()
      const data = store.orderingData!
      store.setOrderingData({ ...data, orderItems: [items[0], ...data.orderItems] })
    })

    let undone = true
    act(() => {
      undone = result.current.undo(key)
    })

    expect(undone).toBe(false)
    expect(currentItems().filter((i) => i.id === items[0].id)).toHaveLength(1)
  })

  it('hết cửa sổ hoàn tác thì undo không còn tác dụng và onExpire được gọi', () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    const items = currentItems()
    const { result } = renderHook(() => useUndoRemove({ windowMs: 5000, onExpire }))

    let key = ''
    act(() => {
      key = result.current.removeWithUndo(items[1])!.key
    })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(result.current.undo(key)).toBe(false)
    expect(currentItems().map((i) => i.name)).toEqual(['Trà sữa', 'Nước ép'])
  })

  it('rời trang khi cửa sổ hoàn tác còn chạy thì timer bị dọn, không nổ lần thứ hai', () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    const items = currentItems()
    const { result, unmount } = renderHook(() => useUndoRemove({ windowMs: 5000, onExpire }))

    act(() => {
      result.current.removeWithUndo(items[0])
    })
    unmount()

    // Đúng 1 lần (do cleanup unmount), và timer đã bị dọn nên không có lần thứ hai.
    expect(onExpire).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  // Toast sống ngoài cây React của trang (`<Toaster/>` ở main.tsx) và react-hot-toast
  // dừng đếm giờ khi con trỏ ở trên toast, nên rời `/cart` KHÔNG làm toast biến mất.
  // Sau unmount thì `undo()` chỉ còn trả false — nếu hook không báo ra, khách còn một
  // nút "Hoàn tác" bấm vào không làm gì trong khi món đã mất thật.
  it('rời trang khi còn NHIỀU cửa sổ hoàn tác thì báo đóng toast cho MỌI entry', () => {
    const onExpire = vi.fn()
    const items = currentItems()
    const { result, unmount } = renderHook(() => useUndoRemove({ onExpire }))

    let firstKey = ''
    let secondKey = ''
    act(() => {
      firstKey = result.current.removeWithUndo(items[0])!.key
      secondKey = result.current.removeWithUndo(items[2])!.key
    })

    unmount()

    expect(onExpire).toHaveBeenCalledTimes(2)
    expect(onExpire.mock.calls.map((call) => call[0].key).sort()).toEqual(
      [firstKey, secondKey].sort(),
    )
    // Và đúng là hoàn tác không còn tác dụng sau đó — tức toast buộc phải đóng.
    expect(result.current.undo(firstKey)).toBe(false)
  })

  it('xoá món CUỐI CÙNG thì gỡ voucher, hoàn tác thì trả voucher lại', () => {
    useOrderFlowStore.getState().initializeOrdering()
    addItem('Trà sữa', 'tra-sua', 1)
    const voucher = {
      slug: 'giam-10',
      code: 'GIAM10',
      type: VOUCHER_TYPE.PERCENT_ORDER,
      value: 10,
      minOrderValue: 0,
      maxItems: 0,
    } as unknown as IVoucher
    useOrderFlowStore.getState().addVoucher(voucher)

    const { result } = renderHook(() => useUndoRemove())

    let key = ''
    act(() => {
      key = result.current.removeWithUndo(currentItems()[0])!.key
    })

    expect(useOrderFlowStore.getState().orderingData!.orderItems).toHaveLength(0)
    expect(useOrderFlowStore.getState().orderingData!.voucher).toBeNull()

    act(() => {
      result.current.undo(key)
    })

    expect(useOrderFlowStore.getState().orderingData!.orderItems).toHaveLength(1)
    expect(useOrderFlowStore.getState().orderingData!.voucher?.slug).toBe('giam-10')
  })
})
