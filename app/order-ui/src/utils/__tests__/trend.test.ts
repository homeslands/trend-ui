import { describe, it, expect } from 'vitest'

import {
  MIN_TREND_R2,
  TREND_SIGNIFICANCE,
  isTrendVisible,
  trendOf,
  trendVerdictKey,
} from '../trend'

describe('trendOf', () => {
  it('returns null when every value is 0 (nothing to fit)', () => {
    expect(trendOf([0, 0, 0, 0])).toBeNull()
  })

  it('ignores leading/trailing zero padding when fitting', () => {
    // Chỉ 3 mốc giữa có dữ liệu; hai đầu là padding và phải ra `null` trong `values`.
    const trend = trendOf([0, 10, 20, 30, 0])
    expect(trend).not.toBeNull()
    expect(trend!.values[0]).toBeNull()
    expect(trend!.values[4]).toBeNull()
    expect(trend!.slope).toBeCloseTo(10, 6)
    expect(trend!.r2).toBeCloseTo(1, 6)
    // `n` là số điểm THỰC SỰ tham gia hồi quy (sau khi bỏ padding), không phải
    // `values.length`.
    expect(trend!.n).toBe(3)
  })

  it('exposes the regression intercept alongside slope', () => {
    // y = 10x + 5: tại x=0 y=5, mỗi bước x tăng 1 thì y tăng 10.
    const trend = trendOf([5, 15, 25, 35])
    expect(trend).not.toBeNull()
    expect(trend!.slope).toBeCloseTo(10, 6)
    expect(trend!.intercept).toBeCloseTo(5, 6)
  })
})

describe('isTrendVisible', () => {
  it('hides a spiky series — one outlier smeared across flat buckets', () => {
    // Đây CHÍNH LÀ hình dạng dữ liệu xu thật: 6 mốc gần như 0 + 1 mốc đột biến.
    // Slope dương trông như "đang tăng" nhưng p >> 0.05 → phải bị ẩn.
    const trend = trendOf([300000, 0, 0, 0, 1700000, 0, 100000])
    expect(trend).not.toBeNull()
    expect(trend!.slope).toBeGreaterThan(0)
    expect(trend!.pValue).toBeGreaterThanOrEqual(TREND_SIGNIFICANCE)
    expect(isTrendVisible(trend)).toBe(false)
  })

  it('shows a series that genuinely rises', () => {
    // Chiều ngược lại: nếu KHÔNG có ca này, một lỗi khiến trend không bao giờ hiện
    // cũng sẽ lọt qua test.
    const trend = trendOf([100, 210, 290, 420, 480, 610, 700, 810])
    expect(trend).not.toBeNull()
    expect(trend!.pValue).toBeLessThan(TREND_SIGNIFICANCE)
    expect(isTrendVisible(trend)).toBe(true)
  })

  it('shows a clean 7-point series — sample size alone no longer hides a trend', () => {
    // Trước đây ca này bị ẩn vì cổng "tối thiểu 8 mốc" tự đặt, dù p ≈ 3e-7. Cổng đó đã
    // bỏ: p-value vốn đã tự tính đến cỡ mẫu qua bậc tự do, nên không cần chặn thêm.
    const trend = trendOf([100, 210, 290, 420, 480, 610, 700])
    expect(trend!.n).toBe(7)
    expect(trend!.pValue).toBeLessThan(TREND_SIGNIFICANCE)
    expect(isTrendVisible(trend)).toBe(true)
  })

  it('still hides a 3-point series unless the fit is near perfect', () => {
    // Ít mốc KHÔNG được miễn kiểm định: với n = 3 (df = 1) phân phối t giãn rất rộng
    // nên phải khớp gần hoàn hảo mới đạt p < 0.05. Đây là thứ thay cho cổng `n` cũ.
    expect(isTrendVisible(trendOf([10, 90, 20]))).toBe(false)
  })

  it('hides a long series that is too noisy to be significant', () => {
    // Nhiều mốc KHÔNG tự động cho qua: 8 điểm nhưng dao động mạnh nên p >= 0.05.
    // Cùng với ca 3 mốc phía trên, hai test này chốt rằng quyết định ẩn/hiện phụ thuộc
    // CHẤT LƯỢNG khớp chứ không phải số lượng mốc.
    const trend = trendOf([50, 480, 20, 510, 40, 470, 60, 500])
    expect(trend).not.toBeNull()
    expect(trend!.n).toBe(8)
    expect(trend!.pValue).toBeGreaterThanOrEqual(TREND_SIGNIFICANCE)
    expect(isTrendVisible(trend)).toBe(false)
  })

  it('hides a statistically significant but explanatorily worthless trend', () => {
    // Dựng lại ca THẬT gặp trên trang xu (72 mốc ngày, R² 0.08, p 0.016): một xu hướng
    // giảm rất nhẹ chìm trong nhiễu mạnh. Mẫu lớn đẩy hiệu ứng vụn vặt qua cổng p, nhưng
    // đường chỉ giải thích được vài phần trăm biến động nên không đáng vẽ.
    // Fixture cho R² ≈ 0.061, p ≈ 0.036 — đúng vùng "significant nhưng vô nghĩa".
    const values = Array.from({ length: 72 }, (_, i) =>
      Math.max(0, Math.round(5000 - i * 18 + ((i * 37) % 11) * 400)),
    )
    const trend = trendOf(values)
    expect(trend).not.toBeNull()
    expect(trend!.pValue).toBeLessThan(TREND_SIGNIFICANCE)
    expect(trend!.r2).toBeLessThan(MIN_TREND_R2)
    expect(isTrendVisible(trend)).toBe(false)
    expect(trendVerdictKey(trend!.pValue, trend!.r2)).toBe(
      'trend.verdict.negligible',
    )
  })

  it('treats a null trend as not visible', () => {
    expect(isTrendVisible(null)).toBe(false)
  })
})

