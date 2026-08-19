import { useTranslation } from 'react-i18next'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { trendVerdictKey } from '@/utils'

interface ITrendModelPopoverProps {
  /** Nội dung của trigger — phần "badge" người dùng bấm vào để mở popover. */
  children: React.ReactNode
  /** Độ dốc — xem `TrendResult.slope`. */
  slope: number
  /** Hệ số chặn của đường hồi quy — xem `TrendResult.intercept`. */
  intercept: number
  /** Hệ số xác định trong [0, 1] — xem `TrendResult.r2`. */
  r2: number
  /** p-value hai phía cho độ dốc — xem `TrendResult.pValue`. */
  pValue: number
  /** Số mốc THỰC SỰ tham gia hồi quy — xem `TrendResult.n`. */
  n: number
  /** Tên chuỗi dữ liệu ("Xu nhận"/"Xu tiêu"…). CHỈ dùng cho tên khả truy cập của nút:
   * `aria-label` THAY THẾ hoàn toàn nội dung chữ bên trong nút, nên nếu không ghép tên
   * chuỗi vào thì hai badge cạnh nhau sẽ đọc y hệt nhau với trình đọc màn hình. */
  label?: string
}


/**
 * Bản rút gọn của "Describe Trend Model" (Tableau) cho người không phải dân phân tích:
 * bấm vào badge xu hướng để xem phương trình hồi quy cùng các chỉ số thống kê đứng sau
 * nó, và một câu kết luận bằng ngôn ngữ thường.
 *
 * QUAN TRỌNG: các props ở đây PHẢI đến từ `trendOf` CHƯA lọc qua `isTrendVisible` (bản
 * "raw") — đây chính là nơi giải thích VÌ SAO một xu hướng không được vẽ trên chart, nên
 * phải hoạt động được cả khi trend bị ẩn. Ngược lại đường kẻ + dải tin cậy trên chart vẫn
 * phải dùng bản ĐÃ LỌC — không được để một xu hướng không có ý nghĩa thống kê vẽ đường.
 */
export default function TrendModelPopover({
  children,
  slope,
  intercept,
  r2,
  pValue,
  n,
  label,
}: ITrendModelPopoverProps) {
  const { t } = useTranslation('common')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            label ? `${label} — ${t('trend.modelDetails')}` : t('trend.modelDetails')
          }
          className="inline-flex items-center gap-1 rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" align="start">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">{t('trend.modelDetails')}</h4>
          <dl className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t('trend.equation')}</dt>
              <dd className="font-mono">
                y = {slope.toFixed(0)} · x + {intercept.toFixed(0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t('trend.pointCount')}</dt>
              <dd>{n}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t('trend.reliability')}</dt>
              <dd>{r2.toFixed(2)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{t('trend.pValue')}</dt>
              <dd>{pValue.toFixed(3)}</dd>
            </div>
          </dl>
          <p className="mt-1 border-t pt-2 text-muted-foreground">
            {t(trendVerdictKey(pValue, r2))}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
