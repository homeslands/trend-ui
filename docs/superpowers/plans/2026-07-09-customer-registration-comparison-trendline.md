# Customer Registration — Period Comparison & Trend Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm so sánh 2 khoảng thời gian (kỳ trước/kỳ sau), card "Tăng trưởng" và trend line hồi quy tuyến tính cho dashboard đăng ký khách hàng.

**Architecture:** Backend chỉ query 1 khoảng → dashboard fetch thêm kỳ trước (khi bật so sánh) và truyền `compareData`/`compareTotal` xuống chart + summary. Chart vẽ bar nhóm theo vị trí bucket + 1 trend line hồi quy cho kỳ sau. Card tăng trưởng hiển thị % (xanh tăng / đỏ giảm). Hồi quy tách util thuần có test.

**Tech Stack:** React 18, TypeScript, ECharts, moment, TanStack Query, Vitest, i18next, Tailwind/shadcn.

## Global Constraints

- **KHÔNG commit** — người dùng tự commit. Mỗi task kết thúc bằng lint + test, không `git commit`.
- State so sánh (toggle, kỳ trước/sau) là **ephemeral** — KHÔNG lên URL.
- Trend line = **hồi quy tuyến tính (least-squares)**, chỉ vẽ cho **kỳ sau**, cần ≥2 điểm.
- Chart khi so sánh = **bar nhóm theo vị trí bucket** (kỳ sau cam `#f89209`, kỳ trước xám `#cbd5e1`), trend line xanh `#2563eb` dashed.
- Card tăng trưởng: % to, `text-green-500` khi ≥0, `text-destructive` khi <0; `beforeTotal===0 && afterTotal>0` → "Mới"; cả hai 0 → "0%" muted.
- Không đổi backend (gọi client 2 lần). Không moving average. Không đụng bảng/URL của tab.
- Lệnh gốc: `app/order-ui/`. Test: `npx vitest run <path>`; lint: `npm run lint`; typecheck: `npx tsc -b --noEmit`.

---

### Task 1: `linearRegression` util + test

**Files:**
- Create: `app/order-ui/src/utils/linear-regression.ts`
- Modify: `app/order-ui/src/utils/index.ts` (thêm export)
- Test: `app/order-ui/src/utils/__tests__/linear-regression.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface LinearRegressionResult { slope: number; intercept: number; at: (x: number) => number }
  function linearRegression(points: { x: number; y: number }[]): LinearRegressionResult | null
  ```
  `null` khi <2 điểm hoặc mọi `x` bằng nhau.

- [ ] **Step 1: Write the failing test**

```ts
// app/order-ui/src/utils/__tests__/linear-regression.test.ts
import { describe, it, expect } from 'vitest'
import { linearRegression } from '../linear-regression'

describe('linearRegression', () => {
  it('fits a perfectly increasing line y = 2x', () => {
    const r = linearRegression([
      { x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 },
    ])
    expect(r).not.toBeNull()
    expect(r!.slope).toBeCloseTo(2, 6)
    expect(r!.intercept).toBeCloseTo(0, 6)
    expect(r!.at(4)).toBeCloseTo(8, 6)
  })

  it('fits a decreasing line (negative slope)', () => {
    const r = linearRegression([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }])
    expect(r!.slope).toBeCloseTo(-2, 6)
    expect(r!.at(3)).toBeCloseTo(4, 6)
  })

  it('returns slope 0 for constant data', () => {
    const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }])
    expect(r!.slope).toBeCloseTo(0, 6)
    expect(r!.intercept).toBeCloseTo(5, 6)
  })

  it('returns null for fewer than 2 points', () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull()
  })

  it('returns null when all x are identical (zero variance)', () => {
    expect(linearRegression([{ x: 2, y: 1 }, { x: 2, y: 5 }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/order-ui && npx vitest run src/utils/__tests__/linear-regression.test.ts`
Expected: FAIL — `Failed to resolve import '../linear-regression'`.

- [ ] **Step 3: Write the util**

