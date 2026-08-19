# Customer Tab — URL State Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa toàn bộ state của bảng Khách hàng lên URL (single source of truth), sửa pagination desync, decouple dashboard↔bảng, dọn re-render và polish UX/i18n — không đổi hành vi mặc định của `DataTable` dùng chung.

**Architecture:** Một hook `useCustomerListFilters` là nơi duy nhất đọc/ghi `searchParams` cho bảng. `DataTable` nhận thêm props **opt-in** (controlled pagination + searchValue) nên 55 trang khác không bị ảnh hưởng. Dashboard tách khỏi bảng; bảng có filter ngày riêng qua `from`/`to` trên URL.

**Tech Stack:** React 18, react-router-dom (`useSearchParams`), TanStack Query + Table, Vitest + Testing Library, i18next, Tailwind/shadcn.

## Global Constraints

- **KHÔNG commit** — người dùng tự commit. Mỗi task kết thúc bằng chạy lint + test, không `git commit`.
- **KHÔNG đổi hành vi mặc định `DataTable`** — chỉ thêm props optional; khi không truyền, hành vi giữ y như cũ.
- URL schema: `?tab=customer&page=1&size=10&phone=<sdt>&card=<rfid>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>`.
- `phone` và `card` loại trừ nhau (set cái này xoá cái kia). Đổi filter nào cũng reset `page=1`. Hydrate từ URL lúc mount **không** reset page.
- Test: `npx vitest run <path>`; lint: `npm run lint`. jsdom env, setup ở `src/tests/setup.ts`.
- Đường dẫn gốc lệnh: `app/order-ui/`.

---

### Task 1: Hook `useCustomerListFilters` (B)

**Files:**
- Create: `app/order-ui/src/app/system/customers/hooks/use-customer-list-filters.ts`
- Create: `app/order-ui/src/app/system/customers/hooks/index.ts`
- Test: `app/order-ui/src/app/system/customers/hooks/__tests__/use-customer-list-filters.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` từ `react-router-dom`.
- Produces:
  ```ts
  interface CustomerListFilters {
    page: number; size: number
    phone: string; card: string; from: string; to: string
    setPage: (page: number) => void        // page 1-based
    setSize: (size: number) => void         // reset page=1
    setPhone: (phone: string) => void       // clear card, reset page=1
    setCard: (card: string) => void         // clear phone, reset page=1
    setDateRange: (from: string, to: string) => void  // reset page=1
    reset: () => void                       // xoá phone/card/from/to, reset page=1
  }
  function useCustomerListFilters(): CustomerListFilters
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// app/order-ui/src/app/system/customers/hooks/__tests__/use-customer-list-filters.test.tsx
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
  it('reads values from URL with defaults', () => {
    const { result } = renderWithUrl('/?tab=customer&page=3&size=20&phone=090&from=2026-01-01')
    expect(result.current.filters.page).toBe(3)
    expect(result.current.filters.size).toBe(20)
    expect(result.current.filters.phone).toBe('090')
    expect(result.current.filters.card).toBe('')
    expect(result.current.filters.from).toBe('2026-01-01')
  })

  it('setPhone clears card and resets page to 1', () => {
    const { result } = renderWithUrl('/?page=5&card=RF123')
    act(() => result.current.filters.setPhone('0987'))
    expect(result.current.sp.get('phone')).toBe('0987')
    expect(result.current.sp.get('card')).toBeNull()
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setCard clears phone and resets page to 1', () => {
    const { result } = renderWithUrl('/?page=5&phone=090')
    act(() => result.current.filters.setCard('RF999'))
    expect(result.current.sp.get('card')).toBe('RF999')
    expect(result.current.sp.get('phone')).toBeNull()
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setSize resets page to 1', () => {
    const { result } = renderWithUrl('/?page=4&size=10')
    act(() => result.current.filters.setSize(50))
    expect(result.current.sp.get('size')).toBe('50')
    expect(result.current.sp.get('page')).toBe('1')
  })

  it('setPage does not touch filters', () => {
    const { result } = renderWithUrl('/?phone=090')
    act(() => result.current.filters.setPage(7))
    expect(result.current.sp.get('page')).toBe('7')
    expect(result.current.sp.get('phone')).toBe('090')
  })

  it('setDateRange sets from/to and resets page; empty deletes param', () => {
    const { result } = renderWithUrl('/?page=3')
    act(() => result.current.filters.setDateRange('2026-01-01', '2026-02-01'))
    expect(result.current.sp.get('from')).toBe('2026-01-01')
    expect(result.current.sp.get('to')).toBe('2026-02-01')
    expect(result.current.sp.get('page')).toBe('1')
    act(() => result.current.filters.setDateRange('', ''))
    expect(result.current.sp.get('from')).toBeNull()
    expect(result.current.sp.get('to')).toBeNull()
  })

  it('reset clears all filters and resets page', () => {
    const { result } = renderWithUrl('/?page=6&phone=090&from=2026-01-01&to=2026-02-01')
    act(() => result.current.filters.reset())
    expect(result.current.sp.get('phone')).toBeNull()
    expect(result.current.sp.get('from')).toBeNull()
    expect(result.current.sp.get('to')).toBeNull()
    expect(result.current.sp.get('page')).toBe('1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/hooks/__tests__/use-customer-list-filters.test.tsx`
