import { describe, it, expect, vi, beforeEach } from 'vitest'

import viToast from '@/locales/vi/toast.json'
import enToast from '@/locales/en/toast.json'

// `vi.hoisted`: factory của `vi.mock` được nâng lên đầu file, tham chiếu thẳng
// một biến khai báo bên dưới sẽ rơi vào vùng chết và ném TDZ.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: vi.fn() },
}))

// i18next trả về chính khoá để test đọc được đang dịch khoá nào, thay vì so
// chuỗi tiếng Việt dễ vỡ khi ai đó sửa câu chữ.
vi.mock('i18next', () => ({
  default: { t: (key: string) => key },
}))

import { showErrorToast } from '@/utils/toast'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('showErrorToast', () => {
  it('dịch mã lỗi đã được ánh xạ', () => {
    // 143425 = giỏ hàng không có sản phẩm nào áp dụng được voucher.
    showErrorToast(143425)
    expect(toastError).toHaveBeenCalledWith(
      'toast.atLeastOneProductMustBeAppliedToVoucher',
    )
  })

  it('dùng message của server khi mã CHƯA được ánh xạ', () => {
    // Đây là điểm mấu chốt: body lỗi luôn kèm sẵn lý do. Vứt nó đi để hiện
    // "Yêu cầu thất bại" là tự làm mù mình — người dùng không biết chuyện gì,
    // còn lập trình viên phải cắm log mới lần ra được mã.
    showErrorToast(999999, 'At least one product must be applied to voucher')
    expect(toastError).toHaveBeenCalledWith(
      'At least one product must be applied to voucher',
    )
  })

  it('ưu tiên bản dịch hơn message server khi mã đã được ánh xạ', () => {
    showErrorToast(143425, 'At least one product must be applied to voucher')
    expect(toastError).toHaveBeenCalledWith(
      'toast.atLeastOneProductMustBeAppliedToVoucher',
    )
  })

  it('về câu mặc định khi mã lạ mà server cũng không nói gì', () => {
    showErrorToast(999999)
    expect(toastError).toHaveBeenCalledWith('toast.requestFailed')

    showErrorToast(999999, '   ')
    expect(toastError).toHaveBeenLastCalledWith('toast.requestFailed')
  })
})

describe('khoá dịch của mã 143425', () => {
  it('có mặt ở CẢ hai ngôn ngữ', () => {
    // Thiếu một bên thì người dùng ngôn ngữ đó thấy khoá thô trên màn hình.
    expect(viToast.toast).toHaveProperty(
      'atLeastOneProductMustBeAppliedToVoucher',
    )
    expect(enToast.toast).toHaveProperty(
      'atLeastOneProductMustBeAppliedToVoucher',
    )
  })
})
