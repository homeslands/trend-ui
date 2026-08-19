import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { UserStatisticsGroupBy } from '@/types'
import {
  MIN_TREND_R2,
  TREND_SIGNIFICANCE,
  TREND_UNIT_I18N_KEY,
  WEAK_TREND_R2,
  trendVerdictKey,
} from '@/utils'
import { InfoHint } from '@/components/app/tooltip'
import { TrendModelPopover } from '@/components/app/popover'
/** Slope nhỏ hơn ngưỡng này (theo đơn vị dữ liệu) đọc là "đi ngang" — tránh hiển thị
 * "+0,0001/ngày" như thể có xu hướng tăng. */
const FLAT_SLOPE_EPSILON = 1e-6

/** Ngưỡng dưới mức này hiển thị "< 0,001" thay vì làm tròn thành "0.000" — một p-value
 * cực nhỏ là bằng chứng MẠNH, làm tròn về 0 khiến nó trông như dữ liệu bị thiếu. */
const P_VALUE_DISPLAY_FLOOR = 0.001
const formatPValue = (pValue: number): string =>
  pValue > 0 && pValue < P_VALUE_DISPLAY_FLOOR
    ? `< ${P_VALUE_DISPLAY_FLOOR}`
    : pValue.toFixed(3)

interface ITrendBadgeProps {
  /** Độ dốc trên MỖI bucket (xem `TrendResult.slope`). */
  slope: number
  /** Hệ số chặn của đường hồi quy (xem `TrendResult.intercept`) — chỉ dùng để hiện
   * phương trình trong popover "Chi tiết mô hình", không ảnh hưởng phần hiển thị chính. */
  intercept: number
  /** Hệ số xác định trong [0, 1]. */
  r2: number
  /** p-value hai phía cho độ dốc (xem `TrendResult.pValue`). */
  pValue: number
  /** Số mốc THỰC SỰ tham gia hồi quy (xem `TrendResult.n`) — dùng cho popover "Chi tiết
   * mô hình". */
  n: number
  /** Quyết định đơn vị hiển thị của slope ("/ngày", "/tháng"…). */
  groupBy: UserStatisticsGroupBy
  /** Tên chuỗi dữ liệu, ví dụ "Khách mới" — bỏ trống nếu chart chỉ có một chuỗi. */
  label?: string
  /** Tên chuỗi dùng RIÊNG cho tên khả truy cập khi không muốn hiện `label` ra màn hình
   * (vd chart thống kê khách: mỗi card đã có tiêu đề nên nhãn nhìn thấy sẽ bị trùng,
   * nhưng trình đọc màn hình vẫn cần biết badge này thuộc chuỗi nào). */
  ariaSeriesName?: string
  /** Format phần ĐỘ LỚN của slope (số khách vs số tiền vs số xu). */
  formatValue: (value: number) => string
  /** Class màu cho phần chữ, để khớp màu chuỗi dữ liệu tương ứng. Bỏ qua khi
   * `colorByDirection` bật. */
  colorClassName?: string
  /** Tô màu theo CHIỀU thay vì theo chuỗi: tăng = xanh, giảm = đỏ, đi ngang = trung tính.
   *
   * Chỉ dùng được khi tăng luôn là tốt và giảm luôn là xấu với MỌI chuỗi trên chart đó —
   * đúng với "khách mới"/"chi tiêu". KHÔNG dùng cho chart lịch sử xu: ở đó xanh/đỏ mang
   * nghĩa ĐỊNH DANH chuỗi (nhận/tiêu), tô theo chiều sẽ khiến "xu tiêu giảm" hiện màu đỏ
   * trong khi cột của nó cũng đỏ — hai thứ khác nghĩa dùng chung một màu. */
  colorByDirection?: boolean
}

/**
 * Hiển thị độ dốc của đường trend KÈM R² và p-value. Ba con số cố tình luôn đi cùng
 * nhau: slope một mình không cho biết đường thẳng có bám dữ liệu hay không, nên rất dễ
 * bị đọc thành một kết luận chắc chắn trên dữ liệu thực ra chỉ là nhiễu.
 *
 * Badge nhận trend CHƯA lọc qua `isTrendVisible` (để popover giải thích được cả trend đã
 * bị ẩn), nên nó phải TỰ làm mờ theo đúng điều kiện mà chart dùng để ẩn đường — nếu chỉ
 * làm mờ theo R² như trước, sẽ có cảnh chart không vẽ đường nào trong khi badge vẫn sáng
 * rõ, hai tín hiệu ngược nhau.
 */
export default function TrendBadge({
  slope,
  intercept,
  r2,
  pValue,
  n,
  groupBy,
  label,
  ariaSeriesName,
  formatValue,
  colorClassName,
  colorByDirection = false,
}: ITrendBadgeProps) {
  const { t } = useTranslation('common')

  const unit = t(TREND_UNIT_I18N_KEY[groupBy] ?? 'trend.perDay')
  const isFlat = Math.abs(slope) < FLAT_SLOPE_EPSILON
  // Đúng hai vế khiến `isTrendVisible` trả về false — giữ badge khớp với chart.
  const isHidden = pValue >= TREND_SIGNIFICANCE || r2 < MIN_TREND_R2
  const isWeak = r2 < WEAK_TREND_R2
  const isDimmed = isHidden || isWeak

  const Icon = isFlat ? Minus : slope > 0 ? ArrowUpRight : ArrowDownRight

  // Dùng chính `isFlat` ở trên nên ngưỡng "đi ngang" luôn khớp với icon đang hiển thị.
  const directionClassName = isFlat
    ? undefined
    : slope > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  const valueClassName = colorByDirection ? directionClassName : colorClassName

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${isDimmed ? 'opacity-60' : ''}`}
      title={
        isDimmed
          ? t(trendVerdictKey(pValue, r2))
          : undefined
      }
    >
      {/* Bấm vào phần giá trị chính của badge mở popover "Chi tiết mô hình" — dùng
          `trend*Raw` (chưa lọc qua `isTrendVisible`) từ phía gọi, để popover giải thích
          được cả những trend đã bị ẩn khỏi chart. */}
      <TrendModelPopover
        slope={slope}
        intercept={intercept}
        r2={r2}
        pValue={pValue}
        n={n}
        label={label ?? ariaSeriesName}
      >
        <Icon className={`h-3.5 w-3.5 ${valueClassName ?? ''}`} />
        {label && <span className="text-muted-foreground">{label}:</span>}
        <b className={valueClassName}>
          {isFlat
            ? t('trend.flat')
            : `${slope > 0 ? '+' : '−'}${formatValue(Math.abs(slope))}/${unit}`}
        </b>
      </TrendModelPopover>
      <InfoHint content={t('hint.trend')} ariaLabel={t('trend.label')} />
      <span className="text-muted-foreground">
        · {t('trend.reliability')} {r2.toFixed(2)}
      </span>
      <InfoHint content={t('hint.r2')} ariaLabel={t('trend.reliability')} />
      <span className="text-muted-foreground">
        · {t('trend.pValue')} {formatPValue(pValue)}
      </span>
      <InfoHint content={t('hint.pValue')} ariaLabel={t('trend.pValueLabel')} />
    </span>
  )
}
