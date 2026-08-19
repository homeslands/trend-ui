import { UserStatisticsGroupBy } from '@/types'

import { linearRegression } from './linear-regression'
import { pValueFromR2, tQuantile } from './statistics'

/** Độ tin cậy hai phía dùng cho dải trên/dưới quanh đường trend (95%). */
const CONFIDENCE_TAIL = 0.975

/** Từ ngưỡng này trở lên: vẫn vẽ nhưng làm mờ + cảnh báo "không đáng tin". Không dùng để
 * quyết định ẨN/HIỆN — việc đó là của `isTrendVisible`. */
export const WEAK_TREND_R2 = 0.3

/** Mức ý nghĩa quy ước. p < 0.05 nghĩa là độ dốc khó có thể chỉ do ngẫu nhiên. */
export const TREND_SIGNIFICANCE = 0.05

/** Sàn ĐỘ LỚN HIỆU ỨNG: dưới mức này đường có thể "đúng" về mặt thống kê nhưng giải
 * thích được quá ít để đáng vẽ. KHÁC với `TREND_SIGNIFICANCE` — xem `isTrendVisible`. */
export const MIN_TREND_R2 = 0.1

/** Trend có đủ tin cậy để hiển thị không. Dùng CHUNG cho mọi chart để hai nơi không
 * lệch ngưỡng nhau.
 *
 * Hai điều kiện trả lời HAI câu hỏi KHÁC NHAU, nên phải có cả hai:
 * - `pValue` — "độ dốc có khác 0 không?" (ý nghĩa THỐNG KÊ)
 * - `r2` — "đường có giải thích được gì không?" (ý nghĩa THỰC TIỄN, tức độ lớn hiệu ứng)
 *
 * Thiếu vế `r2`, mẫu lớn sẽ đẩy những hiệu ứng vụn vặt qua cổng: gặp thật với R² = 0.08
 * trên 72 mốc ngày → p = 0.016, "có ý nghĩa" nhưng đường chỉ giải thích 8% biến động và
 * độ dốc thì do một cụm đột biến nằm đầu cửa sổ lọc tạo ra.
 *
 * Thiếu vế `pValue`, ngưỡng R² đơn độc lại sai chiều ngược lại — R² cần để đạt ý nghĩa
 * phụ thuộc cỡ mẫu (n = 7 cần R² ≥ 0.57, n = 60 chỉ cần ≈ 0.15).
 *
 * Cố ý KHÔNG chặn thêm bằng số mốc tối thiểu: `pValue` đã tự tính đến cỡ mẫu qua bậc
 * tự do (n = 3, df = 1 phải có R² ≈ 0.994 mới đạt p < 0.05). */
export const isTrendVisible = (trend: TrendResult | null): trend is TrendResult =>
  trend !== null &&
  trend.pValue < TREND_SIGNIFICANCE &&
  trend.r2 >= MIN_TREND_R2

/**
 * Khoá i18n của câu kết luận về chất lượng một trend. NGUỒN SỰ THẬT DUY NHẤT cho việc
 * diễn giải: cả badge (làm mờ + tooltip) lẫn popover chi tiết mô hình đều gọi hàm này,
 * nên lời giải thích không thể lệch khỏi điều kiện mà `isTrendVisible` dùng để ẩn/hiện.
 *
 * Hai khoá đầu tương ứng đúng hai vế khiến `isTrendVisible` trả về false — tức mỗi khi
 * chart KHÔNG vẽ đường, hàm này luôn trả về `notSignificant` hoặc `negligible`.
 * `weak` là trạng thái VẪN VẼ nhưng làm mờ.
 */
export const trendVerdictKey = (pValue: number, r2: number): string => {
  if (pValue >= TREND_SIGNIFICANCE) return 'trend.verdict.notSignificant'
  if (r2 < MIN_TREND_R2) return 'trend.verdict.negligible'
  if (r2 < WEAK_TREND_R2) return 'trend.verdict.weak'
  return 'trend.verdict.reliable'
}