Expected: FAIL — `Failed to resolve import '../use-customer-list-filters'`.

- [ ] **Step 3: Write the hook**

```ts
// app/order-ui/src/app/system/customers/hooks/use-customer-list-filters.ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface CustomerListFilters {
  page: number
  size: number
  phone: string
  card: string
  from: string
  to: string
  setPage: (page: number) => void
  setSize: (size: number) => void
  setPhone: (phone: string) => void
  setCard: (card: string) => void
  setDateRange: (from: string, to: string) => void
  reset: () => void
}

export function useCustomerListFilters(): CustomerListFilters {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const phone = searchParams.get('phone') || ''
  const card = searchParams.get('card') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  const setPage = useCallback(
    (p: number) => update((params) => params.set('page', String(p))),
    [update],
  )

  const setSize = useCallback(
    (s: number) =>
      update((params) => {
        params.set('size', String(s))
        params.set('page', '1')
      }),
    [update],
  )

  const setPhone = useCallback(
    (value: string) =>
      update((params) => {
        setOrDelete(params, 'phone', value)
        params.delete('card')
        params.set('page', '1')
      }),
    [update],
  )

  const setCard = useCallback(
    (value: string) =>
      update((params) => {
        setOrDelete(params, 'card', value)
        params.delete('phone')
        params.set('page', '1')
      }),
    [update],
  )

  const setDateRange = useCallback(
    (fromValue: string, toValue: string) =>
      update((params) => {
        setOrDelete(params, 'from', fromValue)
        setOrDelete(params, 'to', toValue)
        params.set('page', '1')
      }),
    [update],
  )

  const reset = useCallback(
    () =>
      update((params) => {
        params.delete('phone')
        params.delete('card')
        params.delete('from')
        params.delete('to')
        params.set('page', '1')
      }),
    [update],
  )

  return useMemo(
    () => ({
      page, size, phone, card, from, to,
      setPage, setSize, setPhone, setCard, setDateRange, reset,
    }),
    [page, size, phone, card, from, to, setPage, setSize, setPhone, setCard, setDateRange, reset],
  )
}
```

```ts
// app/order-ui/src/app/system/customers/hooks/index.ts
export * from './use-customer-list-filters'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/hooks/__tests__/use-customer-list-filters.test.tsx`
Expected: PASS — 7 passed.

- [ ] **Step 5: Lint**

Run: `cd app/order-ui && npm run lint`
Expected: no new errors in the created files. (Người dùng tự commit.)

---

### Task 2: `DataTable` — opt-in controlled pagination + searchValue + sort arrow (C)

**Files:**
- Modify: `app/order-ui/src/components/ui/data-table.tsx`

**Interfaces:**
- Consumes: (không có, đây là component nền).
- Produces: props mới trên `DataTableProps<TData, TValue>`:
  ```ts
  pageIndex?: number        // 0-based; khi truyền → bật controlled pagination
  pageSize?: number         // dùng kèm pageIndex trong controlled mode
  onPaginationChange?: (pageIndex0: number, pageSize: number) => void
  searchValue?: string      // init ô search từ ngoài (URL)
  ```
  Khi `pageIndex === undefined` → hành vi cũ giữ nguyên.