```ts
// app/order-ui/src/utils/linear-regression.ts
export interface LinearRegressionResult {
  slope: number
  intercept: number
  at: (x: number) => number
}

/**
 * Least-squares linear regression. Returns null when there are fewer than
 * 2 points or when all x values are identical (denominator = 0).
 */
export function linearRegression(
  points: { x: number; y: number }[],
): LinearRegressionResult | null {
  const n = points.length
  if (n < 2) return null

  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n

  let num = 0
  let den = 0
  for (const p of points) {
    const dx = p.x - meanX
    num += dx * (p.y - meanY)
    den += dx * dx
  }
  if (den === 0) return null

  const slope = num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept, at: (x: number) => intercept + slope * x }
}
```

- [ ] **Step 4: Add barrel export**

Trong `app/order-ui/src/utils/index.ts`, thêm dòng (cuối danh sách export):
```ts
export * from './linear-regression'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app/order-ui && npx vitest run src/utils/__tests__/linear-regression.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 6: Lint**

Run: `cd app/order-ui && npm run lint`
Expected: no new errors.

---

### Task 2: Chart — trend line + comparison grouped bars

**Files:**
- Modify (replace nội dung): `app/order-ui/src/app/system/customers/components/customer-registration-chart.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`, `app/order-ui/src/locales/en/customer.json` (thêm khoá)

**Interfaces:**
- Consumes: `linearRegression` (Task 1); `IUserStatisticsItem` từ `@/types`.
- Produces: `CustomerRegistrationChart` nhận thêm props optional `compareEnabled?: boolean`, `compareData?: IUserStatisticsItem[]`.

- [ ] **Step 1: Thêm khoá i18n cho chart**

Trong CẢ HAI `src/locales/vi/customer.json` và `src/locales/en/customer.json`, trong object `customer.registrationDashboard`, thêm (sau khoá `chartSeriesName`):

vi:
```json
      "seriesAfter": "Kỳ sau",
      "seriesBefore": "Kỳ trước",
      "trendLine": "Xu hướng",
      "deltaLabel": "Chênh lệch",
```
en:
```json
      "seriesAfter": "Current period",
      "seriesBefore": "Previous period",
      "trendLine": "Trend",
      "deltaLabel": "Difference",
```
(Giữ JSON hợp lệ, đúng dấu phẩy.)

- [ ] **Step 2: Replace toàn bộ `customer-registration-chart.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui'
import { useUserStatistics } from '@/hooks'
import { UserStatisticsGroupBy, IUserStatisticsItem } from '@/types'
import { UserStatisticsGroupBySelect } from '@/components/app/select'
import { linearRegression } from '@/utils'

interface CustomerRegistrationChartProps {
  startDate: string
  endDate: string
  trigger: number
  groupBy: UserStatisticsGroupBy
  onGroupByChange: (value: UserStatisticsGroupBy) => void
  compareEnabled?: boolean
  compareData?: IUserStatisticsItem[]
}

interface TooltipParam {
  axisValue: string
  dataIndex: number
}

