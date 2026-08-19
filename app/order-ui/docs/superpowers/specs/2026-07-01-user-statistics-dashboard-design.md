# Customer Registration Statistics Dashboard — Design

**Date:** 2026-07-01
**Area:** `app/order-ui` (frontend)
**Touches:** customer management page + tab

## 1. Scope

Add a fixed-position dashboard above the customer `DataTable` that visualizes newly-registered customers over a selectable date range. The dashboard consists of:

- Header: title, current date range chip, `TimeRangeRevenueFilter` popover, Refresh button.
- 4 KPI cards.
- 1 echarts bar chart with its own group-unit selector.

The dashboard mounts in two places (identical instance):

- `src/app/system/customers/page.tsx` (route `/customers`)
- `src/components/app/tabscontent/system-customer-management.tabscontent.tsx` (staff dashboard tab)

The existing `DataTable` and its phone/RFID filters remain unchanged.

## 2. Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Thống kê khách hàng                                               │
│  [23/06 - 30/06]                          [Refresh] [Date range ▾] │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐    │
│  │ Tổng KH mới  │ KH mới hôm   │ TB / ngày    │ So với kỳ    │    │
│  │              │ nay          │              │ trước        │    │
│  │    128       │     8        │    18.3      │  ▲ +12.5%    │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┘    │
├────────────────────────────────────────────────────────────────────┤
│  Khách hàng đăng ký mới           [Đơn vị: Ngày ▾]                 │
│  ┃                                                                 │
│  ┃  █           █                                                  │
│  ┃  █    █      █     █                                            │
│  ┃  █    █    █ █     █    █                                       │
│  ┃  24/6  25/6  26/6  27/6  28/6  29/6  30/6                       │
└────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│  DataTable (unchanged: phone/RFID filters, list, pagination)       │
└────────────────────────────────────────────────────────────────────┘
```

## 3. Component architecture

Three new files under `src/app/system/customers/components/`:

```
customer-registration-dashboard.tsx   Wrapper. Owns startDate, endDate, trigger.
customer-registration-summary.tsx     4 KPI cards. Receives startDate/endDate/trigger.
customer-registration-chart.tsx       Echarts bar + DateSelect. Owns groupBy.
```

Tree and data ownership:

```
CustomerRegistrationDashboard
├── state: startDate, endDate, trigger
├── header: title chip + TimeRangeRevenueFilter + Refresh
│
├── <CustomerRegistrationSummary startDate endDate trigger />
│    └── useUserStatistics({ startDate, endDate, groupBy: DAY })
│    └── useUserStatistics({ prevStart, prevEnd, groupBy: DAY })  ← for growth %
│
└── <CustomerRegistrationChart startDate endDate trigger />
     ├── state: groupBy (default = DAY)
     ├── DateSelect  → set groupBy
     └── useUserStatistics({ startDate, endDate, groupBy })
```

Summary and Chart fetch independently. Summary is always fixed at `DAY` so KPIs remain stable when the user changes the chart's group unit.

## 4. Data flow

### 4.1 Enum

Add to `src/constants/user.constants.ts`:

```ts
export enum UserStatisticsGroupBy {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}
```

### 4.2 Types

Add to `src/types/user.type.ts`:

```ts
export interface IGetUserStatisticsRequest {
  startDate: string   // 'YYYY-MM-DDTHH:mm:ss' local time (per Swagger)
  endDate: string
  groupBy?: UserStatisticsGroupBy
}

export interface IUserStatisticsItem {
  date: string        // ISO string; bucket start
  total: number       // count of new users in bucket
}

export type IUserStatisticsResponse = IUserStatisticsItem[]
```

If the backend returns a different field name (e.g. `count`, `newUsers`), rename `total` when verifying the actual response — do not add a mapping layer.

### 4.3 API function

Add to `src/api/user.ts`:

```ts
export async function getUserStatistics(
  params: IGetUserStatisticsRequest,
): Promise<IApiResponse<IUserStatisticsResponse>> {
  const response = await http.get<IApiResponse<IUserStatisticsResponse>>(
    '/user/statistics',
    { params },
  )
  return response.data
}
```

### 4.4 Hook

Create `src/hooks/use-user-statistics.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { getUserStatistics } from '@/api'
import { QUERYKEY } from '@/constants'
import { IGetUserStatisticsRequest } from '@/types'

