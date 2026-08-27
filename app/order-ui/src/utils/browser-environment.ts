/**
 * Nhận diện môi trường trình duyệt cho luồng quét camera.
 *
 * Không nhằm liệt kê hết mọi trình duyệt — chuyện đó bất khả thi và luôn lạc
 * hậu. Mục đích hẹp hơn: khi camera không dùng được, nói cho người dùng biết
 * việc CẦN LÀM, vì cách sửa khác nhau hoàn toàn giữa các môi trường. Trong
 * trình duyệt của Zalo thì phải mở bằng trình duyệt thật; trong Brave thì phải
 * hạ Shields; ngoài ra thì thường chỉ là thiếu sáng hay mã mờ.
 */

/** Trình duyệt nhúng trong một ứng dụng khác. */
export type InAppBrowser =
  | 'zalo'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'line'
  | 'other'

/** Môi trường quyết định cách hướng dẫn người dùng khi camera trục trặc. */
export type ScanEnvironment = 'brave' | 'in-app' | 'normal'

interface InAppSignature {
  name: InAppBrowser
  test: RegExp
}

/**
 * Dấu hiệu trong `userAgent`. Xét theo thứ tự: các app cụ thể trước, dấu hiệu
 * WebView chung sau cùng.
 */
const IN_APP_SIGNATURES: InAppSignature[] = [
  { name: 'zalo', test: /\bZalo\b/i },
  // Facebook và Messenger dùng chung tiền tố FBAN/FBAV/FB_IAB.
  { name: 'facebook', test: /\bFB(AN|AV|_IAB)\b/i },
  { name: 'instagram', test: /\bInstagram\b/i },
  // TikTok đi qua WebView của ByteDance, tên cũ musical_ly vẫn còn xuất hiện.
  { name: 'tiktok', test: /musical_ly|BytedanceWebview|Bytedance/i },
  { name: 'line', test: /\bLine\/[\d.]+/i },
]

/**
 * Dấu hiệu WebView Android chung: chuỗi `; wv)` do chính hệ điều hành thêm vào
 * cho MỌI trình duyệt nhúng. Đây là thứ bắt được cả những app ta chưa từng nghe
 * tên — quan trọng hơn danh sách bên trên, vì danh sách nào rồi cũng thiếu.
 */
const ANDROID_WEBVIEW = /;\s*wv\)/i

/**
 * Trả về tên app đang nhúng trình duyệt, hoặc `null` nếu là trình duyệt thường.
 */
export function detectInAppBrowser(
  userAgent: string = typeof navigator === 'undefined'
    ? ''
    : navigator.userAgent,
): InAppBrowser | null {
  if (!userAgent) return null

  for (const signature of IN_APP_SIGNATURES) {
    if (signature.test.test(userAgent)) return signature.name
  }

  if (ANDROID_WEBVIEW.test(userAgent)) return 'other'

  return null
}

interface BraveNavigator {
  brave?: { isBrave?: () => Promise<boolean> }
}

/**
 * Brave có API riêng để tự khai báo. Bọc trong try/catch vì đây là API không
 * chuẩn: trình duyệt khác không có, và bản Brave cũ có thể khác chữ ký.
 */
export async function isBraveBrowser(): Promise<boolean> {
  try {
    const brave = (navigator as Navigator & BraveNavigator)?.brave
    if (!brave?.isBrave) return false
    return (await brave.isBrave()) === true
  } catch {
    return false
  }
}

/**
 * Môi trường đang chạy, dùng để chọn câu hướng dẫn khi camera trục trặc.
 *
 * Trình duyệt trong app được ưu tiên hơn Brave: nếu ai đó mở link trong WebView
 * của Zalo mà máy đặt Brave làm mặc định, thì việc cần làm vẫn là mở ra ngoài,
 * không phải chỉnh Shields.
 */
/** iOS (kể cả iPadOS mới, vốn khai userAgent giống macOS nhưng có cảm ứng). */
export function isIosDevice(
  userAgent: string = typeof navigator === 'undefined'
    ? ''
    : navigator.userAgent,
): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  return (
    /Macintosh/i.test(userAgent) &&
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints || 0) > 1
  )
}

/**
 * Camera có chắc chắn KHÔNG dùng được ở môi trường này không.
 *
 * Chỉ chặn khi hội đủ iOS **và** trình duyệt nhúng trong app. Trên iOS, WKWebView
 * của app chủ hầu như luôn tắt `allowsInlineMediaPlayback`, và khi đó video bị
 * hệ điều hành đẩy sang trình phát toàn màn — vẽ ngoài cây DOM, che sạch khung
 * ngắm, không CSS nào chen lên được.
 *
 * KHÔNG chặn theo tên app: WebView trên Android không ép toàn màn, nên chặn cả
 * Zalo Android là tự cắt một đường vẫn đang chạy tốt.
 */
export function isCameraBlockedEnvironment(): boolean {
  return isIosDevice() && detectInAppBrowser() !== null
}

const FULLSCREEN_HIJACK_KEY = 'voucher-qr:fullscreen-hijack'

/**
 * Ghi nhớ rằng trình duyệt hiện tại ép video chạy toàn màn.
 *
 * Lần đầu thì không tránh được — không có cách nào hỏi trước xem WebView có bật
 * `allowsInlineMediaPlayback` hay không. Nhưng ghi lại thì những lần sau khỏi
 * phải để người dùng lãnh trọn màn video trần lần nữa.
 */
export function rememberFullscreenHijack(): void {
  try {
    localStorage.setItem(FULLSCREEN_HIJACK_KEY, '1')
  } catch {
    // Chế độ riêng tư chặn localStorage: mất trí nhớ giữa các lần, chấp nhận
    // được — người dùng vẫn nhận đúng hướng dẫn, chỉ là mỗi lần một lần.
  }
}

/** Trình duyệt này đã từng ép toàn màn chưa. */
export function hasFullscreenHijack(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_HIJACK_KEY) === '1'
  } catch {
    return false
  }
}

export async function detectScanEnvironment(): Promise<ScanEnvironment> {
  if (detectInAppBrowser()) return 'in-app'
  if (await isBraveBrowser()) return 'brave'
  return 'normal'
}