- [ ] **Step 1: Thêm props vào interface**

Trong `interface DataTableProps<TData, TValue>` (quanh dòng 98-125), thêm:

```ts
  pageIndex?: number
  pageSize?: number
  onPaginationChange?: (pageIndex0: number, pageSize: number) => void
  searchValue?: string
```

- [ ] **Step 2: Nhận props trong signature + init search từ URL**

Trong khai báo `export function DataTable({ ... })` thêm `pageIndex, pageSize, onPaginationChange, searchValue` vào destructuring.

Đổi dòng khởi tạo debounced input (dòng ~149):

```ts
  const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput({
    defaultValue: searchValue ?? '',
  })
  const isControlledPagination = pageIndex !== undefined
```

- [ ] **Step 3: Bật controlled pagination trong useReactTable**

Sửa cấu hình `useReactTable` (dòng ~178):

```ts
  const table = useReactTable({
    data,
    columns,
    pageCount: pages,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(isControlledPagination
        ? { pagination: { pageIndex: pageIndex as number, pageSize: pageSize ?? 10 } }
        : {}),
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    ...(isControlledPagination
      ? {
          onPaginationChange: (updater) => {
            const current = { pageIndex: pageIndex as number, pageSize: pageSize ?? 10 }
            const next = typeof updater === 'function' ? updater(current) : updater
            onPaginationChange?.(next.pageIndex, next.pageSize)
          },
        }
      : {}),
    manualPagination: true,
    debugTable: true,
  })
```

- [ ] **Step 4: Truyền cờ controlled xuống DataTablePagination**

Sửa chỗ render pagination (dòng ~357):

```tsx
        <DataTablePagination
          table={table}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          controlled={isControlledPagination}
        />
```

- [ ] **Step 5: Cập nhật DataTablePagination cho 2 chế độ**

Sửa `interface DataTablePaginationProps` (dòng ~62) thêm `controlled?: boolean`. Trong `DataTablePagination` (dòng ~530):

Select (dòng ~542):
```tsx
          <Select
            value={
              controlled
                ? `${table.getState().pagination.pageSize}`
                : `${searchParams.get('size') || table.getState().pagination.pageSize}`
            }
            onValueChange={(value) => {
              if (controlled) {
                table.setPageSize(Number(value))
              } else {
                table.setPageSize(Number(value))
                onPageSizeChange?.(Number(value))
              }
            }}
          >
```

First page button:
```tsx
            onClick={() => {
              if (controlled) {
                table.setPageIndex(0)
              } else {
                table.setPageIndex(0)
                onPageChange?.(1)
              }
            }}
```

Previous button:
```tsx
            onClick={() => {
              if (controlled) {
                table.previousPage()
              } else {
                onPageChange(table.getState().pagination.pageIndex)
                table.previousPage()
              }
            }}
```

Next button:
```tsx
            onClick={() => {
              if (controlled) {
                table.nextPage()
              } else {
                onPageChange(table.getState().pagination.pageIndex + 2)
                table.nextPage()
              }
            }}
```

Last page button:
```tsx
            onClick={() => {
              if (controlled) {
                table.setPageIndex(table.getPageCount() - 1)
              } else {
                onPageChange(table.getPageCount())
                table.setPageIndex(table.getPageCount() - 1)
              }
            }}
```

- [ ] **Step 6: Sửa mũi tên sort gây hiểu nhầm (🟢)**

Trong `DataTableColumnHeader` (dòng ~393-399) đổi nhánh cuối để KHÔNG hiện mũi tên khi chưa sort:

```tsx
            {column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 w-3 h-3" />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 w-3 h-3" />
            ) : null}
```

- [ ] **Step 7: Lint + typecheck**

Run: `cd app/order-ui && npm run lint`
Expected: không có lỗi mới. `pageIndex/pageSize/onPaginationChange/searchValue` optional nên các call-site cũ vẫn hợp lệ.

- [ ] **Step 8: Verify không vỡ trang khác (thủ công, nhanh)**

Mở 1 trang bất kỳ đang dùng `<DataTable>` không truyền props mới (vd product list) → phân trang vẫn chạy như trước (uncontrolled).

---

### Task 3: Decouple dashboard ↔ bảng (E)

