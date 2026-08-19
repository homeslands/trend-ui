# Customer Registration Statistics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard (4 KPI cards + echarts bar chart) above the customer `DataTable` that visualizes newly-registered customers over a selectable date range, mounted in both `/customers` page and the staff customer-management tab.

**Architecture:** Mirror the overview-page pattern. A `CustomerRegistrationDashboard` wrapper owns the date range and refresh trigger. Two children — `CustomerRegistrationSummary` (fixed to `groupBy=DAY`) and `CustomerRegistrationChart` (owns its own `groupBy`) — fetch statistics independently via `useUserStatistics`. Data comes from `GET /user/statistics`.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Zustand (not used here), echarts, moment, react-i18next, Vite, shadcn/ui.

## Global Constraints

- **Path root:** all frontend paths are relative to `app/order-ui/`.
- **Foundation names (already implemented in WIP diff — do NOT rename):**
  - Enum `UserStatisticsGroupBy` lives in `src/types/user.type.ts` (NOT in `src/constants/user.constants.ts` as the spec section 4.1 says). Import from `@/types`.
  - Response item shape: `IUserStatisticsResponse = { time: string; count: number }` (NOT `{ date, total }`).
  - API returns `IApiResponse<IUserStatisticsResponse[]>` (array of items in `.result`).
  - Hook: `useUserStatistics(params: IUserStatisticsQuery, enabled?: boolean)` — pass `true` as second arg to activate.
- **Timezone:** serialize date params with `moment(...).format('YYYY-MM-DDTHH:mm:ss')` (local time). Never `.toISOString()`.
- **Chart color:** `#f89209` (match overview bar color).
- **Chart height:** `h-[26rem]` (match `RevenueChart`).
- **Existing filter reuse:** use `TimeRangeRevenueFilter` from `@/components/app/popover` for date range.
- **Do NOT modify** the existing `DataTable`, phone/RFID filter, or `DateSelect` (`DateSelect` is coupled to `RevenueTypeQuery` and used by revenue charts — build a new dedicated select instead).
- **No automated tests** for these pages (project has no vitest coverage under `src/app/system/customers/`). Verification is `npm run lint` + `npx tsc --noEmit` + manual dev-server check.
- **Commits:** each task ends with a commit. Follow existing commit style (e.g. `TaskId: TRE-439-FE (<n>) <short description>`).

---

## File Structure

**New files:**

```
src/components/app/select/user-statistics-group-by-select.tsx    ← new select (5 options)
src/app/system/customers/components/customer-registration-summary.tsx
src/app/system/customers/components/customer-registration-chart.tsx
src/app/system/customers/components/customer-registration-dashboard.tsx
src/app/system/customers/components/index.ts                     ← barrel (if not exists)
```

**Modified files:**

```
src/components/app/select/index.tsx                              ← re-export new select
src/app/system/customers/page.tsx                                ← mount dashboard above DataTable
src/components/app/tabscontent/system-customer-management.tabscontent.tsx  ← mount dashboard above DataTable
src/locales/vi/customer.json                                     ← add dashboard copy (vi)
src/locales/en/customer.json                                     ← add dashboard copy (en)
```

**Already implemented (WIP diff — commit as Task 0):**

```
src/api/user.ts                       (+getUserStatistics)
src/constants/query.ts                (+QUERYKEY.userStatistics)
src/hooks/use-user.ts                 (+useUserStatistics)
src/types/user.type.ts                (+UserStatisticsGroupBy enum, +IUserStatisticsQuery, +IUserStatisticsResponse, +startDate/endDate on IUserQuery)
```

---

## Task 0: Commit the foundation WIP

**Files:**
- Modify: `src/api/user.ts`
- Modify: `src/constants/query.ts`
- Modify: `src/hooks/use-user.ts`
- Modify: `src/types/user.type.ts`

