import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'
import { useCartRevalidation } from '../use-cart-revalidation'

// `getSpecificMenu` luôn trả về đúng MỘT menu bọc trong `result.items[0]`
// (xem `flattenSpecificMenuPages` trong `src/hooks/use-menu.ts` và cách
// `client-menu.tabscontent.tsx` đọc `specificMenu?.result?.items?.[0]?.menuItems`).
// Mock phải phản ánh đúng shape thật này chứ không phải `result.menuItems` phẳng,
// nếu không hook sẽ luôn trả về mảng rỗng khi chạy thật dù test vẫn pass giả.
const menuItems = [
  { isLocked: false, currentStock: 0, product: { slug: 'banh-mi', isLimit: true } },
  { isLocked: false, currentStock: 99, product: { slug: 'tra-sua', isLimit: true } },
  { isLocked: true, currentStock: 99, product: { slug: 'mon-bi-khoa', isLimit: true } },
  { isLocked: false, currentStock: 0, product: { slug: 'mon-khong-gioi-han', isLimit: false } },
]

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useSpecificMenu: () => ({ data: { result: { items: [{ menuItems }] } }, isLoading: false }),
  }
})

const variant = { slug: 'v-m', price: 35000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function addItem(slug: string) {
  useOrderFlowStore.getState().addOrderingItem({
    id: 'seed',
    slug,
    image: '',
    name: slug,
    quantity: 1,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 35000,
    description: '',
    isLimit: true,
    isGift: false,
  } as IOrderItem)
}

describe('useCartRevalidation', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('đánh dấu món hết hàng theo menu hôm nay', () => {
    addItem('banh-mi')
    addItem('tra-sua')
    const items = useOrderFlowStore.getState().orderingData!.orderItems

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toEqual([items[0].id])
  })

  it('giỏ toàn món còn hàng thì danh sách rỗng', () => {
    addItem('tra-sua')

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toHaveLength(0)
  })

  it('món không có trong menu hôm nay thì bỏ qua, không đánh dấu hết hàng', () => {
    addItem('mon-la')

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toHaveLength(0)
  })

  it('món bị khoá (isLocked) thì báo hết hàng dù còn tồn kho', () => {
    addItem('mon-bi-khoa')
    const items = useOrderFlowStore.getState().orderingData!.orderItems

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toEqual([items[0].id])
  })

  it('món không giới hạn tồn kho (isLimit false) thì không báo hết hàng dù currentStock = 0', () => {
    addItem('mon-khong-gioi-han')

    const { result } = renderHook(() => useCartRevalidation())

    expect(result.current.soldOutItemIds).toHaveLength(0)
  })
})