**Files:**
- Modify: `app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx`
- Modify: `app/order-ui/src/app/system/customers/components/index.tsx` (nếu re-export prop type — kiểm tra, thường không cần)

**Interfaces:**
- Produces: `CustomerRegistrationDashboard` không còn prop `onDateRangeChange`; không còn `useEffect` gọi callback ra ngoài.

- [ ] **Step 1: Bỏ prop và effect callback ra bảng**

Trong `customer-registration-dashboard.tsx`:
- Xoá `interface CustomerRegistrationDashboardProps` (dòng ~81-83) và tham số `{ onDateRangeChange }` — đổi signature thành:

```tsx
export default function CustomerRegistrationDashboard() {
```

- Xoá `useEffect` gọi `onDateRangeChange` (dòng ~114-116).

Giữ nguyên toàn bộ state preset/groupBy — dashboard vẫn tự quản lý cho chart + summary.

- [ ] **Step 2: Lint**

Run: `cd app/order-ui && npm run lint`
Expected: không lỗi. (Call-site trong tabscontent sẽ sửa ở Task 4.)

*(Ghi chú: filter ngày cho BẢNG được lắp ở Task 4 qua DataTable `hiddenDatePicker`/`onDateChange` → `from`/`to`.)*

---

### Task 4: Table date-range filter + tabscontent lắp ráp lại (D)

**Files:**
- Create: `app/order-ui/src/app/system/customers/DataTable/actions/customer-date-range-filter.tsx`
- Modify: `app/order-ui/src/app/system/customers/DataTable/actions/index.tsx` (export component mới)
- Modify: `app/order-ui/src/components/app/tabscontent/system-customer-management.tabscontent.tsx`

**Interfaces:**
- Consumes: `useCustomerListFilters` (Task 1); `DataTable` props `pageIndex/pageSize/onPaginationChange/searchValue` (Task 2); `CustomerRegistrationDashboard` không prop (Task 3); `SimpleDatePicker` từ `@/components/app/picker` (có prop `allowEmpty` → rỗng = placeholder).
- Produces: `CustomerDateRangeFilter({ from, to, onChange })` — filter ngày RIÊNG cho bảng, init từ `from`/`to` (rỗng = tất cả, không lọc).

**Quyết định thiết kế (chốt với người dùng):** KHÔNG dùng date picker mặc định của `DataTable` (nó default = hôm nay và tự `onDateChange` lúc mount → lọc nhầm về hôm nay). Dùng component riêng `CustomerDateRangeFilter` init từ URL; rỗng = hiện tất cả.

- [ ] **Step 1: Tạo `CustomerDateRangeFilter`**

```tsx
// app/order-ui/src/app/system/customers/DataTable/actions/customer-date-range-filter.tsx
import moment from 'moment'
import { MoveRight, X } from 'lucide-react'

import { Button } from '@/components/ui'
import { SimpleDatePicker } from '@/components/app/picker'

interface CustomerDateRangeFilterProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export default function CustomerDateRangeFilter({
  from,
  to,
  onChange,
}: CustomerDateRangeFilterProps) {
  return (
    <div className="flex gap-2 items-center">
      <SimpleDatePicker
        allowEmpty
        value={from}
        onChange={(value) => onChange(value, to)}
        disabledDates={
          to
            ? (date: Date) => date > moment(to, 'YYYY-MM-DD').startOf('day').toDate()
            : undefined
        }
        disableFutureDates
      />
      <MoveRight className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
      <SimpleDatePicker
        allowEmpty
        value={to}
        onChange={(value) => onChange(from, value)}
        disabledDates={
          from
            ? (date: Date) => date < moment(from, 'YYYY-MM-DD').startOf('day').toDate()
            : undefined
        }
        disableFutureDates
      />
      {(from || to) && (
        <Button variant="ghost" size="icon" onClick={() => onChange('', '')}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
```

Thêm export vào `app/order-ui/src/app/system/customers/DataTable/actions/index.tsx`:
```ts
export { default as CustomerDateRangeFilter } from './customer-date-range-filter'
```
(Kiểm tra cách index.tsx đang export — nếu dùng `export * from './customer-action'` v.v. thì thêm dòng theo đúng phong cách file đó.)