**Interfaces produced:**
- `UserStatisticsGroupBy` enum with values `HOUR='hour' | DAY='day' | WEEK='week' | MONTH='month' | YEAR='year'` — from `@/types`
- `IUserStatisticsQuery { startDate: string; endDate: string; groupBy: UserStatisticsGroupBy }` — from `@/types`
- `IUserStatisticsResponse { time: string; count: number }` — from `@/types`
- `getUserStatistics(params: IUserStatisticsQuery): Promise<IApiResponse<IUserStatisticsResponse[]>>` — from `@/api`
- `useUserStatistics(params: IUserStatisticsQuery, enabled?: boolean)` returning TanStack Query result whose `data.result` is `IUserStatisticsResponse[]` — from `@/hooks`
- `QUERYKEY.userStatistics = ['userStatistics']`

- [ ] **Step 1: Verify the diff is clean**

Run: `git status --short && git diff --stat app/order-ui/src/api/user.ts app/order-ui/src/constants/query.ts app/order-ui/src/hooks/use-user.ts app/order-ui/src/types/user.type.ts`

Expected: 4 files modified. If anything else is staged/modified unexpectedly, stop and investigate.

- [ ] **Step 2: Run typecheck to confirm the foundation compiles**

Run: `cd app/order-ui && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Run lint on modified files**

Run: `cd app/order-ui && npx eslint src/api/user.ts src/constants/query.ts src/hooks/use-user.ts src/types/user.type.ts`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/api/user.ts app/order-ui/src/constants/query.ts app/order-ui/src/hooks/use-user.ts app/order-ui/src/types/user.type.ts
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (1) Add user statistics API foundation

- Add UserStatisticsGroupBy enum + IUserStatisticsQuery / IUserStatisticsResponse types.
- Add getUserStatistics() API function calling GET /user/statistics.
- Add useUserStatistics() TanStack Query hook keyed by QUERYKEY.userStatistics.

EOF
)"
```

Expected: commit succeeds. No hook failure.

---

## Task 1: UserStatisticsGroupBySelect component

**Files:**
- Create: `src/components/app/select/user-statistics-group-by-select.tsx`
- Modify: `src/components/app/select/index.tsx` (add re-export)

**Interfaces:**
- Consumes: `UserStatisticsGroupBy` enum from `@/types`.
- Produces: default export `UserStatisticsGroupBySelect` with props `{ value: UserStatisticsGroupBy; onChange: (v: UserStatisticsGroupBy) => void }`. Renders shadcn `Select` with 5 options (Giờ / Ngày / Tuần / Tháng / Năm).

- [ ] **Step 1: Create the component**

Create `src/components/app/select/user-statistics-group-by-select.tsx`:

```tsx
import { Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { UserStatisticsGroupBy } from '@/types'

interface UserStatisticsGroupBySelectProps {
  value: UserStatisticsGroupBy
  onChange: (value: UserStatisticsGroupBy) => void
}

export default function UserStatisticsGroupBySelect({
  value,
  onChange,
}: UserStatisticsGroupBySelectProps) {
  const { t } = useTranslation(['common'])

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as UserStatisticsGroupBy)}
    >
      <SelectTrigger className="w-[12rem] flex gap-1 shadow-none font-normal">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <SelectValue placeholder={t('dayOfWeek.selectTimeRange')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={UserStatisticsGroupBy.HOUR}>
            {t('dayOfWeek.hour')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.DAY}>
            {t('dayOfWeek.day')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.WEEK}>
            {t('dayOfWeek.week')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.MONTH}>
            {t('dayOfWeek.month')}
          </SelectItem>
          <SelectItem value={UserStatisticsGroupBy.YEAR}>
            {t('dayOfWeek.year')}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Add missing `dayOfWeek.week` translation key**

Verify `src/locales/vi/common.json` and `src/locales/en/common.json` have a `dayOfWeek.week` key. If missing, add:

- vi: `"week": "Tuần"` inside the `dayOfWeek` object.
- en: `"week": "Week"` inside the `dayOfWeek` object.

Command to inspect: `grep -A3 '"dayOfWeek"' app/order-ui/src/locales/vi/common.json`.

- [ ] **Step 3: Re-export from the barrel**

Modify `src/components/app/select/index.tsx` — add:

```ts
export { default as UserStatisticsGroupBySelect } from './user-statistics-group-by-select'
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
cd app/order-ui && npx tsc --noEmit && npx eslint src/components/app/select/user-statistics-group-by-select.tsx src/components/app/select/index.tsx
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/components/app/select/user-statistics-group-by-select.tsx app/order-ui/src/components/app/select/index.tsx app/order-ui/src/locales/vi/common.json app/order-ui/src/locales/en/common.json
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (2) Add UserStatisticsGroupBySelect

