import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { IOrder, IVoucher } from '@/types'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE } from '@/constants'

// Task 6: sheet thứ hai commit voucher vào ĐƠN HÀNG THẬT. Khác bản client ở chỗ chỉ có
// một đường commit duy nhất (`updateVoucherInOrder`, không có biến thể công khai).
// Mọi assertion bám vào spy của mutation update — tầng thật sự thay đổi đơn hàng.

const PRODUCT_SLUG = 'san-pham-1'
const ORDER_SLUG = 'don-hang-1'

function makeVoucher(overrides: Partial<IVoucher>): IVoucher {
  return {
    slug: 'voucher-mac-dinh',
    code: 'DEFAULT',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    value: 10,
    minOrderValue: 0,
    maxItems: 0,
    isActive: true,
    remainingUsage: 5,
    maxUsage: 10,
    endDate: '2999-12-31T00:00:00.000Z',
    isVerificationIdentity: false,
    applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    // BẮT BUỘC: `handleCompleteSelection` gọi `isVoucherValid` TRƯỚC khi gọi API, và
    // `isVoucherValid` trả false khi `voucherProducts` rỗng hoặc không giao với sản phẩm
    // trong đơn. Thiếu dòng này thì test dừng ở toast `voucher.notValid`, API không bao
    // giờ được gọi, và assertion trở nên vô nghĩa.
    voucherProducts: [{ product: { slug: PRODUCT_SLUG, name: 'Trà sữa' } }],
    ...overrides,
  } as unknown as IVoucher
}

const scannedVoucher = makeVoucher({ slug: 'quet-qr', code: 'SCANNED' })
const fetchedVoucher = makeVoucher({ slug: 'da-tai', code: 'LOADED' })

const PAGE_ONE = { result: { items: [fetchedVoucher], page: 1, hasNext: false } }

function makeOrder(overrides: Partial<IOrder> = {}): IOrder {
  return {
    slug: ORDER_SLUG,
    owner: {
      slug: 'khach-1',
      role: { name: Role.CUSTOMER },
      phonenumber: '0900000000',
    },
    orderItems: [
      {
        slug: 'item-1',
        quantity: 2,
        note: '',
        promotion: null,
        variant: {
          slug: 'variant-1',
          price: 50000,
          product: { slug: PRODUCT_SLUG, name: 'Trà sữa' },
        },
      },
    ],
    voucher: null,
    deliveryFee: 0,
    accumulatedPointsToUse: 0,
    ...overrides,
  } as unknown as IOrder
}

let validateSucceeds = true
let listPageData: { result: unknown } | undefined = undefined
let voucherToResolve: IVoucher = scannedVoucher

const updateVoucherInOrder = vi.fn()
const showToast = vi.fn()
const showErrorToast = vi.fn()
const showErrorToastText = vi.fn()
// Luồng quét nay KHÔNG bắn toast: lý do đi theo giá trị trả về của `onResolved`
// rồi hiện trong dải chữ trên màn quét. Bắt lại giá trị đó để kiểm.
const scanResult: { value: unknown } = { value: undefined }
const onSuccessProp = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Nối `names` vào sau khoá khi có, để test chứng minh được TÊN MÓN thật sự
    // tới nơi hiển thị — chứ không chỉ chứng minh đã chọn đúng khoá dịch.
    t: (key: string, params?: Record<string, unknown>) =>
      params?.names ? `${key}:${params.names}` : key,
  }),
}))

vi.mock('@/components/app/button', () => ({
  VoucherQrScanButton: ({
    onResolved,
  }: {
    onResolved: (voucher: IVoucher) => void
  }) => (
    <button data-testid="qr-scan" onClick={() => { scanResult.value = onResolved(voucherToResolve) }}>
      scan
    </button>
  ),
}))

