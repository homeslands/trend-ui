import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useOrderFlowStore } from '@/stores'
import { IOrderItem, IProductVariant, IVoucher } from '@/types'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { useCartVoucherGuard } from '@/app/client/cart/hooks/use-cart-voucher-guard'

import VoucherListSheet from '../voucher-list-sheet'

// Task 19: trước bản sửa này, `VoucherListSheet` có một effect tự kiểm tra lại
// `minOrderValue`/`maxItems` (dòng ~238-249 bản cũ) TRÙNG với 2 trong 3 effect của
// `useCartVoucherGuard` (Task 18). Trang giỏ hàng render CẢ HAI cùng lúc
// (`src/app/client/cart/page.tsx`: `useCartVoucherGuard()` + `<VoucherListSheet />`),
// nên khi một voucher hết điều kiện, khách thấy 2 toast khác nội dung cho cùng một sự
// kiện: toast lỗi cụ thể (vd. mã 1004) từ guard, RỒI toast "Gỡ voucher thành công" chung
// chung từ `handleToggleVoucher` bên trong sheet — gây hiểu lầm giống như khách tự gỡ.
// Test này khoá lại: sau khi trang mở với voucher không còn hợp lệ, CHỈ MỘT toast hiện ra.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Task 6: thay `VoucherQrScanButton` (camera + tra cứu QR không chạy được trong jsdom)
// bằng một nút giả trả thẳng voucher đã "quét" được qua `onResolved`.
vi.mock('@/components/app/button', () => ({
  VoucherQrScanButton: ({
    onResolved,
  }: {
    onResolved: (voucher: IVoucher) => void
  }) => (
    <button data-testid="qr-scan" onClick={() => onResolved(scannedVoucher)}>
      scan
    </button>
  ),
}))

// Component chỉ dùng đúng 9 hook này từ `@/hooks` (xem import ở đầu voucher-list-sheet.tsx).
// Thay toàn bộ module (không dùng importOriginal) để tránh kéo theo mọi hook khác trong
// barrel `@/hooks` (nhiều hook phụ thuộc Firebase/Capacitor không chạy được trong jsdom).
vi.mock('@/hooks', async () => {
  // Bản THẬT của bộ dựng lời khuyên sửa đơn: bản giả ở đây sẽ khiến test
  // xanh trong khi câu chữ người dùng đọc đã đổi.
  const cartFix = await vi.importActual<
    typeof import('@/hooks/use-voucher-cart-fix')
  >('@/hooks/use-voucher-cart-fix')
  const scanRejection = await vi.importActual<
    typeof import('@/hooks/use-voucher-scan-rejection')
  >('@/hooks/use-voucher-scan-rejection')
  // `refetch` phải ổn định giữa các lần render: component đưa nó vào dependency của
  // effect "đồng bộ voucher hiện tại", nên trả `vi.fn()` mới mỗi render sẽ khiến effect
  // chạy lại liên tục và xoá sạch `tempSelectedVoucher` — một hành vi chỉ có trong test.
  const refetchSpecificVoucher = vi.fn()
  const refetchSpecificPublicVoucher = vi.fn()

  return {
    ...cartFix,
    ...scanRejection,
    useIsMobile: () => false,
    useViewportHeight: () => 800,
    usePagination: () => ({ pagination: { pageIndex: 1, pageSize: 10 } }),
    // Cả hai hook danh sách cùng trả `listPageData`: component chọn hook nào là tuỳ
    // `userInfo`/`cartItems.ownerRole`, test không cần quan tâm nhánh nào trúng.
    usePublicVouchersForOrder: () => ({ data: listPageData }),
    useSpecificPublicVoucher: () => ({
      data: undefined,
      refetch: refetchSpecificPublicVoucher,
    }),
    useSpecificVoucher: () => ({
      data: undefined,
      refetch: refetchSpecificVoucher,
    }),
    // Sheet chỉ áp voucher trong callback `onSuccess` của mutation này, nên mock
    // `vi.fn()` trơ sẽ khiến MỌI nhánh áp voucher không bao giờ chạy tới.
    // `validateSucceeds` cho phép tắt nhánh thành công để sheet KHÔNG tự đóng, nhờ đó
    // quan sát được danh sách voucher. Các test gỡ voucher bên dưới không đi qua đây
    // (nhánh remove không validate).
    useValidatePublicVoucher: () => ({
      mutate: (_param: unknown, options?: { onSuccess?: () => void }) => {
        if (validateSucceeds) options?.onSuccess?.()
      },
    }),
    useValidateVoucher: () => ({
      mutate: (_param: unknown, options?: { onSuccess?: () => void }) => {
        if (validateSucceeds) options?.onSuccess?.()
      },
    }),
    useVouchersForOrder: () => ({ data: listPageData }),
  }
})