Dedicated select for the user-statistics dashboard's group-by unit
(Hour / Day / Week / Month / Year). Kept separate from DateSelect,
which is coupled to RevenueTypeQuery for the revenue charts.

EOF
)"
```

---

## Task 2: i18n copy for the dashboard

**Files:**
- Modify: `src/locales/vi/customer.json`
- Modify: `src/locales/en/customer.json`

**Interfaces:**
- Produces: keys under `customer.registrationDashboard` that all downstream components read via `useTranslation('customer')`.

- [ ] **Step 1: Add Vietnamese keys**

In `src/locales/vi/customer.json`, add the following block **inside** the top-level `"customer": { ... }` object (append as the last sibling):

```jsonc
"registrationDashboard": {
  "title": "Thống kê khách hàng",
  "refresh": "Làm mới",
  "totalNewCustomers": "Tổng KH mới",
  "todayNewCustomers": "KH mới hôm nay",
  "avgPerDay": "TB / ngày",
  "growthVsPrevious": "So với kỳ trước",
  "chartTitle": "Khách hàng đăng ký mới",
  "chartSeriesName": "KH mới",
  "chartYAxisLabel": "Khách hàng mới",
  "emptyChart": "Chưa có khách hàng đăng ký trong khoảng thời gian này",
  "noPreviousData": "Không có dữ liệu kỳ trước"
}
```

- [ ] **Step 2: Add English keys**

In `src/locales/en/customer.json`, mirror the same block:

```jsonc
"registrationDashboard": {
  "title": "Customer statistics",
  "refresh": "Refresh",
  "totalNewCustomers": "Total new customers",
  "todayNewCustomers": "New customers today",
  "avgPerDay": "Avg / day",
  "growthVsPrevious": "vs previous period",
  "chartTitle": "New customer registrations",
  "chartSeriesName": "New customers",
  "chartYAxisLabel": "New customers",
  "emptyChart": "No customer registrations in the selected range",
  "noPreviousData": "No data for the previous period"
}
```

- [ ] **Step 3: Verify JSON is valid**

Run:
```bash
cd app/order-ui && node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/customer.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('src/locales/en/customer.json','utf8'))"
```

Expected: both commands exit 0 silently.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/locales/vi/customer.json app/order-ui/src/locales/en/customer.json
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (3) Add i18n for registration dashboard

EOF
)"
```

---

## Task 3: CustomerRegistrationSummary component (4 KPI cards)

**Files:**
- Create: `src/app/system/customers/components/customer-registration-summary.tsx`
- Create: `src/app/system/customers/components/index.ts` (if it does not already exist)

**Interfaces:**
- Consumes:
  - `useUserStatistics` from `@/hooks`
  - `UserStatisticsGroupBy` from `@/types`
  - `Card, CardContent, CardHeader, CardTitle, Skeleton` from `@/components/ui`
- Produces: default export `CustomerRegistrationSummary` with props `{ startDate: string; endDate: string; trigger: number }`. Renders a `grid grid-cols-2 gap-2 lg:grid-cols-4` of 4 cards.

- [ ] **Step 1: Create the component**

