import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import CreateOrderDialog from '../create-order-dialog'

// i18next chưa được khởi tạo trong môi trường test (convention từ cart-summary.test.tsx /
// cart-error.test.tsx): `useTranslation` thật trả về `t(key)` = chính khoá. Component gọi
// `useTranslation` với 3 namespace khác nhau (['menu'], 'common', 'toast') nhưng mock này
// bỏ qua namespace và luôn trả cùng một `t` — đủ dùng vì test chỉ cần nút render ra được,
// không cần khớp nội dung dịch cụ thể.
const t = (key: string) => key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

// Khoá lại bug độ ưu tiên toán tử (Task 17): code cũ là
// `{isPending || isPendingWithoutLogin && <Loader2 />}` — do `&&` có độ ưu tiên cao hơn
// `||`, biểu thức rút gọn thành `isPending || (isPendingWithoutLogin && <Loader2/>)`, nên
// khi `isPending === true` (khách đã đăng nhập, đang gọi API tạo đơn) toàn bộ biểu thức
// bằng `true` — React không render giá trị boolean, spinner không bao giờ xuất hiện dù
// đang pending. Mock `useCreateOrder` để ép `isPending = true` và kiểm tra phần tử có class
// `animate-spin` (Loader2) THỰC SỰ xuất hiện trong DOM.
let createOrderPending = false
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useCreateOrder: () => ({ mutate: vi.fn(), isPending: createOrderPending }),
    useCreateOrderWithoutLogin: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

describe('CreateOrderDialog', () => {
  beforeEach(() => {
    createOrderPending = false
  })

  it('hiện spinner (animate-spin) trên nút trigger khi isPending = true', () => {
    createOrderPending = true

    const { container } = render(
      <MemoryRouter>
        <CreateOrderDialog totalAmount={100000} deliveryFee={0} />
      </MemoryRouter>,
    )

    // Nút trigger phải bị disable khi đang pending (hành vi có sẵn, không đổi)...
    expect(screen.getByRole('button', { name: /order.create/i })).toBeDisabled()
    // ...VÀ spinner phải render thật sự trong DOM, không phải giá trị boolean bị React bỏ qua.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('không hiện spinner trên nút trigger khi không pending', () => {
    createOrderPending = false

    const { container } = render(
      <MemoryRouter>
        <CreateOrderDialog totalAmount={100000} deliveryFee={0} />
      </MemoryRouter>,
    )

    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  // Finding (review round 1, Important): 2 test trên chỉ mở nút TRIGGER (ở ngoài dialog,
  // isOpen === false mặc định) — không đụng tới nút "Tạo đơn" bên trong DialogFooter (dòng
  // ~365), nơi bug `||`/`&&` tương tự cũng tồn tại nhưng KHÔNG bị 2 test trên bắt (đã tự
  // verify bằng thí nghiệm revert, xem report). Test này mở dialog thật (không mock
  // Dialog/DialogContent — dùng Radix thật) rồi kiểm tra spinner NGAY TRONG DialogFooter.
  //
  // Lưu ý: không thể set `createOrderPending = true` TRƯỚC khi mở dialog, vì khi đó nút
  // trigger tự bị `disabled` (disabled={disabled || isPending || isPendingWithoutLogin})
  // nên click sẽ không mở được dialog — đúng UX thật: dialog phải mở lúc chưa pending, sau
  // đó người dùng bấm "Tạo đơn" mới khiến mutation isPending chuyển true trong khi dialog
  // vẫn đang mở. Vì mock hook đọc biến module-scope `createOrderPending` mỗi lần render
  // (không tự reactive), phải gọi `rerender` với CÙNG cây component để ép hook chạy lại và
  // đọc giá trị mới, trong khi state `isOpen` nội bộ của component vẫn được React giữ
  // nguyên qua lần rerender (cùng vị trí trong cây).
  it('hiện spinner (animate-spin) trong DialogFooter (nút "Tạo đơn") khi isPending = true và dialog đang mở', async () => {
    const user = userEvent.setup()
    createOrderPending = false

    // Không tái sử dụng MỘT biến JSX cho cả `render` lẫn `rerender`: React bail-out toàn bộ
    // subtree khi phần tử con truyền xuống có CÙNG object reference giữa 2 lần render (tối
    // ưu hoá "bailout on referentially stable elements") — nếu dùng lại cùng 1 element, hàm
    // component sẽ KHÔNG được gọi lại nên mock hook mới (`createOrderPending = true`) không
    // bao giờ được đọc, spinner không bao giờ xuất hiện dù code đúng. Phải tạo JSX MỚI
    // (object mới) ở mỗi lần gọi để ép React thực sự re-render.
    const renderTree = () => (
      <MemoryRouter>
        <CreateOrderDialog totalAmount={100000} deliveryFee={0} />
      </MemoryRouter>
    )
    const { rerender } = render(renderTree())

    await user.click(screen.getByRole('button', { name: /order.create/i }))

    const dialog = await screen.findByRole('dialog')
    // Dialog vừa mở, chưa pending: chưa có spinner nào trong dialog.
    expect(dialog.querySelector('.animate-spin')).toBeNull()

    createOrderPending = true
    rerender(renderTree())

    // Spinner phải render THẬT trong DOM bên trong DialogFooter, không phải giá trị
    // boolean bị React bỏ qua do lỗi độ ưu tiên toán tử.
    expect(dialog.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