describe('trendOf — confidence band (upper/lower)', () => {
  it('brackets values at every data point: upper >= values >= lower', () => {
    const trend = trendOf([50, 480, 20, 510, 40, 470, 60, 500])
    expect(trend).not.toBeNull()
    for (let i = 0; i < trend!.values.length; i++) {
      const v = trend!.values[i]
      if (v === null) continue
      expect(trend!.upper[i]).not.toBeNull()
      expect(trend!.lower[i]).not.toBeNull()
      expect(trend!.upper[i]!).toBeGreaterThanOrEqual(v)
      expect(v).toBeGreaterThanOrEqual(trend!.lower[i]!)
    }
  })

  it('never lets lower go negative', () => {
    const trend = trendOf([300000, 0, 0, 0, 1700000, 0, 100000])
    expect(trend).not.toBeNull()
    for (const l of trend!.lower) {
      if (l === null) continue
      expect(l).toBeGreaterThanOrEqual(0)
    }
  })

  it('is null in upper/lower at exactly the positions values is null (padding)', () => {
    const trend = trendOf([0, 10, 20, 30, 0])
    expect(trend).not.toBeNull()
    for (let i = 0; i < trend!.values.length; i++) {
      if (trend!.values[i] === null) {
        expect(trend!.upper[i]).toBeNull()
        expect(trend!.lower[i]).toBeNull()
      } else {
        expect(trend!.upper[i]).not.toBeNull()
        expect(trend!.lower[i]).not.toBeNull()
      }
    }
  })

  it('gives a narrower band to a perfectly linear series than to a noisy one of the same length', () => {
    const perfect = trendOf([10, 20, 30, 40, 50, 60, 70, 80])
    const noisy = trendOf([50, 480, 20, 510, 40, 470, 60, 500])
    expect(perfect).not.toBeNull()
    expect(noisy).not.toBeNull()

    const bandWidth = (t: NonNullable<ReturnType<typeof trendOf>>) =>
      t.upper.reduce((sum: number, u, i) => {
        const l = t.lower[i]
        if (u === null || l === null) return sum
        return sum + (u - l)
      }, 0)

    expect(bandWidth(perfect!)).toBeLessThan(bandWidth(noisy!))
  })

  it('falls back to upper = lower = values when df < 1 (n = 2)', () => {
    const trend = trendOf([10, 20])
    expect(trend).not.toBeNull()
    expect(trend!.n).toBe(2)
    expect(trend!.upper).toEqual(trend!.values)
    expect(trend!.lower).toEqual(trend!.values)
  })

  it('brackets values even when the series declines to the zero floor', () => {
    // Chuỗi giảm chạm đáy 0: hồi quy thô ŷ có thể âm ở cuối trong khi `values` đã
    // clamp về 0. Nếu `upper`/`lower` được tính từ ŷ thô thay vì từ `values` đã
    // clamp, `upper` có thể tụt XUỐNG DƯỚI `values` tại chính những điểm này.
    const trend = trendOf([1000, 855, 702, 551, 421, 99, 21, 0, 11])
    expect(trend).not.toBeNull()
    expect(isTrendVisible(trend)).toBe(true)
    for (let i = 0; i < trend!.values.length; i++) {
      const v = trend!.values[i]
      if (v === null) continue
      expect(trend!.upper[i]).not.toBeNull()
      expect(trend!.lower[i]).not.toBeNull()
      expect(trend!.upper[i]!).toBeGreaterThanOrEqual(v)
      expect(v).toBeGreaterThanOrEqual(trend!.lower[i]!)
    }
  })
})

describe('flat series', () => {
  it('is not a visible trend even though r2 is 1 by convention', () => {
    // linearRegression quy ước r2 = 1 khi mọi y bằng nhau (đường ngang khớp hoàn hảo).
    // Nếu không tách ca này, chuỗi phẳng sẽ lọt cổng và chart vẽ một đường ngang kèm
    // verdict "đáng tin cậy", trong khi badge lại nói "đi ngang".
    const trend = trendOf([500, 500, 500, 500, 500, 500, 500, 500, 500, 500])
    expect(trend).not.toBeNull()
    expect(trend!.slope).toBe(0)
    expect(trend!.pValue).toBe(1)
    expect(isTrendVisible(trend)).toBe(false)
  })
})

describe('trendVerdictKey', () => {
  it('reports not significant when p fails', () => {
    const trend = trendOf([50, 480, 20, 510, 40, 470, 60, 500])
    expect(trendVerdictKey(trend!.pValue, trend!.r2)).toBe(
      'trend.verdict.notSignificant',
    )
  })

  it('reports negligible when significant but the effect size is tiny', () => {
    expect(trendVerdictKey(0.01, 0.05)).toBe('trend.verdict.negligible')
  })

  it('reports weak when the fit is loose but still worth showing', () => {
    expect(trendVerdictKey(0.01, 0.2)).toBe('trend.verdict.weak')
  })

  it('reports reliable when it passes every gate', () => {
    const trend = trendOf([100, 210, 290, 420, 480, 610, 700, 810])
    expect(isTrendVisible(trend)).toBe(true)
    expect(trendVerdictKey(trend!.pValue, trend!.r2)).toBe(
      'trend.verdict.reliable',
    )
  })
})