export const useUserStatistics = (params: IGetUserStatisticsRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.userStatistics, params],
    queryFn: () => getUserStatistics(params),
    enabled: !!params.startDate && !!params.endDate,
  })
}
```

`QUERYKEY.userStatistics` already exists at `src/constants/query.ts:47`.

Export the hook from `src/hooks/index.ts`.

### 4.5 Date format

Use `moment(...).format('YYYY-MM-DDTHH:mm:ss')` (local time, no `Z`) when serializing params. `.toISOString()` produces UTC and would misalign KPI buckets across timezones.

## 5. KPI computation (`customer-registration-summary.tsx`)

```ts
const items = data?.result ?? []

// KPI 1 — total new customers
const total = items.reduce((sum, it) => sum + it.total, 0)

// KPI 2 — new today
const todayStr = moment().format('YYYY-MM-DD')
const today = items.find(
  it => moment(it.date).format('YYYY-MM-DD') === todayStr
)?.total ?? 0

// KPI 3 — average per day
const days = items.length || 1
const avgPerDay = +(total / days).toFixed(1)

// KPI 4 — growth vs previous period
const rangeDays = moment(endDate).diff(moment(startDate), 'days') + 1
const prevStart = moment(startDate)
  .subtract(rangeDays, 'days')
  .format('YYYY-MM-DDTHH:mm:ss')
const prevEnd = moment(startDate)
  .subtract(1, 'days')
  .format('YYYY-MM-DDT23:59:59')

const { data: prevData } = useUserStatistics({
  startDate: prevStart,
  endDate: prevEnd,
  groupBy: UserStatisticsGroupBy.DAY,
})
const prevTotal = (prevData?.result ?? []).reduce((s, it) => s + it.total, 0)

const growthPct = prevTotal === 0
  ? null
  : +(((total - prevTotal) / prevTotal) * 100).toFixed(1)
