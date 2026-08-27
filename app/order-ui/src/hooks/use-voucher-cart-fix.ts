import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { IVoucher } from '@/types'
import { buildVoucherCartFixHint } from '@/utils'

export interface TranslatedVoucherCartFix {
  /** Việc cần làm ngay. Thay cho câu lý do chung chung ở nhóm giỏ hàng. */
  message: string
  /** Gọi gì thì được. Vắng mặt khi lý do không liên quan tới sản phẩm. */
  hint?: string
  /** Toàn bộ tên món được áp dụng, để màn quét mở rộng tại chỗ. */
  eligibleNames?: string[]
}

/**
 * Dịch sẵn lời khuyên sửa đơn, để 6 sheet voucher không phải lặp lại phần nối
 * khoá dịch với tham số.
 *
 * Tách khỏi `buildVoucherCartFixHint` để phần quyết định NÓI GÌ vẫn là hàm
 * thuần, kiểm thử được mà không cần dựng i18n.
 */
export function useVoucherCartFix() {
  const { t } = useTranslation('voucher')

  return useCallback(
    (
      voucher: IVoucher,
      context: {
        cartItems: Array<{ slug: string; name: string }>
        subTotal: number
      },
    ): TranslatedVoucherCartFix | null => {
      const fix = buildVoucherCartFixHint(voucher, context)
      if (!fix) return null

      return {
        message: t(fix.message.key, fix.message.params),
        hint: fix.hint ? t(fix.hint.key, fix.hint.params) : undefined,
        eligibleNames: fix.eligibleNames,
      }
    },
    [t],
  )
}