Create `src/app/system/customers/components/customer-registration-summary.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { UserPlus, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'

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
}

const fmtDay = (d: string | moment.Moment) => moment(d).format('YYYY-MM-DDTHH:mm:ss')

export default function CustomerRegistrationSummary({
  startDate,
  endDate,
  trigger,
}: CustomerRegistrationSummaryProps) {
  const { t } = useTranslation('customer')

  const currentParams = useMemo(
    () => ({
      startDate,
      endDate,
      groupBy: UserStatisticsGroupBy.DAY,
    }),
    [startDate, endDate],
  )

  const { previousParams } = useMemo(() => {
    const rangeDays =
      moment(endDate).startOf('day').diff(moment(startDate).startOf('day'), 'days') + 1
    return {
      previousParams: {
        startDate: fmtDay(moment(startDate).subtract(rangeDays, 'days').startOf('day')),
        endDate: fmtDay(moment(startDate).subtract(1, 'days').endOf('day')),
        groupBy: UserStatisticsGroupBy.DAY,
      },
    }
  }, [startDate, endDate])

  const currentQuery = useUserStatistics(currentParams, true)
  const previousQuery = useUserStatistics(previousParams, true)

  useEffect(() => {
    if (trigger) {
      currentQuery.refetch()
      previousQuery.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const items = currentQuery.data?.result ?? []
  const prevItems = previousQuery.data?.result ?? []
  const isLoading = currentQuery.isLoading || previousQuery.isLoading

  const total = items.reduce((sum, it) => sum + (it.count ?? 0), 0)
  const todayStr = moment().format('YYYY-MM-DD')
  const today =
    items.find((it) => moment(it.time).format('YYYY-MM-DD') === todayStr)?.count ?? 0
  const days = items.length || 1
  const avgPerDay = +(total / days).toFixed(1)
  const prevTotal = prevItems.reduce((sum, it) => sum + (it.count ?? 0), 0)
  const growthPct =
    prevTotal === 0 ? null : +(((total - prevTotal) / prevTotal) * 100).toFixed(1)

  const growthColor =
    growthPct === null
      ? 'text-muted-foreground'
      : growthPct >= 0
        ? 'text-emerald-600'
        : 'text-red-600'
  const GrowthIcon =
    growthPct === null ? TrendingUp : growthPct >= 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Card className="text-white shadow-none bg-primary">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-bold">
            {t('customer.registrationDashboard.totalNewCustomers')}
          </CardTitle>
          <UserPlus className="w-4 h-4" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">{total}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            {t('customer.registrationDashboard.todayNewCustomers')}
          </CardTitle>
          <Users className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">{today}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            {t('customer.registrationDashboard.avgPerDay')}
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold">{avgPerDay}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            {t('customer.registrationDashboard.growthVsPrevious')}
          </CardTitle>
          <GrowthIcon className={`w-4 h-4 ${growthColor}`} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : growthPct === null ? (
            <div
              className={`text-2xl font-bold ${growthColor}`}
              title={t('customer.registrationDashboard.noPreviousData') ?? ''}
            >
              —
            </div>
          ) : (
            <div className={`text-2xl font-bold ${growthColor}`}>
              {growthPct >= 0 ? '+' : ''}
              {growthPct}%
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create/update barrel**

If `src/app/system/customers/components/index.ts` does not exist, create it:

```ts
export { default as CustomerRegistrationSummary } from './customer-registration-summary'
```

If it exists, append the export line.

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
cd app/order-ui && npx tsc --noEmit && npx eslint src/app/system/customers/components/customer-registration-summary.tsx src/app/system/customers/components/index.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/customer-registration-summary.tsx app/order-ui/src/app/system/customers/components/index.ts
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (4) Add CustomerRegistrationSummary

Four KPI cards: total new customers, new today, avg per day,
and growth vs previous period. Fetches useUserStatistics twice
(current + shifted-back window) to compute growth %.

EOF
)"
```

---

## Task 4: CustomerRegistrationChart component (echarts bar)

**Files:**
- Create: `src/app/system/customers/components/customer-registration-chart.tsx`
- Modify: `src/app/system/customers/components/index.ts` (add re-export)