let validateSucceeds = true

// Dữ liệu trang 1 mà hook danh sách trả về. Mặc định `undefined` để hai test Task 19 giữ
// nguyên hành vi cũ (`if (!currentData) return` — effect gom trang thoát sớm). Test nào
// cần chạm tới nhánh "replace" của effect thì gán dữ liệu thật vào đây.
// Phải là object ỔN ĐỊNH giữa các lần render: nó nằm trong deps của effect, trả object
// mới mỗi render sẽ thành vòng lặp vô hạn.
let listPageData: { result: unknown } | undefined = undefined

const showErrorToast = vi.fn()
const showErrorToastMessage = vi.fn()
const showToast = vi.fn()
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    showErrorToast: (code: number) => showErrorToast(code),
    showErrorToastMessage: (message: string) => showErrorToastMessage(message),
    showToast: (message: string) => showToast(message),
  }
})

const variant = { slug: 'v-m', price: 50000, size: { slug: 's-m', name: 'm' } } as IProductVariant

function addItem(slug: string, quantity: number, promotionDiscount = 0) {
  useOrderFlowStore.getState().addOrderingItem({
    id: 'seed',
    slug,
    image: '',
    name: slug,
    quantity,
    size: 'm',
    allVariants: [variant],
    variant,
    originalPrice: 50000,
    promotionDiscount,
    description: '',
    isLimit: false,
    isGift: false,
  } as IOrderItem)
}

function makeVoucher(overrides: Partial<IVoucher>): IVoucher {
  return {
    slug: 'voucher-test',
    code: 'TEST',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    value: 10,
    minOrderValue: 0,
    maxItems: 0,
    voucherProducts: [],
    ...overrides,
  } as unknown as IVoucher
}

// Voucher "quét được": CỐ Ý không nằm trong `localVoucherList` (mọi hook danh sách đều
// trả `undefined` ở trên), đúng như tình huống thật — danh sách chỉ chứa các trang đã tải.
// `voucherProducts` phải khớp sản phẩm trong giỏ (`addItem('tra-sua', ...)`): luồng
// quét nay chặn tại máy bằng `isVoucherValid`, mà hàm đó coi voucher KHÔNG có sản
// phẩm áp dụng nào là không dùng được. Fixture thiếu trường này là fixture không tồn
// tại ngoài đời.
const APPLICABLE_PRODUCTS = [{ product: { slug: 'tra-sua', name: 'Trà sữa' } }]

const scannedVoucher: IVoucher = makeVoucher({
  slug: 'chua-tai',
  code: 'UNLOADED',
  isActive: true,
  remainingUsage: 10,
  maxUsage: 10,
  endDate: '2999-12-31T00:00:00.000Z',
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  voucherProducts: APPLICABLE_PRODUCTS,
} as unknown as Partial<IVoucher>)

// Voucher đã có sẵn trong trang 1 mà API trả về — đại diện cho phần danh sách "đã tải".
const fetchedVoucher: IVoucher = makeVoucher({
  slug: 'da-tai',
  code: 'LOADED',
  isActive: true,
  remainingUsage: 5,
  maxUsage: 10,
  endDate: '2999-12-31T00:00:00.000Z',
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  voucherProducts: APPLICABLE_PRODUCTS,
} as unknown as Partial<IVoucher>)

