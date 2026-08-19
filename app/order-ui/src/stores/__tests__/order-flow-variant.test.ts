import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant } from '@/types'

const variantM = { slug: 'v-m', price: 45000, size: { slug: 's-m', name: 'm' } } as IProductVariant
const variantL = { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } } as IProductVariant
const variantCafeM = { slug: 'cf-m', price: 30000, size: { slug: 's-m', name: 'm' } } as IProductVariant
const variantCafeL = { slug: 'cf-l', price: 40000, size: { slug: 's-l', name: 'l' } } as IProductVariant

function seedCart() {
  useOrderFlowStore.getState().initializeOrdering()
  useOrderFlowStore.getState().addOrderingItem({
    id: 'ignored',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variantM, variantL],
    variant: variantM,
    originalPrice: 45000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  return useOrderFlowStore.getState().orderingData!.orderItems[0].id
}

// `addOrderingItem` luôn cấp id mới (`generateOrderItemId()`), bỏ qua `id` truyền vào —
// nên gọi hai lần với hai sản phẩm khác nhau chắc chắn tạo ra hai dòng riêng biệt, đúng
// điều kiện cần để kiểm "đổi dòng này không đụng dòng khác".
function seedTwoItems() {
  useOrderFlowStore.getState().initializeOrdering()
  useOrderFlowStore.getState().addOrderingItem({
    id: 'ignored-1',
    slug: 'tra-sua',
    image: '',
    name: 'Trà sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variantM, variantL],
    variant: variantM,
    originalPrice: 45000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  useOrderFlowStore.getState().addOrderingItem({
    id: 'ignored-2',
    slug: 'ca-phe-sua',
    image: '',
    name: 'Cà phê sữa',
    quantity: 1,
    size: 'm',
    allVariants: [variantCafeM, variantCafeL],
    variant: variantCafeM,
    originalPrice: 30000,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
  const items = useOrderFlowStore.getState().orderingData!.orderItems
  return { firstId: items[0].id, secondId: items[1].id }
}

describe('changeOrderingItemVariant', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().clearOrderingData()
  })

  it('đổi variant, size và giá gốc của đúng dòng', () => {
    const id = seedCart()

    useOrderFlowStore.getState().changeOrderingItemVariant(id, 'v-l')

    const item = useOrderFlowStore.getState().orderingData!.orderItems[0]
    expect(item.variant.slug).toBe('v-l')
    expect(item.size).toBe('l')
    expect(item.originalPrice).toBe(55000)
  })

  it('bỏ qua khi variant slug không có trong allVariants', () => {
    const id = seedCart()

    useOrderFlowStore.getState().changeOrderingItemVariant(id, 'khong-ton-tai')

    expect(useOrderFlowStore.getState().orderingData!.orderItems[0].variant.slug).toBe('v-m')
  })

  it('không đụng tới dòng khác', () => {
    // Test trước chỉ seed MỘT dòng rồi đổi variant bằng id không tồn tại — điều đó chỉ
    // chứng minh "id lạ là no-op", không chứng minh dòng khác được giữ nguyên (không có
    // dòng khác nào để đụng vào). Ở đây seed hai dòng khác id, đổi variant của dòng thứ
    // nhất, rồi assert toàn bộ dòng thứ hai (variant.slug, size, originalPrice) không đổi.
    const { firstId, secondId } = seedTwoItems()

    useOrderFlowStore.getState().changeOrderingItemVariant(firstId, 'v-l')

    const secondItem = useOrderFlowStore
      .getState()
      .orderingData!.orderItems.find((item) => item.id === secondId)!
    expect(secondItem.variant.slug).toBe('cf-m')
    expect(secondItem.size).toBe('m')
    expect(secondItem.originalPrice).toBe(30000)
  })
})
