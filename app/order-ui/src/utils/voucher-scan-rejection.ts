import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IVoucher } from '@/types'
import { isVoucherApplicableToCartItems } from './voucher'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from './voucher-time'

/**
 * Vì sao voucher chưa dùng được — phân theo VIỆC NGƯỜI DÙNG CÓ THỂ LÀM, không
 * phải theo nguyên nhân kỹ thuật.
 *
 * - `permanent`: không bao giờ dùng được. Quét lại vô nghĩa.
 * - `cart`: sẽ dùng được nếu giỏ hàng đổi (thêm món, tăng giá trị đơn).
 * - `condition`: sẽ dùng được khi điều kiện khác đổi (tới khung giờ, đăng nhập).
 */
export type VoucherRejectionKind = 'permanent' | 'cart' | 'condition'

export interface VoucherRejectionContext {
  /** Slug sản phẩm đang có trong giỏ/đơn. */
  cartProductSlugs: string[]
  /** Tổng tiền hàng sau khuyến mãi, để so với `minOrderValue`. */
  subTotal: number
  /** Mặc định `true`: chỉ các sheet có khái niệm đăng nhập mới cần truyền. */
  isLoggedIn?: boolean
}

/**
 * Phân loại lý do voucher không dùng được, hoặc `null` nếu dùng được.
 *
 * Dùng để chọn lời khuyên hiển thị trên màn quét. Trước đây màn quét luôn mời
 * "giữ nguyên vài giây để thử lại" — một lời mời sai với voucher đã hết hạn, và
 * mâu thuẫn với chính toast đang nói "Voucher đã hết hạn" ngay bên cạnh.
 *
 * Thứ tự xét quan trọng: nhóm `permanent` phải được xét TRƯỚC. Một voucher vừa
 * hết hạn vừa chưa đủ giá trị tối thiểu mà bị xếp vào `cart` sẽ khiến ta khuyên
 * khách thêm món — việc không bao giờ cứu được nó.
 */
export function classifyVoucherRejection(
  voucher: IVoucher,
  context: VoucherRejectionContext,
): VoucherRejectionKind | null {
  if (!voucher?.slug) return 'permanent'

  // Nhóm vĩnh viễn: chỉ phụ thuộc chính voucher, không phụ thuộc giỏ hàng hay
  // thời điểm, nên không thao tác nào của người dùng thay đổi được.
  if (!voucher.isActive) return 'permanent'
  if (isVoucherExpired(voucher)) return 'permanent'
  if ((voucher.remainingUsage || 0) <= 0) return 'permanent'

  const { cartProductSlugs, subTotal, isLoggedIn = true } = context

  if (voucher.isVerificationIdentity && !isLoggedIn) return 'condition'
  if (!isVoucherInActiveTimeWindow(voucher)) return 'condition'

  // Nhóm phụ thuộc giỏ hàng: khách thêm/bớt món là đổi được kết quả.
  const voucherProductSlugs =
    voucher.voucherProducts?.map((vp) => vp.product?.slug).filter(Boolean) || []

  if (voucherProductSlugs.length === 0) return 'permanent'
  if (cartProductSlugs.length === 0) return 'cart'
  if (
    !isVoucherApplicableToCartItems(
      cartProductSlugs,
      voucherProductSlugs as string[],
      voucher.applicabilityRule || APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    )
  ) {
    return 'cart'
  }

  const needsMinOrder =
    voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    (voucher.minOrderValue || 0) > subTotal
  if (needsMinOrder) return 'cart'

  return null
}

/**
 * Khoá dịch cho VIỆC CẦN LÀM, hiện làm dòng phụ trên màn quét.
 *
 * `condition` không có: khi voucher vướng khung giờ hay yêu cầu đăng nhập thì
 * chính câu lý do đã nêu rõ điều kiện rồi, thêm một dòng khuyên nữa là thừa.
 */
export const VOUCHER_REJECTION_HINT_KEY: Partial<
  Record<VoucherRejectionKind, string>
> = {
  permanent: 'voucher.scanHintTryAnother',
  cart: 'voucher.scanHintAdjustCart',
}

/**
 * Sheet trả về cái này khi từ chối voucher vừa quét.
 *
 * `message` là lý do ĐÃ DỊCH, do sheet tự dựng vì chỉ nó biết ngữ cảnh giỏ hàng
 * (số tiền tối thiểu còn thiếu, khung giờ áp dụng). Màn quét hiện nó trực tiếp —
 * KHÔNG bắn thêm toast: hai khối chữ cùng lúc cho một sự việc là quá nhiều, và
 * dải chữ nằm ngay chỗ mắt người dùng đang nhìn.
 */
export interface VoucherScanRejection {
  kind: VoucherRejectionKind
  message: string
  /**
   * Lời khuyên CỤ THỂ cho lý do này, đè lên câu chung theo `kind`. Sheet dựng
   * vì chỉ nó biết giỏ hàng: "Thêm một trong: Cà phê sữa, Trà đào" hữu ích hơn
   * hẳn "Thêm món phù hợp rồi quét lại", nhưng cần dữ liệu mà bộ phân loại
   * không có.
   */
  hint?: string
  /**
   * Toàn bộ tên món được áp dụng, để màn quét bung ra khi người dùng bấm.
   *
   * Dòng `hint` chỉ nêu được vài tên đầu; với voucher gắn hai chục món thì phần
   * còn lại là thứ nhân viên phải trả lời khách ngay tại quầy, mà danh sách đầy
   * đủ lại chỉ có ở trang quản trị.
   */
  hintItems?: string[]
  /**
   * Hành động nối tiếp mà màn quét nên mời người dùng làm. Sheet quyết định,
   * không phải bộ phân loại: cùng một lý do "thiếu định danh" thì nhân viên có
   * thể thêm khách ngay tại chỗ, còn khách hàng thì không.
   */
  action?: 'add-customer'
}
