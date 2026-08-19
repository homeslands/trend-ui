# Unified Date Range + Compare Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gộp preset + khoảng tùy chọn + so sánh + kỳ trước vào **một popover ngày kiểu GA**; toolbar chỉ còn 1 nút ngày.

**Architecture:** Tách helper preset ra file constants (dùng chung + test). Tạo component controlled `DateRangeComparePopover` (dashboard giữ state + fetch, popover chỉ trình bày). Dùng `Calendar mode="range"` inline (không lồng popover).

**Tech Stack:** React 18, TypeScript, react-day-picker v8 (`Calendar`), Radix `Popover`/`Checkbox` (shadcn), moment, i18next, Vitest.

## Global Constraints

- **KHÔNG commit** — người dùng tự commit. Mỗi task kết thúc bằng lint + test.
- Áp dụng trực tiếp (không nút "Áp dụng"); chỉ emit khi range đủ `from`+`to`.
- Calendar range **1 tháng** (`numberOfMonths={1}`), chặn ngày tương lai.
- State so sánh **ephemeral** (không URL). Data flow không đổi (chart/summary fetch kỳ sau; dashboard fetch kỳ trước).
- KHÔNG đổi hành vi mặc định `TimeRangeRevenueFilter` (chỉ thôi dùng ở dashboard).
- Lệnh gốc: `app/order-ui/`. tsc: `npx tsc -b --noEmit`; lint: `npm run lint`; test: `npx vitest run <path>`.

---

### Task 1: Tách helper preset ra constants + test

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/registration-range.constants.ts`
- Test: `app/order-ui/src/app/system/customers/components/__tests__/registration-range.constants.test.ts`

**Interfaces:**
- Produces: `type Preset`, `ALL_TIME_START`, `fmt`, `PRESET_GROUPBY`, `presetRange(preset)`, `PRESETS[]`, `suggestPrevious(afterStart, afterEnd)`, `formatRangeLabel(activePreset, startDate, endDate, allTimeLabel)`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/registration-range.constants.test.ts
import { describe, it, expect } from 'vitest'
import moment from 'moment'
import { suggestPrevious, formatRangeLabel } from '../registration-range.constants'

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
    expect(formatRangeLabel('allTime', '2020-01-01T00:00:00', '2026-07-09T23:59:59', 'Tất cả')).toBe('Tất cả')
  })
  it('returns a single date when start and end are the same day', () => {
    expect(formatRangeLabel(null, '2026-06-10T00:00:00', '2026-06-10T23:59:59', 'Tất cả')).toBe('10/06/2026')
  })
  it('returns a range when start and end differ', () => {
    expect(formatRangeLabel(null, '2026-06-01T00:00:00', '2026-06-30T23:59:59', 'Tất cả')).toBe('01/06/2026 - 30/06/2026')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/__tests__/registration-range.constants.test.ts`
Expected: FAIL — cannot resolve `../registration-range.constants`.

- [ ] **Step 3: Create the constants file**

```ts
// registration-range.constants.ts
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
      return { start: fmt(now.clone().subtract(6, 'days').startOf('day')), end: fmt(now.clone().endOf('day')) }
    case 'last30Days':
      return { start: fmt(now.clone().subtract(29, 'days').startOf('day')), end: fmt(now.clone().endOf('day')) }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/__tests__/registration-range.constants.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Lint + typecheck**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint`
Expected: clean.

---

### Task 2: `DateRangeComparePopover` component + i18n

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/date-range-compare-popover.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`, `app/order-ui/src/locales/en/customer.json`

**Interfaces:**
- Consumes: `Preset`, `PRESETS`, `formatRangeLabel` (Task 1); `Calendar`, `Checkbox`, `Popover*`, `Button` từ `@/components/ui`; `DateRange` từ `react-day-picker`.
- Produces: `DateRangeComparePopover` với props:
  ```ts
  interface DateRangeComparePopoverProps {
    startDate: string; endDate: string; activePreset: Preset | null
    onSelectPreset: (preset: Preset) => void
    onSelectRange: (start: string, end: string) => void   // 'YYYY-MM-DD'
    compareEnabled: boolean; compareStart: string; compareEnd: string
    onToggleCompare: () => void
    onSelectCompareRange: (start: string, end: string) => void  // 'YYYY-MM-DD'
    onUseSamePeriod: () => void
  }
  ```

- [ ] **Step 1: Thêm khoá i18n**

Trong CẢ HAI locale, trong `customer.registrationDashboard`, thêm (sau `selectPreviousPeriod`):

vi:
```json
      "dateRange": "Khoảng thời gian",
      "compareWithPrevious": "So sánh với kỳ trước",
      "samePeriod": "Kỳ liền trước",