**Interfaces:**
- Consumes:
  - `useUserStatistics` from `@/hooks`
  - `UserStatisticsGroupBy` from `@/types`
  - `UserStatisticsGroupBySelect` from `@/components/app/select`
  - `Card, CardContent, CardHeader, CardTitle, Skeleton` from `@/components/ui`
- Produces: default export `CustomerRegistrationChart` with props `{ startDate: string; endDate: string; trigger: number }`. Renders card containing title, `UserStatisticsGroupBySelect`, and echarts bar chart. Owns local `groupBy` state (default `DAY`).

- [ ] **Step 1: Create the component**

Create `src/app/system/customers/components/customer-registration-chart.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { UserStatisticsGroupBy } from '@/types'
import { UserStatisticsGroupBySelect } from '@/components/app/select'

interface CustomerRegistrationChartProps {
  startDate: string
  endDate: string
  trigger: number
}

interface TooltipParam {
  name: string
  value: number
}

export default function CustomerRegistrationChart({
  startDate,
  endDate,
  trigger,
}: CustomerRegistrationChartProps) {
  const { t } = useTranslation('customer')
  const chartRef = useRef<HTMLDivElement>(null)
  const [groupBy, setGroupBy] = useState<UserStatisticsGroupBy>(
    UserStatisticsGroupBy.DAY,
  )

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

  const items = data?.result ?? []
  const sorted = [...items].sort(
    (a, b) => moment(a.time).valueOf() - moment(b.time).valueOf(),
  )
  const isEmpty = !isLoading && sorted.length === 0

  useEffect(() => {
    if (!chartRef.current || isEmpty || isLoading) return

    const chart = echarts.init(chartRef.current)
    const seriesName = t('customer.registrationDashboard.chartSeriesName')

    chart.setOption({
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: TooltipParam[]) =>
          `${params[0].name}<br/>${seriesName}: ${params[0].value}`,
      },
      grid: { left: 40, right: 20, top: 30, bottom: 60 },
      xAxis: {
        type: 'category',
        data: sorted.map((it) => formatDate(it.time)),
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'value',
        name: t('customer.registrationDashboard.chartYAxisLabel'),
        minInterval: 1,
        splitLine: { show: true, lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: seriesName,
          type: 'bar',
          barWidth: sorted.length === 1 ? 40 : '50%',
          data: sorted.map((it) => it.count),
          itemStyle: { color: '#f89209', borderRadius: [5, 5, 0, 0] },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', onResize)
    }
  }, [sorted, formatDate, isEmpty, isLoading, t])

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{t('customer.registrationDashboard.chartTitle')}</span>
          <UserStatisticsGroupBySelect value={groupBy} onChange={setGroupBy} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2">
        {isLoading ? (
          <Skeleton className="h-[26rem] w-full" />
        ) : isEmpty ? (
          <div className="flex flex-col gap-2 justify-center items-center h-[26rem] w-full text-muted-foreground">
            <Users className="w-10 h-10 opacity-30" />
            <span>{t('customer.registrationDashboard.emptyChart')}</span>
          </div>
        ) : (
          <div ref={chartRef} className="h-[26rem] w-full" />
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Append to barrel**

Modify `src/app/system/customers/components/index.ts` — add:

```ts
export { default as CustomerRegistrationChart } from './customer-registration-chart'
```

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
cd app/order-ui && npx tsc --noEmit && npx eslint src/app/system/customers/components/customer-registration-chart.tsx src/app/system/customers/components/index.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/customer-registration-chart.tsx app/order-ui/src/app/system/customers/components/index.ts
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (5) Add CustomerRegistrationChart

Echarts bar chart with a UserStatisticsGroupBySelect header
(HOUR / DAY / WEEK / MONTH / YEAR). Fetches useUserStatistics
independently from the summary cards so KPIs stay stable when
the user changes the chart's group unit.

EOF
)"
```

---

## Task 5: CustomerRegistrationDashboard wrapper

**Files:**
- Create: `src/app/system/customers/components/customer-registration-dashboard.tsx`
- Modify: `src/app/system/customers/components/index.ts` (add re-export)

