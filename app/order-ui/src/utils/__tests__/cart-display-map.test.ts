import { describe, it, expect } from 'vitest'
import { buildDisplayItemMap, calculateCartItemDisplay } from '../cart'
import { ICartItem, IOrderItem } from '@/types'

// Hai dòng cùng product slug nhưng khác size là ca gây lỗi P0-2:
// tra cứu theo slug luôn trả về dòng đầu tiên nên dòng thứ hai hiện sai giá.
function makeItem(id: string, price: number): IOrderItem {
  return {
    id,
    slug: 'tra-sua-tran-chau',
    image: '',
    name: 'Trà sữa trân châu',
    quantity: 1,
    size: id === 'it_1' ? 'M' : 'L',
    allVariants: [],
    variant: { slug: `variant-${id}`, price } as IOrderItem['variant'],
    originalPrice: price,
    description: '',
    isLimit: false,
    isGift: false,
  }
}

describe('buildDisplayItemMap', () => {
  it('giữ riêng từng dòng khi hai dòng cùng một sản phẩm', () => {
    const cart = {
      orderItems: [makeItem('it_1', 45000), makeItem('it_2', 55000)],
    } as unknown as ICartItem

    const map = buildDisplayItemMap(calculateCartItemDisplay(cart, null))

    expect(map.size).toBe(2)
    expect(map.get('it_1')?.finalPrice).toBe(45000)
    expect(map.get('it_2')?.finalPrice).toBe(55000)
  })

  it('trả về map rỗng khi không có dòng nào', () => {
    expect(buildDisplayItemMap([]).size).toBe(0)
  })
})