- [ ] **Step 2: Thay thế toàn bộ nội dung tabscontent**

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { CustomerRegistrationDashboard } from '@/app/system/customers/components'
import { DataTable } from '@/components/ui'
import { useUsers } from '@/hooks'
import { useCustomerListFilters } from '@/app/system/customers/hooks'
import { useUserListColumns } from '@/app/system/customers/DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { CustomerAction, CustomerDateRangeFilter } from '@/app/system/customers/DataTable/actions'
import { IUserInfo } from '@/types'
import { showErrorToastMessage } from '@/utils'
import { useTranslation } from 'react-i18next'

export function SystemCustomerManagementTabsContent() {
  const { t } = useTranslation('customer')
  const { t: tToast } = useTranslation('toast')
  const navigate = useNavigate()

  const {
    page, size, phone, card, from, to,
    setPage, setSize, setPhone, setCard, setDateRange, reset,
  } = useCustomerListFilters()

  const columns = useUserListColumns()
  const memoColumns = useMemo(() => columns, [columns])

  const hasShownToastForCurrentFilterRef = useRef<string>('')

  const { data, isLoading } = useUsers(
    {
      page,
      size,
      order: 'DESC',
      phonenumber: phone,
      membershipCard: card || undefined,
      hasPaging: true,
      role: Role.CUSTOMER,
      startDate: from || undefined,
      endDate: to || undefined,
    },
    true,
  )

  // Toast khi filter (phone hoặc card) không tìm thấy user
  useEffect(() => {
    const activeFilter = card || phone
    if (isLoading || !data?.result || !activeFilter) {
      if (!activeFilter) hasShownToastForCurrentFilterRef.current = ''
      return
    }
    const currentItemsCount = data.result.items?.length ?? 0
    if (currentItemsCount === 0 && hasShownToastForCurrentFilterRef.current !== activeFilter) {
      showErrorToastMessage(tToast('toast.userNotFound', { ns: 'toast' }))
      hasShownToastForCurrentFilterRef.current = activeFilter
    }
  }, [data, phone, card, isLoading, tToast])

  // Ô search debounce trong DataTable gọi lên đây; guard tránh reset page khi hydrate từ URL
  const handleSearchChange = useCallback(
    (value: string) => {
      if (value !== phone) setPhone(value)
    },
    [phone, setPhone],
  )

  const handleRFIDScan = useCallback((code: string) => setCard(code), [setCard])
  const handleRFIDClear = useCallback(() => setCard(''), [setCard])
  const handleReset = useCallback(() => reset(), [reset])

  // Filter ngày RIÊNG cho bảng (decouple khỏi dashboard) — DataTable emit 'YYYY-MM-DD'
  const handleTableDateChange = useCallback(
    (startDate: string, endDate: string) => {
      if (startDate !== from || endDate !== to) setDateRange(startDate, endDate)
    },
    [from, to, setDateRange],
  )

  const handlePaginationChange = useCallback(
    (pageIndex0: number, pageSize: number) => {
      if (pageSize !== size) setSize(pageSize)
      else setPage(pageIndex0 + 1)
    },
    [size, setSize, setPage],
  )

  const handleRowClick = (row: IUserInfo) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.slug}`)
  }

  const CustomerActionOptions = useMemo(() => {
    return function ActionOptions() {
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <CustomerDateRangeFilter from={from} to={to} onChange={handleTableDateChange} />
          <CustomerAction
            onRFIDScan={handleRFIDScan}
            onRFIDClear={handleRFIDClear}
            onReset={handleReset}
            scannedCode={card}
            hasActiveFilter={!!phone || !!card || !!from || !!to}
          />
        </div>
      )
    }
  }, [card, phone, from, to, handleTableDateChange, handleRFIDScan, handleRFIDClear, handleReset])

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <CustomerRegistrationDashboard />
      <DataTable
        columns={memoColumns}
        data={data?.result?.items || []}
        isLoading={isLoading}
        pages={data?.result?.totalPages || 0}
        pageIndex={page - 1}
        pageSize={size}
        onPaginationChange={handlePaginationChange}
        onInputChange={handleSearchChange}
        searchValue={phone}
        hiddenInput={false}
        searchPlaceholder={t('customer.searchByPhoneNumber')}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        actionOptions={CustomerActionOptions}
        onRowClick={handleRowClick}
      />
    </div>
  )
}
```