// Component dùng đúng 7 hook này từ `@/hooks`. `refetch` phải ỔN ĐỊNH giữa các render:
// nó nằm trong deps của effect, trả `vi.fn()` mới mỗi render sẽ khiến effect chạy lại
// liên tục và xoá mất state đang test.
vi.mock('@/hooks', async () => {
  // Bản THẬT của bộ dựng lời khuyên sửa đơn: bản giả ở đây sẽ khiến test
  // xanh trong khi câu chữ người dùng đọc đã đổi.
  const cartFix = await vi.importActual<
    typeof import('@/hooks/use-voucher-cart-fix')
  >('@/hooks/use-voucher-cart-fix')
  const scanRejection = await vi.importActual<
    typeof import('@/hooks/use-voucher-scan-rejection')
  >('@/hooks/use-voucher-scan-rejection')
  const refetchSpecificVoucher = vi.fn()
  const refetchVoucherList = vi.fn()

  return {
    ...cartFix,
    ...scanRejection,
    useIsMobile: () => false,
    useViewportHeight: () => 800,
    usePagination: () => ({ pagination: { pageIndex: 1, pageSize: 10 } }),
    useVouchersForOrder: () => ({
      data: listPageData,
      refetch: refetchVoucherList,
    }),
    useSpecificVoucher: () => ({
      data: undefined,
      refetch: refetchSpecificVoucher,
    }),
    // Component chỉ gọi API update BÊN TRONG `onSuccess` của validate — mock trơ
    // `vi.fn()` sẽ khiến nhánh commit không bao giờ chạy tới.
    useValidateVoucher: () => ({
      mutate: (_param: unknown, options?: { onSuccess?: () => void }) => {
        if (validateSucceeds) options?.onSuccess?.()
      },
    }),
    useUpdateVoucherInOrder: () => ({
      mutate: (param: unknown, options?: unknown) =>
        updateVoucherInOrder(param, options),
    }),
  }
})

vi.mock('@/stores', () => {
  const setOrderFromAPI = vi.fn()
  return {
    // `paymentData` undefined => `orderData` lấy thẳng từ prop `order`.
    useOrderFlowStore: () => ({ paymentData: undefined, setOrderFromAPI }),
    useUserStore: () => ({
      userInfo: { slug: 'nhan-vien-1', role: { name: Role.STAFF } },
    }),
    useThemeStore: () => ({ getTheme: () => 'light' }),
  }
})

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    showToast: (message: string) => showToast(message),
    showErrorToast: (code: number) => showErrorToast(code),
    showErrorToastText: (text: string) => showErrorToastText(text),
  }
})

import StaffVoucherListSheetInPayment from '../staff-voucher-list-sheet-in-payment'

function renderSheet(order: IOrder = makeOrder()) {
  return render(
    <StaffVoucherListSheetInPayment onSuccess={onSuccessProp} order={order} />,
  )
}

async function openSheet() {
  await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  validateSucceeds = true
  listPageData = undefined
  voucherToResolve = scannedVoucher
})

