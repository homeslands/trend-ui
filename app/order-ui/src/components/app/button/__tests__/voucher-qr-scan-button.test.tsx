import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import VoucherQrScanButton from '../voucher-qr-scan-button'

// `vi.mock` factories are hoisted above every other top-level statement in this
// file, including plain `const` declarations. The `@/utils` factory below reads
// `showErrorToastMessage` eagerly (as part of its own return value, not inside a
// deferred closure), so a plain `const` here would be accessed before it is
// initialized. `vi.hoisted` hoists the declaration itself alongside `vi.mock`,
// which is what actually fixes it (see https://vitest.dev/api/vi.html#vi-hoisted).
const { mutateAsync, showErrorToastMessage, scanState } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToastMessage: vi.fn(),
  // Dialog thật dùng giá trị trả về của `onScanned` để quyết định có mở lại chốt
  // quét hay không, nên bản giả phải ghi lại giá trị đó — không thì hợp đồng này
  // không được kiểm ở đâu cả.
  scanState: {
    raw: 'https://order.cmsiot.net/voucher/abc123',
    results: [] as unknown[],
  },
}))

vi.mock('@/hooks', () => ({
  useLookupVoucherByQr: () => ({ mutateAsync, isPending: false }),
}))

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/voucher-qr')>(
    '@/utils/voucher-qr',
  )
  // Lấy cả bảng khoá gợi ý thật: nhánh từ chối theo nhóm đọc nó, và một bản giả
  // ở đây sẽ khiến test xanh trong khi câu chữ thật đã đổi.
  const rejection = await vi.importActual<
    typeof import('@/utils/voucher-scan-rejection')
  >('@/utils/voucher-scan-rejection')
  return { ...actual, ...rejection, showErrorToastMessage }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Dialog thật bật camera — thay bằng bản giả bắn ra chuỗi khi bấm.
