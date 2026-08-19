import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// t() trả thẳng key — panel chỉ cần bản dịch để tìm control bằng placeholder/text,
// không cần khởi tạo i18next thật cho một test không kiểm tra nội dung dịch.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Chỉ override các hook gọi API — giữ nguyên `useDebouncedInput` thật vì chính hành vi
// debounce của nó là thứ đang được kiểm tra hồi quy. `useBranch` (react-query) cũng bị
// stub vì panel gọi thẳng nó để dựng select chi nhánh — không liên quan tới bug đang
// test, stub ra để khỏi cần bọc QueryClientProvider. Giá trị trả về đổi được theo từng
// test (biến `branchQueryResult`) để test riêng hành vi cắt bớt tên chi nhánh dài.
let branchQueryResult: { data: unknown; isLoading: boolean } = {
  data: undefined,
  isLoading: false,
}

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useCustomerAccountRevenue: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
    useUserStatistics: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
    // Panel gọi `useUsers` để đếm tổng khách cho card "Tổng khách" — cũng là react-query
    // nên phải stub cùng lý do với `useBranch`: không stub thì render ném "No QueryClient
    // set" và mọi test trong file chết theo, dù card đó không liên quan tới bug đang test.
    useUsers: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
    useBranch: () => branchQueryResult,
  }
})

// DateRangeComparePopover không liên quan tới bug đang test — stub để thu hẹp bề mặt render
// (nó tự import UserStatisticsGroupBySelect nội bộ, không còn lý do stub riêng module đó ở đây).
vi.mock('@/components/app/popover/date-range-compare-popover', () => ({
  default: () => null,
}))

// Không liên quan tới toolbar chi tiêu — stub để thu hẹp bề mặt render.
vi.mock('../customer-analytics-summary', () => ({ default: () => null }))
vi.mock('../customer-analytics-chart', () => ({ default: () => null }))

import CustomerAnalyticsPanel from '../customer-analytics-panel'
import { useCustomerAnalyticsFilters } from '@/app/system/customers/hooks'

function TestHost() {
  const filters = useCustomerAnalyticsFilters()
  const [sp] = useSearchParams()
  return (
    <>
      <CustomerAnalyticsPanel filters={filters} />
      <div data-testid="url-phone">{sp.get('phone') ?? ''}</div>
    </>
  )
}

function renderPanel(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <TestHost />
    </MemoryRouter>,
  )
}

describe('CustomerAnalyticsPanel — phone Reset vs debounce race (bug #1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('typing then clicking Reset before the 400ms debounce fires keeps `phone` out of the URL', () => {
    renderPanel('/?tab=customer')

    const input = screen.getByPlaceholderText(
      'customer.analytics.filterPhone',
    ) as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '0912' } })
    })
    expect(input.value).toBe('0912')

    // Reset well within the 400ms debounce window.
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // Reset giờ là icon-only (RotateCcw); nhãn chỉ còn ở `aria-label` + tooltip, không có
    // text hiển thị nữa, nên phải tìm theo accessible name thay vì `getByText`.
    const resetButton = screen.getByRole('button', { name: 'customer.analytics.reset' })
    act(() => {
      fireEvent.click(resetButton)
    })

    // Let the debounce timer (and any other pending timers) fully elapse.
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId('url-phone').textContent).toBe('')
    expect(input.value).toBe('')
  })

  it('without Reset, the same keystroke DOES land in the URL after the debounce (control case)', () => {
    renderPanel('/?tab=customer')

    const input = screen.getByPlaceholderText(
      'customer.analytics.filterPhone',
    ) as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '0912' } })
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByTestId('url-phone').textContent).toBe('0912')
  })
})

describe('CustomerAnalyticsPanel — branch trigger does not overflow on a long address (bug #3)', () => {
  const LONG_ADDRESS =
    '123 Đường Nguyễn Văn Linh, Phường Tân Phong, Quận 7, Thành phố Hồ Chí Minh, Việt Nam'

  afterEach(() => {
    branchQueryResult = { data: undefined, isLoading: false }
  })

  it('shows the branch NAME only (not `name - address`, unlike BranchSelect) and keeps the trigger fixed-width instead of content-sized', () => {
    branchQueryResult = {
      data: {
        result: [
          { slug: 'hcm-7', name: 'Chi nhánh Quận 7', address: LONG_ADDRESS },
        ],
      },
      isLoading: false,
    }

    renderPanel('/?tab=customer&branch=hcm-7')

    // Self-labelling trigger: "<label>: <name>" — the address never enters the DOM at all,
    // so there is nothing for the fixed-width trigger to overflow on.
    const triggerText = screen.getByText(
      'customer.analytics.filterBranch: Chi nhánh Quận 7',
    )
    expect(triggerText.textContent).not.toContain(LONG_ADDRESS)

    // Root cause of the original overflow was `BranchSelect`'s `w-fit` (content-sized)
    // trigger. This panel builds its own `Select` with a fixed width instead, so a long
    // value clips via the shared `[&>span]:line-clamp-1` rule in `ui/select.tsx` rather
    // than stretching the row.
    const trigger = triggerText.closest('button')
    expect(trigger).not.toBeNull()
    expect(trigger?.className).toContain('w-[17rem]')
    expect(trigger?.className).not.toContain('w-fit')
  })

  it('defaults to the first branch (branch is REQUIRED by the API, no more "all branches")', () => {
    branchQueryResult = {
      data: {
        result: [
          { slug: 'hcm-7', name: 'Chi nhánh Quận 7', address: LONG_ADDRESS },
          { slug: 'hn-1', name: 'Chi nhánh Hà Nội', address: LONG_ADDRESS },
        ],
      },
      isLoading: false,
    }

    renderPanel('/?tab=customer')

    // No `branch` on the URL and no branch in `useBranchStore` → falls back to the
    // FIRST branch returned by the API, never to an "all branches" state.
    expect(
      screen.getByText('customer.analytics.filterBranch: Chi nhánh Quận 7'),
    ).toBeTruthy()
  })
})