describe('StaffVoucherListSheetInPayment — commit voucher vào đơn hàng', () => {
  it('nút xác nhận ở footer commit voucher đang chọn, không phải MouseEvent', async () => {
    // Footer truyền thẳng `onClick={handleCompleteSelection}` sẽ khiến React nhét
    // MouseEvent vào tham số `overrideVoucher`; nó truthy nên event bị coi là voucher.
    // TypeScript KHÔNG bắt được vì `onClick` vốn nhận hàm có tham số event.
    listPageData = PAGE_ONE

    const { baseElement } = renderSheet()
    await openSheet()

    const checkbox = await waitFor(() => {
      const el = baseElement.querySelector('#da-tai')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    await userEvent.click(checkbox)
    await userEvent.click(
      screen.getByRole('button', { name: 'voucher.complete' }),
    )

    await waitFor(() => expect(updateVoucherInOrder).toHaveBeenCalled())
    expect(updateVoucherInOrder).toHaveBeenCalledWith(
      expect.objectContaining({ slug: ORDER_SLUG, voucher: 'da-tai' }),
      expect.anything(),
    )
  })

  it('quét QR áp voucher NGAY, không bắt bấm "Hoàn thành"', async () => {
    // Ba màn phía khách phải hành xử giống nhau: cùng một thao tác quét không
    // thể cho hai kết quả khác nhau tuỳ màn. Ở đây áp luôn như giỏ hàng và sửa đơn.
    const { getByTestId } = renderSheet()
    await openSheet()
    await userEvent.click(getByTestId('qr-scan'))

    // Danh sách rỗng nên voucher quét được chắc chắn KHÔNG nằm sẵn trong
    // `localVoucherList`; nếu bước chèn danh sách hỏng thì luồng dừng ở
    // `showErrorToast(1000)` và không gọi API.

    await waitFor(() => expect(updateVoucherInOrder).toHaveBeenCalled())
    expect(updateVoucherInOrder).toHaveBeenCalledWith(
      expect.objectContaining({ slug: ORDER_SLUG, voucher: 'quet-qr' }),
      expect.anything(),
    )
    expect(showErrorToast).not.toHaveBeenCalledWith(1000)
  })

  it('quét trúng voucher đang áp: báo "đã áp rồi" và KHÔNG gọi API', async () => {
    const order = makeOrder({ voucher: scannedVoucher } as Partial<IOrder>)

    const { getByTestId } = renderSheet(order)
    await openSheet()
    await userEvent.click(getByTestId('qr-scan'))

    expect(showToast).toHaveBeenCalledWith('toast.voucherAlreadyApplied')
    // Quan trọng hơn cả toast: KHÔNG được đụng vào đơn hàng.
    expect(updateVoucherInOrder).not.toHaveBeenCalled()
  })

  it('quét voucher không hợp lệ KHÔNG biến nút xác nhận thành nút GỠ voucher đang áp', async () => {
    // Nhánh "voucher không hợp lệ" trước đây gần như không với tới được (checkbox của
    // voucher không hợp lệ bị disabled). Luồng quét QR đưa được voucher không hợp lệ
    // vào bằng một thao tác thường. Nếu nhánh đó xoá trắng lựa chọn, lần bấm nút xác
    // nhận kế tiếp rơi vào nhánh `!effectiveSlug` và GỠ voucher đang áp của khách —
    // kèm toast "gỡ thành công", nên trên màn hình mọi thứ trông như thành công.
    listPageData = PAGE_ONE
    const appliedVoucher = makeVoucher({ slug: 'dang-ap', code: 'APPLIED' })
    // Không giao sản phẩm nào với đơn => `isVoucherValid` trả false.
    voucherToResolve = makeVoucher({
      slug: 'quet-qr-hong',
      code: 'BAD',
      voucherProducts: [{ product: { slug: 'san-pham-khac', name: 'Khác' } }],
    } as unknown as Partial<IVoucher>)

    const order = makeOrder({ voucher: appliedVoucher } as Partial<IOrder>)
    const { baseElement, getByTestId } = renderSheet(order)
    await openSheet()

    await waitFor(() =>
      expect(baseElement.querySelector('#dang-ap')).not.toBeNull(),
    )

    await userEvent.click(getByTestId('qr-scan'))
    // Chứng minh nhánh "không hợp lệ" ĐÃ chạy — không có assertion này thì test xanh
    // kể cả khi luồng quét dừng ở chỗ khác và chẳng kiểm tra được gì.
    // Nói RÕ lý do thay vì câu chung chung: fixture cố ý dùng sản phẩm không giao
    // với đơn, nên lý do phải là "cần ít nhất một sản phẩm áp dụng được".
    await waitFor(() =>
      expect(scanResult.value).toEqual({
        kind: 'cart',
        // Hai dòng: việc cần làm ngay, và gọi gì thì được. Dòng hai nêu đích
        // danh tên món nên khách không phải hỏi thêm nhân viên.
        message: 'voucher.fixAddEligibleItem',
        hint: expect.stringContaining('voucher.fixHintAddOneOf:'),
        // Danh sách đầy đủ để màn quét bung ra khi voucher gắn nhiều món.
        hintItems: expect.arrayContaining([expect.any(String)]),
      }),
    )

    // Và nó KHÔNG được chọn sẵn: tick một voucher không hợp lệ chỉ làm nút
    // "Hoàn thành" tự disable, nhân viên bấm không được mà không hiểu vì sao.
    expect(baseElement.querySelector('#quet-qr-hong')).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'voucher.complete' }),
    )

    expect(updateVoucherInOrder).not.toHaveBeenCalledWith(
      expect.objectContaining({ voucher: null }),
      expect.anything(),
    )
    expect(updateVoucherInOrder).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalledWith('toast.removeVoucherSuccess')
  })

  it('giữ voucher vừa quét trong danh sách kể cả khi effect gom trang dựng lại danh sách', async () => {
    listPageData = PAGE_ONE
    validateSucceeds = false

    const { baseElement, getByTestId } = renderSheet()
    await openSheet()

    // Chờ voucher trang 1 hiện ra: chứng minh effect gom trang ĐÃ chạy.
    await waitFor(() =>
      expect(baseElement.querySelector('#da-tai')).not.toBeNull(),
    )

    await userEvent.click(getByTestId('qr-scan'))

    await waitFor(() =>
      expect(baseElement.querySelector('#quet-qr')).not.toBeNull(),
    )
    await waitFor(() =>
      expect(baseElement.querySelector('#da-tai')).not.toBeNull(),
    )
    expect(baseElement.querySelector('#quet-qr')).not.toBeNull()
    expect(updateVoucherInOrder).not.toHaveBeenCalled()
  })
})