```

Card 4 displays:
- `▲ +12.5%` (green) when positive
- `▼ -8.3%` (red) when negative
- `—` (grey, with tooltip "Không có dữ liệu kỳ trước") when `growthPct === null`

## 6. Chart config (`customer-registration-chart.tsx`)

Follow the echarts pattern in `src/app/system/home/components/revenue-chart.tsx:71-186`. Single bar series:

```ts
const option = {
  tooltip: {
    trigger: 'axis',
    formatter: (p) => `${p[0].name}<br/>KH mới: ${p[0].value}`,
  },
  xAxis: {
    type: 'category',
    data: sortedItems.map(it => formatDate(it.date, groupBy)),
    axisLabel: { rotate: 45 },
  },
  yAxis: {
    type: 'value',
    name: 'Khách hàng mới',
    minInterval: 1,   // integer ticks only
    splitLine: { show: true, lineStyle: { type: 'dashed' } },
  },
  series: [{
    name: 'KH mới',
    type: 'bar',
    barWidth: sortedItems.length === 1 ? 40 : '50%',
    data: sortedItems.map(it => it.total),
    itemStyle: { color: '#f89209', borderRadius: [5, 5, 0, 0] },
  }],
}
```

`formatDate` per group unit:

| Group unit | Format         |
| ---------- | -------------- |
| HOUR       | `HH:00 DD/MM`  |
| DAY        | `DD/MM`        |
| WEEK       | `Tuần w, YYYY` |
| MONTH      | `MM/YYYY`      |
| YEAR       | `YYYY`         |

### 6.1 DateSelect

`src/components/app/select/date-select.tsx` currently supports `DAILY / MONTHLY / YEARLY`. Extend it to include `HOUR` and `WEEK` so it can be reused. If extending affects other consumers (check `revenue-chart.tsx`), fall back to an inline shadcn `Select` inside the chart component instead.

## 7. States & edge cases

### 7.1 Loading

- Summary cards: render `<Skeleton />` blocks inside each card.
- Chart: render a `h-[26rem]` skeleton to preserve layout height.

### 7.2 Error

Rely on the global `QueryCache` handler in `App.tsx` for toast. No per-hook try/catch.

### 7.3 Empty

- Cards: all show `0`; growth shows `—`.
- Chart: render a centered placeholder (`Users` icon muted + text "Chưa có khách hàng đăng ký trong khoảng thời gian này"); do not init echarts.

### 7.4 Refresh

Increment `trigger` in the wrapper. Both Summary and Chart watch `trigger` in `useEffect` and call `refetch()` — pattern identical to `overview-page.tsx`.

### 7.5 Filter validation

`TimeRangeRevenueFilter` already enforces `end >= start`. No additional client-side clamps (e.g., for large ranges with `HOUR` group) — trust the backend.

### 7.6 Timezone

Serialize local time consistently:

- API params: `moment().format('YYYY-MM-DDTHH:mm:ss')`
- KPI "today" comparison: `moment().format('YYYY-MM-DD')`

### 7.7 Growth % edge cases

- `prevTotal === 0` → `null` → render `—`
- `total === 0 && prevTotal === 0` → `—`
- Previous period width matches current period in days, regardless of chart group unit

### 7.8 Persistence

None. Filter resets to the default (last 7 days, `groupBy=DAY`) on every mount. If usage patterns later warrant persistence, upgrade to a Zustand store mirroring `useOverviewFilterStore`.

## 8. Files touched

**New:**

- `src/hooks/use-user-statistics.ts`
- `src/app/system/customers/components/customer-registration-dashboard.tsx`
- `src/app/system/customers/components/customer-registration-summary.tsx`
- `src/app/system/customers/components/customer-registration-chart.tsx`

**Modified:**

- `src/api/user.ts` — add `getUserStatistics`
- `src/types/user.type.ts` — add request/response interfaces
- `src/constants/user.constants.ts` — add `UserStatisticsGroupBy` enum
- `src/hooks/index.ts` — re-export `use-user-statistics`
- `src/app/system/customers/page.tsx` — mount `<CustomerRegistrationDashboard />` above `<DataTable />`
- `src/components/app/tabscontent/system-customer-management.tabscontent.tsx` — mount `<CustomerRegistrationDashboard />` above `<DataTable />`

**Conditionally modified:**

- `src/components/app/select/date-select.tsx` — extend with `HOUR` and `WEEK` options if reused

## 9. i18n

Extend `public/locales/{vi,en}/customer.json`:

```jsonc
"customer.registrationDashboard": {
  "title": "Thống kê khách hàng",
  "totalNewCustomers": "Tổng KH mới",
  "todayNewCustomers": "KH mới hôm nay",
  "avgPerDay": "TB / ngày",
  "growthVsPrevious": "So với kỳ trước",
  "chartTitle": "Khách hàng đăng ký mới",
  "emptyChart": "Chưa có khách hàng đăng ký trong khoảng thời gian này",
  "noPreviousData": "Không có dữ liệu kỳ trước"
}
```

## 10. Manual test plan

1. Navigate to `/customers`. Dashboard renders above the table with the default 7-day range and a bar chart.
2. Open the date-range popover, pick a 30-day range → all 4 KPIs + chart update.
3. Change `DateSelect` from Day → Month → chart re-renders with month buckets; **KPIs do not change**.
4. Click `Refresh` → both queries refetch (verify in Network tab).
5. Pick a range with no registrations → chart shows empty placeholder; KPIs show `0`; growth shows `—`.
6. Navigate to the staff dashboard tab "Customer management" → dashboard behaves identically.
7. Verify locale switch (vi/en) applies to all new copy.

## 11. Out of scope

- Automated tests (project has no test coverage for these pages currently).
- Persisting filter state across sessions.
- Adding cumulative/total-user line to the chart.
- Segmenting by membership card / role — this dashboard is customer registrations only.