**Interfaces:**
- Consumes:
  - `CustomerRegistrationSummary` + `CustomerRegistrationChart` from the sibling barrel
  - `TimeRangeRevenueFilter` from `@/components/app/popover`
  - `Button` from `@/components/ui`
- Produces: default export `CustomerRegistrationDashboard` with **no props**. Owns `startDate` (default = today − 6 days, `startOf('day')`), `endDate` (default = today `endOf('day')`), and `trigger` (int, incremented by Refresh). Renders header + `<CustomerRegistrationSummary />` + `<CustomerRegistrationChart />`.

- [ ] **Step 1: Create the component**

Create `src/app/system/customers/components/customer-registration-dashboard.tsx`:

```tsx
import { useState } from 'react'
import moment from 'moment'
import { RefreshCcw, SquareMenu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { TimeRangeRevenueFilter } from '@/components/app/popover'
import CustomerRegistrationSummary from './customer-registration-summary'
import CustomerRegistrationChart from './customer-registration-chart'

const fmt = (m: moment.Moment) => m.format('YYYY-MM-DDTHH:mm:ss')

export default function CustomerRegistrationDashboard() {
  const { t } = useTranslation('customer')

  const [startDate, setStartDate] = useState<string>(
    fmt(moment().subtract(6, 'days').startOf('day')),
  )
  const [endDate, setEndDate] = useState<string>(
    fmt(moment().endOf('day')),
  )
  const [trigger, setTrigger] = useState(0)

  const handleSelectDateRange = (start: string, end: string) => {
    // TimeRangeRevenueFilter emits 'YYYY-MM-DD' — normalize to full local datetime.
    setStartDate(fmt(moment(start).startOf('day')))
    setEndDate(fmt(moment(end).endOf('day')))
  }

  const handleRefresh = () => setTrigger((prev) => prev + 1)

  const rangeLabel =
    moment(startDate).format('DD/MM/YYYY') === moment(endDate).format('DD/MM/YYYY')
      ? moment(startDate).format('DD/MM/YYYY')
      : `${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}`

  return (
    <section className="flex flex-col gap-2 pb-2">
      <div className="flex flex-col gap-2 items-start w-full sm:flex-row sm:justify-between sm:items-center">
        <div className="flex gap-1 items-center px-1 text-lg">
          <SquareMenu />
          {t('customer.registrationDashboard.title')}
          <span className="px-4 py-1 ml-4 text-xs rounded-full border border-primary text-primary bg-primary/10">
            {rangeLabel}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex gap-1 items-center"
          >
            <RefreshCcw className="w-4 h-4" />
            {t('customer.registrationDashboard.refresh')}
          </Button>
          <TimeRangeRevenueFilter onApply={handleSelectDateRange} />
        </div>
      </div>

      <CustomerRegistrationSummary
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
      />

      <CustomerRegistrationChart
        startDate={startDate}
        endDate={endDate}
        trigger={trigger}
      />
    </section>
  )
}
```

- [ ] **Step 2: Verify `TimeRangeRevenueFilter` export path**

Run: `grep -n "TimeRangeRevenueFilter" app/order-ui/src/components/app/popover/index.tsx`

Expected: a line re-exporting from `./time-range-revenue-popover`. If missing, fall back to importing from `@/components/app/popover/time-range-revenue-popover`.

- [ ] **Step 3: Append to barrel**

Modify `src/app/system/customers/components/index.ts` — add:

```ts
export { default as CustomerRegistrationDashboard } from './customer-registration-dashboard'
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
cd app/order-ui && npx tsc --noEmit && npx eslint src/app/system/customers/components/customer-registration-dashboard.tsx src/app/system/customers/components/index.ts
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx app/order-ui/src/app/system/customers/components/index.ts
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (6) Add CustomerRegistrationDashboard wrapper

Owns startDate (default = today - 6 days), endDate (today), and
a refresh trigger. Renders the header (title + date range chip +
Refresh + TimeRangeRevenueFilter) with Summary and Chart below.

EOF
)"
```

---

