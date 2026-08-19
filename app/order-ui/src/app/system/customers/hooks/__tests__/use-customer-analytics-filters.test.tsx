import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import moment from 'moment'
import { CustomerAccountRevenueType, UserStatisticsGroupBy } from '@/types'
import { useCustomerAnalyticsFilters } from '../use-customer-analytics-filters'

function renderWithUrl(initialUrl: string) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => {
      const filters = useCustomerAnalyticsFilters()
      const [sp] = useSearchParams()
      return { filters, sp }
    },
    { wrapper },
  )
}

describe('useCustomerAnalyticsFilters', () => {
  it('defaults to a 30-day range grouped by day', () => {
    const { result } = renderWithUrl('/?tab=customer')
    expect(result.current.filters.groupBy).toBe(UserStatisticsGroupBy.DAY)
    // Khoảng mặc định là 30 NGÀY (bao gồm hôm nay) — một khớp lệch (vd. 7 ngày) vẫn
    // qua được nếu chỉ kiểm tra định dạng chuỗi, nên phải khẳng định đúng độ dài.
    expect(result.current.filters.to).toBe(moment().format('YYYY-MM-DD'))
    expect(moment().diff(moment(result.current.filters.from), 'days')).toBe(29)
    expect(result.current.filters.customerType).toBe(CustomerAccountRevenueType.ALL)
    expect(result.current.filters.compareEnabled).toBe(false)
    expect(result.current.filters.table).toBe('dir')
  })

  it('seeds preset=last30Days when no preset and no explicit range are on the URL', () => {
    const { result } = renderWithUrl('/?tab=customer')
    expect(result.current.filters.preset).toBe('last30Days')
  })

  it('leaves preset null when an explicit `from` is on the URL (e.g. a shared link)', () => {
    const { result } = renderWithUrl('/?from=2026-07-01')
    expect(result.current.filters.preset).toBeNull()
  })

  it('reads every value from the URL', () => {
    const { result } = renderWithUrl(
      '/?from=2026-07-01&to=2026-07-14&gb=month&cmp=1&cfrom=2026-06-17&cto=2026-06-30&branch=b1&pm=cash&ctype=all&phone=090&tbl=spend',
    )
    const f = result.current.filters
    expect(f.from).toBe('2026-07-01')
    expect(f.to).toBe('2026-07-14')
    expect(f.groupBy).toBe(UserStatisticsGroupBy.MONTH)
    expect(f.compareEnabled).toBe(true)
    expect(f.compareFrom).toBe('2026-06-17')
    expect(f.compareTo).toBe('2026-06-30')
    expect(f.branch).toBe('b1')
    expect(f.paymentMethod).toBe('cash')
    expect(f.customerType).toBe(CustomerAccountRevenueType.ALL)
    expect(f.phone).toBe('090')
    expect(f.table).toBe('spend')
  })

  it('reads the active preset from the URL, and null for an unknown one', () => {
    expect(renderWithUrl('/?preset=last7Days').result.current.filters.preset).toBe('last7Days')
    expect(renderWithUrl('/?preset=bogus').result.current.filters.preset).toBeNull()
    expect(renderWithUrl('/?from=2026-07-01').result.current.filters.preset).toBeNull()
  })

  // Hồi quy: hai setter liên tiếp (setDateRange rồi setGroupBy) thì cái sau đóng gói
  // searchParams của lần render cũ và navigate của nó đè mất cái trước — bấm "Hôm nay"
  // chỉ đổi gb=hour còn khoảng ngày vẫn là 30 ngày. Một lần ghi phải ra đủ from+to+gb.
  it('setRange writes from + to + gb + preset in a SINGLE update', () => {
    const { result } = renderWithUrl('/?from=2026-01-01&to=2026-01-31&gb=day')
    act(() =>
      result.current.filters.setRange({
        from: '2026-07-17',
        to: '2026-07-17',
        groupBy: UserStatisticsGroupBy.HOUR,
        preset: 'today',
      }),
    )
    expect(result.current.sp.get('from')).toBe('2026-07-17')
    expect(result.current.sp.get('to')).toBe('2026-07-17')
    expect(result.current.sp.get('gb')).toBe('hour')
    expect(result.current.sp.get('preset')).toBe('today')
    expect(result.current.filters.from).toBe('2026-07-17')
    expect(result.current.filters.groupBy).toBe(UserStatisticsGroupBy.HOUR)
  })

  it('setRange with a null preset clears the preset param (custom range)', () => {
    const { result } = renderWithUrl('/?preset=today')
    act(() =>
      result.current.filters.setRange({
        from: '2026-07-01',
        to: '2026-07-14',
        groupBy: UserStatisticsGroupBy.DAY,
        preset: null,
      }),
    )
    expect(result.current.sp.get('preset')).toBeNull()
    expect(result.current.filters.preset).toBeNull()
  })

  it('setRange carries compare params in the same write', () => {
    const { result } = renderWithUrl('/?from=2026-01-01&to=2026-01-31')
    act(() =>
      result.current.filters.setRange({
        from: '2026-07-08',
        to: '2026-07-14',
        groupBy: UserStatisticsGroupBy.DAY,
        preset: null,
        compareEnabled: true,
        compareFrom: '2026-07-01',
        compareTo: '2026-07-07',
      }),
    )
    expect(result.current.sp.get('from')).toBe('2026-07-08')
    expect(result.current.sp.get('cmp')).toBe('1')
    expect(result.current.sp.get('cfrom')).toBe('2026-07-01')
    expect(result.current.sp.get('cto')).toBe('2026-07-07')
  })

  it('setRange with compare off clears compare params in the same write', () => {
    const { result } = renderWithUrl('/?cmp=1&cfrom=2026-07-01&cto=2026-07-07')
    act(() =>
      result.current.filters.setRange({
        from: '2026-07-08',
        to: '2026-07-14',
        groupBy: UserStatisticsGroupBy.DAY,
        preset: null,
        compareEnabled: false,
      }),
    )
    expect(result.current.sp.get('cmp')).toBeNull()
    expect(result.current.sp.get('cfrom')).toBeNull()
    expect(result.current.sp.get('to')).toBe('2026-07-14')
  })

  it('setRange leaves compare untouched when compareEnabled is omitted', () => {
    const { result } = renderWithUrl('/?cmp=1&cfrom=2026-07-01&cto=2026-07-07')
    act(() =>
      result.current.filters.setRange({
        from: '2026-07-08',
        to: '2026-07-14',
        groupBy: UserStatisticsGroupBy.DAY,
        preset: null,
      }),
    )
    expect(result.current.sp.get('cmp')).toBe('1')
    expect(result.current.sp.get('cfrom')).toBe('2026-07-01')
  })

  it('setGroupBy writes gb', () => {
    const { result } = renderWithUrl('/?gb=day')
    act(() => result.current.filters.setGroupBy(UserStatisticsGroupBy.WEEK))
    expect(result.current.sp.get('gb')).toBe('week')
  })

  it('setCompare(true) stores the suggested previous range', () => {
    const { result } = renderWithUrl('/?from=2026-07-08&to=2026-07-14')
    act(() => result.current.filters.setCompare(true, '2026-07-01', '2026-07-07'))
    expect(result.current.sp.get('cmp')).toBe('1')
    expect(result.current.sp.get('cfrom')).toBe('2026-07-01')
    expect(result.current.sp.get('cto')).toBe('2026-07-07')
  })

  it('setCompare(false) clears compare params', () => {
    const { result } = renderWithUrl('/?cmp=1&cfrom=2026-07-01&cto=2026-07-07')
    act(() => result.current.filters.setCompare(false))
    expect(result.current.sp.get('cmp')).toBeNull()
    expect(result.current.sp.get('cfrom')).toBeNull()
    expect(result.current.sp.get('cto')).toBeNull()
  })

  it('setBranch with empty value deletes the param', () => {
    const { result } = renderWithUrl('/?branch=b1')
    act(() => result.current.filters.setBranch(''))
    expect(result.current.sp.get('branch')).toBeNull()
  })

  it('setTable writes tbl', () => {
    const { result } = renderWithUrl('/?tbl=dir')
    act(() => result.current.filters.setTable('spend'))
    expect(result.current.sp.get('tbl')).toBe('spend')
  })

  it('reset clears spending filters but keeps the date range', () => {
    const { result } = renderWithUrl('/?from=2026-07-01&to=2026-07-14&branch=b1&pm=cash&phone=090&ctype=all')
    act(() => result.current.filters.reset())
    expect(result.current.sp.get('branch')).toBeNull()
    expect(result.current.sp.get('pm')).toBeNull()
    expect(result.current.sp.get('phone')).toBeNull()
    expect(result.current.sp.get('ctype')).toBeNull()
    expect(result.current.sp.get('from')).toBe('2026-07-01')
  })
})
