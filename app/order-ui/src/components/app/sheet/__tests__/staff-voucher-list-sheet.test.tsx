import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Task 5: `StaffVoucherListSheet` áp voucher qua `handleToggleVoucher`, một hàm TOGGLE —
// gọi nó với voucher đang được áp sẽ GỠ voucher đó khỏi đơn. Nút quét QR
// (`VoucherQrScanButton.onResolved`) phải tự chặn trường hợp này bằng `isVoucherSelected`
// trước khi gọi `handleToggleVoucher`, nếu không quét trúng voucher đang áp sẽ âm thầm
// xoá mất giảm giá của khách mà không có lỗi nào bắn ra.
// Luồng quét nay chặn tại máy bằng `isVoucherValid` trước khi phiền tới server, nên
// fixture phải là voucher DÙNG ĐƯỢC thật: còn hạn, còn lượt, và có sản phẩm áp dụng
// giao với giỏ (`cartOrderItems` bên dưới dùng slug `item-1`). Fixture chỉ có
// `{ slug, code }` là voucher không tồn tại ngoài đời.
const usableVoucherFields = {
  isActive: true,
  // Mặc định KHÔNG đòi định danh: voucher công khai áp được cho đơn khách vãng
  // lai. Test nào cần nhánh đòi định danh thì tự bật lên.
  isVerificationIdentity: false,
  remainingUsage: 5,
  maxUsage: 10,
  minOrderValue: 0,
  endDate: '2999-12-31T00:00:00.000Z',
  applicabilityRule: 'at_least_one_required',
  voucherProducts: [{ product: { slug: 'item-1', name: 'Item 1' } }],
}

const appliedVoucher = {
  slug: 'dang-ap',
  code: 'APPLIED',
  ...usableVoucherFields,
}
const newVoucher = { slug: 'moi-quet', code: 'NEW', ...usableVoucherFields }

let resolveWith: typeof appliedVoucher = newVoucher

vi.mock('@/components/app/button', () => ({
  VoucherQrScanButton: ({
    onResolved,
  }: {
    onResolved: (v: unknown) => void
  }) => (
    <button data-testid="qr-scan" onClick={() => { scanResult.value = onResolved(resolveWith) }}>
      scan
    </button>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Nối `names` vào sau khoá khi có, để test chứng minh được TÊN MÓN thật sự
    // tới nơi hiển thị — chứ không chỉ chứng minh đã chọn đúng khoá dịch.
    t: (key: string, params?: Record<string, unknown>) =>
      params?.names ? `${key}:${params.names}` : key,
  }),
}))