export interface TrendResult {
  /** Giá trị đường trend theo từng mốc; `null` ở hai đầu padding (ngoài miền có dữ liệu). */
  values: (number | null)[]
  /** Cận trên dải tin cậy 95% quanh `values`, cùng độ dài và cùng vị trí `null` với
   * `values`. Khi bậc tự do (n - 2) < 1, bằng chính `values` (không đủ dữ liệu để ước
   * lượng sai số chuẩn). */
  upper: (number | null)[]
  /** Cận dưới dải tin cậy 95%, clamp >= 0 cùng lý do với `values` (số xu/số khách không
   * thể âm). Cùng quy ước fallback với `upper` khi bậc tự do < 1. */
  lower: (number | null)[]
  /** Độ dốc — đơn vị là "trên MỖI BUCKET", không phải trên ngày. Bucket là gì thì phụ
   * thuộc `groupBy`, nên khi hiển thị BẮT BUỘC ghi kèm đơn vị bucket (xem
   * `TREND_UNIT_I18N_KEY`), nếu không cùng một dữ liệu xem theo ngày và theo tháng sẽ ra
   * hai con số khác nhau mà người đọc không hiểu vì sao. */
  slope: number
  /** Hệ số chặn của đường hồi quy — giá trị `y` ước lượng tại `x = 0`, với `x` là CHỈ SỐ
   * TUYỆT ĐỐI trong `values` (giống quy ước của `reg.at(i)` bên dưới), nên khi có padding
   * đầu chuỗi đây là một giá trị NGOẠI SUY, không phải giá trị tại mốc dữ liệu đầu tiên.
   * Dùng để hiện phương trình `y = slope · x + intercept` trong popover "Chi tiết mô
   * hình". */
  intercept: number
  /** Xem `LinearRegressionResult.r2` — luôn hiển thị kèm slope. */
  r2: number
  /** p-value hai phía cho độ dốc (xem `pValueFromR2`). Nhỏ hơn `TREND_SIGNIFICANCE`
   * nghĩa là độ dốc khó có thể chỉ do ngẫu nhiên. */
  pValue: number
  /** Số điểm THỰC SỰ tham gia hồi quy — sau khi bỏ padding 0 hai đầu, KHÔNG phải
   * `values.length`. Hiển thị trong popover chi tiết mô hình; KHÔNG dùng làm cổng
   * chặn — xem `isTrendVisible`. */
  n: number
}

/**
 * Trend = hồi quy tuyến tính trên miền CÓ dữ liệu (bỏ padding 0 ở hai đầu), clamp >= 0.
 * Trả về cả `slope` và `r2` để phía hiển thị nói được xu hướng mạnh/yếu, thay vì chỉ vẽ
 * một đường thẳng không kèm mức tin cậy.
 */
export function trendOf(values: number[]): TrendResult | null {
  const first = values.findIndex((v) => v > 0)
  if (first === -1) return null
  const last = values.length - 1 - [...values].reverse().findIndex((v) => v > 0)

  const points = []
  for (let i = first; i <= last; i++) points.push({ x: i, y: values[i] })

  const reg = linearRegression(points)
  if (!reg) return null

  const n = points.length

  const trendValues = values.map((_, i) =>
    i >= first && i <= last ? Number(Math.max(0, reg.at(i)).toFixed(2)) : null,
  )

  // Dải tin cậy 95% cần bậc tự do (n - 2) >= 1 để ước lượng sai số chuẩn còn ý nghĩa —
  // dưới ngưỡng đó fallback về chính `values` (không vẽ dải thay vì vẽ một dải vô nghĩa).
  const df = n - 2
  let upper: (number | null)[]
  let lower: (number | null)[]

  if (df < 1) {
    upper = trendValues
    lower = trendValues
  } else {
    const meanX = points.reduce((s, p) => s + p.x, 0) / n
    let ssRes = 0
    let sumDxSq = 0
    for (const p of points) {
      ssRes += (p.y - reg.at(p.x)) ** 2
      sumDxSq += (p.x - meanX) ** 2
    }
    const s = Math.sqrt(ssRes / df)
    const tCrit = tQuantile(CONFIDENCE_TAIL, df)

    const seAt = (x: number) => s * Math.sqrt(1 / n + (x - meanX) ** 2 / sumDxSq)

    // Xây từ `trendValues` (đã clamp >= 0), KHÔNG từ `reg.at(i)` thô — nếu không
    // `upper`/`lower` có thể lệch khỏi baseline mà `values` dùng và invariant
    // `upper >= values >= lower` sẽ vỡ khi đường hồi quy đi âm.
    upper = trendValues.map((v, i) =>
      v === null ? null : Number((v + tCrit * seAt(i)).toFixed(2)),
    )
    lower = trendValues.map((v, i) =>
      v === null ? null : Number(Math.max(0, v - tCrit * seAt(i)).toFixed(2)),
    )
  }

  return {
    values: trendValues,
    upper,
    lower,
    slope: reg.slope,
    intercept: reg.intercept,
    r2: reg.r2,
    pValue: pValueFromR2(reg.r2, n, reg.slope),
    n,
  }
}

/** Đơn vị của một bucket, để ghép vào nhãn slope ("+2,3 khách/ngày"). */
export const TREND_UNIT_I18N_KEY: Record<UserStatisticsGroupBy, string> = {
  [UserStatisticsGroupBy.HOUR]: 'trend.perHour',
  [UserStatisticsGroupBy.DAY]: 'trend.perDay',
  [UserStatisticsGroupBy.WEEK]: 'trend.perWeek',
  [UserStatisticsGroupBy.MONTH]: 'trend.perMonth',
  [UserStatisticsGroupBy.YEAR]: 'trend.perYear',
}
