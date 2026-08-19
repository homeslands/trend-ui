import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import CartSummary from '../cart-summary'
import { ICartPricing } from '../../hooks/use-cart-pricing'

// i18next chưa được khởi tạo trong môi trường test: `useTranslation` thật trả về
// `t(key)` = chính `key` (vd. `t('order.deliveryFee')` → `'order.deliveryFee'`), nên
// assertion gốc trong brief tìm bằng regex `/phí giao hàng|delivery fee/i` sẽ KHÔNG
// khớp. Mock `react-i18next` ở PHẠM VI MODULE (convention từ order-type-tabs.test.tsx /
// cart-item-row.test.tsx) với bảng dịch khớp đúng nội dung thật trong
// src/locales/vi/menu.json (nhóm `order`), để giữ nguyên khả năng định vị bằng tiếng
// Việt như brief gốc mong muốn.
const translations: Record<string, string> = {
  'order.totalPayment': 'Tổng tiền',
  'order.subtotalBeforeDiscount': 'Tổng giá gốc',
  'order.promotionDiscount': 'Giảm giá khuyến mãi',
  'order.voucherDiscount': 'Giảm giá voucher',
  'order.deliveryFee': 'Phí giao hàng',
  'order.youSaved': 'Bạn đã tiết kiệm',
  'order.partialAppliedNote': 'Voucher giảm tối đa theo giá trị đơn hàng',
  'order.enterAddressForFee': 'Nhập địa chỉ để tính phí giao hàng',
}

const t = (key: string) => translations[key] ?? key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

const pricing: ICartPricing = {
  displayMap: new Map(),
  isDeliveryFeePending: false,
  subTotalBeforeDiscount: 174000,
  promotionDiscount: 29000,
  voucherDiscount: 4000,
  deliveryFee: 0,
  finalTotal: 141000,
  savedTotal: 33000,
}