```
en:
```json
      "dateRange": "Date range",
      "compareWithPrevious": "Compare with previous period",
      "samePeriod": "Previous period",
```

- [ ] **Step 2: Tạo component**

```tsx
// date-range-compare-popover.tsx
import moment from 'moment'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DateRange } from 'react-day-picker'

import {
  Button,
  Calendar,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { Preset, PRESETS, formatRangeLabel } from './registration-range.constants'

interface DateRangeComparePopoverProps {
  startDate: string
  endDate: string
  activePreset: Preset | null
  onSelectPreset: (preset: Preset) => void
  onSelectRange: (start: string, end: string) => void
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  onToggleCompare: () => void
  onSelectCompareRange: (start: string, end: string) => void
  onUseSamePeriod: () => void
}

const toDate = (v: string) => (v ? moment(v).toDate() : undefined)
const ymd = (d: Date) => moment(d).format('YYYY-MM-DD')

export default function DateRangeComparePopover({
  startDate,
  endDate,
  activePreset,
  onSelectPreset,
  onSelectRange,
  compareEnabled,
  compareStart,
  compareEnd,
  onToggleCompare,
  onSelectCompareRange,
  onUseSamePeriod,
}: DateRangeComparePopoverProps) {
  const { t } = useTranslation('customer')
  const allTimeLabel = t('customer.registrationDashboard.presetAllTime')
  const label = formatRangeLabel(activePreset, startDate, endDate, allTimeLabel)

  const currentRange: DateRange | undefined = startDate
    ? { from: toDate(startDate), to: toDate(endDate) }
    : undefined
  const compareRange: DateRange | undefined = compareStart
    ? { from: toDate(compareStart), to: toDate(compareEnd) }
    : undefined

  const handleCurrentSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) onSelectRange(ymd(range.from), ymd(range.to))
  }
  const handleCompareSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) onSelectCompareRange(ymd(range.from), ymd(range.to))
  }
  const disableFuture = (date: Date) => date > moment().endOf('day').toDate()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 whitespace-nowrap">
          <CalendarDays className="w-4 h-4" />
          <span>
            {label}
            {compareEnabled ? ` · ${t('customer.registrationDashboard.compare')}` : ''}
          </span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[20rem] max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPreset(p.key)}
                className={
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors ' +
                  (activePreset === p.key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-input text-muted-foreground hover:text-foreground')
                }
              >
                {t(p.i18n)}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('customer.registrationDashboard.dateRange')}
            </span>
            <Calendar
              mode="range"
              numberOfMonths={1}
              selected={currentRange}
              onSelect={handleCurrentSelect}
              disabled={disableFuture}
            />
          </div>

          <div className="border-t" />

          <label className="flex gap-2 items-center text-sm cursor-pointer">
            <Checkbox
              checked={compareEnabled}
              onCheckedChange={() => onToggleCompare()}
            />
            {t('customer.registrationDashboard.compareWithPrevious')}
          </label>

          {compareEnabled && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={onUseSamePeriod}>
                  {t('customer.registrationDashboard.samePeriod')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {compareStart && compareEnd
                    ? `${moment(compareStart).format('DD/MM/YYYY')} - ${moment(compareEnd).format('DD/MM/YYYY')}`
                    : '—'}
                </span>
              </div>
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={compareRange}
                onSelect={handleCompareSelect}
                disabled={disableFuture}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Typecheck + lint + JSON parse**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: clean + `OK`. (Nếu `Calendar`/`Checkbox` cần prop khác với react-day-picker v8, sửa cho khớp — `mode`/`selected`/`onSelect`/`disabled`/`numberOfMonths` là API chuẩn v8.)

---

### Task 3: Dashboard dùng popover (bỏ cụm điều khiển cũ)

**Files:**
- Modify: `app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx`

**Interfaces:**
- Consumes: `DateRangeComparePopover` (Task 2); helpers từ `registration-range.constants` (Task 1).

- [ ] **Step 1: Đổi imports**

- Xóa các định nghĩa nội bộ: `type Preset`, `ALL_TIME_START`, `fmt`, `PRESET_GROUPBY`, `presetRange`, `PRESETS` (dòng ~19–96) — thay bằng import:
  ```ts
  import {
    Preset,
    PRESET_GROUPBY,
    presetRange,
    suggestPrevious,
  } from './registration-range.constants'
  import DateRangeComparePopover from './date-range-compare-popover'
  ```
  (Xóa luôn `suggestPrevious` nội bộ ở dòng ~112 — dùng bản import.)
- Bỏ import không còn dùng: `TimeRangeRevenueFilter`, `GitCompareArrows`, `Badge`. GIỮ: `ListFilter` (applyToList), `RefreshCcw`, `RotateCcw`, `Tooltip*`, `Button`.
- Giữ `import { useEffect, useMemo, useState } from 'react'` và `import moment from 'moment'` (moment vẫn dùng ở compareData memo).

- [ ] **Step 2: Thêm `handleUseSamePeriod`, bỏ `rangeLabel`**

Sau `handleSelectCompareRange`, thêm:
```ts
  const handleUseSamePeriod = () => {
    const s = suggestPrevious(startDate, endDate)
    setCompareStart(s.start)
    setCompareEnd(s.end)
  }
```
Xóa biến `rangeLabel` (dòng ~198–201) — nhãn đã nằm trong popover.

- [ ] **Step 3: Thay khối toolbar**

Thay toàn bộ `<div className="flex flex-col gap-2 items-stretch w-full lg:flex-row ...">…</div>` (khối chứa Badge + preset + TimeRangeRevenueFilter + nút So sánh + cụm refresh/reset) VÀ khối `{compareEnabled && (<div>…Chọn kỳ trước…</div>)}` bên dưới — **bằng**:

```tsx
      <div className="flex flex-nowrap gap-2 items-center w-full overflow-x-auto scrollbar-hide lg:justify-end [&>*]:shrink-0">
        <DateRangeComparePopover
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onSelectPreset={handleSelectPreset}
          onSelectRange={handleSelectDateRange}
          compareEnabled={compareEnabled}
          compareStart={compareStart}
          compareEnd={compareEnd}
          onToggleCompare={handleToggleCompare}
          onSelectCompareRange={handleSelectCompareRange}
          onUseSamePeriod={handleUseSamePeriod}
        />

        <TooltipProvider delayDuration={200}>
          {onApplyToList && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleApplyToList}>
                  <ListFilter className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('customer.registrationDashboard.applyToList')}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('customer.registrationDashboard.refresh')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('customer.registrationDashboard.reset')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint`
Expected: clean; không còn tham chiếu `Badge`, `TimeRangeRevenueFilter`, `GitCompareArrows`, `rangeLabel`, `PRESETS` (nội bộ).

- [ ] **Step 5: Verify thủ công (chạy app)**

Run: `cd app/order-ui && npm run dev` → tab customer:
- Toolbar chỉ còn nút ngày + 3 icon (danh sách/refresh/reset).
- Bấm nút ngày → popover: preset highlight đúng; chọn preset → chart/summary đổi + nhãn nút đổi; chọn range trên calendar → áp trực tiếp.
- Tick "So sánh với kỳ trước" → hiện "Kỳ liền trước" + calendar kỳ trước; nhãn nút thêm "· So sánh"; card Tăng trưởng + bar nhóm hoạt động.
- Bấm "Kỳ liền trước" → kỳ trước = liền trước cùng độ dài.
- Đóng/mở popover, chọn ngày trong calendar KHÔNG làm popover đóng đột ngột.

---

## Self-Review

**Spec coverage:**
- Gộp mọi điều khiển vào 1 popover → Task 2 (component) + Task 3 (thay toolbar). ✅
- Preset trong popover + highlight → Task 2. ✅
- Calendar range inline 1 tháng, áp trực tiếp → Task 2. ✅
- Compare checkbox + "Kỳ liền trước" + calendar kỳ trước → Task 2 + Task 3 (`handleUseSamePeriod`). ✅
- Nhãn nút = khoảng + "· So sánh" → Task 2 (`formatRangeLabel`). ✅
- Tách helper + test `suggestPrevious`/`formatRangeLabel` → Task 1. ✅
- Giữ applyToList/refresh/reset; bỏ TimeRangeRevenueFilter ở dashboard → Task 3. ✅
- i18n vi/en → Task 2. ✅
- Data flow/backend/URL/table filter không đổi → không task nào đụng. ✅

**Placeholder scan:** không có TBD; code cụ thể từng bước. ✅

**Type consistency:** props `DateRangeComparePopover` (Task 2) khớp handler dashboard truyền (Task 3): `handleSelectPreset(preset)`, `handleSelectDateRange(start,end)`, `handleToggleCompare()`, `handleSelectCompareRange(start,end)`, `handleUseSamePeriod()`. `Preset`/`presetRange`/`suggestPrevious` (Task 1) dùng đúng ở Task 2/3. ✅

**Ghi chú thực thi:** Task 1 → 2 → 3 tuần tự (2 cần 1; 3 cần 1+2). Không commit.
