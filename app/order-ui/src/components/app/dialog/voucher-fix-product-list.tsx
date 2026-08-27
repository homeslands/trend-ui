import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { MAX_LISTED_PRODUCTS } from '@/utils'

/**
 * Ngữ cảnh màu nền mà khối chữ này nằm trên.
 *
 * Hai màn quét có nền khác hẳn nhau: màn đầu đọc là nền sáng, còn màn camera vẽ
 * đè lên hình ảnh nên phải dùng chữ trắng. Một bộ class cứng sẽ tàng hình ở một
 * trong hai chỗ.
 */
export type VoucherFixTone = 'muted' | 'overlay'

interface ToneStyle {
  /** Dòng gợi ý ngắn khi chưa bung. */
  text: string
  /** Nút bung/thu. */
  button: string
  /** Khung bao danh sách khi đã bung. */
  panel: string
  /** Nhãn tiêu đề trong khung. */
  label: string
  /** Từng tên món. */
  chip: string
}

const TONE_CLASS: Record<VoucherFixTone, ToneStyle> = {
  muted: {
    text: 'text-sm text-muted-foreground',
    button:
      'text-sm font-medium text-primary hover:opacity-80 transition-opacity',
    panel: 'rounded-lg border border-muted-foreground/20 bg-muted/40',
    label: 'text-xs font-medium uppercase tracking-wide text-muted-foreground',
    chip: 'border border-muted-foreground/20 bg-background text-foreground',
  },
  overlay: {
    text: 'text-xs leading-snug text-white/70',
    button: 'text-xs font-medium text-white hover:opacity-80 transition-opacity',
    panel: 'rounded-lg border border-white/20 bg-white/10',
    label: 'text-[0.65rem] font-medium uppercase tracking-wide text-white/60',
    chip: 'border border-white/25 bg-white/10 text-white',
  },
}

interface VoucherFixProductListProps {
  /** Dòng gợi ý ngắn, đã dịch, đã gồm vài tên đầu. */
  hint?: string
  /** Toàn bộ tên món được áp dụng. Vắng khi lý do không phải sản phẩm. */
  items?: string[]
  /** Mặc định `muted` — nền sáng. Màn camera phải truyền `overlay`. */
  tone?: VoucherFixTone
}

/**
 * Dòng "gọi gì thì được", bung ra danh sách đầy đủ khi bấm.
 *
 * Dùng chung cho màn camera và màn đầu đọc: cùng một tính năng thì hai nhóm
 * người dùng không nên nhận hai mức thông tin khác nhau.
 *
 * Bung TẠI CHỖ chứ không mở màn khác, vì danh sách đầy đủ chỉ tồn tại trong
 * `VoucherDetailInfoDialog` — mà dialog đó chỉ gắn ở trang quản trị, nên đứng ở
 * quầy lúc quét thì không có đường nào tới. Mắt người dùng cũng đang ở đây rồi.
 *
 * Danh sách xếp thành các viên chữ chạy tràn dòng, không phải danh sách dọc: tên
 * món vốn ngắn, xếp ngang thì hai chục món vừa một khung không cần cuộn nhiều,
 * và mắt lướt nhanh hơn hẳn.
 *
 * Nơi gọi nên đặt `key={hint}` để mỗi lượt quét mới bắt đầu ở trạng thái thu gọn.
 */
export default function VoucherFixProductList({
  hint,
  items,
  tone = 'muted',
}: VoucherFixProductListProps) {
  const { t } = useTranslation('voucher')
  const [isExpanded, setIsExpanded] = useState(false)

  if (!hint) return null

  const styles = TONE_CLASS[tone]
  const hiddenCount = (items?.length || 0) - MAX_LISTED_PRODUCTS

  return (
    <div className="mt-1 w-full">
      {isExpanded && items ? (
        <div className={`p-3 text-left ${styles.panel}`}>
          <p className={styles.label}>
            {t('voucher.fixAllProductsTitle', { total: items.length })}
          </p>
          {/* Giới hạn chiều cao: voucher gắn vài chục món sẽ đẩy nút đóng ra
              ngoài màn hình điện thoại. */}
          <ul className="flex overflow-y-auto flex-wrap gap-1.5 mt-2 max-h-36">
            {items.map((name) => (
              <li
                key={name}
                className={`px-2.5 py-1 max-w-full text-xs rounded-full truncate ${styles.chip}`}
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.text}>{hint}</p>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          className={`inline-flex gap-1 items-center mt-2 ${styles.button}`}
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? (
            <>
              {t('voucher.fixHideProducts')}
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              {t('voucher.fixShowAllProducts', { rest: hiddenCount })}
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
