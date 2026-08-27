import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IVoucher } from '@/types'
import { formatCurrency } from './formatCurrency'

/**
 * Số tên món nêu ra trước khi gộp phần còn lại thành "+N món khác".
 *
 * Xuất ra vì màn quét cần đúng con số này để biết còn bao nhiêu món chưa hiện.
 */
export const MAX_LISTED_PRODUCTS = 3

/** Một dòng chữ chưa dịch: nơi gọi tự `t(key, params)`. */
export interface VoucherCartFixLine {
  key: string
  params?: Record<string, string | number>
}

/**
 * Lời khuyên sửa đơn, tách làm hai dòng.
 *
 * `message` nói VIỆC CẦN LÀM NGAY, `hint` nói GỌI GÌ THÌ ĐƯỢC. Tách ra vì nhét
 * cả hai vào một câu thì tràn dải chữ trên màn quét, mà bỏ dòng hai thì người
 * dùng biết phải bỏ món nào nhưng không biết thay bằng gì.
 */
export interface VoucherCartFix {
  message: VoucherCartFixLine
  hint?: VoucherCartFixLine
  /**
   * Toàn bộ tên sản phẩm được áp dụng, để màn quét mở rộng tại chỗ.
   *
   * Cần thiết vì danh sách đầy đủ chỉ tồn tại trong `VoucherDetailInfoDialog`,
   * mà dialog đó chỉ gắn ở trang quản trị — đứng ở quầy lúc quét thì không có
   * đường nào tới. Vắng mặt khi lý do là tiền chứ không phải sản phẩm.
   */
  eligibleNames?: string[]
}

interface VoucherCartFixContext {
  /** Món trong đơn, đã lọc bỏ món tặng. `slug` là slug SẢN PHẨM. */
  cartItems: Array<{ slug: string; name: string }>
  /** Tổng tiền hàng sau khuyến mãi, để so với `minOrderValue`. */
  subTotal: number
}

/**
 * Dựng lời khuyên "sửa đơn thế nào để dùng được phiếu", hoặc `null` khi không
 * có gì để khuyên.
 *
 * `null` gồm hai trường hợp khác hẳn nhau: voucher đã dùng được rồi, và voucher
 * hỏng vì lý do người dùng không sửa được (hết hạn, không gắn sản phẩm nào).
 * Cả hai đều không sinh ra lời khuyên, nên nơi gọi giữ nguyên câu lý do sẵn có.
 *
 * Hàm này CHỈ xét các điều kiện phụ thuộc giỏ hàng. Hết hạn, ngoài khung giờ,
 * hết lượt dùng là việc của `classifyVoucherRejection`.
 */
export function buildVoucherCartFixHint(
  voucher: IVoucher,
  context: VoucherCartFixContext,
): VoucherCartFix | null {
  const eligible = (voucher?.voucherProducts || [])
    .map((vp) => vp?.product)
    .filter((product): product is NonNullable<typeof product> => !!product)

  // Không gắn sản phẩm nào thì thêm hay bỏ món đều vô nghĩa — nhóm `permanent`.
  if (eligible.length === 0) return null

  const eligibleSlugs = new Set(eligible.map((p) => p.slug))
  const { cartItems, subTotal } = context
  const rule = voucher.applicabilityRule || APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED

  // Điều kiện SẢN PHẨM xét trước điều kiện TIỀN, dù thứ tự cũ ngược lại. Thiếu
  // sản phẩm là cổng cứng: thêm bao nhiêu món khác cũng không qua. Nói tiền
  // trước sẽ đẩy người dùng thêm món cho đủ tiền rồi vẫn bị từ chối.
  if (rule === APPLICABILITY_RULE.ALL_REQUIRED) {
    const notApplicable = cartItems.filter((item) => !eligibleSlugs.has(item.slug))
    if (notApplicable.length > 0) {
      return {
        // KHÔNG cắt danh sách này: nó lấy từ đơn nên vốn ngắn, và bỏ sót một
        // món là người dùng bỏ xong vẫn không dùng được phiếu.
        message: {
          key: 'voucher.fixRemoveItems',
          params: { names: notApplicable.map((i) => i.name).join(', ') },
        },
        hint: listLine(eligible, 'voucher.fixHintOnlyAppliesTo'),
        eligibleNames: eligible.map((p) => p.name),
      }
    }
  } else if (!cartItems.some((item) => eligibleSlugs.has(item.slug))) {
    return {
      message: { key: 'voucher.fixAddEligibleItem' },
      hint: listLine(eligible, 'voucher.fixHintAddOneOf'),
      eligibleNames: eligible.map((p) => p.name),
    }
  }

  const needsMinOrder =
    voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    (voucher.minOrderValue || 0) > subTotal
  if (needsMinOrder) {
    return {
      // Nêu số tiền CÒN THIẾU chứ không nêu ngưỡng: người dùng cần biết phải
      // thêm bao nhiêu, không phải tự trừ nhẩm.
      message: {
        key: 'voucher.fixMinOrderShort',
        params: { amount: formatCurrency((voucher.minOrderValue || 0) - subTotal) },
      },
    }
  }

  return null
}

/**
 * Dòng liệt kê sản phẩm, cắt ở `MAX_LISTED_PRODUCTS`.
 *
 * Dùng hai khoá dịch riêng thay vì một khoá có phần đuôi tuỳ chọn: người dịch
 * cần thấy trọn câu để đặt dấu câu cho đúng ngôn ngữ của họ.
 */
function listLine(
  products: Array<{ name: string }>,
  baseKey: string,
): VoucherCartFixLine {
  const names = products.slice(0, MAX_LISTED_PRODUCTS).map((p) => p.name).join(', ')
  const rest = products.length - MAX_LISTED_PRODUCTS

  // Nêu TỔNG khi có cắt: người đọc biết phạm vi rộng hay hẹp trước khi quyết
  // định bấm mở ra xem. `rest` dành cho nhãn nút mở rộng.
  if (rest > 0) {
    return {
      key: `${baseKey}More`,
      params: { names, rest, total: products.length },
    }
  }
  return { key: baseKey, params: { names } }
}