vi.mock('@/components/app/dialog', () => ({
  VoucherQrScannerDialog: ({
    isOpen,
    onScanned,
  }: {
    isOpen: boolean
    onScanned: (raw: string) => boolean | void | Promise<boolean | void>
  }) =>
    isOpen ? (
      <button
        data-testid="fake-scan"
        onClick={async () => {
          scanState.results.push(await onScanned(scanState.raw))
        }}
      >
        scan
      </button>
    ) : null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  scanState.raw = 'https://order.cmsiot.net/voucher/abc123'
  scanState.results = []
})

describe('VoucherQrScanButton', () => {
  it('mở dialog khi bấm nút', async () => {
    render(<VoucherQrScanButton isPublic={false} onResolved={vi.fn()} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('fake-scan')).toBeInTheDocument()
  })

  it('tra cứu rồi gọi onResolved khi quét được mã hợp lệ', async () => {
    const voucher = { slug: 'abc123', code: 'ABC123' }
    mutateAsync.mockResolvedValue(voucher)
    const onResolved = vi.fn()

    render(<VoucherQrScanButton isPublic={false} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        identifier: 'abc123',
        isPublic: false,
      }),
    )
    expect(onResolved).toHaveBeenCalledWith(voucher)
  })

  it('đóng dialog sau khi tra cứu thành công', async () => {
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    render(<VoucherQrScanButton isPublic={false} onResolved={vi.fn()} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() =>
      expect(screen.queryByTestId('fake-scan')).not.toBeInTheDocument(),
    )
  })

  it('GIỮ dialog mở khi sheet từ chối voucher (không đủ điều kiện)', async () => {
    // Voucher tra ra được nhưng không dùng được cho đơn này — hết hạn, sai sản
    // phẩm, chưa đủ giá trị tối thiểu. Đây là lúc khách hay muốn thử phiếu khác
    // nhất, nên đóng màn quét ngay là bắt họ mở lại một cách vô cớ.
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    const onResolved = vi.fn().mockReturnValue(false)

    render(<VoucherQrScanButton isPublic={false} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    expect(screen.getByTestId('fake-scan')).toBeInTheDocument()
  })

  it('báo lỗi và GIỮ dialog mở khi tra cứu không ra voucher', async () => {
    mutateAsync.mockRejectedValue(new Error('not found'))
    const onResolved = vi.fn()

    render(<VoucherQrScanButton isPublic={false} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    // Không còn toast: lý do đi theo giá trị trả về rồi hiện trong dải chữ.
    await waitFor(() =>
      expect(scanState.results).toEqual([
        expect.objectContaining({ message: 'toast.voucherNotFoundFromQrCode' }),
      ]),
    )
    expect(onResolved).not.toHaveBeenCalled()
    // Giữ camera chạy: người dùng gần như luôn quét lại ngay.
    expect(screen.getByTestId('fake-scan')).toBeInTheDocument()
  })

  it('trả false cho dialog khi quét hụt, true khi đã tiêu thụ', async () => {
    // Dialog mở lại chốt quét khi nhận `false` HOẶC một object từ chối. Trả nhầm
    // `true` ở nhánh hỏng => camera vẫn chạy nhưng không nhận thêm khung hình nào.
    // Object còn mang theo lời khuyên hiện lên màn quét.
    scanState.raw = 'https://order.cmsiot.net/menu'
    const { unmount } = render(
      <VoucherQrScanButton isPublic={false} onResolved={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))
    await waitFor(() =>
      expect(scanState.results).toEqual([
        expect.objectContaining({ permanent: false }),
      ]),
    )
    expect(scanState.results[0]).toMatchObject({
      message: 'toast.invalidVoucherQrCode',
    })
    // Chưa gọi tới API: nhánh này dừng ngay ở bước phân tích chuỗi.
    expect(mutateAsync).not.toHaveBeenCalled()
    unmount()

    // Tra cứu thất bại cũng là quét hụt.
    scanState.results = []
    scanState.raw = 'https://order.cmsiot.net/voucher/abc123'
    mutateAsync.mockRejectedValueOnce(new Error('not found'))
    const second = render(
      <VoucherQrScanButton isPublic={false} onResolved={vi.fn()} />,
    )
    await userEvent.click(second.getByRole('button', { name: 'voucher.scanQrCode' }))
    await userEvent.click(second.getByTestId('fake-scan'))
    await waitFor(() =>
      expect(scanState.results).toEqual([
        expect.objectContaining({ permanent: false }),
      ]),
    )
    second.unmount()

    // Tra cứu thành công: đã tiêu thụ, dialog KHÔNG được mở lại chốt.
    scanState.results = []
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    const third = render(
      <VoucherQrScanButton isPublic={false} onResolved={vi.fn()} />,
    )
    await userEvent.click(third.getByRole('button', { name: 'voucher.scanQrCode' }))
    await userEvent.click(third.getByTestId('fake-scan'))
    await waitFor(() => expect(scanState.results).toEqual([true]))
  })

  it('dùng lời khuyên CỤ THỂ của sheet thay cho câu chung theo nhóm', async () => {
    // Sheet biết giỏ hàng nên nêu được đích danh món cần thêm; bộ phân loại thì
    // không, nó chỉ biết "lý do thuộc nhóm giỏ hàng".
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    const onResolved = vi.fn().mockReturnValue({
      kind: 'cart',
      message: 'Giỏ hàng chưa có món nào thuộc phiếu này.',
      hint: 'Thêm một trong: Cà phê sữa, Trà đào.',
    })

    render(<VoucherQrScanButton isPublic={false} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() => expect(scanState.results).toHaveLength(1))
    expect(scanState.results[0]).toMatchObject({
      hint: 'Thêm một trong: Cà phê sữa, Trà đào.',
    })
  })

  it('rơi về câu chung theo nhóm khi sheet không đưa lời khuyên riêng', async () => {
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    const onResolved = vi
      .fn()
      .mockReturnValue({ kind: 'cart', message: 'Không dùng được.' })

    render(<VoucherQrScanButton isPublic={false} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() => expect(scanState.results).toHaveLength(1))
    expect(scanState.results[0]).toMatchObject({
      hint: 'voucher.scanHintAdjustCart',
    })
  })

  it('truyền isPublic xuống hook tra cứu', async () => {
    mutateAsync.mockResolvedValue({ slug: 'abc123' })
    render(<VoucherQrScanButton isPublic onResolved={vi.fn()} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByTestId('fake-scan'))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        identifier: 'abc123',
        isPublic: true,
      }),
    )
  })
})
