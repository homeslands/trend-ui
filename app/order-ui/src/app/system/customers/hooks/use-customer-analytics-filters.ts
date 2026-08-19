import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import moment from 'moment'

import { CustomerAccountRevenueType, UserStatisticsGroupBy } from '@/types'
import { Preset, PRESETS } from '@/constants/date-range.constants'

export type AnalyticsTable = 'dir' | 'spend'

const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
  if (value) params.set(key, value)
  else params.delete(key)
}

const DAY = 'YYYY-MM-DD'

/** Mặc định: 30 ngày gần nhất, gom theo ngày. Xem "Quyết định mặc định" trong plan. */
const defaultFrom = () => moment().subtract(29, 'days').format(DAY)
const defaultTo = () => moment().format(DAY)

const GROUP_BY_VALUES = Object.values(UserStatisticsGroupBy) as string[]
const CUSTOMER_TYPE_VALUES = Object.values(CustomerAccountRevenueType) as string[]
const PRESET_VALUES = PRESETS.map((p) => p.key) as string[]

/**
 * Mọi tham số của khoảng thời gian, ghi trong MỘT lần `update()`.
 *
 * `useSearchParams` của react-router 6 đóng gói (closure) `searchParams` của LẦN
 * RENDER hiện tại: gọi hai setter liên tiếp trong cùng một event handler thì setter
 * thứ hai tính từ params CŨ và navigate của nó đè mất setter thứ nhất. Vì vậy preset
 * và sheet ngày đều phải đi qua setter gộp này thay vì gọi setDateRange + setGroupBy.
 */
export interface RangeUpdate {
  from: string
  to: string
  groupBy: UserStatisticsGroupBy
  /** null = khoảng tuỳ chọn (không preset nào đang active) */
  preset: Preset | null
  compareEnabled?: boolean
  compareFrom?: string
  compareTo?: string
}

export interface CustomerAnalyticsFilters {
  from: string
  to: string
  groupBy: UserStatisticsGroupBy
  /** Preset đang active, để chip/sheet highlight; null = khoảng tuỳ chọn. */
  preset: Preset | null
  compareEnabled: boolean
  compareFrom: string
  compareTo: string
  branch: string
  paymentMethod: string
  customerType: CustomerAccountRevenueType
  phone: string
  table: AnalyticsTable
  /** Ghi from + to + gb + preset (+ compare) trong một lần navigate duy nhất. */
  setRange: (value: RangeUpdate) => void
  setGroupBy: (groupBy: UserStatisticsGroupBy) => void
  setCompare: (enabled: boolean, from?: string, to?: string) => void
  /** `replace = true` để ghi mặc định lúc mount không đẻ ra entry lịch sử. */
  setBranch: (value: string, replace?: boolean) => void
  setPaymentMethod: (value: string) => void
  setCustomerType: (value: CustomerAccountRevenueType) => void
  setPhone: (value: string) => void
  setTable: (value: AnalyticsTable) => void
  reset: () => void
}

