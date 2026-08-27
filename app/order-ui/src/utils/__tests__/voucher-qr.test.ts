import { describe, it, expect } from 'vitest'

import { buildVoucherQrPayload, parseVoucherQrPayload } from '../voucher-qr'

describe('buildVoucherQrPayload', () => {
  it('mã hoá SLUG, không mã hoá code — code có thể chứa ký tự ngoài ASCII', () => {
    // Đây là bài học trả giá bằng một lần thử thật: mã QR chứa code `hêhhihi`
    // quét ra `h234hhihi`. Súng quét giả lập bàn phím, không gõ được ký tự
    // ngoài ASCII nên nó phát Alt+0234 và trình duyệt nhận ba chữ số rời (234
    // là mã thập phân của `ê`). Slug do BE sinh và đã bỏ dấu, nên luôn an toàn.
    expect(
      buildVoucherQrPayload({ slug: 'he-hhihi-a1b2', code: 'hêhhihi' }),
    ).toBe('he-hhihi-a1b2')
  })

  it('không dùng code kể cả khi code toàn ASCII — quy tắc phải là một', () => {
    // Chọn field theo từng voucher thì lúc chạy được lúc không, và cái hỏng chỉ
    // lộ ra ở quầy với voucher có dấu. Luôn dùng slug là quy tắc kiểm chứng được.
    expect(buildVoucherQrPayload({ slug: 'abc-123', code: 'SALE50' })).toBe(
      'abc-123',
    )
  })

  it('mã hoá ĐÚNG slug, không kèm đường dẫn', () => {
    // `:` và `/` của một URL cũng phụ thuộc bố cục bàn phím — cùng lớp lỗi với
    // ký tự có dấu ở trên.
    expect(buildVoucherQrPayload({ slug: 'abc123', code: 'X' })).toBe('abc123')
  })

  it('mã QR thưa hơn hẳn so với dạng URL', () => {
    // Nhãn in chỉ 1,5cm trên máy nhiệt 203dpi — biên vật lý hẹp nhất.
    const url = 'https://order.cmsiot.net/voucher/abc123'
    expect(
      buildVoucherQrPayload({ slug: 'abc123', code: 'X' }).length,
    ).toBeLessThan(url.length / 3)
  })
})

describe('parseVoucherQrPayload', () => {
  it('lấy slug từ URL production', () => {
    expect(
      parseVoucherQrPayload('https://order.cmsiot.net/voucher/abc123'),
    ).toBe('abc123')
  })

  it('lấy slug từ URL sandbox', () => {
    expect(
      parseVoucherQrPayload('https://sandbox.order.cmsiot.net/voucher/abc123'),
    ).toBe('abc123')
  })

  it('chấp nhận host lạ — QR in ra sống lâu hơn tên miền', () => {
    expect(parseVoucherQrPayload('https://domain-la.example/voucher/abc123')).toBe(
      'abc123',
    )
  })

  it('bỏ qua dấu / ở cuối path', () => {
    expect(
      parseVoucherQrPayload('https://order.cmsiot.net/voucher/abc123/'),
    ).toBe('abc123')
  })

  it('trả null cho URL không phải path voucher — KHÔNG rơi xuống nhánh fallback', () => {
    expect(parseVoucherQrPayload('https://order.cmsiot.net/menu')).toBeNull()
    expect(parseVoucherQrPayload('https://google.com')).toBeNull()
  })

  it('trả null cho URL /voucher không có slug', () => {
    expect(parseVoucherQrPayload('https://order.cmsiot.net/voucher')).toBeNull()
    expect(parseVoucherQrPayload('https://order.cmsiot.net/voucher/')).toBeNull()
  })

  it('coi chuỗi thuần là định danh — nhãn in kiểu cũ chỉ có code', () => {
    expect(parseVoucherQrPayload('ABC123')).toBe('ABC123')
    expect(parseVoucherQrPayload('  ABC123  ')).toBe('ABC123')
  })

  it('chặn độ dài cả với slug lấy từ URL — định danh đi thẳng vào query string', () => {
    expect(
      parseVoucherQrPayload(
        `https://order.cmsiot.net/voucher/${'a'.repeat(129)}`,
      ),
    ).toBeNull()
    expect(
      parseVoucherQrPayload(
        `https://order.cmsiot.net/voucher/${'a'.repeat(128)}`,
      ),
    ).toBe('a'.repeat(128))
  })

  it('giải mã percent-encoding trong slug lấy từ URL', () => {
    // URL.pathname giữ nguyên dạng đã mã hoá; không giải mã thì tra cứu sai chuỗi.
    expect(
      parseVoucherQrPayload('https://order.cmsiot.net/voucher/abc%20123'),
    ).toBe('abc 123')
    expect(
      parseVoucherQrPayload('https://order.cmsiot.net/voucher/qu%C3%A0-t%E1%BA%B7ng'),
    ).toBe('quà-tặng')
  })

  it('KHÔNG giải mã percent-encoding trong chuỗi thuần — % là ký tự thật của mã', () => {
    // Nhãn in kiểu cũ chỉ chứa mã voucher, không phải URL, nên ở đây không có
    // percent-encoding để mà gỡ. Giải mã sẽ biến `A%42C` thành `ABC` và tra cứu
    // nhầm sang một voucher khác (schema mã voucher không giới hạn bộ ký tự).
    expect(parseVoucherQrPayload('A%42C')).toBe('A%42C')
    expect(parseVoucherQrPayload('GIAM%20')).toBe('GIAM%20')
  })

  it('giữ nguyên chuỗi khi percent-encoding hỏng, không ném', () => {
    expect(parseVoucherQrPayload('https://order.cmsiot.net/voucher/abc%zz')).toBe(
      'abc%zz',
    )
  })

  it('trả null cho chuỗi rỗng, có khoảng trắng giữa, hoặc quá dài', () => {
    expect(parseVoucherQrPayload('')).toBeNull()
    expect(parseVoucherQrPayload('   ')).toBeNull()
    expect(parseVoucherQrPayload('ABC 123')).toBeNull()
    expect(parseVoucherQrPayload('a'.repeat(129))).toBeNull()
  })
})
