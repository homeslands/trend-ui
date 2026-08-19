export const PHONE_NUMBER_REGEX = /^[0-9]{10}$/

/**
 * Số di động Việt Nam: 10 chữ số, bắt đầu bằng 03/05/07/08/09.
 * Dùng ở bước nhập số khi đăng ký — số không thể tồn tại sẽ khiến nhà mạng từ
 * chối gửi OTP và backend trả 119028, một lỗi không nói được gì cho khách.
 * Cố ý KHÔNG thay PHONE_NUMBER_REGEX: chỗ đó còn dùng cho SĐT giao hàng và
 * tài khoản do nhân viên tạo, siết lại sẽ chặn cả dữ liệu cũ.
 */
export const VN_MOBILE_PHONE_REGEX = /^0(3|5|7|8|9)[0-9]{8}$/
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const NAME_REGEX = /^(?!.* {2,})[A-Za-zÀ-ỹà-ỹ]+(?: [A-Za-zÀ-ỹà-ỹ]+)*$/ // Matches names with letters and spaces, but not consecutive spaces

export const EMOJI_REGEX =
  /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/u

export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/ // At least 8 characters, at most 20 characters, at least one letter and one number