// Trang 1 hợp lệ: `page` phải khớp `currentPage` (=1) thì effect gom trang mới đi tiếp
// thay vì thoát sớm, và `currentPage === 1` đưa nó vào đúng nhánh "replace" cần test.
const PAGE_ONE = { result: { items: [fetchedVoucher], page: 1, hasNext: false } }

// Trang giỏ hàng thật render `useCartVoucherGuard()` và `<VoucherListSheet />` cùng lúc
// trong cùng cây component (page.tsx) — dựng lại đúng cấu trúc đó để bài test phản ánh
// đúng tình huống gây toast kép (mỗi component test riêng lẻ sẽ không bắt được lỗi).
function Harness() {
  useCartVoucherGuard()
  return <VoucherListSheet />
}

function renderHarness() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Chỉ sheet, không kèm `useCartVoucherGuard`: guard là chủ đề của Task 19, ở đây nó chỉ
// thêm nhiễu (có thể tự gỡ voucher vừa áp) cho thứ đang test là luồng quét QR.
function renderSheet() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VoucherListSheet />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VoucherListSheet + useCartVoucherGuard (Task 19: chỉ một toast khi gỡ voucher tự động)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('gỡ voucher do KHÔNG đạt minOrderValue: chỉ hiện đúng một toast (lỗi 1004), không có toast thành công', () => {
    // 1 × 50.000 = 50.000 < 100.000 (minOrderValue)
    addItem('tra-sua', 1)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ minOrderValue: 100000 }))

    renderHarness()

    expect(useOrderFlowStore.getState().orderingData?.voucher).toBeNull()
    // Đúng một toast lỗi, với đúng mã lý do (1004 = chưa đạt giá trị đơn tối thiểu).
    expect(showErrorToast).toHaveBeenCalledTimes(1)
    expect(showErrorToast).toHaveBeenCalledWith(1004)
    // Không có toast "Gỡ voucher thành công" chung chung từ effect trùng trong sheet.
    expect(showToast).not.toHaveBeenCalled()
  })

  it('gỡ voucher do vượt maxItems: chỉ hiện đúng một toast, không có toast thành công', () => {
    addItem('tra-sua', 2)
    addItem('ca-phe', 2)
    useOrderFlowStore.getState().addVoucher(makeVoucher({ maxItems: 3 }))

    renderHarness()

    expect(useOrderFlowStore.getState().orderingData?.voucher).toBeNull()
    expect(showErrorToastMessage).toHaveBeenCalledTimes(1)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.voucherMaxItemsExceeded')
    expect(showToast).not.toHaveBeenCalled()
  })
})

