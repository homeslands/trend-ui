import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import { UserStatisticsGroupBy } from '@/types'
import { useCustomerAnalyticsFilters } from '../use-customer-analytics-filters'
import { useCustomerListFilters } from '../use-customer-list-filters'

/**
 * Trước đây (spec §4 cũ) hai hook cùng mount trên một tab và bị buộc dùng key URL RỜI
 * cho MỌI field (kể cả SĐT/ngày), vì lúc đó chúng vô tình chia sẻ key và gây bug: gõ
 * SĐT ở bảng lọc luôn chart, "reset filter chi tiêu" xoá luôn ô tìm kiếm của bảng.
 *
 * Product owner giờ ĐẢO NGƯỢC yêu cầu cho ĐÚNG hai field — SĐT và khoảng ngày — nhưng
 * theo cách khác: không phải "chia sẻ key ngẫu nhiên" (nguồn gốc bug cũ) mà "một nguồn
 * sự thật duy nhất". `useCustomerAnalyticsFilters` sở hữu `phone`/`from`/`to`;
 * `useCustomerListFilters` không còn các field này nữa — bảng danh bạ đọc thẳng
 * `analytics.phone`/`from`/`to` ở tầng component (`system-customer-management.
 * tabscontent.tsx`), không qua hook thứ hai. Vì vậy hai hook KHÔNG bao giờ đụng key
 * URL của nhau nữa: `useCustomerListFilters` chỉ còn `page`/`size`/`card`.
 *
 * Bộ test dưới đây khoá lại tính KHÔNG va chạm giữa hai hook cho phần còn lại
 * (page/size/card ở list vs. mọi key ở analytics) — không phải để cấm đồng bộ SĐT/ngày
 * (đã chuyển hẳn sang analytics), mà để đảm bảo hai hook không vô tình dẫm lên nhau ở
 * NHỮNG KEY CÒN LẠI, đúng như bài học từ bug cũ.
 */
function renderBoth(initialUrl: string) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => {
      const analytics = useCustomerAnalyticsFilters()
      const list = useCustomerListFilters()
      const [sp] = useSearchParams()
      return { analytics, list, sp }
    },
    { wrapper },
  )
}

describe('dashboard filters vs directory filters (mounted together)', () => {
  it('the list hook no longer exposes phone/from/to — analytics is the single source now', () => {
    const { result } = renderBoth('/?tab=customer&phone=0912&from=2026-01-01&to=2026-01-31')
    expect(result.current.list).not.toHaveProperty('phone')
    expect(result.current.list).not.toHaveProperty('from')
    expect(result.current.list).not.toHaveProperty('to')
    expect(result.current.list).not.toHaveProperty('setPhone')
    expect(result.current.list).not.toHaveProperty('setDateRange')
    // analytics vẫn đọc đúng các field này — nó là nguồn sự thật duy nhất còn lại.
    expect(result.current.analytics.phone).toBe('0912')
    expect(result.current.analytics.from).toBe('2026-01-01')
    expect(result.current.analytics.to).toBe('2026-01-31')
  })

  it('analytics.setPhone does not touch the list hook state (page/size/card)', () => {
    const { result } = renderBoth('/?tab=customer&page=4&card=RF1')
    act(() => result.current.analytics.setPhone('0912345678'))

    expect(result.current.analytics.phone).toBe('0912345678')
    expect(result.current.list.page).toBe(4)
    expect(result.current.list.card).toBe('RF1')
  })

  it('list.setCard does not touch the analytics hook state (phone/from/to/branch)', () => {
    const { result } = renderBoth('/?tab=customer&phone=0912&from=2026-03-01&to=2026-03-31&branch=b1')
    act(() => result.current.list.setCard('RF999'))

    expect(result.current.list.card).toBe('RF999')
    expect(result.current.analytics.phone).toBe('0912')
    expect(result.current.analytics.from).toBe('2026-03-01')
    expect(result.current.analytics.to).toBe('2026-03-31')
    expect(result.current.analytics.branch).toBe('b1')
  })

  // "reset filter chi tiêu" giờ CỐ Ý xoá luôn SĐT dùng chung (khác hành vi cũ) — nhưng
  // vẫn không được đụng vào page/size/card của bảng, thứ vẫn thuộc riêng danh bạ.
  it('analytics.reset() clears the shared phone but does not touch list page/size/card', () => {
    const { result } = renderBoth('/?tab=customer&page=4&card=RF1&phone=0912&branch=b1')
    act(() => result.current.analytics.reset())

    expect(result.current.analytics.phone).toBe('')
    expect(result.current.analytics.branch).toBe('')
    expect(result.current.list.page).toBe(4)
    expect(result.current.list.card).toBe('RF1')
  })

  it('list.reset() clears card but does not touch analytics phone/from/to/branch', () => {
    const { result } = renderBoth('/?tab=customer&card=RF1&phone=0912&from=2026-03-01&to=2026-03-31&branch=b1')
    act(() => result.current.list.reset())

    expect(result.current.list.card).toBe('')
    expect(result.current.analytics.phone).toBe('0912')
    expect(result.current.analytics.branch).toBe('b1')
    expect(result.current.analytics.from).toBe('2026-03-01')
    expect(result.current.analytics.to).toBe('2026-03-31')
  })

  it('the dashboard date range does not reset the directory page — no shared date key', () => {
    const { result } = renderBoth('/?tab=customer&page=4')
    act(() =>
      result.current.analytics.setRange({
        from: '2026-07-17',
        to: '2026-07-17',
        groupBy: UserStatisticsGroupBy.HOUR,
        preset: 'today',
      }),
    )

    expect(result.current.analytics.from).toBe('2026-07-17')
    expect(result.current.list.page).toBe(4)
  })

  it('the two hooks share no URL key', () => {
    const { result } = renderBoth('/?tab=customer')
    act(() => result.current.list.setCard('RF1'))
    act(() => result.current.analytics.setPhone('0222'))
    act(() =>
      result.current.analytics.setRange({
        from: '2026-03-01',
        to: '2026-03-31',
        groupBy: UserStatisticsGroupBy.DAY,
        preset: null,
      }),
    )

    const keys = [...result.current.sp.keys()]
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(
      expect.arrayContaining(['card', 'phone', 'from', 'to', 'gb']),
    )
  })
})