// StaffVoucherListSheet chỉ dùng đúng 6 hook này từ `@/hooks` (xem import ở đầu
// staff-voucher-list-sheet.tsx). Thay toàn bộ module (không dùng importOriginal) để
// tránh kéo theo mọi hook khác trong barrel `@/hooks` (nhiều hook phụ thuộc
// Firebase/Capacitor không chạy được trong jsdom) — cùng cách tiếp cận đã dùng ở
// voucher-list-sheet.test.tsx.
vi.mock('@/hooks', async () => ({
  // Lấy bản THẬT của bộ dựng lời khuyên sửa đơn: một bản giả ở đây sẽ khiến
  // test xanh trong khi câu chữ người dùng đọc đã đổi. Import thẳng module thay
  // vì `importOriginal` trên barrel, theo đúng lý do nêu ở ghi chú bên trên.
  ...(await vi.importActual<typeof import('@/hooks/use-voucher-cart-fix')>(
    '@/hooks/use-voucher-cart-fix',
  )),
  ...(await vi.importActual<
    typeof import('@/hooks/use-voucher-scan-rejection')
  >('@/hooks/use-voucher-scan-rejection')),
  useIsMobile: () => false,
  usePagination: () => ({ pagination: { pageIndex: 1, pageSize: 10 } }),
  useViewportHeight: () => 800,
  useSpecificVoucher: () => ({ data: undefined, refetch: vi.fn() }),
  // Component chỉ gọi `addVoucher` bên trong callback `onSuccess` của mutation này, nên
  // mock `vi.fn()` trơ khiến nhánh áp voucher không bao giờ chạy tới đích — và mọi
  // assertion kiểu "đã áp voucher" sẽ vô nghĩa. Cho validate thành công luôn.
  useValidateVoucher: () => ({
    mutate: (_param: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
  }),
  useVouchersForOrder: () => ({ data: undefined }),
}))

const removeVoucher = vi.fn()
const addVoucher = vi.fn()
const showToast = vi.fn()
const showErrorToastText = vi.fn()
// Luồng quét nay KHÔNG bắn toast: lý do đi theo giá trị trả về của `onResolved`
// rồi hiện trong dải chữ trên màn quét. Bắt lại giá trị đó để kiểm.
const scanResult: { value: unknown } = { value: undefined }

// Phải có ít nhất 1 order item không phải quà tặng: nếu `orderItems` rỗng, effect
// "Auto-check voucher validity" của chính component (không liên quan gì tới task này)
// sẽ tự gỡ voucher ngay khi mount vì coi giỏ hàng là trống — che mất hành vi đang
// test (chốt chặn ở `handleQrResolved`).
const cartOrderItems = [
  {
    slug: 'item-1',
    productSlug: 'item-1',
    quantity: 1,
    originalPrice: 100000,
    promotionDiscount: 0,
    variant: { slug: 'v-1' },
    note: '',
    promotion: null,
  },
]

vi.mock('@/stores', () => ({
  useOrderFlowStore: () => ({
    getCartItems: () => ({ orderItems: cartOrderItems, voucher: appliedVoucher }),
    addVoucher,
    removeVoucher,
  }),
  useUserStore: () => ({ userInfo: { slug: 'staff-1', role: { name: 'STAFF' } } }),
  useThemeStore: () => ({ getTheme: () => 'light' }),
}))

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    showErrorToast: vi.fn(),
    showErrorToastText: (text: string) => showErrorToastText(text),
    showToast: (message: string) => showToast(message),
  }
})

// Import tĩnh, đặt SAU các `vi.mock` cho dễ đọc — Vitest hoist `vi.mock` lên trên toàn
// bộ import nên component vẫn nhận đúng các module đã mock ở trên.
import StaffVoucherListSheet from '../staff-voucher-list-sheet'

beforeEach(() => {
  vi.clearAllMocks()
  resolveWith = newVoucher
})

// `StaffVoucherListSheet` là component ~1000 dòng với cây import nặng. Trước đây file
// này `await import('../staff-voucher-list-sheet')` NGAY TRONG thân mỗi `it(...)`, nên
// toàn bộ chi phí transform module đó (và cả cây phụ thuộc của nó) bị tính vào đồng hồ
// timeout của chính test: máy đã ấm thì ~2s (qua), máy lạnh/CI thì vượt xa mốc mặc định
// 5000ms (trượt). Đưa import lên module scope khiến chi phí đó rơi vào pha "collect",
// nằm ngoài đồng hồ của test — `vi.mock` vẫn được hoist lên trên mọi import nên các mock
// bên dưới vẫn áp dụng bình thường.
//
// Timeout tường minh giữ lại làm lớp đệm: render + mở sheet của component cỡ này vẫn có
// thể mất vài giây khi cả 77 file test chạy song song. Nới theo từng test thay vì nâng
// `testTimeout` toàn cục — nâng toàn cục sẽ làm mọi file test khác chậm phát hiện lỗi.
const SLOW_RENDER_TIMEOUT_MS = 15000

