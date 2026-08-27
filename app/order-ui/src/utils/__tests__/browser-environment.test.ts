import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  detectInAppBrowser,
  detectScanEnvironment,
  isBraveBrowser,
} from '../browser-environment'

/** userAgent thật, rút gọn phần không liên quan. */
const UA = {
  zalo: 'Mozilla/5.0 (Linux; Android 13; SM-N985F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Zalo/23.09.01 ZaloTheme/light',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/440.0.0.32.108;FBBV/0]',
  instagram:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.113',
  tiktok:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 musical_ly_2022803040 JsSdk/1.0 BytedanceWebview/d8a21c6',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Line/13.14.0',
  // WebView Android của một app không tên tuổi — chỉ có dấu `; wv)`.
  unknownWebview:
    'Mozilla/5.0 (Linux; Android 13; SM-N985F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-N985F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectInAppBrowser', () => {
  it('nhận ra từng app cụ thể', () => {
    expect(detectInAppBrowser(UA.zalo)).toBe('zalo')
    expect(detectInAppBrowser(UA.facebook)).toBe('facebook')
    expect(detectInAppBrowser(UA.instagram)).toBe('instagram')
    expect(detectInAppBrowser(UA.tiktok)).toBe('tiktok')
    expect(detectInAppBrowser(UA.line)).toBe('line')
  })

  it('bắt được WebView của app KHÔNG có trong danh sách', () => {
    // Đây mới là phần thật sự "cover hết": danh sách tên app nào rồi cũng
    // thiếu, còn dấu `; wv)` do chính Android thêm vào mọi WebView nhúng.
    expect(detectInAppBrowser(UA.unknownWebview)).toBe('other')
  })

  it('KHÔNG nhận nhầm trình duyệt thường', () => {
    // Nhận nhầm còn tệ hơn bỏ sót: ta sẽ bảo người đang dùng Chrome đi "mở bằng
    // trình duyệt khác", một lời khuyên vô nghĩa.
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull()
    expect(detectInAppBrowser(UA.safariIos)).toBeNull()
  })

  it('chuỗi rỗng thì trả null chứ không ném', () => {
    expect(detectInAppBrowser('')).toBeNull()
  })
})

describe('isBraveBrowser', () => {
  it('true khi navigator.brave xác nhận', async () => {
    vi.stubGlobal('navigator', {
      userAgent: UA.chromeAndroid,
      brave: { isBrave: () => Promise.resolve(true) },
    })
    await expect(isBraveBrowser()).resolves.toBe(true)
  })

  it('false khi không có navigator.brave', async () => {
    vi.stubGlobal('navigator', { userAgent: UA.chromeAndroid })
    await expect(isBraveBrowser()).resolves.toBe(false)
  })

  it('false chứ không ném khi API lỗi', async () => {
    vi.stubGlobal('navigator', {
      userAgent: UA.chromeAndroid,
      brave: {
        isBrave: () => {
          throw new Error('nope')
        },
      },
    })
    await expect(isBraveBrowser()).resolves.toBe(false)
  })
})

describe('detectScanEnvironment', () => {
  it('trình duyệt trong app THẮNG Brave', async () => {
    // Mở link trong WebView của Zalo trên máy đặt Brave làm mặc định: việc cần
    // làm là mở ra ngoài, không phải chỉnh Shields. Khuyên nhầm ở đây là dắt
    // người dùng đi sửa một thứ không liên quan.
    vi.stubGlobal('navigator', {
      userAgent: UA.zalo,
      brave: { isBrave: () => Promise.resolve(true) },
    })
    await expect(detectScanEnvironment()).resolves.toBe('in-app')
  })

  it('nhận ra Brave khi không ở trong app nào', async () => {
    vi.stubGlobal('navigator', {
      userAgent: UA.chromeAndroid,
      brave: { isBrave: () => Promise.resolve(true) },
    })
    await expect(detectScanEnvironment()).resolves.toBe('brave')
  })

  it('trình duyệt thường là normal', async () => {
    vi.stubGlobal('navigator', { userAgent: UA.safariIos })
    await expect(detectScanEnvironment()).resolves.toBe('normal')
  })
})
