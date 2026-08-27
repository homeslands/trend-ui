import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import VoucherQrScannerDialog from '../voucher-qr-scanner-dialog'

const start = vi.fn()
const stop = vi.fn().mockResolvedValue(undefined)
const clear = vi.fn()

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start,
    stop,
    clear,
    getState: () => 2, // SCANNING
  })),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// jsdom không cài đặt navigator.mediaDevices (nó là undefined, không chỉ
// thiếu method). Component feature-detect secure context qua
// `if (!navigator.mediaDevices)`, nên nếu không stub, MỌI test ở đây sẽ rơi
// vào nhánh insecure-context trước khi Html5Qrcode.start được gọi. Stub này
// chỉ áp dụng trong file test này (không đặt ở src/tests/setup.ts dùng
// chung cho toàn bộ 75 file test khác) để không âm thầm che mất các test
// tương lai thật sự cần kiểm tra trường hợp thiếu mediaDevices.
const originalMediaDevices = navigator.mediaDevices

beforeEach(() => {
  vi.clearAllMocks()
  start.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {},
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: originalMediaDevices,
    writable: true,
    configurable: true,
  })
})

describe('VoucherQrScannerDialog', () => {
  it('khởi động camera khi mở', async () => {
    render(
      <VoucherQrScannerDialog
        isOpen
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())
  })

  it('không khởi động camera khi đóng', () => {
    render(
      <VoucherQrScannerDialog
        isOpen={false}
        onOpenChange={vi.fn()}
        onScanned={vi.fn()}
      />,
    )
    expect(start).not.toHaveBeenCalled()
  })

  it('gọi onScanned ĐÚNG MỘT LẦN dù callback bắn nhiều khung hình', async () => {
    const onScanned = vi.fn()
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    // html5-qrcode gọi callback mỗi khung hình khi mã còn trong khung ngắm.
    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/abc123')
    successCallback('https://order.cmsiot.net/voucher/abc123')
    successCallback('https://order.cmsiot.net/voucher/abc123')

    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(onScanned).toHaveBeenCalledWith(
      'https://order.cmsiot.net/voucher/abc123',
    )
  })

  it('quét lại được khi nơi gọi trả đúng false', async () => {
    // Chốt `hasScannedRef` chỉ được mở lại trong effect camera (chạy theo `isOpen`
    // và `attempt`). Nơi gọi CỐ Ý không đóng dialog khi quét hụt, nên nếu dialog
    // không mở lại chốt thì mọi khung hình sau đó đều bị chặn: camera vẫn hiện
    // hình nhưng không quét được gì nữa cho tới khi đóng/mở lại dialog.
    const onScanned = vi.fn().mockResolvedValue(false)
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('khong-phai-qr-voucher')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    // Người dùng chĩa lại camera vào mã khác — khung hình mới phải tới được nơi gọi.
    successCallback('https://order.cmsiot.net/voucher/abc123')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(2))
    expect(onScanned).toHaveBeenLastCalledWith(
      'https://order.cmsiot.net/voucher/abc123',
    )
  })

  it('nút "nhập mã bằng tay" đóng màn quét để lộ ô nhập mã của sheet', async () => {
    // Lối thoát bắt buộc: khi camera hỏng, mã in mờ, hoặc bị từ chối quyền thì
    // đây là đường duy nhất để người dùng không kẹt cứng trong màn quét.
    const onOpenChange = vi.fn()
    render(
      <VoucherQrScannerDialog
        isOpen
        onOpenChange={onOpenChange}
        onScanned={vi.fn()}
      />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    await userEvent.click(
      screen.getByRole('button', { name: 'voucher.enterCodeManually' }),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('vẫn còn lối nhập tay khi camera bị từ chối quyền', async () => {
    // Trạng thái lỗi trước đây là ngõ cụt: chỉ có nút "Thử lại", mà thử lại
    // cũng vô ích nếu người dùng chưa vào cài đặt bật quyền.
    const err = new Error('denied')
    err.name = 'NotAllowedError'
    start.mockRejectedValue(err)

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
    )

    expect(
      await screen.findByText('voucher.cameraPermissionDenied'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'voucher.enterCodeManually' }),
    ).toBeInTheDocument()
  })

  it('KHÔNG chớp lớp phủ khi tra cứu xong nhanh', async () => {
    // Mạng tốt thì tra cứu chỉ mất khoảng một phần mười giây. Bật lớp phủ ngay
    // lập tức khiến màn hình chớp đen một cái mỗi lần quét — người dùng phản ánh
    // đúng chuyện này. Lớp phủ chỉ được hiện khi chờ quá ngưỡng.
    // Phải kiểm NGAY khi tra cứu còn đang chạy. Kiểm sau khi nó xong thì lớp phủ
    // đã tắt rồi, và test sẽ xanh kể cả khi màn hình vừa chớp một cái.
    let release: (value: boolean) => void = () => undefined
    const onScanned = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        }),
    )

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/abc123')
    await waitFor(() => expect(onScanned).toHaveBeenCalled())

    // Còn xa mới tới ngưỡng: lớp phủ chưa được phép xuất hiện.
    expect(screen.queryByText('voucher.scanQrCodeProcessing')).toBeNull()

    release(true)
  })

  it('hiện trạng thái đang xử lý trong lúc nơi gọi còn tra cứu', async () => {
    // Không có lớp phủ này, khung camera lúc đang tra cứu trông y hệt lúc chưa
    // quét được gì: mạng chậm thì người dùng tưởng quét hụt và chĩa lại, trong
    // khi lượt tra cứu cũ vẫn đang chạy.
    let resolveLookup: (value: boolean) => void = () => undefined
    const onScanned = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLookup = resolve
        }),
    )

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    // Trước khi quét được: không có gì che khung ngắm.
    expect(screen.queryByText('voucher.scanQrCodeProcessing')).toBeNull()

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/abc123')

    expect(
      await screen.findByText('voucher.scanQrCodeProcessing'),
    ).toBeInTheDocument()

    resolveLookup(true)
    await waitFor(() =>
      expect(screen.queryByText('voucher.scanQrCodeProcessing')).toBeNull(),
    )
  })

  it('KHÔNG bắn lại liên tục cùng một mã khi mã đó vừa hỏng', async () => {
    // Mã QR vẫn nằm trong khung ngắm sau lượt quét hỏng, nên thư viện đọc lại
    // nó ở MỌI khung hình kế tiếp. Mở lại chốt vô điều kiện biến chuyện đó
    // thành vòng lặp: hỏng → mở chốt → đọc lại cùng mã → hỏng, mỗi vòng bắn
    // thêm request. Người dùng không thấy gì ngoài lớp phủ nhấp nháy nên tưởng
    // máy không quét được.
    const onScanned = vi.fn().mockResolvedValue(false)
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    const SAME = 'https://order.cmsiot.net/voucher/hong'

    successCallback(SAME)
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    // Những khung hình ngay sau đó vẫn thấy đúng mã cũ.
    successCallback(SAME)
    successCallback(SAME)
    successCallback(SAME)
    await new Promise((r) => setTimeout(r, 0))

    expect(onScanned).toHaveBeenCalledTimes(1)
  })

  it('mã KHÔNG BAO GIỜ dùng được thì chặn hẳn, không chờ hết nguội rồi mời lại', async () => {
    // Voucher hết hạn thì quét lại bao nhiêu lần cũng vậy. Chặn hẳn trong phiên
    // để khỏi mời người dùng làm một việc chắc chắn thất bại — và để không bắn
    // thêm request nào cho nó nữa.
    const onScanned = vi
      .fn()
      .mockResolvedValue({ message: 'Voucher đã hết hạn', permanent: true })
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    const EXPIRED = 'https://order.cmsiot.net/voucher/het-han'

    successCallback(EXPIRED)
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Voucher đã hết hạn'),
    ).toBeInTheDocument()

    // Quá thời gian nguội mà vẫn phải im: chặn là VĨNH VIỄN, không phải tạm.
    // Nhảy đồng hồ thay vì chờ thật, và chỉ giả lập `Date.now` — khoảng nguội
    // đo bằng nó, còn setTimeout của dải chữ thì để nguyên cho khỏi rối.
    const realNow = Date.now
    Date.now = () => realNow() + 10_000
    successCallback(EXPIRED)
    Date.now = realNow
    await new Promise((r) => setTimeout(r, 0))
    expect(onScanned).toHaveBeenCalledTimes(1)

    // Nhưng phiếu khác vẫn ăn ngay.
    successCallback('https://order.cmsiot.net/voucher/phieu-khac')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(2))
  })

  it('lý do phụ thuộc GIỎ HÀNG thì KHÔNG chặn hẳn — khách thêm món rồi quét lại phải ăn', async () => {
    // Phân loại nhầm nhóm này thành vĩnh viễn sẽ tạo ngõ cụt: khách làm đúng
    // việc ta vừa khuyên (thêm món) rồi quét lại và không có gì xảy ra.
    const onScanned = vi
      .fn()
      .mockResolvedValue({ message: 'Đơn chưa đạt tối thiểu', hint: 'Thêm món rồi quét lại', permanent: false })
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/chua-du-tien')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Đơn chưa đạt tối thiểu'),
    ).toBeInTheDocument()
  })

  it('vẫn nhận NGAY một mã KHÁC sau khi mã trước hỏng', async () => {
    // Mặt còn lại: chặn lặp không được biến thành chặn luôn thao tác thật.
    // Khách chĩa sang phiếu khác thì phải ăn ngay, không phải chờ hết thời gian
    // nguội.
    const onScanned = vi.fn().mockResolvedValue(false)
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/hong')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    successCallback('https://order.cmsiot.net/voucher/phieu-khac')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(2))
    expect(onScanned).toHaveBeenLastCalledWith(
      'https://order.cmsiot.net/voucher/phieu-khac',
    )
  })

  it('KHÔNG quét lại khi nơi gọi báo đã tiêu thụ chuỗi quét được', async () => {
    // Mặt còn lại của test trên: mở lại chốt vô điều kiện sẽ khiến một lần quét
    // THÀNH CÔNG bắn onScanned nhiều lần theo từng khung hình.
    const onScanned = vi.fn().mockResolvedValue(true)
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/abc123')
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    successCallback('https://order.cmsiot.net/voucher/abc123')
    await Promise.resolve()
    expect(onScanned).toHaveBeenCalledTimes(1)
  })

  it('KHÔNG quét lại khi nơi gọi không trả gì — chỉ đúng false mới mở chốt', async () => {
    // Mặc định phải nghiêng về phía an toàn: nơi gọi không nói gì thì coi như đã
    // tiêu thụ. Nếu mọi giá trị falsy đều mở chốt, một nơi gọi quên `return true`
    // sẽ bị bắn onScanned theo TỪNG KHUNG HÌNH sau một lần quét thành công — trên
    // luồng này là áp voucher nhiều lần vào một đơn hàng thật.
    const onScanned = vi.fn() // trả undefined
    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={onScanned} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())

    const successCallback = start.mock.calls[0][2]
    successCallback('https://order.cmsiot.net/voucher/abc123')
    // waitFor xả hết microtask: nếu dialog định mở lại chốt thì tới đây đã mở rồi.
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1))

    successCallback('https://order.cmsiot.net/voucher/abc123')
    await Promise.resolve()
    expect(onScanned).toHaveBeenCalledTimes(1)
  })

  it('bấm Thử lại khởi động lại camera sau lỗi', async () => {
    const err = new Error('denied')
    err.name = 'NotAllowedError'
    start.mockRejectedValueOnce(err)

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
    )
    expect(
      await screen.findByText('voucher.cameraPermissionDenied'),
    ).toBeInTheDocument()
    expect(start).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'voucher.retry' }))

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByText('voucher.cameraPermissionDenied')).toBeNull(),
    )
  })

  it('KHÔNG khởi động lại camera khi nơi gọi truyền onScanned mới mỗi lần render', async () => {
    const { rerender } = render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={() => {}} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))

    // Sheet gọi component này thường không memo hoá handler.
    rerender(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={() => {}} />,
    )
    rerender(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={() => {}} />,
    )

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('dừng camera khi unmount — không để camera bật ngầm', async () => {
    const { unmount } = render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
    )
    await waitFor(() => expect(start).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(stop).toHaveBeenCalled())
  })

  it('hiện thông báo riêng khi bị từ chối quyền', async () => {
    const err = new Error('denied')
    err.name = 'NotAllowedError'
    start.mockRejectedValue(err)

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
    )
    expect(
      await screen.findByText('voucher.cameraPermissionDenied'),
    ).toBeInTheDocument()
  })

  it('hiện thông báo riêng khi không có camera', async () => {
    const err = new Error('none')
    err.name = 'NotFoundError'
    start.mockRejectedValue(err)

    render(
      <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
    )
    expect(await screen.findByText('voucher.cameraNotFound')).toBeInTheDocument()
  })

  it('trình duyệt đã từng ép toàn màn thì KHÔNG mở camera nữa', async () => {
    // Lần đầu không tránh được — không hỏi trước được WebView có bật
    // `allowsInlineMediaPlayback` hay không. Nhưng lần thứ hai mà vẫn mở camera
    // là bắt người dùng lãnh lại nguyên màn video trần, rồi tự vuốt xuống mới
    // thấy lời giải thích. `webkitExitFullscreen()` không cứu được vì iOS chỉ
    // cho thoát bằng thao tác tay.
    localStorage.setItem('voucher-qr:fullscreen-hijack', '1')
    try {
      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )

      expect(await screen.findByText('voucher.inAppTitle')).toBeInTheDocument()
      expect(start).not.toHaveBeenCalled()

      // Nhập tay là việc CHÍNH, và phải có đường sao chép link để mở bằng
      // trình duyệt thật — bảo người ta "mở Safari" mà không cho cách lấy
      // địa chỉ thì lời khuyên đó vô dụng.
      expect(
        screen.getByRole('button', { name: /enterCodeManually/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /copyLink/ }),
      ).toBeInTheDocument()
    } finally {
      localStorage.removeItem('voucher-qr:fullscreen-hijack')
    }
  })

  it('nút sao chép liên kết đưa đúng địa chỉ trang vào clipboard', async () => {
    // Đây là đường duy nhất chạy được ở mọi app: `window.open` trong WKWebView
    // thường chỉ mở lại trong chính app đó.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })
    localStorage.setItem('voucher-qr:fullscreen-hijack', '1')
    try {
      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )
      await screen.findByText('voucher.inAppTitle')

      await userEvent.click(screen.getByRole('button', { name: /copyLink/ }))
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(window.location.href),
      )
    } finally {
      localStorage.removeItem('voucher-qr:fullscreen-hijack')
    }
  })

  it('quét mãi không ra thì gợi ý theo đúng môi trường đang chạy', async () => {
    // Lưới an toàn: không ai liệt kê nổi mọi trình duyệt, và ngày mai lại có
    // cái mới. Nếu camera chạy mà chẳng đọc được gì, ít nhất phải nói cho người
    // dùng biết làm gì — im lặng là thứ khiến họ kết luận "máy hỏng".
    const originalUserAgent = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Zalo/23.09.01',
      writable: true,
      configurable: true,
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )
      await vi.waitFor(() => expect(start).toHaveBeenCalled())

      // Chưa tới hạn: chưa được làm phiền người đang quét bình thường.
      await vi.advanceTimersByTimeAsync(5000)
      expect(screen.queryByText('voucher.scanStallInApp')).toBeNull()

      await vi.advanceTimersByTimeAsync(8000)
      await vi.waitFor(() =>
        expect(screen.getByText('voucher.scanStallInApp')).toBeInTheDocument(),
      )
    } finally {
      vi.useRealTimers()
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        writable: true,
        configurable: true,
      })
    }
  })

  describe('khi không có navigator.mediaDevices', () => {
    // Ba nguyên nhân khác nhau, ba cách sửa khác nhau. Gộp hết vào "cần HTTPS"
    // như bản đầu là nói sai với đa số người gặp: trong trình duyệt của Zalo thì
    // trang vẫn HTTPS, chỉ là WebView không cho dùng camera — và lời khuyên
    // "hãy dùng HTTPS" khiến họ không biết phải làm gì.
    const setUserAgent = (ua: string) =>
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        writable: true,
        configurable: true,
      })

    const originalUserAgent = navigator.userAgent

    beforeEach(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      setUserAgent(originalUserAgent)
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    it('trong trình duyệt của app thì bảo mở bằng trình duyệt thật', async () => {
      setUserAgent(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Zalo/23.09.01',
      )

      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )

      expect(
        await screen.findByText('voucher.cameraInAppBrowser'),
      ).toBeInTheDocument()
      expect(start).not.toHaveBeenCalled()
    })

    it('trang không phải secure context thì mới nói về HTTPS', async () => {
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        writable: true,
        configurable: true,
      })

      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )

      expect(
        await screen.findByText('voucher.cameraInsecureContext'),
      ).toBeInTheDocument()
    })

    it('còn lại thì báo trình duyệt không hỗ trợ', async () => {
      render(
        <VoucherQrScannerDialog isOpen onOpenChange={vi.fn()} onScanned={vi.fn()} />,
      )

      expect(
        await screen.findByText('voucher.cameraNotSupported'),
      ).toBeInTheDocument()
    })
  })
})
