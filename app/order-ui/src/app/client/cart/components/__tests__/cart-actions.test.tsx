import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartActions from '../cart-actions'
import { ICartPricing } from '../../hooks/use-cart-pricing'

// i18next chưa được khởi tạo trong môi trường test (xem cart-summary.test.tsx): `t`
// thật trả về chính khoá thay vì bản dịch. Mock `react-i18next` ở PHẠM VI MODULE với
// bảng dịch khớp đúng nội dung thật trong src/locales/vi/menu.json — key `order.totalPayment`
// nằm trong nhóm `order`, key `menu.blockerPrefix` nằm trong nhóm `menu` (cả hai file đều
// dùng chung namespace `menu.json`, key có dấu chấm nên tra thẳng theo chuỗi đầy đủ).
const translations: Record<string, string> = {
  'order.totalPayment': 'Tổng tiền',
  'menu.blockerPrefix': 'Còn thiếu',
}

const t = (key: string) => translations[key] ?? key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

// `@/components/app/dialog` là barrel export RẤT nhiều dialog khác (CreateOrderDialog
// chỉ là một trong hàng chục export). Nếu thay thế toàn bộ module bằng object chỉ có
// CreateOrderDialog, bất kỳ export nào khác mà CartActions hoặc cây con của nó cần (kể
// cả gián tiếp qua re-export nội bộ) sẽ vỡ. Dùng `importOriginal` để giữ nguyên mọi
// export khác, chỉ ghi đè CreateOrderDialog bằng bản giả lập tối giản.
vi.mock('@/components/app/dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/app/dialog')>()
  return {
    ...actual,
    // Expose `disabledText` qua data-attribute (thay vì bỏ qua như bản mock ban đầu) để
    // test có thể khoá lại bất biến: khi có NHIỀU blocker cùng lúc, `disabledText` phải
    // là nhãn của blocker ĐẦU TIÊN (`blockers[0].label`), không phải blocker bất kỳ khác.
    CreateOrderDialog: ({
      disabled,
      disabledText,
    }: {
      disabled?: boolean
      disabledText?: string
    }) => (
      <button type="button" disabled={disabled} data-disabled-text={disabledText ?? ''}>
        Đặt hàng
      </button>
    ),
  }
})

const pricing: ICartPricing = {
  displayMap: new Map(),
  isDeliveryFeePending: false,
  subTotalBeforeDiscount: 100000,
  promotionDiscount: 0,
  voucherDiscount: 0,
  deliveryFee: 0,
  finalTotal: 100000,
  savedTotal: 0,
}

describe('CartActions', () => {
  it('disable nút đặt hàng khi còn điều kiện chặn', () => {
    render(
      <CartActions
        pricing={pricing}
        blockers={[{ code: 'NO_TABLE', label: 'Chọn bàn', targetId: 'cart-field-table' }]}
      />,
    )

    expect(screen.getByRole('button', { name: /đặt hàng/i })).toBeDisabled()
    expect(screen.getByText(/Chọn bàn/)).toBeInTheDocument()
  })

  it('bấm vào điều kiện chặn thì cuộn tới đúng phần tử', async () => {
    const target = document.createElement('div')
    target.id = 'cart-field-table'
    // jsdom KHÔNG cài đặt sẵn scrollIntoView (gọi trực tiếp sẽ ném "Not implemented") —
    // phải tự stub trước khi render/click.
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    render(
      <CartActions
        pricing={pricing}
        blockers={[{ code: 'NO_TABLE', label: 'Chọn bàn', targetId: 'cart-field-table' }]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Chọn bàn/ }))

    expect(target.scrollIntoView).toHaveBeenCalled()
    document.body.removeChild(target)
  })

  it('bật nút đặt hàng khi không còn điều kiện chặn', () => {
    render(<CartActions pricing={pricing} blockers={[]} />)

    expect(screen.getByRole('button', { name: /đặt hàng/i })).toBeEnabled()
  })

  // focusTarget được dùng cho 3 loại target khác nhau (Task 11): `cart-field-table` gắn
  // vào SelectTrigger (thẻ <button>), `cart-field-address` / `cart-field-phone` gắn vào
  // <input>. `el instanceof HTMLElement` chỉ để TypeScript hẹp kiểu cho `.focus()` (vốn
  // không tồn tại trên `Element`) — cả HTMLButtonElement lẫn HTMLInputElement đều là
  // HTMLElement nên guard đúng cho cả hai. Test này khoá lại hành vi cho trường hợp input.
  it('focus đúng phần tử input khi target là ô nhập liệu (vd. địa chỉ/SĐT)', async () => {
    const input = document.createElement('input')
    input.id = 'cart-field-address'
    input.scrollIntoView = vi.fn()
    document.body.appendChild(input)

    render(
      <CartActions
        pricing={pricing}
        blockers={[{ code: 'NO_ADDRESS', label: 'Nhập địa chỉ giao hàng', targetId: 'cart-field-address' }]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Nhập địa chỉ giao hàng/ }))

    expect(input.scrollIntoView).toHaveBeenCalled()
    expect(input).toHaveFocus()
    document.body.removeChild(input)
  })

  // Finding 1 (review round 1, Important): bug gốc là đơn giao hàng thiếu CẢ địa chỉ LẪN
  // số điện thoại cùng lúc (`NO_ADDRESS` + `BAD_PHONE`), nhưng 4 test trên chỉ dùng 0 hoặc
  // 1 blocker — nhánh nhiều blocker chưa từng chạy. Test này khoá lại: mọi lý do chặn đều
  // phải hiện ra, VÀ `disabledText` truyền cho CreateOrderDialog phải là nhãn của blocker
  // ĐẦU TIÊN trong mảng (đúng theo `blockers[0].label` trong cart-actions.tsx), không phải
  // blocker thứ hai.
  it('hiện đủ mọi lý do khi bị chặn nhiều điều kiện cùng lúc', () => {
    const blockers = [
      { code: 'NO_ADDRESS' as const, label: 'Nhập địa chỉ giao hàng', targetId: 'cart-field-address' },
      { code: 'BAD_PHONE' as const, label: 'Nhập số điện thoại hợp lệ', targetId: 'cart-field-phone' },
    ]
    render(<CartActions pricing={pricing} blockers={blockers} />)

    expect(screen.getByText(/Nhập địa chỉ giao hàng/)).toBeInTheDocument()
    expect(screen.getByText(/Nhập số điện thoại hợp lệ/)).toBeInTheDocument()

    const orderButton = screen.getByRole('button', { name: /đặt hàng/i })
    expect(orderButton).toBeDisabled()
    expect(orderButton).toHaveAttribute('data-disabled-text', 'Nhập địa chỉ giao hàng')
  })

  // Finding 2 (review round 1, Important): `focusTarget` có `if (!el) return` nhưng chưa
  // test nào khoá lại nhánh này. Đây là guard chống crash: nếu `targetId` trong hook
  // (`use-cart-blockers.ts`) và `id` gắn trong DOM (Task 11) trôi lệch nhau sau này, guard
  // này là thứ duy nhất ngăn trang trắng khi khách bấm vào lý do chặn.
  it('bấm vào lý do chặn có targetId không tồn tại trong DOM thì không ném lỗi', async () => {
    render(
      <CartActions
        pricing={pricing}
        blockers={[
          { code: 'NO_TABLE', label: 'Chọn bàn', targetId: 'cart-field-khong-ton-tai' },
        ]}
      />,
    )

    await expect(
      userEvent.click(screen.getByRole('button', { name: /Chọn bàn/ })),
    ).resolves.not.toThrow()
  })
})
