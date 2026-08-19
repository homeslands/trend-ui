import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOrderFlowStore } from '@/stores'
import { VOUCHER_TYPE } from '@/constants'
import { IDisplayCartItem, IOrderItem, IProductVariant, IVoucher } from '@/types'
import CartItemRow from '../cart-item-row'

// i18next chưa được khởi tạo trong môi trường test: `useTranslation` thật sẽ trả về
// hàm `t` mà `t(key)` chỉ trả lại chính `key`, KHÔNG nội suy tham số `{{value}}`. Test
// dưới đây cần assert nội dung nhãn giảm giá đã nội suy ("Giảm 20%"), nên mock
// `react-i18next` ở PHẠM VI MODULE (convention từ order-type-tabs.test.tsx /
// customer-analytics-panel.test.tsx) với một bảng dịch tối giản khớp đúng nội dung thật
// trong src/locales/vi/menu.json, và tự nội suy `{{value}}` bằng giá trị truyền vào.
const translations: Record<string, string> = {
  removeItem: 'Xoá món',
  soldOutInCart: 'Hết hàng hôm nay',
  removeSoldOut: 'Xoá khỏi giỏ',
  promotionBadge: 'Giảm {{value}}%',
  samePriceBadge: 'Đồng giá {{value}}',
}

const t = (key: string, options?: Record<string, unknown>) => {
  // Component gọi `t('menu.removeItem')` dù namespace đã là 'menu' (convention hiện có
  // trong page.tsx), nên bỏ tiền tố 'menu.' nếu có trước khi tra bảng dịch.
  const shortKey = key.startsWith('menu.') ? key.slice('menu.'.length) : key
  const template = translations[shortKey] ?? key
  if (!options) return template
  return Object.entries(options).reduce(
    (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
    template,
  )
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

const variant = { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } } as IProductVariant

const item = {
  id: 'it_2',
  slug: 'tra-sua',
  image: '',
  name: 'Trà sữa trân châu',
  quantity: 1,
  size: 'l',
  allVariants: [variant],
  variant,
  originalPrice: 55000,
  description: '',
  isLimit: false,
  isGift: false,
} as IOrderItem

const display = {
  ...item,
  finalPrice: 44000,
  priceAfterPromotion: 44000,
  promotionDiscount: 11000,
  voucherDiscount: 0,
} as IDisplayCartItem

describe('CartItemRow', () => {
  // Component đọc voucher từ `useOrderFlowStore((state) => state.orderingData?.voucher)`
  // (store thật, không mock) — reset về trạng thái mặc định (voucher: null) trước MỖI
  // test để test trước không rò rỉ voucher sang test sau.
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('hiển thị giá của chính dòng đó và nhãn giảm giá bằng chữ', () => {
    render(<CartItemRow item={item} display={display} isSoldOut={false} onRemove={vi.fn()} />)

    // `formatCurrency` thật (src/utils/formatCurrency.ts) dùng currency.js với
    // `separator: ','` và nối thêm ' đ' — không phải dấu chấm + '₫' liền như brief gốc
    // giả định. Xác nhận bằng cách gọi thẳng hàm: formatCurrency(44000) === '44,000 đ'.
    //
    // `item.quantity` là 1 trong dữ liệu test, nên giá đơn vị (44.000đ) và thành tiền cả
    // dòng (44.000đ x 1 = 44.000đ) render ra HAI node text giống hệt nhau — dùng
    // `getAllByText` thay vì `getByText` để không bị lỗi "multiple elements found".
    expect(screen.getAllByText('44,000 đ')).toHaveLength(2)
    expect(screen.getByText('55,000 đ')).toBeInTheDocument()
    expect(screen.getByText(/Giảm 20%/)).toBeInTheDocument()
  })

  it('gắn id để cuộn tới khi bị chặn đặt hàng', () => {
    const { container } = render(
      <CartItemRow item={item} display={display} isSoldOut={false} onRemove={vi.fn()} />,
    )

    expect(container.querySelector('#cart-row-it_2')).not.toBeNull()
  })

  it('hiện dải hết hàng khi món không còn bán', () => {
    render(<CartItemRow item={item} display={display} isSoldOut onRemove={vi.fn()} />)

    expect(screen.getByText(/Hết hàng hôm nay|Sold out today/)).toBeInTheDocument()
  })

  // Finding 1 (review round 1): xoá món là hành động phá huỷ dữ liệu giỏ hàng, chưa có
  // test nào bấm được nút xoá. Nút xoá ở đầu dòng có aria-label
  // `${t('menu.removeItem')} ${item.name}` — chứa tên món. `QuantitySelector` (được
  // CartItemRow truyền `onRequestRemove`) CŨNG render một nút có aria-label
  // `t('menu.removeItem')` khi quantity <= 1 (đổi nút "−" thành nút xoá), nhưng nhãn đó
  // KHÔNG chứa tên món — nên định vị bằng regex tên món vẫn trỏ đúng, không nhầm hai nút.
  it('bấm nút xoá gọi onRemove với đúng item', async () => {
    const onRemove = vi.fn()
    render(<CartItemRow item={item} display={display} isSoldOut={false} onRemove={onRemove} />)

    await userEvent.click(screen.getByRole('button', { name: new RegExp(item.name, 'i') }))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith(item)
  })

  // Finding 1 (review round 1, phần 2): dải "hết hàng" có nút xoá riêng ("Xoá khỏi giỏ")
  // — tách biệt hoàn toàn với nút xoá ở đầu dòng, kiểm thử luôn để không bỏ sót nhánh.
  it('bấm nút xoá trong dải hết hàng cũng gọi onRemove với đúng item', async () => {
    const onRemove = vi.fn()
    render(<CartItemRow item={item} display={display} isSoldOut onRemove={onRemove} />)

    await userEvent.click(screen.getByRole('button', { name: 'Xoá khỏi giỏ' }))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith(item)
  })

  // Finding 2 (review round 1): reviewer soi 4 ca hiển thị giá trong bảng đối chiếu với
  // page.tsx cũ, mới có test cho 2 ca (có giảm giá thường, hết hàng). Bổ sung 2 ca còn
  // lại — voucher đồng giá và không giảm giá gì — vì đây là các ca liên quan trực tiếp
  // tới số tiền hiển thị cho khách.
  it('hiện nhãn Đồng giá và dùng finalPrice làm giá đơn vị khi áp voucher đồng giá', () => {
    // Store thật (không mock) — set voucher SAME_PRICE_PRODUCT vào orderingData để
    // component đọc qua `state.orderingData?.voucher`.
    useOrderFlowStore.setState((state) => ({
      orderingData: state.orderingData
        ? { ...state.orderingData, voucher: { type: VOUCHER_TYPE.SAME_PRICE_PRODUCT } as IVoucher }
        : state.orderingData,
    }))

    const displaySamePrice = {
      ...item,
      finalPrice: 40000,
      priceAfterPromotion: 55000,
      promotionDiscount: 0,
      voucherDiscount: 15000,
    } as IDisplayCartItem

    render(
      <CartItemRow item={item} display={displaySamePrice} isSoldOut={false} onRemove={vi.fn()} />,
    )

    expect(screen.getByText(/Đồng giá/)).toBeInTheDocument()
    // Giá gốc (55.000đ) phải vẫn hiện gạch ngang — chứng minh so sánh dùng finalPrice
    // (giá đồng giá) chứ không phải originalPrice.
    expect(screen.getByText('55,000 đ')).toBeInTheDocument()
    // Giá đơn vị (finalPrice) và thành tiền cả dòng (quantity=1) trùng giá trị —
    // giống lý do dùng getAllByText ở test giá đầu tiên.
    expect(screen.getAllByText('40,000 đ')).toHaveLength(2)
  })

  it('không hiện giá gạch ngang và không hiện nhãn giảm giá khi không có giảm giá nào', () => {
    const displayNoDiscount = {
      ...item,
      finalPrice: 55000,
      priceAfterPromotion: 55000,
      promotionDiscount: 0,
      voucherDiscount: 0,
    } as IDisplayCartItem

    const { container } = render(
      <CartItemRow item={item} display={displayNoDiscount} isSoldOut={false} onRemove={vi.fn()} />,
    )

    expect(container.querySelector('.line-through')).toBeNull()
    expect(screen.queryByText(/Giảm/)).toBeNull()
    expect(screen.queryByText(/Đồng giá/)).toBeNull()
  })
})