## Task 6: Mount dashboard above DataTable in both places

**Files:**
- Modify: `src/app/system/customers/page.tsx`
- Modify: `src/components/app/tabscontent/system-customer-management.tabscontent.tsx`

**Interfaces:**
- Consumes: `CustomerRegistrationDashboard` from `@/app/system/customers/components`.

- [ ] **Step 1: Mount in `/customers` page**

Edit `src/app/system/customers/page.tsx`. Add import at the top of the imports block:

```ts
import { CustomerRegistrationDashboard } from './components'
```

Change the JSX return so the dashboard sits between the title span and the `DataTable`. Find the block:

```tsx
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('customer.title')}
      </span>
      <DataTable
```

Replace with:

```tsx
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('customer.title')}
      </span>
      <CustomerRegistrationDashboard />
      <DataTable
```

- [ ] **Step 2: Mount in staff tab**

Edit `src/components/app/tabscontent/system-customer-management.tabscontent.tsx`. Add import:

```ts
import { CustomerRegistrationDashboard } from '@/app/system/customers/components'
```

Change the JSX return. Find the block:

```tsx
  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <DataTable
```

Replace with:

```tsx
  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <CustomerRegistrationDashboard />
      <DataTable
```

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
cd app/order-ui && npx tsc --noEmit && npx eslint src/app/system/customers/page.tsx src/components/app/tabscontent/system-customer-management.tabscontent.tsx
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/app/system/customers/page.tsx app/order-ui/src/components/app/tabscontent/system-customer-management.tabscontent.tsx
git commit -m "$(cat <<'EOF'
TaskId: TRE-439-FE (7) Mount CustomerRegistrationDashboard above DataTable

Adds the dashboard on /customers page and inside the staff
customer-management tab. Existing DataTable and its filters
remain unchanged.

EOF
)"
```

---

## Task 7: Full build + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run full build**

Run: `cd app/order-ui && npm run build`

Expected: build succeeds. If it fails, read the error, fix the offending file, and commit with `TaskId: TRE-439-FE (8) Fix <thing>`.

- [ ] **Step 2: Start dev server**

Run: `cd app/order-ui && npm run dev`

Expected: server on http://localhost:5173. Set `VITE_BASE_API_URL` in `.env` first if not already set.

- [ ] **Step 3: Manual test checklist**

Open http://localhost:5173, log in as a staff user, and go to `/customers`. Verify:

1. Dashboard renders above the DataTable with a bar chart for the last 7 days and `groupBy=DAY`.
2. All 4 KPI cards render: total, today, avg/day, growth-vs-previous. Numbers are non-negative integers/decimals (or `—` for growth if the previous 7 days have zero registrations).
3. Open the `TimeRangeRevenueFilter` popover and pick a 30-day range → chart re-renders with 30 buckets, KPIs update, growth % re-computes.
4. Change the chart's group select from Ngày → Tháng → chart re-renders with month buckets. KPIs must **not** change (they stay pinned to `DAY`).
5. Click Refresh → both queries refetch (Network tab shows 2 fresh calls to `/user/statistics`).
6. Pick a range with no data (e.g. 5 years ago) → chart shows empty placeholder ("Chưa có khách hàng đăng ký..."); KPIs show `0`; growth shows `—`.
7. Navigate to the staff dashboard tab that hosts `SystemCustomerManagementTabsContent` → dashboard behaves identically.
8. Switch UI language from vi → en → all copy updates.
9. The existing DataTable, phone search input, RFID scanner, and pagination still work exactly as before. Filtering the table does not re-trigger the dashboard.

- [ ] **Step 4: Fix any regression uncovered**

If any of the above fails, land a follow-up commit `TaskId: TRE-439-FE (n) Fix <thing>` after each fix. Only mark this task done when the whole checklist passes.

- [ ] **Step 5: Final status commit note**

Nothing more to commit if all manual checks pass. Report completion to the reviewer with:

- List of commits since Task 0
- Brief note on what was verified manually
- Any deviations from the spec/plan and the reason