describe('CartSummary', () => {
  beforeEach(() => {
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('không hiện dòng phí giao hàng cho đơn tại bàn', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    render(<CartSummary pricing={pricing} />)

    expect(screen.queryByText(/phí giao hàng|delivery fee/i)).toBeNull()
    // `formatCurrency` dùng dấu phẩy + ' đ' (xem src/utils/formatCurrency.ts),
    // không phải dấu chấm + '₫'.
    expect(screen.getByText('141,000 đ')).toBeInTheDocument()
  })

  it('hiện dòng phí giao hàng cho đơn giao hàng', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<CartSummary pricing={{ ...pricing, deliveryFee: 16000, finalTotal: 157000 }} />)

    expect(screen.getByText(/phí giao hàng|delivery fee/i)).toBeInTheDocument()
    expect(screen.getByText('157,000 đ')).toBeInTheDocument()
  })

  it('hiện số tiền tiết kiệm khi có giảm giá', () => {
    render(<CartSummary pricing={pricing} />)

    expect(screen.getByText(/33,000 đ/)).toBeInTheDocument()
  })

  // Bất biến quan trọng nhất của component: dòng hiển thị phải neo vào CHÍNH con số
  // được cộng vào tổng (`pricing.deliveryFee`), không neo vào `cart.type` — hai nguồn
  // khác nhau trôi lệch nhau đúng là cách lỗi P0-1 sinh ra (tổng cộng phí giao hàng
  // nhưng dòng phí giao hàng bị ẩn vì gate sai nguồn). Đây là trạng thái "không nên xảy
  // ra" (đơn tại bàn không nên có `pricing.deliveryFee > 0`), nhưng nếu nó xảy ra thì
  // hiển thị phải trung thực: thà hiện dòng phí lạ (nhìn là biết có gì đó sai) còn hơn
  // giấu đi và để khách thấy tổng cao hơn tổng các dòng mà không hiểu vì sao.
  it('luôn hiện dòng phí giao hàng khi tổng đã cộng phí, kể cả khi loại đơn không phải giao hàng', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    render(<CartSummary pricing={{ ...pricing, deliveryFee: 16000, finalTotal: 157000 }} />)

    expect(screen.getByText(/phí giao hàng/i)).toBeInTheDocument()
    expect(screen.getByText('16,000 đ')).toBeInTheDocument()
  })

  // Finding 1 (review round 1, Important): page.tsx cũ hiện dòng chú thích
  // `order.partialAppliedNote` ngay dưới dòng giảm giá voucher, giải thích cho khách vì
  // sao số tiền giảm ít hơn giá trị voucher họ kỳ vọng. Component mới đã khôi phục dòng
  // này trong cùng khối `pricing.voucherDiscount > 0` — khoá lại bằng test.
  it('hiện chú thích voucher giảm tối đa theo giá trị đơn hàng khi có giảm giá voucher', () => {
    render(<CartSummary pricing={pricing} />)

    expect(screen.getByText(/voucher giảm tối đa theo giá trị đơn hàng/i)).toBeInTheDocument()
  })

  // Finding 2 (review round 1, Minor nhưng sửa vì comment nói sai): đơn giao hàng CHƯA
  // có địa chỉ (`isDelivery = true`, `deliveryFee = 0`) phải hiện dòng phí dạng `—` VÀ
  // dòng gợi ý nhập địa chỉ ngay dưới — nếu không, comment "giữ isDelivery để có dòng
  // gợi ý" là nói sai so với hành vi thật.
  it('đơn giao hàng chưa có địa chỉ hiện dòng phí dạng — kèm gợi ý nhập địa chỉ', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.DELIVERY)

    render(<CartSummary pricing={{ ...pricing, deliveryFee: 0 }} />)

    // Chuỗi gợi ý ("Nhập địa chỉ để tính phí giao hàng") CHỨA cả cụm "phí giao hàng",
    // nên regex /phí giao hàng/i khớp cả nhãn dòng lẫn dòng gợi ý — dùng chuỗi khớp
    // chính xác cho nhãn dòng để tránh lỗi "multiple elements found".
    expect(screen.getByText('Phí giao hàng')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/nhập địa chỉ để tính phí giao hàng/i)).toBeInTheDocument()
  })

  // Finding 3 (review round 1, Important): 4 test trước đều dùng chung fixture đã có sẵn
  // giảm giá, nên nhánh "không giảm giá gì" (cả promotionDiscount, voucherDiscount VÀ
  // savedTotal đều 0) chưa từng được chạm — phải không hiện dòng khuyến mãi, dòng
  // voucher, chú thích của Finding 1, và dòng "Bạn đã tiết kiệm" cùng lúc.
  it('không có giảm giá nào thì không hiện dòng khuyến mãi, voucher, chú thích và tiết kiệm', () => {
    useOrderFlowStore.getState().setOrderingType(OrderTypeEnum.AT_TABLE)

    render(
      <CartSummary
        pricing={{
          ...pricing,
          promotionDiscount: 0,
          voucherDiscount: 0,
          deliveryFee: 0,
          savedTotal: 0,
          finalTotal: 174000,
        }}
      />,
    )

    expect(screen.queryByText(/giảm giá khuyến mãi/i)).toBeNull()
    expect(screen.queryByText(/giảm giá voucher/i)).toBeNull()
    expect(screen.queryByText(/voucher giảm tối đa theo giá trị đơn hàng/i)).toBeNull()
    expect(screen.queryByText(/bạn đã tiết kiệm/i)).toBeNull()
  })

  // Finding 3 (review round 1, Important), nhánh còn lại: `finalTotal = 0` không được
  // làm crash component (vd. chia cho 0 hoặc lỗi định dạng), và phải hiện đúng "0 đ".
  it('finalTotal = 0 không crash và hiện đúng 0 đ', () => {
    render(<CartSummary pricing={{ ...pricing, finalTotal: 0 }} />)

    expect(screen.getByText('0 đ')).toBeInTheDocument()
  })
})