> Ghi chú: `onPageChange`/`onPageSizeChange` truyền no-op vì controlled mode dùng `onPaginationChange`. `DataTable` yêu cầu 2 prop này (non-optional) nên vẫn phải truyền.

- [ ] **Step 3: Kiểm tra format ngày filter ↔ backend**

`CustomerDateRangeFilter` (qua `SimpleDatePicker`) emit `YYYY-MM-DD`. `useUsers` nhận `startDate/endDate` — xác nhận backend chấp nhận `YYYY-MM-DD` (giống cách dashboard cũ truyền range đã hoạt động). Nếu backend cần full datetime, map trong `handleTableDateChange`:
```ts
setDateRange(
  startDate ? moment(startDate).startOf('day').format('YYYY-MM-DDTHH:mm:ss') : '',
  endDate ? moment(endDate).endOf('day').format('YYYY-MM-DDTHH:mm:ss') : '',
)
```
(thêm `import moment from 'moment'` nếu dùng nhánh này).

- [ ] **Step 4: Lint + typecheck**

Run: `cd app/order-ui && npm run lint`
Expected: không lỗi. Không còn tham chiếu `usePagination`, `useSearchParams`, `membershipCard` state cũ.

- [ ] **Step 5: Verify thủ công (chạy app)**

Run: `cd app/order-ui && npm run dev`, mở `http://localhost:5173/system/customer-and-marketing-management?tab=customer`:
- Tìm SĐT → URL có `?phone=...&page=1`; F5 → ô search vẫn giữ giá trị, kết quả đúng.
- Deep-link `?page=3` → nút Prev **không** bị disable sai, Next sang trang 4 (không nhảy về 2).
- Đổi page rồi đổi filter → page về 1.
- Chọn ngày trên bảng → `?from=...&to=...`, dashboard **không** đổi theo.

---

### Task 5: Tabs wrapper controlled (F)

**Files:**
- Modify: `app/order-ui/src/components/app/tabs/system-customer-and-marketing-management.tabs.tsx`

**Interfaces:**
- Produces: `<Tabs>` controlled bằng `value={tab}` + `onValueChange`.

- [ ] **Step 1: Chuyển Tabs sang controlled**

Đổi (dòng ~64):

```tsx
    <Tabs value={tab} onValueChange={setTab} className="w-full">
```

- [ ] **Step 2: Bỏ onClick thừa trên các TabsTrigger (tuỳ chọn, dọn)**

Vì `onValueChange={setTab}` đã cập nhật `tab` khi đổi tab, các `onClick={() => setTab('...')}` trên từng `TabsTrigger` trở nên thừa. Xoá các `onClick` đó để tránh double-set (giữ nguyên `value`/`className`).

- [ ] **Step 3: Lint + verify**

Run: `cd app/order-ui && npm run lint`
Verify: chuyển qua lại các tab hoạt động; nếu tài khoản không có quyền tab hiện tại, panel tự chuyển đúng về default tab (redirect permission hiển thị đúng nội dung).

---

### Task 6: Polish RFID filter + i18n (G)

**Files:**
- Modify: `app/order-ui/src/app/system/customers/DataTable/actions/rfid-filter.tsx`
- Modify: `app/order-ui/src/app/system/customers/DataTable/actions/customer-action.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`
- Modify: `app/order-ui/src/locales/en/customer.json`

**Interfaces:** không có (chỉ dọn dead code + i18n).

- [ ] **Step 1: Thêm khoá i18n**

Trong `src/locales/vi/customer.json`, thêm vào object `customer`:
```json
"rfid": {
  "scanButton": "Quét thẻ / QR",
  "dialogTitle": "Quét thẻ / QR để tìm kiếm",
  "dialogDescription": "Chọn chế độ và đưa thẻ RFID hoặc mã QR vào đầu đọc",
  "modeRfid": "Thẻ RFID",
  "modeQr": "Mã QR",
  "waitingRfid": "Đang chờ quét thẻ RFID...",
  "waitingQr": "Đang chờ quét mã QR...",
  "hintRfid": "Đưa thẻ RFID vào đầu đọc",
  "hintQr": "Đưa mã QR vào đầu đọc"
}
```

