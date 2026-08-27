const VOUCHER_PATH_SEGMENT = 'voucher'
const MAX_IDENTIFIER_LENGTH = 128

/**
 * Nội dung nhúng vào mã QR của voucher: đúng `slug`, không kèm gì khác.
 *
 * Nhận cả voucher chứ không nhận một chuỗi, để việc CHỌN FIELD được chốt ở đây
 * một lần. Nếu nhận chuỗi thì mỗi nơi in lại tự chọn, và hai nhãn in ra từ hai
 * màn hình khác nhau có thể mã hoá hai thứ khác nhau.
 *
 * DÙNG `slug`, KHÔNG dùng `code`, dù `code` mới là chuỗi in cho người đọc ngay
 * cạnh mã QR. Lý do biết được bằng một lần thử thật: mã QR chứa code `hêhhihi`
 * quét ra `h234hhihi`. Súng quét ở quầy giả lập bàn phím, không gõ được ký tự
 * ngoài ASCII nên nó phát Alt+0234, và trình duyệt nhận về ba chữ số rời — 234
 * là mã thập phân của `ê`. Mà `code` do người tạo nhập và schema không giới hạn
 * bộ ký tự, nên nó có thể chứa chữ có dấu lẫn khoảng trắng. Slug do BE sinh và
 * đã bỏ dấu, luôn nằm trong ASCII.
 *
 * Cùng lý do đó nên KHÔNG dùng URL: `:` và `/` cũng phụ thuộc bố cục bàn phím.
 * Chuỗi ASCII thuần là dạng duy nhất cả camera lẫn súng quét đều tải nổi.
 *
 * Thêm hai cái được: mã thưa hơn nhiều nên in ở 1,5cm trên máy nhiệt 203dpi rõ
 * hơn, và không phụ thuộc biến môi trường nào — cấu hình sai là in cả xấp nhãn
 * hỏng, thứ chỉ phát hiện được sau khi giấy đã ra khỏi máy.
 *
 * Cái mất: quét bằng camera hệ điều hành ra một chuỗi vô nghĩa thay vì đường
 * link. Chấp nhận được vì route `/voucher/:slug` chưa tồn tại — hiện nó ra
 * trang trắng. Khi nào làm route thì đổi lại một dòng ở đây, và nhãn đã in vẫn
 * quét tốt vì `parseVoucherQrPayload` nhận cả hai dạng.
 */
export function buildVoucherQrPayload(voucher: {
  code: string
  slug: string
}): string {
  return voucher.slug
}

/**
 * Đọc chuỗi thô từ camera, trả về định danh voucher (slug hoặc code) hoặc
 * `null` nếu không phải mã QR của voucher.
 *
 * Thứ tự xét là dứt khoát: nếu phân tích được thành URL thì CHỈ path
 * `/voucher/:slug` được chấp nhận — mọi URL khác trả `null` chứ không rơi
 * xuống nhánh chuỗi thuần. Nếu để rơi, `https://order.cmsiot.net/menu` sẽ bị
 * coi là một định danh voucher hợp lệ.
 *
 * Host cố tình KHÔNG bị ràng buộc: nhãn in ra tồn tại lâu hơn tên miền, và
 * sandbox với production dùng host khác nhau.
 *
 * Nhánh URL vẫn giữ dù `buildVoucherQrPayload` không còn sinh URL: nhãn in theo
 * dạng cũ đang nằm trong tay khách và phải quét được tiếp. Nó cũng là thứ khiến
 * quyết định bỏ URL đảo ngược được — đổi lại một dòng bên trên là xong.
 */
export function parseVoucherQrPayload(raw: string): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  let url: URL | null = null
  try {
    url = new URL(trimmed)
  } catch {
    url = null
  }

  if (url) {
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length !== 2 || segments[0] !== VOUCHER_PATH_SEGMENT) {
      return null
    }
    return withinLengthLimit(decodePathSegment(segments[1]))
  }

  // KHÔNG giải mã percent-encoding ở nhánh này: percent-encoding là chuyện của
  // URL, còn trong một chuỗi thuần quét từ nhãn in kiểu cũ thì '%' là ký tự thật
  // của mã voucher (schema mã voucher không giới hạn bộ ký tự). Giải mã ở đây sẽ
  // biến mã `A%42C` thành `ABC` và tra cứu nhầm một voucher khác.
  if (/\s/.test(trimmed)) return null
  return withinLengthLimit(trimmed)
}

/**
 * Giải mã percent-encoding cho một segment của URL — chỉ dùng cho nhánh URL, nơi
 * việc mã hoá là do chính URL sinh ra. `URL.pathname` giữ nguyên dạng đã mã hoá,
 * nên `/voucher/abc%20123` sẽ tra cứu đúng chuỗi `abc%20123` nếu không giải mã.
 */
function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    // Chuỗi chứa '%' không hợp lệ (ví dụ '%zz'): giữ nguyên bản gốc thay vì ném.
    return value
  }
}

/**
 * Chặn độ dài, áp cho định danh lấy từ CẢ HAI nhánh: định danh đi thẳng vào query
 * string của một request GET, một mã QR với slug 10.000 ký tự không được lọt qua.
 */
function withinLengthLimit(value: string): string | null {
  if (!value) return null
  if (value.length > MAX_IDENTIFIER_LENGTH) return null
  return value
}
