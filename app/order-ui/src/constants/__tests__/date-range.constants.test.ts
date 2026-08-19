import { describe, it, expect } from 'vitest'
import moment from 'moment'
import {
  suggestPrevious,
  formatRangeLabel,
  presetToValue,
  defaultDateFilter,
  groupByForSpan,
} from '../date-range.constants'
import { UserStatisticsGroupBy } from '@/types'

/** Builds an inclusive `[from, to]` pair spanning exactly `days` days (a 1-day span is
 * `from === to`), matching the convention `groupByForSpan` and `suggestPrevious` use. */
const spanOf = (days: number) => {
  const from = moment('2026-01-01T00:00:00')
  const to = from.clone().add(days - 1, 'days').endOf('day')
  return { from: from.format('YYYY-MM-DDTHH:mm:ss'), to: to.format('YYYY-MM-DDTHH:mm:ss') }
}

describe('suggestPrevious', () => {
  it('suggests the preceding period of the same length (7 days)', () => {
    const r = suggestPrevious('2026-06-08T00:00:00', '2026-06-14T23:59:59')
    expect(moment(r.start).format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(moment(r.end).format('YYYY-MM-DD')).toBe('2026-06-07')
  })

  it('suggests the previous day for a 1-day period', () => {
    const r = suggestPrevious('2026-06-10T00:00:00', '2026-06-10T23:59:59')
    expect(moment(r.start).format('YYYY-MM-DD')).toBe('2026-06-09')
    expect(moment(r.end).format('YYYY-MM-DD')).toBe('2026-06-09')
  })
})

describe('formatRangeLabel', () => {
  it('returns the all-time label for allTime preset', () => {
    expect(
      formatRangeLabel('allTime', '2020-01-01T00:00:00', '2026-07-09T23:59:59', 'Tất cả'),
    ).toBe('Tất cả')
  })

  it('returns a single date when start and end are the same day', () => {
    expect(formatRangeLabel(null, '2026-06-10T00:00:00', '2026-06-10T23:59:59', 'Tất cả')).toBe(
      '10/06/2026',
    )
  })

  it('returns a range when start and end differ', () => {
    expect(formatRangeLabel(null, '2026-06-01T00:00:00', '2026-06-30T23:59:59', 'Tất cả')).toBe(
      '01/06/2026 - 30/06/2026',
    )
  })
})

describe('presetToValue', () => {
  it('maps allTime to year groupBy + allTime start', () => {
    const v = presetToValue('allTime')
    expect(v.activePreset).toBe('allTime')
    expect(v.groupBy).toBe(UserStatisticsGroupBy.YEAR)
    expect(v.startDate).toBe('2020-01-01T00:00:00')
  })
  it('maps last7Days to day groupBy', () => {
    expect(presetToValue('last7Days').groupBy).toBe(UserStatisticsGroupBy.DAY)
    expect(presetToValue('last7Days').activePreset).toBe('last7Days')
  })
})

describe('groupByForSpan', () => {
  // Every boundary from the spec, tested on both sides — off-by-one here silently
  // changes every chart's bucketing.
  it('1 day -> HOUR (lower edge)', () => {
    const { from, to } = spanOf(1)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.HOUR)
  })
  it('2 days -> DAY (just past the 1-day boundary)', () => {
    const { from, to } = spanOf(2)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.DAY)
  })
  it('31 days -> DAY (upper edge)', () => {
    const { from, to } = spanOf(31)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.DAY)
  })
  it('32 days -> WEEK (just past the 31-day boundary)', () => {
    const { from, to } = spanOf(32)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.WEEK)
  })
  it('92 days -> WEEK (upper edge)', () => {
    const { from, to } = spanOf(92)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.WEEK)
  })
  it('93 days -> MONTH (just past the 92-day boundary)', () => {
    const { from, to } = spanOf(93)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.MONTH)
  })
  it('730 days -> MONTH (upper edge)', () => {
    const { from, to } = spanOf(730)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.MONTH)
  })
  it('731 days -> YEAR (just past the 730-day boundary)', () => {
    const { from, to } = spanOf(731)
    expect(groupByForSpan(from, to)).toBe(UserStatisticsGroupBy.YEAR)
  })
})

describe('defaultDateFilter', () => {
  // Phải khớp mặc định không-tham-số của useCustomerAnalyticsFilters (30 ngày gần
  // nhất) — nếu không, "Reset" trong sheet đưa người dùng tới nơi mà chính mặc định
  // của dashboard không bao giờ tới.
  it('is last30Days with comparison off', () => {
    const v = defaultDateFilter()
    expect(v.activePreset).toBe('last30Days')
    expect(v.groupBy).toBe(UserStatisticsGroupBy.DAY)
    expect(v.compareEnabled).toBe(false)
    expect(v.compareStart).toBe('')
    expect(v.compareEnd).toBe('')
  })
})