Trong `src/locales/en/customer.json`, thêm vào object `customer`:
```json
"rfid": {
  "scanButton": "Scan card / QR",
  "dialogTitle": "Scan card / QR to search",
  "dialogDescription": "Choose a mode and present the RFID card or QR code to the reader",
  "modeRfid": "RFID card",
  "modeQr": "QR code",
  "waitingRfid": "Waiting for RFID scan...",
  "waitingQr": "Waiting for QR scan...",
  "hintRfid": "Present the RFID card to the reader",
  "hintQr": "Present the QR code to the reader"
}
```

- [ ] **Step 2: Dùng i18n + bỏ dead ternary trong rfid-filter.tsx**

- Thêm `const { t } = useTranslation('customer')` (giữ `tCommon` hiện có).
- Button label (dòng ~73): `{t('customer.rfid.scanButton')}` (bỏ ternary trùng nhánh).
- DialogTitle (dòng ~80): `{t('customer.rfid.dialogTitle')}`.
- DialogDescription (dòng ~82-86): `{t('customer.rfid.dialogDescription')}` (bỏ ternary trùng nhánh).
- Nút mode RFID/QR (dòng ~100, ~110): `{t('customer.rfid.modeRfid')}` / `{t('customer.rfid.modeQr')}`.
- Đoạn waiting (dòng ~120-129): dùng `scanMode === 'rfid' ? t('customer.rfid.waitingRfid') : t('customer.rfid.waitingQr')` và tương tự `hintRfid`/`hintQr`.

- [ ] **Step 3: Xử lý prop `onClear` thừa**

`RFIDFilter` khai báo `onClear` trong interface nhưng không dùng. Vì `CustomerAction` truyền `onClear` xuống, giữ interface nhưng đánh dấu dùng: thêm nút Clear nhỏ khi có `scannedCode`, HOẶC bỏ hẳn `onClear` khỏi `RFIDFilterProps` và khỏi chỗ truyền trong `customer-action.tsx`. Chọn **bỏ hẳn** cho gọn (reset đã có ở `CustomerAction`):
  - `rfid-filter.tsx`: bỏ `onClear` khỏi `interface RFIDFilterProps`.
  - `customer-action.tsx`: bỏ prop `onClear={...}` khi render `<RFIDFilter>` (giữ `onRFIDClear` ở `CustomerActionProps` vì tabscontent vẫn truyền — nó vô hại; hoặc để nguyên).

- [ ] **Step 4: Dọn fallback vô nghĩa trong customer-action.tsx**

Dòng ~37: `title={tCommon('common.reset') || 'Reset'}` và text nút (dòng ~40) → bỏ `|| 'Reset'`, chỉ `tCommon('common.reset')`.

- [ ] **Step 5: Lint + verify**

Run: `cd app/order-ui && npm run lint`
Verify: mở dialog quét thẻ, đổi mode RFID/QR → chuỗi hiển thị đúng theo ngôn ngữ; đổi sang EN kiểm tra bản dịch.

---

## Self-Review

**Spec coverage:**
- 1a controlled pagination → Task 2. 1b reset page → Task 1 (setters) + Task 4 (handlers). 1c double-fetch → Task 3 (bỏ effect) + Task 4 (single source). 1d tabs controlled → Task 5. 2 memo columns + optional-chain → Task 4. 3 decouple → Task 3 + Task 4 (table date filter). 5a/5b filter lên URL → Task 1 + Task 4. 5c search từ URL → Task 2 (`searchValue`) + Task 4 (`handleSearchChange` guard). 5d share link → hệ quả. 🟢 sort arrow → Task 2; RFID/i18n → Task 6; toast cả phone+card → Task 4.
- Tất cả requirement có task tương ứng. ✅

**Placeholder scan:** không có TBD/TODO; mọi step có code cụ thể. ✅

**Type consistency:** `useCustomerListFilters` trả đúng các tên `setPhone/setCard/setDateRange/setPage/setSize/reset` dùng ở Task 4. DataTable props `pageIndex/pageSize/onPaginationChange/searchValue` khai ở Task 2 dùng đúng ở Task 4. `onPaginationChange(pageIndex0, pageSize)` khớp `handlePaginationChange`. ✅

**Ghi chú thực thi:** Task 1 và Task 2 độc lập (song song được). Task 4 phụ thuộc 1+2+3. Không commit ở bất kỳ task nào.
