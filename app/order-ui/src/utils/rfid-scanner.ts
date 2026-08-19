// utils/rfidScanner.ts
// @ts-expect-error - onscan.js không có type definitions
import onScan from 'onscan.js'

type RFIDCallback = (cardCode: string) => void

/**
 * Khởi tạo RFID scanner listener sử dụng onscan.js
 * @param callback - Callback được gọi khi nhận được mã thẻ
 * @returns Cleanup function để dừng listener
 */
export function listenRFID(callback?: RFIDCallback) {
  try {
    // Attach onScan vào document để bắt tất cả keyboard events
    onScan.attachTo(document, {
      // Callback khi quét thành công
      onScan: (scannedString: string) => {
        if (callback) {
          callback(scannedString)
        }
      },

      // Callback khi có lỗi
      onScanError: () => {},

      // Cấu hình
      timeBeforeScanTest: 100, // Chờ 100ms sau khi nhận ký tự cuối
      avgTimeByChar: 30, // Thời gian trung bình giữa các ký tự (ms) - RFID rất nhanh
      minLength: 1, // Độ dài tối thiểu của mã thẻ
      suffixKeyCodes: [9, 13], // Tab và Enter = kết thúc quét
      prefixKeyCodes: [], // Không có prefix

      // Quan trọng: ignoreIfFocusOn để không xử lý khi focus vào input
      // Cho phép người dùng nhập input bình thường khi focus vào input
      ignoreIfFocusOn: true, // Ignore khi focus vào input để cho phép nhập thủ công

      // Không prevent default để cho phép nhập input
      // RFID scan vẫn được bắt khi không focus vào input
      preventDefault: false, // Cho phép default action để có thể nhập input
      stopPropagation: false, // Không stop propagation để các handler khác vẫn hoạt động

      // Capture events sớm để bắt được trước input
      captureEvents: true, // Bắt event ở capture phase

      // Chỉ react với keydown (không cần paste)
      reactToKeydown: true,
      reactToPaste: false,
    })

    // Cleanup function
    return () => {
      try {
        onScan.detachFrom(document)
      } catch {
        // Do nothing
      }
    }
  } catch {
    // Trả về cleanup function rỗng nếu có lỗi
    return () => {}
  }
}