export default function CustomerRegistrationChart({
  startDate,
  endDate,
  trigger,
  groupBy,
  onGroupByChange,
  compareEnabled = false,
  compareData,
}: CustomerRegistrationChartProps) {
  const { t } = useTranslation('customer')
  const chartRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useUserStatistics(
    { startDate, endDate, groupBy },
    true,
  )

  useEffect(() => {
    if (trigger) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const formatDate = useCallback(
    (dateStr: string) => {
      switch (groupBy) {
        case UserStatisticsGroupBy.HOUR:
          return moment(dateStr).format('HH:00 DD/MM')
        case UserStatisticsGroupBy.WEEK:
          return `T${moment(dateStr).isoWeek()}/${moment(dateStr).isoWeekYear()}`
        case UserStatisticsGroupBy.MONTH:
          return moment(dateStr).format('MM/YYYY')
        case UserStatisticsGroupBy.YEAR:
          return moment(dateStr).format('YYYY')
        case UserStatisticsGroupBy.DAY:
        default:
          return moment(dateStr).format('DD/MM')
      }
    },
    [groupBy],
  )

  const items = useMemo(() => data?.result?.data ?? [], [data])
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => moment(a.time).valueOf() - moment(b.time).valueOf(),
      ),
    [items],
  )

  const compareItems = useMemo(() => compareData ?? [], [compareData])
  const sortedCompare = useMemo(
    () =>
      [...compareItems].sort(
        (a, b) => moment(a.time).valueOf() - moment(b.time).valueOf(),
      ),
    [compareItems],
  )

  const isEmpty = !isLoading && sorted.length === 0

  useEffect(() => {
    if (!chartRef.current || isEmpty || isLoading) return

    const chart = echarts.init(chartRef.current)
    const seriesAfterName = t('customer.registrationDashboard.seriesAfter')
    const seriesBeforeName = t('customer.registrationDashboard.seriesBefore')
    const trendName = t('customer.registrationDashboard.trendLine')
    const deltaLabel = t('customer.registrationDashboard.deltaLabel')

    const xLabels = sorted.map((it) => formatDate(it.time))
    const afterCounts = sorted.map((it) => it.count)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series: any[] = [
      {
        name: seriesAfterName,
        type: 'bar',
        barWidth: !compareEnabled && sorted.length === 1 ? 40 : undefined,
        data: afterCounts,
        itemStyle: { color: '#f89209', borderRadius: [5, 5, 0, 0] },
      },
    ]

    if (compareEnabled) {
      series.push({
        name: seriesBeforeName,
        type: 'bar',
        data: sorted.map((_, i) => sortedCompare[i]?.count ?? 0),
        itemStyle: { color: '#cbd5e1', borderRadius: [5, 5, 0, 0] },
      })
    }

    const reg = linearRegression(afterCounts.map((y, x) => ({ x, y })))
    if (reg) {
      series.push({
        name: trendName,
        type: 'line',
        data: afterCounts.map((_, i) => Number(reg.at(i).toFixed(2))),
        symbol: 'none',
        smooth: false,
        lineStyle: { color: '#2563eb', type: 'dashed', width: 2 },
        itemStyle: { color: '#2563eb' },
        z: 3,
      })
    }

    chart.setOption({
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: TooltipParam[]) => {
          const idx = params[0].dataIndex
          const after = afterCounts[idx] ?? 0
          let html = `${params[0].axisValue}<br/>${seriesAfterName}: ${after}`
          if (compareEnabled) {
            const before = sortedCompare[idx]?.count ?? 0
            const delta = after - before
            html += `<br/>${seriesBeforeName}: ${before}<br/>${deltaLabel}: ${delta >= 0 ? '+' : ''}${delta}`
          }
          return html
        },
      },
      legend: { top: 0, data: series.map((s) => s.name) },
      grid: { left: 40, right: 20, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'value',
        name: t('customer.registrationDashboard.chartYAxisLabel'),
        minInterval: 1,
        splitLine: { show: true, lineStyle: { type: 'dashed' } },
      },
      series,
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', onResize)
    }
  }, [sorted, sortedCompare, compareEnabled, formatDate, isEmpty, isLoading, t])

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{t('customer.registrationDashboard.chartTitle')}</span>
          <UserStatisticsGroupBySelect value={groupBy} onChange={onGroupByChange} />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="relative h-[26rem] w-full">
          <div
            ref={chartRef}
            className={
              'h-full w-full ' + (isLoading || isEmpty ? 'invisible' : '')
            }
          />
          {isLoading && (
            <Skeleton className="absolute inset-0 h-full w-full" />
          )}
          {!isLoading && isEmpty && (
            <div className="absolute inset-0 flex flex-col gap-2 justify-center items-center text-muted-foreground">
              <Users className="w-10 h-10 opacity-30" />
              <span>{t('customer.registrationDashboard.emptyChart')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint`
Expected: clean. (`IUserStatisticsItem` đã export sẵn trong `src/types/user.type.ts`.)

- [ ] **Step 4: Verify JSON parse**

Run: `cd app/order-ui && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: `OK`.

---

### Task 3: Summary — card "Tăng trưởng"

**Files:**
- Modify (replace nội dung): `app/order-ui/src/app/system/customers/components/customer-registration-summary.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`, `app/order-ui/src/locales/en/customer.json`

**Interfaces:**
- Produces: `CustomerRegistrationSummary` nhận thêm props optional `compareEnabled?: boolean`, `compareTotal?: number`.

- [ ] **Step 1: Thêm khoá i18n cho summary**

Trong CẢ HAI locale, trong `customer.registrationDashboard`, thêm (sau `avgPerDay`):

vi:
```json
      "growth": "Tăng trưởng",
      "growthNew": "Mới",
```
en:
```json
      "growth": "Growth",
      "growthNew": "New",
```

- [ ] **Step 2: Replace toàn bộ `customer-registration-summary.tsx`**

```tsx
import { useEffect } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { UserPlus, Users, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui'
import { useUserStatistics } from '@/hooks'
import { UserStatisticsGroupBy } from '@/types'

interface CustomerRegistrationSummaryProps {
  startDate: string
  endDate: string
  trigger: number
  compareEnabled?: boolean
  compareTotal?: number
}

export default function CustomerRegistrationSummary({
  startDate,
  endDate,
  trigger,
  compareEnabled = false,
  compareTotal,
}: CustomerRegistrationSummaryProps) {
  const { t } = useTranslation('customer')

  const params = {
    startDate,
    endDate,
    groupBy: UserStatisticsGroupBy.DAY,
  }

  const { data, isLoading, refetch } = useUserStatistics(params, true)

  useEffect(() => {
    if (trigger) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const items = data?.result?.data ?? []
  const total = data?.result?.total ?? 0
  const todayStr = moment().format('YYYY-MM-DD')
  const today =
    items.find((it) => moment(it.time).format('YYYY-MM-DD') === todayStr)?.count ?? 0
  const rangeDays =
    moment(endDate).startOf('day').diff(moment(startDate).startOf('day'), 'days') + 1
  const avgPerDay = +(total / Math.max(rangeDays, 1)).toFixed(1)

  const before = compareTotal ?? 0
  const growthPct = before > 0 ? +(((total - before) / before) * 100).toFixed(1) : null
  const isNew = before === 0 && total > 0
  const growthPositive = growthPct === null ? isNew : growthPct >= 0

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Card className="text-white shadow-none bg-primary">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-bold">
            {t('customer.registrationDashboard.totalNewCustomers')}
          </CardTitle>
          <UserPlus className="w-4 h-4" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="w-16 h-8" />
          ) : (
            <div className="text-2xl font-bold">{total}</div>
          )}
        </CardContent>
      </Card>

      {compareEnabled ? (
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {t('customer.registrationDashboard.growth')}
            </CardTitle>
            {growthPositive ? (
              <ArrowUp className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDown className="w-4 h-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-16 h-8" />
            ) : isNew ? (
              <div className="text-2xl font-bold text-green-500">
                {t('customer.registrationDashboard.growthNew')}
              </div>
            ) : growthPct === null ? (
              <div className="text-2xl font-bold text-muted-foreground">0%</div>
            ) : (
              <div
                className={
                  'text-2xl font-bold ' +
                  (growthPct >= 0 ? 'text-green-500' : 'text-destructive')
                }
              >
                {growthPct >= 0 ? '+' : ''}
                {growthPct}%
              </div>
            )}
            {!isLoading && (
              <div className="text-xs text-muted-foreground">
                {before} → {total}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {t('customer.registrationDashboard.todayNewCustomers')}
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-16 h-8" />
            ) : (
              <div className="text-2xl font-bold">{today}</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            {t('customer.registrationDashboard.avgPerDay')}
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="w-16 h-8" />
          ) : (
            <div className="text-2xl font-bold">{avgPerDay}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint + JSON parse**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: clean + `OK`.

---

### Task 4: Dashboard — so sánh (state, toggle, fetch kỳ trước, auto-suggest, wiring)

**Files:**
- Modify: `app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`, `app/order-ui/src/locales/en/customer.json`

**Interfaces:**
- Consumes: `CustomerRegistrationChart` props `compareEnabled`/`compareData` (Task 2); `CustomerRegistrationSummary` props `compareEnabled`/`compareTotal` (Task 3); `useUserStatistics` từ `@/hooks`.

- [ ] **Step 1: Thêm khoá i18n cho dashboard**

Trong CẢ HAI locale, trong `customer.registrationDashboard`, thêm (sau `reset`/`applyToList`):

vi:
```json
      "compare": "So sánh",
      "previousPeriod": "Kỳ trước",
      "currentPeriod": "Kỳ sau",
```
en:
```json
      "compare": "Compare",
      "previousPeriod": "Previous period",
      "currentPeriod": "Current period",
```
(Chú ý dấu phẩy: khoá cuối object không có dấu phẩy.)

- [ ] **Step 2: Thêm imports**

Trong `customer-registration-dashboard.tsx`:
- Thêm icon: đổi dòng import lucide thành có `GitCompareArrows`:
  ```ts
  import { GitCompareArrows, ListFilter, RefreshCcw, RotateCcw } from 'lucide-react'
  ```
- Thêm hook:
  ```ts
  import { useUserStatistics } from '@/hooks'
  ```

- [ ] **Step 3: Thêm state + helper so sánh**

Ngay sau dòng `const [trigger, setTrigger] = useState(0)`:

```ts
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareStart, setCompareStart] = useState<string>('')
  const [compareEnd, setCompareEnd] = useState<string>('')

  // Kỳ trước = kỳ liền trước cùng độ dài với kỳ sau hiện tại.
  const suggestPrevious = (afterStart: string, afterEnd: string) => {
    const start = moment(afterStart)
    const end = moment(afterEnd)
    const days = end.startOf('day').diff(start.clone().startOf('day'), 'days') + 1
    const prevEnd = start.clone().subtract(1, 'day').endOf('day')
    const prevStart = prevEnd.clone().subtract(days - 1, 'days').startOf('day')
    return { start: fmt(prevStart), end: fmt(prevEnd) }
  }

  const { data: beforeData, refetch: refetchBefore } = useUserStatistics(
    { startDate: compareStart, endDate: compareEnd, groupBy },
    compareEnabled && !!compareStart && !!compareEnd,
  )

  useEffect(() => {
    if (trigger && compareEnabled) refetchBefore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const handleToggleCompare = () => {
    if (!compareEnabled) {
      const s = suggestPrevious(startDate, endDate)
      setCompareStart(s.start)
      setCompareEnd(s.end)
    }
    setCompareEnabled((v) => !v)
  }

  const handleSelectCompareRange = (start: string, end: string) => {
    setCompareStart(fmt(moment(start).startOf('day')))
    setCompareEnd(fmt(moment(end).endOf('day')))
  }
```

> Cần `import { useEffect } from 'react'` — dòng import react hiện là `import { useState } from 'react'`; đổi thành `import { useEffect, useState } from 'react'`.

- [ ] **Step 4: Thêm nút toggle "So sánh" vào toolbar**

Trong hàng điều khiển (`<div className="flex flex-nowrap gap-2 items-center overflow-x-auto scrollbar-hide lg:justify-end [&>*]:shrink-0">`), thêm nút NGAY SAU `<TimeRangeRevenueFilter onApply={handleSelectDateRange} />`:

```tsx
          <Button
            variant={compareEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleCompare}
            className="gap-2 whitespace-nowrap"
          >
            <GitCompareArrows className="w-4 h-4" />
            {t('customer.registrationDashboard.compare')}
          </Button>
```

- [ ] **Step 5: Thêm khối chọn kỳ trước (hiện khi bật so sánh)**

Ngay SAU `<div className="flex flex-col gap-2 items-stretch w-full lg:flex-row ...">...</div>` (khối toolbar chính, tức trước `<CustomerRegistrationSummary ...>`), thêm:

```tsx
      {compareEnabled && (
        <div className="flex flex-nowrap gap-2 items-center overflow-x-auto scrollbar-hide [&>*]:shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {t('customer.registrationDashboard.previousPeriod')}:
          </span>
          <TimeRangeRevenueFilter onApply={handleSelectCompareRange} />
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-input text-muted-foreground whitespace-nowrap">
            {compareStart && compareEnd
              ? `${moment(compareStart).format('DD/MM/YYYY')} - ${moment(compareEnd).format('DD/MM/YYYY')}`
              : '—'}
          </span>
        </div>
      )}
```

- [ ] **Step 6: Truyền props xuống summary + chart**

Đổi:
```tsx
      <CustomerRegistrationSummary
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
      />

      <CustomerRegistrationChart
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />
```
thành:
```tsx
      <CustomerRegistrationSummary
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
        compareEnabled={compareEnabled}
        compareTotal={beforeData?.result?.total}
      />

      <CustomerRegistrationChart
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        compareEnabled={compareEnabled}
        compareData={beforeData?.result?.data ?? []}
      />
```

- [ ] **Step 7: Typecheck + lint + JSON parse**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: clean + `OK`.

- [ ] **Step 8: Verify thủ công (chạy app)**

Run: `cd app/order-ui && npm run dev` → tab customer:
- Trend line xanh dashed xuất hiện trên biểu đồ (kể cả khi chưa so sánh); kỳ 1 điểm thì ẩn.
- Bấm "So sánh" → xuất hiện khối "Kỳ trước" với range auto-suggest cùng độ dài; chart thành bar nhóm (cam/xám); tooltip có Δ; card "Tăng trưởng" thay card "Hôm nay", % xanh khi tăng / đỏ khi giảm; before=0 & after>0 → "Mới".
- Đổi kỳ trước bằng picker → chart/card cập nhật.
- Tắt "So sánh" → về 1 series + trend line, card "Hôm nay" trở lại.

---

## Self-Review

**Spec coverage:**
- So sánh 2 kỳ tự do + auto-suggest → Task 4 (`suggestPrevious`, toggle, picker kỳ trước). ✅
- Fetch kỳ trước ở dashboard, truyền xuống → Task 4 (`useUserStatistics` + props). ✅
- Chart bar nhóm theo vị trí bucket + tooltip Δ → Task 2. ✅
- Trend line hồi quy chỉ kỳ sau, ≥2 điểm → Task 1 (util) + Task 2 (line series, `reg` null-guard). ✅
- Card "Tăng trưởng" riêng, % xanh/đỏ, "Mới", 0% muted → Task 3. ✅
- State ephemeral (không URL) → Task 4 dùng `useState`. ✅
- i18n vi/en → Task 2/3/4 mỗi task thêm khoá của mình. ✅
- Không đổi backend / không moving average / không đụng bảng → không có task nào vi phạm. ✅

**Placeholder scan:** không có TBD; mọi step có code cụ thể. ✅

**Type consistency:** `linearRegression(points:{x,y}[]) → {slope,intercept,at}|null` (Task 1) dùng đúng ở Task 2. `compareEnabled`/`compareData: IUserStatisticsItem[]` (Task 2) và `compareEnabled`/`compareTotal: number` (Task 3) khớp props dashboard truyền ở Task 4 (`beforeData?.result?.data`, `beforeData?.result?.total`). ✅

**Ghi chú thực thi:** Task 1 → Task 2 (cần util). Task 3 độc lập. Task 4 cần 2+3. Task 2/3/4 đều sửa cùng 2 file JSON → chạy TUẦN TỰ (không song song) để tránh xung đột. Không commit.