describe('StaffVoucherListSheet — quét QR (Task 5)', () => {
  it('KHÔNG gỡ voucher khi quét trúng voucher đang được áp', async () => {
    resolveWith = appliedVoucher

    render(<StaffVoucherListSheet />)
    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    // handleToggleVoucher là toggle — thiếu chốt chặn isVoucherSelected thì
    // dòng này sẽ gỡ mất voucher khỏi đơn, im lặng, không lỗi nào bắn ra.
    expect(removeVoucher).not.toHaveBeenCalled()
    expect(addVoucher).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('toast.voucherAlreadyApplied')
  }, SLOW_RENDER_TIMEOUT_MS)

  it('CÓ áp voucher mới khi quét trúng voucher chưa được áp', async () => {
    resolveWith = newVoucher

    render(<StaffVoucherListSheet />)
    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    // Voucher chưa được áp -> handleToggleVoucher chạy nhánh "apply", không gỡ gì cả.
    expect(removeVoucher).not.toHaveBeenCalled()
    // Assertion khẳng định: thiếu nó thì test vẫn xanh kể cả khi cú quét chẳng làm gì
    // cả (ví dụ chốt chặn "đã áp rồi" chặn nhầm mọi voucher).
    expect(addVoucher).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'moi-quet' }),
    )
    expect(showToast).toHaveBeenCalledWith('toast.applyVoucherSuccess')
  }, SLOW_RENDER_TIMEOUT_MS)

  it('voucher đòi định danh mà đơn chưa có khách: mời THÊM KHÁCH HÀNG', async () => {
    // Trước đây đây là ngõ cụt: báo "cần định danh" rồi hết, nhân viên phải tự
    // đóng sheet, mở ô tìm khách, quét thẻ, rồi quay lại quét voucher từ đầu.
    // Cờ `action` là thứ để màn quét mời họ làm bước tiếp theo ngay tại chỗ.
    resolveWith = {
      ...newVoucher,
      slug: 'can-dinh-danh',
      isVerificationIdentity: true,
    }

    render(<StaffVoucherListSheet />)
    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    expect(scanResult.value).toMatchObject({ action: 'add-customer' })
    expect(addVoucher).not.toHaveBeenCalled()
  }, SLOW_RENDER_TIMEOUT_MS)

  it('voucher KHÔNG đòi định danh thì không mời thêm khách', async () => {
    // Chặn nhầm ở đây là mời nhân viên đi làm một việc chẳng liên quan gì tới
    // lý do voucher bị từ chối.
    resolveWith = {
      ...newVoucher,
      slug: 'sai-san-pham',
      voucherProducts: [{ product: { slug: 'san-pham-khac', name: 'Khác' } }],
    }

    render(<StaffVoucherListSheet />)
    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    expect(scanResult.value).not.toHaveProperty('action')
  }, SLOW_RENDER_TIMEOUT_MS)

  it('quét voucher không đủ điều kiện: nói RÕ lý do và KHÔNG áp', async () => {
    // Trước đây luồng quét không kiểm gì tại máy, cứ gửi lên server rồi để toast
    // lỗi chung chung của handler toàn cục xử lý. Giờ chặn tại chỗ và nói đúng
    // nguyên nhân — ở đây voucher không có sản phẩm nào giao với giỏ hàng.
    resolveWith = {
      ...newVoucher,
      slug: 'khong-hop-le',
      voucherProducts: [{ product: { slug: 'san-pham-khac', name: 'Khác' } }],
    }

    render(<StaffVoucherListSheet />)
    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    // Hai dòng: việc cần làm ngay, và gọi gì thì được. Dòng hai nêu đích danh
    // tên món nên khách không phải hỏi thêm nhân viên.
    expect(scanResult.value).toEqual({
      kind: 'cart',
      message: 'voucher.fixAddEligibleItem',
      hint: 'voucher.fixHintAddOneOf:Khác',
      // Thiếu trường này thì màn quét không có gì để bung ra, và nhân viên lại
      // phải tự tra danh sách ở chỗ khác.
      hintItems: ['Khác'],
    })
    expect(addVoucher).not.toHaveBeenCalled()
    expect(removeVoucher).not.toHaveBeenCalled()
  }, SLOW_RENDER_TIMEOUT_MS)
})
