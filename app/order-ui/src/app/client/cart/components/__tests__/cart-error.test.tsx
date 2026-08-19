import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useOrderFlowStore } from '@/stores'
import { ROUTE } from '@/constants'
import CartErrorBoundary from '../cart-error'

// i18next chưa được khởi tạo trong môi trường test: `useTranslation` thật trả về
// `t(key)` = chính `key`, nên assertion gốc trong brief tìm nút bằng regex
// `/xoá giỏ hàng|clear cart/i` sẽ KHÔNG khớp nếu `t` trả thẳng khoá. Mock
// `react-i18next` ở PHẠM VI MODULE (convention từ cart-summary.test.tsx /
// order-type-tabs.test.tsx) với bảng dịch khớp đúng nội dung thật trong
// src/locales/vi/menu.json (nhóm `menu` và `order`), để giữ nguyên khả năng định vị
// bằng tiếng Việt như brief gốc mong muốn. Chuỗi `CART_RENDER_ERROR` trong component
// là chuỗi cứng (không qua i18n) nên không cần có trong bảng dịch này.
const translations: Record<string, string> = {
  'menu.cartErrorTitle': 'Không mở được giỏ hàng',
  'menu.cartErrorDescription':
    'Dữ liệu giỏ hàng lưu trên máy đã hỏng hoặc thuộc phiên bản cũ. Xoá giỏ hàng sẽ khắc phục, các món cần đặt lại.',
  'menu.cartErrorClear': 'Xoá giỏ hàng & tải lại',
  'order.backToMenu': 'Quay lại thực đơn',
}

const t = (key: string) => translations[key] ?? key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}))

function Boom(): JSX.Element {
  throw new Error("Cannot read properties of undefined (reading 'slug')")
}

function SafeChild(): JSX.Element {
  return <div>Nội dung giỏ hàng bình thường</div>
}

describe('CartErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hiện lối thoát thay vì màn hình trắng khi cây con ném lỗi', () => {
    render(
      <MemoryRouter>
        <CartErrorBoundary>
          <Boom />
        </CartErrorBoundary>
      </MemoryRouter>,
    )

    // Finding 1 (fix round 1): mã lỗi đổi từ `CART_HYDRATE_FAILED` (nói dối — không
    // phải mọi lỗi render trong giỏ hàng đều do hydrate localStorage) sang
    // `CART_RENDER_ERROR`, trung thực với thứ boundary thực sự bắt được: một lỗi ném ra
    // lúc render. `Boom` ném `Error` thường nên `error.name` là `Error`.
    expect(screen.getByText(/CART_RENDER_ERROR · Error/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xoá giỏ hàng|clear cart/i })).toBeInTheDocument()
  })

  // Happy path: KHÔNG có lỗi thì boundary phải trong suốt — chỉ render children, không
  // tự vẽ thêm gì và không hiện màn hình lỗi. Nếu thiếu test này, một lỗi lô-gíc khiến
  // boundary luôn hiện fallback (vd. hasError mặc định true) sẽ không bị bắt.
  it('không có lỗi thì hiện đúng nội dung con, không hiện màn hình lỗi', () => {
    render(
      <MemoryRouter>
        <CartErrorBoundary>
          <SafeChild />
        </CartErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText('Nội dung giỏ hàng bình thường')).toBeInTheDocument()
    expect(screen.queryByText(/CART_RENDER_ERROR/)).toBeNull()
  })

  // Nút "Quay lại thực đơn" phải trỏ đúng route thực đơn — nếu route đổi tên/giá trị mà
  // không cập nhật ở đây, khách bấm nút cứu hộ này sẽ đi vào một đường dẫn chết.
  it('nút quay lại thực đơn trỏ đúng ROUTE.CLIENT_MENU', () => {
    render(
      <MemoryRouter>
        <CartErrorBoundary>
          <Boom />
        </CartErrorBoundary>
      </MemoryRouter>,
    )

    const backLink = screen.getByRole('link', { name: /quay lại thực đơn|back to menu/i })
    expect(backLink).toHaveAttribute('href', ROUTE.CLIENT_MENU)
  })

  // Finding 2 (fix round 1, quan trọng nhất): nhánh THẬT SỰ cứu khách khỏi bị kẹt vĩnh
  // viễn (đúng nguyên nhân P0-3) là bấm nút rồi (1) giỏ hàng hỏng bị xoá khỏi store
  // (nên khỏi persist) VÀ (2) trang được tải lại. Test trước đó chỉ chứng minh nút tồn
  // tại, chưa chứng minh nó hoạt động. `window.location.reload` không cài đặt được
  // trong jsdom (ném "Not implemented") nên phải thay cả `window.location` bằng một
  // object có `reload` là mock, rồi khôi phục lại nguyên trạng sau test.
  it('bấm "Xoá giỏ hàng & tải lại" xoá dữ liệu giỏ trong store và tải lại trang', async () => {
    const user = userEvent.setup()

    // Seed giỏ có dữ liệu (giống trạng thái trước khi giỏ "hỏng" khiến cây con ném lỗi).
    useOrderFlowStore.getState().initializeOrdering()
    expect(useOrderFlowStore.getState().orderingData).not.toBeNull()

    const reloadMock = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
    })

    try {
      render(
        <MemoryRouter>
          <CartErrorBoundary>
            <Boom />
          </CartErrorBoundary>
        </MemoryRouter>,
      )

      await user.click(screen.getByRole('button', { name: /xoá giỏ hàng|clear cart/i }))

      expect(useOrderFlowStore.getState().orderingData).toBeNull()
      expect(reloadMock).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      })
    }
  })
})
