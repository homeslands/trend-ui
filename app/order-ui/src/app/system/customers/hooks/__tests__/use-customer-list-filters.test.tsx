import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { useCustomerListFilters } from '../use-customer-list-filters'

function renderWithUrl(initialUrl: string) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => {
      const filters = useCustomerListFilters()
      const [sp] = useSearchParams()
      return { filters, sp }
    },
    { wrapper },
  )
}

describe('useCustomerListFilters', () => {
  // Hook giờ chỉ còn page/size/card — SĐT và khoảng ngày đã chuyển hẳn sang
  // useCustomerAnalyticsFilters (nguồn sự thật duy nhất, key from/to/phone).
  it('reads page/size/card from its own URL keys with defaults', () => {
    const { result } = renderWithUrl('/?tab=customer&page=3&size=20&card=RF123')
    expect(result.current.filters.page).toBe(3)
    expect(result.current.filters.size).toBe(20)
    expect(result.current.filters.card).toBe('RF123')
  })

  it('defaults page to 1 and size to 10 when absent', () => {
    const { result } = renderWithUrl('/')
    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.size).toBe(10)
    expect(result.current.filters.card).toBe('')
  })

  // Bất biến bắt buộc: hook này không còn được đọc phone/from/to (hay q/tfrom/tto cũ) —
  // đó chính là namespace của dashboard, va chạm đúng kiểu đã gây bug trước đây.
  it('does not expose phone/from/to — those are dashboard-owned now', () => {
    const { result } = renderWithUrl('/?phone=090&from=2026-01-01&to=2026-02-01&q=090&tfrom=2026-01-01&tto=2026-02-01')
    expect(result.current.filters).not.toHaveProperty('phone')
    expect(result.current.filters).not.toHaveProperty('from')
    expect(result.current.filters).not.toHaveProperty('to')
    expect(result.current.filters).not.toHaveProperty('setPhone')
    expect(result.current.filters).not.toHaveProperty('setDateRange')
    // page/size/card vẫn đọc đúng, không bị các key lạ ở trên ảnh hưởng.
    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.card).toBe('')
  })

  it('setCard writes card and resets page to 1', () => {
    const { result } = renderWithUrl('/?page=5')
    act(() => result.current.filters.setCard('RF999'))
    expect(result.current.sp.get('card')).toBe('RF999')
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setCard with empty string deletes card', () => {
    const { result } = renderWithUrl('/?page=5&card=RF1')
    act(() => result.current.filters.setCard(''))
    expect(result.current.sp.get('card')).toBeNull()
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setSize resets page to 1', () => {
    const { result } = renderWithUrl('/?page=4&size=10')
    act(() => result.current.filters.setSize(50))
    expect(result.current.sp.get('size')).toBe('50')
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setPage does not touch card', () => {
    const { result } = renderWithUrl('/?card=RF123')
    act(() => result.current.filters.setPage(7))
    expect(result.current.sp.get('page')).toBe('7')
    expect(result.current.sp.get('card')).toBe('RF123')
  })

  it('reset clears card and resets page, leaving dashboard-owned keys untouched', () => {
    const { result } = renderWithUrl('/?page=6&card=RF1&phone=090&from=2026-01-01&to=2026-02-01')
    act(() => result.current.filters.reset())
    expect(result.current.sp.get('card')).toBeNull()
    expect(result.current.sp.get('page')).toBe('1')
    // reset() của hook danh bạ không được đụng vào key của dashboard.
    expect(result.current.sp.get('phone')).toBe('090')
    expect(result.current.sp.get('from')).toBe('2026-01-01')
    expect(result.current.sp.get('to')).toBe('2026-02-01')
  })
})
