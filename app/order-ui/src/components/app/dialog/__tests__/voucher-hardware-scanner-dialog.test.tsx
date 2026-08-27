import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const stopListening = vi.fn()
const listenRFID = vi.fn()
const isRfidListenerAttached = vi.fn()

vi.mock('@/utils', async () => ({
  // Lấy hằng số THẬT: nó quyết định khi nào mời bung danh sách, nên một con số
  // giả ở đây sẽ che mất chính hành vi đang kiểm.
  ...(await vi.importActual<typeof import('@/utils/voucher-cart-fix-hint')>(
    '@/utils/voucher-cart-fix-hint',
  )),
  listenRFID: (cb: (code: string) => void) => listenRFID(cb),
  isRfidListenerAttached: () => isRfidListenerAttached(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import VoucherHardwareScannerDialog from '../voucher-hardware-scanner-dialog'

/** Chuỗi mà đầu đọc "gõ" ra khi quét mã QR trên phiếu giảm giá. */
const SCANNED = 'https://order.cmsiot.net/voucher/abc123'

/** Lấy callback mà component đã đăng ký với listenRFID. */
function fireScan(value: string = SCANNED) {
  const callback = listenRFID.mock.calls[0][0]
  callback(value)
}

beforeEach(() => {
  vi.clearAllMocks()
  listenRFID.mockReturnValue(stopListening)
  isRfidListenerAttached.mockReturnValue(true)
})

describe('VoucherHardwareScannerDialog', () => {
  it('chỉ lắng nghe đầu đọc khi dialog đang mở', () => {
    const { rerender } = render(
      <VoucherHardwareScannerDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    expect(listenRFID).not.toHaveBeenCalled()

    rerender(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    expect(listenRFID).toHaveBeenCalledTimes(1)
  })

  it('chuyển chuỗi đầu đọc quét được cho nơi gọi', async () => {
    const onScanned = vi.fn().mockResolvedValue(true)
    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    await waitFor(() => expect(onScanned).toHaveBeenCalledWith(SCANNED))
  })

  it('bỏ qua lượt quét mới khi lượt trước còn đang tra cứu', async () => {
    // Nhân viên bóp cò hai lần liên tiếp trước khi có kết quả. Không chặn thì
    // một thao tác thành hai lượt áp voucher lên cùng một đơn hàng.
    let release: (value: boolean) => void = () => undefined
    const onScanned = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        }),
    )

    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    fireScan()
    fireScan()
    expect(onScanned).toHaveBeenCalledTimes(1)

    release(true)
    await waitFor(() =>
      expect(screen.queryByText('voucher.scanQrCodeProcessing')).toBeNull(),
    )
  })

  it('nhận lượt quét tiếp theo khi nơi gọi trả đúng false', async () => {
    // Quét hụt (mã lạ, voucher không tồn tại) thì màn chờ phải sẵn sàng nhận
    // lượt quét mới ngay, không bắt đóng rồi mở lại dialog.
    const onScanned = vi.fn().mockResolvedValue(false)
    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan('ma-la')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    fireScan()
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(2))
    expect(onScanned).toHaveBeenLastCalledWith(SCANNED)
  })

  it('KHÔNG nhận lượt quét mới khi nơi gọi không trả gì', async () => {
    // Mặt còn lại: mặc định an toàn là coi như đã tiêu thụ, để nơi gọi quên
    // trả giá trị không biến thành áp voucher hai lần.
    const onScanned = vi.fn().mockReturnValue(undefined)
    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    fireScan()
    await new Promise((r) => setTimeout(r, 0))
    expect(onScanned).toHaveBeenCalledTimes(1)
  })

  it('hiện CẢ lời khuyên, không chỉ câu lý do', async () => {
    // Nhân viên đọc "giỏ hàng chưa có món nào thuộc phiếu" rồi vẫn phải hỏi
    // "vậy thêm món gì?". Dòng hai trả lời đúng câu đó, và trước đây nó bị bỏ
    // rơi ở màn đầu đọc trong khi màn camera vẫn hiện.
    const onScanned = vi.fn().mockResolvedValue({
      message: 'Giỏ hàng chưa có món nào thuộc phiếu này.',
      hint: 'Thêm một trong: Cà phê sữa, Trà đào.',
      permanent: false,
    })

    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    await screen.findByText('Giỏ hàng chưa có món nào thuộc phiếu này.')
    expect(
      screen.getByText('Thêm một trong: Cà phê sữa, Trà đào.'),
    ).toBeInTheDocument()
  })

  it('bung danh sách đầy đủ khi bấm, vì ở quầy không có đường nào khác tới nó', async () => {
    // Voucher gắn hai chục món thì dòng gợi ý nêu 3 tên là gần như vô dụng.
    // Danh sách đầy đủ chỉ có trong màn chi tiết voucher ở trang quản trị.
    const onScanned = vi.fn().mockResolvedValue({
      message: 'Giỏ hàng chưa có món nào thuộc phiếu này.',
      hint: 'Thêm một trong 5 món: A, B, C',
      hintItems: ['A', 'B', 'C', 'D', 'E'],
      permanent: false,
    })

    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    // Chưa bấm thì hai món cuối chưa hiện.
    const toggle = await screen.findByRole('button', {
      name: 'voucher.fixShowAllProducts',
    })
    expect(screen.queryByText('E')).toBeNull()

    await userEvent.click(toggle)
    expect(screen.getByText('E')).toBeInTheDocument()
  })

  it('KHÔNG mời bung khi số món vừa đủ hiện hết', async () => {
    const onScanned = vi.fn().mockResolvedValue({
      message: 'Giỏ hàng chưa có món nào thuộc phiếu này.',
      hint: 'Thêm một trong: A, B, C',
      hintItems: ['A', 'B', 'C'],
      permanent: false,
    })

    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={onScanned}
      />,
    )

    fireScan()
    await screen.findByText('Thêm một trong: A, B, C')
    expect(
      screen.queryByRole('button', { name: 'voucher.fixShowAllProducts' }),
    ).toBeNull()
  })

  it('gỡ listener khi đóng dialog', () => {
    const { rerender } = render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    expect(stopListening).not.toHaveBeenCalled()

    rerender(
      <VoucherHardwareScannerDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    expect(stopListening).toHaveBeenCalled()
  })

  it('báo lỗi khi không gắn được listener thay vì chờ vĩnh viễn', () => {
    // onscan.js chỉ cho một listener trên mỗi element. `listenRFID` nuốt lỗi và
    // vẫn trả về hàm cleanup, nên không kiểm thì màn này đứng im mãi mãi và
    // nhân viên quét hoài không hiểu vì sao không có gì xảy ra.
    isRfidListenerAttached.mockReturnValue(false)

    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )

    expect(screen.getByText('voucher.scannerBusy')).toBeInTheDocument()
    expect(screen.queryByText('voucher.waitingHardwareScan')).toBeNull()
  })

  it('nút đóng gọi onOpenChange(false)', async () => {
    const onOpenChange = vi.fn()
    render(
      <VoucherHardwareScannerDialog
        isOpen
        onOpenChange={onOpenChange}
        onScanned={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'voucher.close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