// Task 6: `VoucherListSheet` là loại "chọn tạm rồi xác nhận" — thẻ voucher chỉ đánh dấu
// `tempSelectedVoucher`, nút ở footer mới thật sự áp qua `handleCompleteSelection`.
// Voucher quét từ QR đụng hai cái bẫy im lặng cùng lúc:
//   1. Nó KHÔNG có trong `localVoucherList` (danh sách chỉ chứa các trang đã tải), mà
//      `handleCompleteSelection` lại tra voucher bằng `localVoucherList.find(...)` →
//      không tìm thấy → chỉ hiện toast lỗi 1000.
//   2. `setTempSelectedVoucher(...)` rồi gọi `handleCompleteSelection()` ngay sau đó thì
//      hàm vẫn đọc giá trị state CŨ → áp nhầm voucher khác, hoặc không áp gì cả.
// TypeScript không bắt được cả hai. Test này khoá lại: quét xong thì voucher đó phải
// thật sự nằm trong giỏ.
describe('VoucherListSheet — quét QR (Task 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateSucceeds = true
    listPageData = undefined
    useOrderFlowStore.getState().initializeOrdering()
  })

  it('áp đúng voucher vừa quét dù nó CHƯA có trong localVoucherList', async () => {
    addItem('tra-sua', 1)

    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    // Voucher thật sự được áp — thiếu tham số override thì hàm đọc state cũ, không tìm
    // thấy voucher trong `localVoucherList` và chỉ bắn lỗi 1000.
    await waitFor(() =>
      expect(useOrderFlowStore.getState().orderingData?.voucher).toEqual(
        expect.objectContaining({ slug: 'chua-tai' }),
      ),
    )
    expect(showErrorToast).not.toHaveBeenCalledWith(1000)
  })

  it('giữ voucher vừa quét trong danh sách kể cả khi effect gom trang dựng lại danh sách', async () => {
    // Áp thành công thì sheet đóng ngay, không quan sát được danh sách. Tắt nhánh
    // thành công để sheet ở lại — đây cũng là tình huống thật khi validate trượt:
    // khách phải thấy voucher vừa quét nằm trong danh sách chứ không phải một sheet trống.
    validateSucceeds = false
    // Có dữ liệu trang 1 thật thì effect gom trang mới đi tới nhánh "replace". Chính cú
    // unshift của luồng quét làm `localVoucherList.length` đổi, mà length nằm trong deps
    // của effect đó → effect chạy lại và dựng lại danh sách từ trang đã fetch. Không chèn
    // lại voucher đã quét thì thẻ của nó hiện lên rồi biến mất ngay.
    listPageData = PAGE_ONE
    addItem('tra-sua', 1)

    const { baseElement } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    // Voucher của trang 1 phải hiện trước, để chắc chắn effect gom trang ĐÃ chạy và
    // nhánh replace thật sự có tác dụng (nếu không thì test này không kiểm tra gì cả).
    await waitFor(() =>
      expect(baseElement.querySelector('#da-tai')).not.toBeNull(),
    )

    await userEvent.click(await screen.findByTestId('qr-scan'))

    // Checkbox của thẻ voucher mang `id` chính là slug.
    await waitFor(() =>
      expect(baseElement.querySelector('#chua-tai')).not.toBeNull(),
    )
    // Và nó phải TRỤ LẠI sau khi effect gom trang chạy lại vì length vừa đổi.
    await waitFor(() =>
      expect(baseElement.querySelector('#da-tai')).not.toBeNull(),
    )
    expect(baseElement.querySelector('#chua-tai')).not.toBeNull()
  })

  it('nút xác nhận ở footer áp đúng voucher đang chọn, không phải MouseEvent', async () => {
    // `handleCompleteSelection` nhận tham số `overrideVoucher`. Nếu footer truyền thẳng
    // `onClick={handleCompleteSelection}`, React nhét MouseEvent vào tham số đó; nó truthy
    // nên `overrideVoucher ?? ...` trả về chính cái event và event bị áp như một voucher.
    // TypeScript không bắt được vì `onClick` vốn nhận hàm có tham số event.
    validateSucceeds = false
    addItem('tra-sua', 1)

    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    validateSucceeds = true
    await userEvent.click(
      await screen.findByRole('button', { name: 'voucher.complete' }),
    )

    await waitFor(() =>
      expect(useOrderFlowStore.getState().orderingData?.voucher).toEqual(
        expect.objectContaining({ slug: 'chua-tai', code: 'UNLOADED' }),
      ),
    )
  })

  it('không áp lại và báo "đã áp rồi" khi quét trúng voucher đang được áp', async () => {
    addItem('tra-sua', 1)
    useOrderFlowStore.getState().addVoucher(scannedVoucher)

    renderSheet()

    await userEvent.click(screen.getByRole('button', { name: /voucher/i }))
    await userEvent.click(await screen.findByTestId('qr-scan'))

    expect(showToast).toHaveBeenCalledWith('toast.voucherAlreadyApplied')
    expect(showToast).not.toHaveBeenCalledWith('toast.applyVoucherSuccess')
  })
})