export function useCustomerAnalyticsFilters(): CustomerAnalyticsFilters {
  const [searchParams, setSearchParams] = useSearchParams()

  const from = searchParams.get('from') || defaultFrom()
  const to = searchParams.get('to') || defaultTo()

  const rawGb = searchParams.get('gb') || ''
  const groupBy = (GROUP_BY_VALUES.includes(rawGb)
    ? rawGb
    : UserStatisticsGroupBy.DAY) as UserStatisticsGroupBy

  // `preset` VẮNG MẶT trên URL (rawPreset === ''): nếu cũng không có `from` tường minh
  // (tức đang dùng khoảng mặc định 30 ngày ở trên), coi như preset 'last30Days' đang
  // active để chip/toolbar highlight đúng ngay từ lần load đầu. Có `from` tường minh
  // (vd. link chia sẻ) thì vẫn null — đó là khoảng tuỳ chọn. Một giá trị preset KHÔNG
  // hợp lệ (vd. `?preset=bogus`) không được coi là "vắng mặt" — vẫn trả về null như cũ.
  const rawPreset = searchParams.get('preset') || ''
  const preset = (PRESET_VALUES.includes(rawPreset)
    ? rawPreset
    : rawPreset === '' && !searchParams.has('from')
      ? 'last30Days'
      : null) as Preset | null

  const rawCtype = searchParams.get('ctype') || ''
  const customerType = (CUSTOMER_TYPE_VALUES.includes(rawCtype)
    ? rawCtype
    : CustomerAccountRevenueType.ALL) as CustomerAccountRevenueType

  const compareEnabled = searchParams.get('cmp') === '1'
  const compareFrom = searchParams.get('cfrom') || ''
  const compareTo = searchParams.get('cto') || ''
  const branch = searchParams.get('branch') || ''
  const paymentMethod = searchParams.get('pm') || ''
  const phone = searchParams.get('phone') || ''
  const table = (searchParams.get('tbl') === 'spend' ? 'spend' : 'dir') as AnalyticsTable

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  const setRange = useCallback(
    (value: RangeUpdate) =>
      update((params) => {
        setOrDelete(params, 'from', value.from)
        setOrDelete(params, 'to', value.to)
        params.set('gb', value.groupBy)
        setOrDelete(params, 'preset', value.preset ?? '')
        if (value.compareEnabled === undefined) return
        if (!value.compareEnabled) {
          params.delete('cmp')
          params.delete('cfrom')
          params.delete('cto')
          return
        }
        params.set('cmp', '1')
        setOrDelete(params, 'cfrom', value.compareFrom ?? '')
        setOrDelete(params, 'cto', value.compareTo ?? '')
      }),
    [update],
  )

  const setGroupBy = useCallback(
    (value: UserStatisticsGroupBy) => update((params) => params.set('gb', value)),
    [update],
  )

  const setCompare = useCallback(
    (enabled: boolean, fromValue = '', toValue = '') =>
      update((params) => {
        if (!enabled) {
          params.delete('cmp')
          params.delete('cfrom')
          params.delete('cto')
          return
        }
        params.set('cmp', '1')
        setOrDelete(params, 'cfrom', fromValue)
        setOrDelete(params, 'cto', toValue)
      }),
    [update],
  )

  const setBranch = useCallback(
    (value: string, replace = false) =>
      update((params) => setOrDelete(params, 'branch', value), replace),
    [update],
  )

  const setPaymentMethod = useCallback(
    (value: string) => update((params) => setOrDelete(params, 'pm', value)),
    [update],
  )

  const setCustomerType = useCallback(
    (value: CustomerAccountRevenueType) =>
      update((params) => params.set('ctype', value)),
    [update],
  )

  // Gõ phím: replace để 10 chữ số không đẻ ra 10 entry trong history.
  const setPhone = useCallback(
    (value: string) => update((params) => setOrDelete(params, 'phone', value), true),
    [update],
  )

  const setTable = useCallback(
    (value: AnalyticsTable) => update((params) => params.set('tbl', value)),
    [update],
  )

  // Chỉ xoá filter riêng của khối chi tiêu; ngày là state dùng chung nên giữ lại.
  const reset = useCallback(
    () =>
      update((params) => {
        params.delete('branch')
        params.delete('pm')
        params.delete('ctype')
        params.delete('phone')
      }),
    [update],
  )

  return useMemo(
    () => ({
      from, to, groupBy, preset, compareEnabled, compareFrom, compareTo,
      branch, paymentMethod, customerType, phone, table,
      setRange, setGroupBy, setCompare, setBranch,
      setPaymentMethod, setCustomerType, setPhone, setTable, reset,
    }),
    [
      from, to, groupBy, preset, compareEnabled, compareFrom, compareTo,
      branch, paymentMethod, customerType, phone, table,
      setRange, setGroupBy, setCompare, setBranch,
      setPaymentMethod, setCustomerType, setPhone, setTable, reset,
    ],
  )
}
