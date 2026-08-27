import { useCallback } from 'react'

import { IVoucher } from '@/types'
// Import thẳng file thay vì qua barrel '@/utils': barrel kéo theo
// `google-map.ts`, mà file đó import ngược lại '@/hooks' — vòng tròn này làm
// treo bước gom module trong test.
import {
  classifyVoucherRejection,
  type VoucherScanRejection,
} from '@/utils/voucher-scan-rejection'
import { type VoucherCartLine } from '@/utils/voucher-cart-lines'
import { useVoucherCartFix } from './use-voucher-cart-fix'

interface UseVoucherScanRejectionParams {
  /**
   * Món trong đơn, ĐÃ chuẩn hoá qua `normalizeVoucherCartLines`.
   *
   * Nhận bản đã nắn chứ không nắn hộ, để sheet nắn đúng một lần rồi dùng chung
   * cho cả khối từ chối lẫn dòng gợi ý trên thẻ voucher — hai chỗ đó mà nắn
   * riêng thì lệch nhau lại có đường quay lại.
   */
  cartLines: VoucherCartLine[]
  /** Tổng tiền hàng sau khuyến mãi. */
  subTotal: number
  /**
   * Đơn đã có khách định danh chưa — KHÔNG phải người đang đăng nhập.
   *
   * Phân biệt này từng là một con bug thật: các sheet nhân viên truyền
   * `!!userInfo?.slug`, mà nhân viên thì luôn đăng nhập, nên điều kiện "voucher
   * đòi định danh mà đơn chưa có khách" không bao giờ kích hoạt.
   */
  isOrderOwnerIdentified: boolean
  /**
   * Sheet này có mời thêm khách hàng được không. Chỉ sheet nhân viên — phía
   * khách không có khái niệm "thêm khách hàng vào đơn".
   */
  canAddCustomer?: boolean
}

/**
 * Dựng trọn khối từ chối cho một voucher vừa quét.
 *
 * Tồn tại vì sáu sheet từng tự lắp lấy khối này, và đã lệch nhau theo bốn kiểu
 * khác nhau: chỉ một sheet mời thêm khách, năm sheet kiểm định danh sai đối
 * tượng, hai sheet cho bộ phân loại và bộ dựng lời khuyên đọc hai field giỏ hàng
 * khác nhau, một sheet dùng hai công thức tiền khác nhau cho cùng một voucher.
 *
 * Điểm mấu chốt: `cartLines` và `subTotal` đi vào CẢ `classifyVoucherRejection`
 * lẫn `useVoucherCartFix` từ cùng một chỗ, nên phân loại và lời khuyên không thể
 * nói hai chuyện khác nhau nữa — đó là ràng buộc cấu trúc, không phải quy ước.
 */
export function useVoucherScanRejection({
  cartLines,
  subTotal,
  isOrderOwnerIdentified,
  canAddCustomer = false,
}: UseVoucherScanRejectionParams) {
  const voucherCartFix = useVoucherCartFix()

  return useCallback(
    (voucher: IVoucher, message: string): VoucherScanRejection => {
      const fix = voucherCartFix(voucher, { cartItems: cartLines, subTotal })
      const needsCustomer =
        canAddCustomer &&
        !!voucher.isVerificationIdentity &&
        !isOrderOwnerIdentified

      return {
        message,
        hint: fix?.hint,
        hintItems: fix?.eligibleNames,
        // `permanent` là mặc định an toàn: không phân loại được thì đừng mời
        // người dùng thử lại vô ích.
        kind:
          classifyVoucherRejection(voucher, {
            cartProductSlugs: cartLines.map((line) => line.slug),
            subTotal,
            isLoggedIn: isOrderOwnerIdentified,
          }) ?? 'permanent',
        ...(needsCustomer ? { action: 'add-customer' as const } : {}),
      }
    },
    [cartLines, subTotal, isOrderOwnerIdentified, canAddCustomer, voucherCartFix],
  )
}
