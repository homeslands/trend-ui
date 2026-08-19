import moment from 'moment'

import { UserStatisticsGroupBy } from '@/types'

export type Preset =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'thisMonth'
  | 'thisYear'
  | 'allTime'

export const ALL_TIME_START = '2020-01-01T00:00:00'

export const fmt = (m: moment.Moment) => m.format('YYYY-MM-DDTHH:mm:ss')

export const PRESET_GROUPBY: Record<Preset, UserStatisticsGroupBy> = {
  today: UserStatisticsGroupBy.HOUR,
  last7Days: UserStatisticsGroupBy.DAY,
  last30Days: UserStatisticsGroupBy.DAY,
  thisMonth: UserStatisticsGroupBy.DAY,
  thisYear: UserStatisticsGroupBy.MONTH,
  allTime: UserStatisticsGroupBy.YEAR,
}

export const presetRange = (preset: Preset): { start: string; end: string } => {
  const now = moment()
  switch (preset) {
    case 'today':
      return { start: fmt(now.clone().startOf('day')), end: fmt(now.clone().endOf('day')) }
    case 'last7Days':
      return {
        start: fmt(now.clone().subtract(6, 'days').startOf('day')),
        end: fmt(now.clone().endOf('day')),
      }
    case 'last30Days':
      return {
        start: fmt(now.clone().subtract(29, 'days').startOf('day')),
        end: fmt(now.clone().endOf('day')),
      }
    case 'thisMonth':
      return { start: fmt(now.clone().startOf('month')), end: fmt(now.clone().endOf('day')) }
    case 'thisYear':
      return { start: fmt(now.clone().startOf('year')), end: fmt(now.clone().endOf('day')) }
    case 'allTime':
      return { start: ALL_TIME_START, end: fmt(now.clone().endOf('day')) }
  }
}

export const PRESETS: { key: Preset; i18n: string }[] = [
  { key: 'today', i18n: 'customer.registrationDashboard.presetToday' },
  { key: 'last7Days', i18n: 'customer.registrationDashboard.presetLast7Days' },
  { key: 'last30Days', i18n: 'customer.registrationDashboard.presetLast30Days' },
  { key: 'thisMonth', i18n: 'customer.registrationDashboard.presetThisMonth' },
  { key: 'thisYear', i18n: 'customer.registrationDashboard.presetThisYear' },
  { key: 'allTime', i18n: 'customer.registrationDashboard.presetAllTime' },
]

/** Derives a sensible `groupBy` from a custom (non-preset) date span. Mirrors the
 * bucketing that `PRESET_GROUPBY` gives standard presets of comparable length, so a
 * custom range picked by hand charts the same way a preset covering the same span
 * would. Inclusive day counts, same convention as `suggestPrevious` (a single day = 1). */
export const groupByForSpan = (from: string, to: string): UserStatisticsGroupBy => {
  const start = moment(from).startOf('day')
  const end = moment(to).startOf('day')
  const days = end.diff(start, 'days') + 1
  if (days <= 1) return UserStatisticsGroupBy.HOUR
  if (days <= 31) return UserStatisticsGroupBy.DAY
  if (days <= 92) return UserStatisticsGroupBy.WEEK
  if (days <= 730) return UserStatisticsGroupBy.MONTH
  return UserStatisticsGroupBy.YEAR
}

export const suggestPrevious = (
  afterStart: string,
  afterEnd: string,
): { start: string; end: string } => {
  const start = moment(afterStart)
  const end = moment(afterEnd)
  const days = end.startOf('day').diff(start.clone().startOf('day'), 'days') + 1
  const prevEnd = start.clone().subtract(1, 'day').endOf('day')
  const prevStart = prevEnd.clone().subtract(days - 1, 'days').startOf('day')
  return { start: fmt(prevStart), end: fmt(prevEnd) }
}

export const formatRangeLabel = (
  activePreset: Preset | null,
  startDate: string,
  endDate: string,
  allTimeLabel: string,
): string => {
  if (activePreset === 'allTime') return allTimeLabel
  const s = moment(startDate).format('DD/MM/YYYY')
  const e = moment(endDate).format('DD/MM/YYYY')
  return s === e ? s : `${s} - ${e}`
}

/** Giá trị nội bộ của `DateRangeComparePopover` — dùng 'YYYY-MM-DDTHH:mm:ss'; URL lưu 'YYYY-MM-DD'. */
export interface DateFilterValue {
  startDate: string
  endDate: string
  activePreset: Preset | null
  groupBy: UserStatisticsGroupBy
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
}

export const presetToValue = (
  preset: Preset,
): Pick<DateFilterValue, 'startDate' | 'endDate' | 'groupBy' | 'activePreset'> => {
  const r = presetRange(preset)
  return {
    startDate: r.start,
    endDate: r.end,
    groupBy: PRESET_GROUPBY[preset],
    activePreset: preset,
  }
}

/** Phải khớp với mặc định không-tham-số của `useCustomerAnalyticsFilters` (30 ngày gần nhất) — nếu không, Reset trong sheet đưa người dùng tới một nơi mà chính mặc định của dashboard không bao giờ tới. */
export const defaultDateFilter = (): DateFilterValue => ({
  ...presetToValue('last30Days'),
  compareEnabled: false,
  compareStart: '',
  compareEnd: '',
})

