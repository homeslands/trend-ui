# Customer Spending Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghép thống kê chi tiêu khách hàng (`/revenue/account`) vào chung tab Khách hàng với thống kê khách mới, dùng bố cục hai panel biểu đồ căn chung trục thời gian.

**Architecture:** Một component `CustomerAnalyticsPanel` sở hữu toàn bộ bộ lọc (đọc/ghi URL qua `useCustomerAnalyticsFilters`) và render: hàng KPI gộp → thanh phân bổ phương thức → một instance ECharts chứa **hai grid xếp chồng dùng chung nhãn trục X** (mỗi grid một trục Y riêng). Bên dưới là khu bảng có switch độc lập `[Danh bạ | Chi tiêu]`. Logic thuần (bucket hoá, KPI, CSV) tách khỏi component để test bằng Vitest không cần render.

**Tech Stack:** React 18 + TypeScript, TanStack Query, ECharts 5.6, moment, react-router-dom (URL state), Tailwind + shadcn/Radix, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-17-customer-spending-dashboard-design.md`

## Global Constraints

- **KHÔNG BAO GIỜ vẽ hai thang Y trong một plot.** Hai đại lượng (khách / tiền) = hai grid ECharts riêng, mỗi grid một `yAxis`, dùng chung nhãn trục X. Đây là ràng buộc cứng của spec.
- **KPI chuyển đổi phải ẩn khi `customerType !== 'new-register'`** — mẫu số không khớp tử số, hiển thị là số sai.
- **Không thêm dependency mới.** Repo chưa có xlsx/sheetjs → export bằng CSV client-side.
- **Định dạng `time` dùng `'YYYY-MM-DDTHH:mm:ss'`** (local, không timezone) — khớp `/user/statistics` để `fillTimeBuckets` dùng chung được.
- **URL lưu ngày dạng `'YYYY-MM-DD'`**; chuyển sang datetime đầy đủ khi gọi API (`moment(from).startOf('day')` / `moment(to).endOf('day')`) — theo đúng pattern đang có ở `system-customer-management.tabscontent.tsx:40-41`.
- **Màu series (đã chạy validator):** light `#f89209` (khách mới) / `#2a78d6` (chi tiêu) / `#cbd5e1` (kỳ trước); dark `#c97a07` / `#3987e5` / `#4d5561`. Bước dark là **re-step cho nền tối**, không phải lật máy móc.
- **Màu thanh phương thức (đã chạy validator):** light `#2a78d6` / `#1baf7a` / `#eda100` / `#4a3aa7`; dark `#3987e5` / `#199e70` / `#c98500` / `#9085e9`. **Mọi màu biểu đồ phải lấy từ `chart-colors.ts`** — không hardcode hex trong component.
- **Thanh phương thức bắt buộc có nhãn % + số tiền.** Ở light mode 2 trong 4 hue nằm dưới 3:1 contrast; nhãn là phần relief bù lại, không được bỏ.
- **`ICustomerAccountRevenue.data` là optional** — BE chưa deploy `groupBy` thì `undefined`; panel chi tiêu phải hiện empty state, không được vỡ.
- **API trả về mảng:** `getCustomerAccountRevenue` → `IApiResponse<ICustomerAccountRevenue[]>`. Luôn đọc `data?.result?.[0]`.
- **i18n:** mọi chuỗi hiển thị lấy từ `src/locales/vi/customer.json` + `src/locales/en/customer.json`, namespace `customer`.
- **Lệnh:** `npx vitest run <file>` (test lẻ), `npm run lint`, `npx tsc -b` (typecheck).

### Quyết định mặc định (khác hành vi hiện tại — reviewer chú ý)

Dashboard hiện mặc định preset `allTime` (→ `groupBy=year`). Plan này đổi mặc định thành **`last30Days` + `groupBy=day`**. Lý do: với bố cục C, mở tab sẽ bắn cả query chi tiêu; `allTime` nghĩa là quét toàn bộ doanh thu từ 2020 ngay khi mở tab. `last30Days` là mặc định phân tích hữu dụng hơn và nhẹ hơn nhiều. Preset `allTime` vẫn còn trong danh sách chip, chỉ không còn là mặc định.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/types/revenue.type.ts` | *(sửa)* thêm `groupBy` vào query, `data` vào response |
| `src/constants/query.ts` | *(sửa)* thêm query key `customerAccountRevenue` |
| `src/hooks/use-revenue.ts` | *(sửa)* `useCustomerAccountRevenue(q, enabled)` |
| `src/utils/fill-spending-buckets.ts` | bucket hoá chuỗi tiền, tái dùng `fillTimeBuckets` |
| `src/app/system/customers/components/analytics/spending-kpis.ts` | logic KPI thuần + ràng buộc chuyển đổi |
| `src/app/system/customers/components/analytics/spending-csv.ts` | sinh CSV thuần |
| `src/app/system/customers/components/analytics/chart-colors.ts` | màu series theo theme |
| `src/app/system/customers/components/analytics/customer-analytics-chart.tsx` | ECharts 2 grid chung trục X |
| `src/app/system/customers/components/analytics/customer-analytics-summary.tsx` | KPI gộp + thanh phương thức |
| `src/app/system/customers/components/analytics/customer-spending-table.tsx` | bảng `customer[]` + nút CSV |
| `src/app/system/customers/components/analytics/customer-analytics-panel.tsx` | toolbar + ghép tất cả |
| `src/app/system/customers/hooks/use-customer-analytics-filters.ts` | URL state của panel |
| `src/app/system/customers/DataTable/columns/customer-spending-columns.tsx` | cột bảng chi tiêu |
| `src/components/app/tabscontent/system-customer-management.tabscontent.tsx` | *(sửa)* ghép panel + switch bảng |

---

### Task 1: Hợp đồng API — types, query key, hook

**Files:**
- Modify: `app/order-ui/src/types/revenue.type.ts:40-71`
- Modify: `app/order-ui/src/constants/query.ts:23`
- Modify: `app/order-ui/src/hooks/use-revenue.ts:41-47`

**Interfaces:**
- Produces: `ICustomerAccountRevenueTimeItem { time: string; totalAmount: number }`; `ICustomerAccountRevenueQuery.groupBy?: UserStatisticsGroupBy`; `ICustomerAccountRevenue.data?: ICustomerAccountRevenueTimeItem[]`; `useCustomerAccountRevenue(q: ICustomerAccountRevenueQuery, enabled?: boolean)`.

- [ ] **Step 1: Thêm types**

Trong `src/types/revenue.type.ts`, thêm import và sửa 2 interface:

```ts
import { PaymentMethod, RevenueTypeQuery } from '@/constants'
import { IBase } from './base.type'
import { UserStatisticsGroupBy } from './user.type'

export interface ICustomerAccountRevenueTimeItem {
  time: string
  totalAmount: number
}

export interface ICustomerAccountRevenueQuery {
  startDate?: string
  endDate?: string
  branch?: string
  paymentMethod?: PaymentMethod
  phonenumber?: string
  customerType?: CustomerAccountRevenueType
  groupBy?: UserStatisticsGroupBy
}

export interface ICustomerAccountRevenue extends IBase {
  summary: {
    totalAmount: number,
    totalAmountBank: number,
    totalAmountCash: number,
    totalAmountPoint: number,
    totalAmountCreditCard: number,
    percentPoint: number,
    percentCash: number,
    percentBank: number,
    percentCreditCard: number,
  }
  customer: {
    customerSlug: string,
    customerName: string,
    customerRegisteredAt: string,
    totalAmount: number,
    totalAmountPoint: number,
    totalAmountCash: number,
    totalAmountBank: number,
    totalAmountCreditCard: number,
  }[]
  // Optional: BE chưa deploy groupBy thì field này undefined → panel chart hiện empty state.
  data?: ICustomerAccountRevenueTimeItem[]
}
```

- [ ] **Step 2: Thêm query key**

Trong `src/constants/query.ts`, ngay dưới dòng `revenue: ['revenue'],` thêm:

```ts
  customerAccountRevenue: ['customerAccountRevenue'],
```

- [ ] **Step 3: Sửa hook nhận `enabled`**

Trong `src/hooks/use-revenue.ts`, thay hàm `useCustomerAccountRevenue`:

```ts
export const useCustomerAccountRevenue = (
  q: ICustomerAccountRevenueQuery,
  enabled = true,
) => {
  return useQuery({
    queryKey: [QUERYKEY.customerAccountRevenue, JSON.stringify(q)],
    queryFn: () => getCustomerAccountRevenue(q),
    placeholderData: keepPreviousData,
    enabled,
  })
}
```

- [ ] **Step 4: Typecheck**

Run: `cd app/order-ui && npx tsc -b`
Expected: không lỗi. (Nếu báo `UserStatisticsGroupBy` không export từ `./user.type` → kiểm tra lại, enum nằm ở `src/types/user.type.ts:6`.)

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/types/revenue.type.ts app/order-ui/src/constants/query.ts app/order-ui/src/hooks/use-revenue.ts
git commit -m "TaskId: 441-FE (1) Add groupBy contract to customer account revenue"
```

---

### Task 2: `fillSpendingBuckets` — bucket hoá chuỗi tiền

Chuỗi chi tiêu là `{ time, totalAmount }` còn `fillTimeBuckets` đã có nhận `{ time, count }`. Thay vì viết lại logic bucket (đã test kỹ), bọc một adapter mỏng.

**Files:**
- Create: `app/order-ui/src/utils/fill-spending-buckets.ts`
- Test: `app/order-ui/src/utils/__tests__/fill-spending-buckets.test.ts`
- Modify: `app/order-ui/src/utils/index.ts` (thêm export)

**Interfaces:**
- Consumes: `fillTimeBuckets` từ `./fill-time-buckets`; `ICustomerAccountRevenueTimeItem` (Task 1).
- Produces: `fillSpendingBuckets(data: ICustomerAccountRevenueTimeItem[], startDate: string, endDate: string, groupBy: UserStatisticsGroupBy): ICustomerAccountRevenueTimeItem[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `app/order-ui/src/utils/__tests__/fill-spending-buckets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fillSpendingBuckets } from '../fill-spending-buckets'
import { UserStatisticsGroupBy } from '@/types'

describe('fillSpendingBuckets', () => {
  it('fills missing day buckets with 0', () => {
    const data = [
      { time: '2026-07-01T00:00:00', totalAmount: 150000 },
      { time: '2026-07-04T00:00:00', totalAmount: 220000 },
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-04T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r).toHaveLength(4)
    expect(r.map((x) => x.totalAmount)).toEqual([150000, 0, 0, 220000])
    expect(r[0].time).toBe('2026-07-01T00:00:00')
  })

  it('sums amounts landing in the same bucket', () => {
    const data = [
      { time: '2026-07-01T03:00:00', totalAmount: 100 },
      { time: '2026-07-01T20:00:00', totalAmount: 50 },
    ]
    const r = fillSpendingBuckets(
      data,
      '2026-07-01T00:00:00',
      '2026-07-01T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r).toHaveLength(1)
    expect(r[0].totalAmount).toBe(150)
  })

  it('returns a copy of data when range is missing', () => {
    const data = [{ time: '2026-07-01T00:00:00', totalAmount: 10 }]
    expect(fillSpendingBuckets(data, '', '', UserStatisticsGroupBy.DAY)).toEqual(data)
  })

  it('returns all-zero buckets for empty data', () => {
    const r = fillSpendingBuckets(
      [],
      '2026-07-01T00:00:00',
      '2026-07-03T23:59:59',
      UserStatisticsGroupBy.DAY,
    )
    expect(r.map((x) => x.totalAmount)).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd app/order-ui && npx vitest run src/utils/__tests__/fill-spending-buckets.test.ts`
Expected: FAIL — `Failed to resolve import "../fill-spending-buckets"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `app/order-ui/src/utils/fill-spending-buckets.ts`:

```ts
import { ICustomerAccountRevenueTimeItem, UserStatisticsGroupBy } from '@/types'

import { fillTimeBuckets } from './fill-time-buckets'

/**
 * Điền đủ mốc thời gian cho chuỗi CHI TIÊU, tái dùng nguyên logic bucket của
 * `fillTimeBuckets` (mốc thiếu = 0, gộp nếu trùng bucket) bằng cách ánh xạ
 * totalAmount <-> count. Giữ một nguồn sự thật duy nhất cho việc chia bucket.
 */
export function fillSpendingBuckets(
  data: ICustomerAccountRevenueTimeItem[],
  startDate: string,
  endDate: string,
  groupBy: UserStatisticsGroupBy,
): ICustomerAccountRevenueTimeItem[] {
  const asCounts = data.map((d) => ({ time: d.time, count: d.totalAmount }))
  return fillTimeBuckets(asCounts, startDate, endDate, groupBy).map((b) => ({
    time: b.time,
    totalAmount: b.count,
  }))
}
```

- [ ] **Step 4: Thêm export vào barrel**

Trong `app/order-ui/src/utils/index.ts`, thêm dòng cuối:

```ts
export * from './fill-spending-buckets'
```

- [ ] **Step 5: Chạy test để chắc chắn nó pass**

Run: `cd app/order-ui && npx vitest run src/utils/__tests__/fill-spending-buckets.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add app/order-ui/src/utils/fill-spending-buckets.ts app/order-ui/src/utils/__tests__/fill-spending-buckets.test.ts app/order-ui/src/utils/index.ts
git commit -m "TaskId: 441-FE (2) Add fillSpendingBuckets util"
```

---

### Task 3: `spending-kpis.ts` — logic KPI + ràng buộc chuyển đổi

Đây là nơi ràng buộc quan trọng nhất của spec sống: **KPI chuyển đổi chỉ có nghĩa khi lọc `new-register`**.

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/spending-kpis.ts`
- Test: `app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-kpis.test.ts`

**Interfaces:**
- Consumes: `ICustomerAccountRevenue`, `CustomerAccountRevenueType` (Task 1).
- Produces:
  - `computeSpendingKpis(input: SpendingKpiInput): SpendingKpis`
  - `SpendingKpiInput { revenue?: ICustomerAccountRevenue; newCustomerTotal?: number; customerType: CustomerAccountRevenueType }`
  - `SpendingKpis { totalAmount: number; spendingCustomers: number; avgPerCustomer: number; conversion: number | null }`
  - `computePaymentMix(summary?: ICustomerAccountRevenue['summary']): PaymentMixSegment[]`
  - `PaymentMixSegment { key: 'bank' | 'cash' | 'point' | 'credit'; percent: number; amount: number }`
  - `isSpendingSeriesUnavailable(revenue: ICustomerAccountRevenue | undefined, isLoading: boolean): boolean`

- [ ] **Step 1: Viết test thất bại**

Tạo `app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-kpis.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CustomerAccountRevenueType, ICustomerAccountRevenue } from '@/types'
import {
  computeSpendingKpis,
  computePaymentMix,
  isSpendingSeriesUnavailable,
} from '../spending-kpis'

const summary: ICustomerAccountRevenue['summary'] = {
  totalAmount: 1000,
  totalAmountBank: 420,
  totalAmountCash: 280,
  totalAmountPoint: 190,
  totalAmountCreditCard: 110,
  percentBank: 42,
  percentCash: 28,
  percentPoint: 19,
  percentCreditCard: 11,
}

const makeRevenue = (customerCount: number): ICustomerAccountRevenue =>
  ({
    summary,
    customer: Array.from({ length: customerCount }, (_, i) => ({
      customerSlug: `c${i}`,
      customerName: `KH ${i}`,
      customerRegisteredAt: '2026-07-01T00:00:00',
      totalAmount: 100,
      totalAmountPoint: 10,
      totalAmountCash: 30,
      totalAmountBank: 50,
      totalAmountCreditCard: 10,
    })),
  }) as ICustomerAccountRevenue

describe('computeSpendingKpis', () => {
  it('computes conversion when filtering new-register', () => {
    const r = computeSpendingKpis({
      revenue: makeRevenue(8),
      newCustomerTotal: 10,
      customerType: CustomerAccountRevenueType.NEW_REGISTER,
    })
    expect(r.totalAmount).toBe(1000)
    expect(r.spendingCustomers).toBe(8)
    expect(r.avgPerCustomer).toBe(125)
    expect(r.conversion).toBe(80)
  })

  it('returns null conversion when customerType is ALL (denominator mismatch)', () => {
    const r = computeSpendingKpis({
      revenue: makeRevenue(8),
      newCustomerTotal: 10,
      customerType: CustomerAccountRevenueType.ALL,
    })
    expect(r.conversion).toBeNull()
    expect(r.spendingCustomers).toBe(8)
  })

  it('returns null conversion when there are no new customers (no divide by zero)', () => {
    const r = computeSpendingKpis({
      revenue: makeRevenue(0),
      newCustomerTotal: 0,
      customerType: CustomerAccountRevenueType.NEW_REGISTER,
    })
    expect(r.conversion).toBeNull()
    expect(r.avgPerCustomer).toBe(0)
  })

  it('caps conversion at 100 when spenders exceed new customers', () => {
    const r = computeSpendingKpis({
      revenue: makeRevenue(12),
      newCustomerTotal: 10,
      customerType: CustomerAccountRevenueType.NEW_REGISTER,
    })
    expect(r.conversion).toBe(100)
  })

  it('handles missing revenue (not loaded yet)', () => {
    const r = computeSpendingKpis({
      revenue: undefined,
      newCustomerTotal: 10,
      customerType: CustomerAccountRevenueType.NEW_REGISTER,
    })
    expect(r.totalAmount).toBe(0)
    expect(r.spendingCustomers).toBe(0)
    expect(r.avgPerCustomer).toBe(0)
    expect(r.conversion).toBeNull()
  })
})

describe('computePaymentMix', () => {
  it('returns four segments ordered by percent desc', () => {
    const mix = computePaymentMix(summary)
    expect(mix.map((s) => s.key)).toEqual(['bank', 'cash', 'point', 'credit'])
    expect(mix[0]).toEqual({ key: 'bank', percent: 42, amount: 420 })
  })

  it('drops zero segments', () => {
    const mix = computePaymentMix({ ...summary, percentPoint: 0, totalAmountPoint: 0 })
    expect(mix.map((s) => s.key)).toEqual(['bank', 'cash', 'credit'])
  })

  it('returns empty array when summary missing', () => {
    expect(computePaymentMix(undefined)).toEqual([])
  })
})

describe('isSpendingSeriesUnavailable', () => {
  it('is false while still loading', () => {
    expect(isSpendingSeriesUnavailable(undefined, true)).toBe(false)
  })

  it('is true when BE returned no data field (groupBy not deployed)', () => {
    expect(isSpendingSeriesUnavailable(makeRevenue(3), false)).toBe(true)
  })

  it('is false when BE returned a data array, even an empty one', () => {
    const revenue = { ...makeRevenue(3), data: [] } as ICustomerAccountRevenue
    expect(isSpendingSeriesUnavailable(revenue, false)).toBe(false)
  })

  it('is true when the response itself is missing after loading', () => {
    expect(isSpendingSeriesUnavailable(undefined, false)).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/analytics/__tests__/spending-kpis.test.ts`
Expected: FAIL — `Failed to resolve import "../spending-kpis"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `app/order-ui/src/app/system/customers/components/analytics/spending-kpis.ts`:

```ts
import { CustomerAccountRevenueType, ICustomerAccountRevenue } from '@/types'

export interface SpendingKpiInput {
  revenue?: ICustomerAccountRevenue
  newCustomerTotal?: number
  customerType: CustomerAccountRevenueType
}

export interface SpendingKpis {
  totalAmount: number
  spendingCustomers: number
  avgPerCustomer: number
  /** null = không hiển thị được (xem ghi chú bên dưới) */
  conversion: number | null
}

export type PaymentMixKey = 'bank' | 'cash' | 'point' | 'credit'

export interface PaymentMixSegment {
  key: PaymentMixKey
  percent: number
  amount: number
}

/**
 * KPI chuyển đổi ghép từ HAI nguồn: tử số là customer[] của /revenue/account,
 * mẫu số là total của /user/statistics. Nó chỉ có nghĩa khi đang lọc
 * `new-register` — khi đó tử số mới thật sự là "khách mới có chi tiêu".
 * Với `all`, tử số là "mọi khách có chi tiêu" trong khi mẫu số vẫn là "khách mới
 * trong kỳ" → tỉ lệ vô nghĩa (có thể vượt 100% một cách khó hiểu). Trả null để
 * tầng UI ẩn hẳn KPI thay vì hiển thị số sai.
 */
export function computeSpendingKpis({
  revenue,
  newCustomerTotal,
  customerType,
}: SpendingKpiInput): SpendingKpis {
  const totalAmount = revenue?.summary?.totalAmount ?? 0
  const spendingCustomers = revenue?.customer?.length ?? 0
  const avgPerCustomer = spendingCustomers
    ? Math.round(totalAmount / spendingCustomers)
    : 0

  const canComputeConversion =
    customerType === CustomerAccountRevenueType.NEW_REGISTER &&
    !!newCustomerTotal &&
    newCustomerTotal > 0

  const conversion = canComputeConversion
    ? Math.min(100, +((spendingCustomers / newCustomerTotal) * 100).toFixed(1))
    : null

  return { totalAmount, spendingCustomers, avgPerCustomer, conversion }
}

export function computePaymentMix(
  summary?: ICustomerAccountRevenue['summary'],
): PaymentMixSegment[] {
  if (!summary) return []
  const segments: PaymentMixSegment[] = [
    { key: 'bank', percent: summary.percentBank, amount: summary.totalAmountBank },
    { key: 'cash', percent: summary.percentCash, amount: summary.totalAmountCash },
    { key: 'point', percent: summary.percentPoint, amount: summary.totalAmountPoint },
    { key: 'credit', percent: summary.percentCreditCard, amount: summary.totalAmountCreditCard },
  ]
  return segments.filter((s) => s.percent > 0)
}

/**
 * Chuỗi thời gian chi tiêu chỉ tồn tại khi BE đã deploy param `groupBy`. Phân biệt
 * "chưa deploy" (field `data` vắng mặt) với "kỳ này không ai tiêu" (`data: []`) —
 * cái sau là dữ liệu hợp lệ và phải vẽ ra các cột 0, không phải báo thiếu tính năng.
 */
export function isSpendingSeriesUnavailable(
  revenue: ICustomerAccountRevenue | undefined,
  isLoading: boolean,
): boolean {
  if (isLoading) return false
  return revenue?.data === undefined
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/analytics/__tests__/spending-kpis.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/spending-kpis.ts app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-kpis.test.ts
git commit -m "TaskId: 441-FE (3) Add spending KPI logic with conversion guard"
```

---

### Task 4: `spending-csv.ts` — sinh CSV

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/spending-csv.ts`
- Test: `app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-csv.test.ts`

**Interfaces:**
- Consumes: `ICustomerAccountRevenue` (Task 1).
- Produces: `buildSpendingCsv(rows: ICustomerAccountRevenue['customer'], headers: string[]): string`

- [ ] **Step 1: Viết test thất bại**

Tạo `app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSpendingCsv } from '../spending-csv'

const HEADERS = ['Khách hàng', 'Ngày ĐK', 'Tổng chi', 'Bank', 'Cash', 'Point', 'Credit']

const row = (customerName: string) => ({
  customerSlug: 'c1',
  customerName,
  customerRegisteredAt: '2026-07-01T08:30:00',
  totalAmount: 1000,
  totalAmountBank: 500,
  totalAmountCash: 300,
  totalAmountPoint: 150,
  totalAmountCreditCard: 50,
})

describe('buildSpendingCsv', () => {
  it('writes header then one line per row', () => {
    const csv = buildSpendingCsv([row('Nguyen Van An')], HEADERS)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Khách hàng,Ngày ĐK,Tổng chi,Bank,Cash,Point,Credit')
    expect(lines[1]).toBe('Nguyen Van An,01/07/2026,1000,500,300,150,50')
  })

  it('quotes and escapes a name containing a comma', () => {
    const csv = buildSpendingCsv([row('An, Nguyen')], HEADERS)
    expect(csv.split('\n')[1]).toContain('"An, Nguyen"')
  })

  it('doubles embedded double quotes', () => {
    const csv = buildSpendingCsv([row('An "Bo" Nguyen')], HEADERS)
    expect(csv.split('\n')[1]).toContain('"An ""Bo"" Nguyen"')
  })

  it('quotes a name containing a newline', () => {
    const csv = buildSpendingCsv([row('An\nNguyen')], HEADERS)
    expect(csv).toContain('"An\nNguyen"')
  })

  it('returns only the header for an empty list', () => {
    expect(buildSpendingCsv([], HEADERS)).toBe(HEADERS.join(','))
  })
})
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/analytics/__tests__/spending-csv.test.ts`
Expected: FAIL — `Failed to resolve import "../spending-csv"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `app/order-ui/src/app/system/customers/components/analytics/spending-csv.ts`:

```ts
import moment from 'moment'

import { ICustomerAccountRevenue } from '@/types'

type SpendingRow = ICustomerAccountRevenue['customer'][number]

/** Bọc nháy kép khi ô chứa dấu phẩy, nháy kép hoặc xuống dòng; nháy kép bên trong nhân đôi. */
const escapeCell = (value: string | number): string => {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildSpendingCsv(
  rows: SpendingRow[],
  headers: string[],
): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        escapeCell(r.customerName),
        escapeCell(moment(r.customerRegisteredAt).format('DD/MM/YYYY')),
        r.totalAmount,
        r.totalAmountBank,
        r.totalAmountCash,
        r.totalAmountPoint,
        r.totalAmountCreditCard,
      ].join(','),
    )
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/analytics/__tests__/spending-csv.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/spending-csv.ts app/order-ui/src/app/system/customers/components/analytics/__tests__/spending-csv.test.ts
git commit -m "TaskId: 441-FE (4) Add spending CSV builder"
```

---

### Task 5: `useCustomerAnalyticsFilters` — URL state

**Files:**
- Create: `app/order-ui/src/app/system/customers/hooks/use-customer-analytics-filters.ts`
- Test: `app/order-ui/src/app/system/customers/hooks/__tests__/use-customer-analytics-filters.test.tsx`
- Modify: `app/order-ui/src/app/system/customers/hooks/index.ts`

**Interfaces:**
- Consumes: `UserStatisticsGroupBy`, `CustomerAccountRevenueType`, `PaymentMethod`.
- Produces: `useCustomerAnalyticsFilters(): CustomerAnalyticsFilters` — xem interface trong Step 3.

- [ ] **Step 1: Viết test thất bại**

Tạo `app/order-ui/src/app/system/customers/hooks/__tests__/use-customer-analytics-filters.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
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
    expect(result.current.filters.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.filters.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.filters.customerType).toBe(CustomerAccountRevenueType.NEW_REGISTER)
    expect(result.current.filters.compareEnabled).toBe(false)
    expect(result.current.filters.table).toBe('dir')
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

  it('setDateRange writes from/to', () => {
    const { result } = renderWithUrl('/?from=2026-01-01&to=2026-01-31')
    act(() => result.current.filters.setDateRange('2026-07-01', '2026-07-14'))
    expect(result.current.sp.get('from')).toBe('2026-07-01')
    expect(result.current.sp.get('to')).toBe('2026-07-14')
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
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/hooks/__tests__/use-customer-analytics-filters.test.tsx`
Expected: FAIL — `Failed to resolve import "../use-customer-analytics-filters"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `app/order-ui/src/app/system/customers/hooks/use-customer-analytics-filters.ts`:

```ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import moment from 'moment'

import { CustomerAccountRevenueType, UserStatisticsGroupBy } from '@/types'

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

export interface CustomerAnalyticsFilters {
  from: string
  to: string
  groupBy: UserStatisticsGroupBy
  compareEnabled: boolean
  compareFrom: string
  compareTo: string
  branch: string
  paymentMethod: string
  customerType: CustomerAccountRevenueType
  phone: string
  table: AnalyticsTable
  setDateRange: (from: string, to: string) => void
  setGroupBy: (groupBy: UserStatisticsGroupBy) => void
  setCompare: (enabled: boolean, from?: string, to?: string) => void
  setBranch: (value: string) => void
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

  const rawCtype = searchParams.get('ctype') || ''
  const customerType = (CUSTOMER_TYPE_VALUES.includes(rawCtype)
    ? rawCtype
    : CustomerAccountRevenueType.NEW_REGISTER) as CustomerAccountRevenueType

  const compareEnabled = searchParams.get('cmp') === '1'
  const compareFrom = searchParams.get('cfrom') || ''
  const compareTo = searchParams.get('cto') || ''
  const branch = searchParams.get('branch') || ''
  const paymentMethod = searchParams.get('pm') || ''
  const phone = searchParams.get('phone') || ''
  const table = (searchParams.get('tbl') === 'spend' ? 'spend' : 'dir') as AnalyticsTable

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

  const setDateRange = useCallback(
    (fromValue: string, toValue: string) =>
      update((params) => {
        setOrDelete(params, 'from', fromValue)
        setOrDelete(params, 'to', toValue)
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
    (value: string) => update((params) => setOrDelete(params, 'branch', value)),
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

  const setPhone = useCallback(
    (value: string) => update((params) => setOrDelete(params, 'phone', value)),
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
      from, to, groupBy, compareEnabled, compareFrom, compareTo,
      branch, paymentMethod, customerType, phone, table,
      setDateRange, setGroupBy, setCompare, setBranch,
      setPaymentMethod, setCustomerType, setPhone, setTable, reset,
    }),
    [
      from, to, groupBy, compareEnabled, compareFrom, compareTo,
      branch, paymentMethod, customerType, phone, table,
      setDateRange, setGroupBy, setCompare, setBranch,
      setPaymentMethod, setCustomerType, setPhone, setTable, reset,
    ],
  )
}
```

- [ ] **Step 4: Thêm export vào barrel**

Trong `app/order-ui/src/app/system/customers/hooks/index.ts`, thêm:

```ts
export * from './use-customer-analytics-filters'
```

- [ ] **Step 5: Chạy test để chắc chắn nó pass**

Run: `cd app/order-ui && npx vitest run src/app/system/customers/hooks/__tests__/use-customer-analytics-filters.test.tsx`
Expected: PASS — 10 tests.

- [ ] **Step 6: Commit**

```bash
git add app/order-ui/src/app/system/customers/hooks/use-customer-analytics-filters.ts app/order-ui/src/app/system/customers/hooks/__tests__/use-customer-analytics-filters.test.tsx app/order-ui/src/app/system/customers/hooks/index.ts
git commit -m "TaskId: 441-FE (5) Add customer analytics URL filters hook"
```

---

### Task 6: Khoá i18n

Gom toàn bộ chuỗi hiển thị của tính năng vào một chỗ để các task UI phía sau dùng ngay.

**Files:**
- Modify: `app/order-ui/src/locales/vi/customer.json`
- Modify: `app/order-ui/src/locales/en/customer.json`

**Interfaces:**
- Produces: các khoá dưới `customer.analytics.*`, dùng bởi Task 7–10.

- [ ] **Step 1: Thêm khoá tiếng Việt**

Trong `app/order-ui/src/locales/vi/customer.json`, thêm vào object `customer` (giữ nguyên các khoá sẵn có):

```json
"analytics": {
  "title": "Khách mới & chi tiêu",
  "chartTitle": "Khách mới và chi tiêu theo thời gian",
  "seriesNewCustomers": "Khách mới",
  "seriesSpending": "Chi tiêu",
  "seriesPrevious": "Kỳ trước",
  "trendLine": "Xu hướng",
  "axisCustomers": "khách",
  "axisAmount": "đồng",
  "totalNewCustomers": "Khách mới",
  "totalSpending": "Tổng chi tiêu",
  "spendingCustomers": "Khách có chi tiêu",
  "conversion": "Khách mới có chi tiêu",
  "conversionHint": "{{count}} / {{total}} khách mới",
  "avgPerCustomer": "TB mỗi khách",
  "paymentMix": "Phân bổ theo phương thức",
  "paymentBank": "Chuyển khoản",
  "paymentCash": "Tiền mặt",
  "paymentPoint": "Điểm",
  "paymentCredit": "Thẻ tín dụng",
  "filterBranch": "Chi nhánh",
  "filterPaymentMethod": "Phương thức",
  "filterCustomerType": "Loại khách",
  "filterPhone": "Số điện thoại",
  "customerTypeAll": "Tất cả khách",
  "customerTypeNewRegister": "Khách mới đăng ký",
  "allBranches": "Tất cả chi nhánh",
  "allPaymentMethods": "Tất cả phương thức",
  "scopeShared": "Áp dụng cho cả hai biểu đồ",
  "scopeSpending": "Chỉ áp dụng cho chi tiêu",
  "reset": "Đặt lại bộ lọc chi tiêu",
  "refresh": "Tải lại",
  "tableDirectory": "Danh bạ",
  "tableSpending": "Chi tiêu",
  "exportCsv": "Xuất CSV",
  "spendingTableTitle": "Chi tiêu theo khách",
  "colCustomer": "Khách hàng",
  "colRegisteredAt": "Ngày đăng ký",
  "colTotal": "Tổng chi",
  "colBank": "Chuyển khoản",
  "colCash": "Tiền mặt",
  "colPoint": "Điểm",
  "colCredit": "Thẻ tín dụng",
  "emptySpendingChart": "Chưa có dữ liệu chi tiêu trong khoảng này",
  "emptySpendingTable": "Không có khách nào chi tiêu trong khoảng này",
  "csvFileName": "chi-tieu-khach-hang"
}
```

- [ ] **Step 2: Thêm khoá tiếng Anh**

Trong `app/order-ui/src/locales/en/customer.json`, thêm vào object `customer`:

```json
"analytics": {
  "title": "New customers & spending",
  "chartTitle": "New customers and spending over time",
  "seriesNewCustomers": "New customers",
  "seriesSpending": "Spending",
  "seriesPrevious": "Previous period",
  "trendLine": "Trend",
  "axisCustomers": "customers",
  "axisAmount": "VND",
  "totalNewCustomers": "New customers",
  "totalSpending": "Total spending",
  "spendingCustomers": "Customers who spent",
  "conversion": "New customers who spent",
  "conversionHint": "{{count}} / {{total}} new customers",
  "avgPerCustomer": "Avg per customer",
  "paymentMix": "Payment method mix",
  "paymentBank": "Bank transfer",
  "paymentCash": "Cash",
  "paymentPoint": "Points",
  "paymentCredit": "Credit card",
  "filterBranch": "Branch",
  "filterPaymentMethod": "Payment method",
  "filterCustomerType": "Customer type",
  "filterPhone": "Phone number",
  "customerTypeAll": "All customers",
  "customerTypeNewRegister": "Newly registered",
  "allBranches": "All branches",
  "allPaymentMethods": "All methods",
  "scopeShared": "Applies to both charts",
  "scopeSpending": "Applies to spending only",
  "reset": "Reset spending filters",
  "refresh": "Refresh",
  "tableDirectory": "Directory",
  "tableSpending": "Spending",
  "exportCsv": "Export CSV",
  "spendingTableTitle": "Spending by customer",
  "colCustomer": "Customer",
  "colRegisteredAt": "Registered",
  "colTotal": "Total spent",
  "colBank": "Bank transfer",
  "colCash": "Cash",
  "colPoint": "Points",
  "colCredit": "Credit card",
  "emptySpendingChart": "No spending data in this range",
  "emptySpendingTable": "No customer spent in this range",
  "csvFileName": "customer-spending"
}
```

- [ ] **Step 3: Kiểm tra JSON hợp lệ**

Run: `cd app/order-ui && node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/customer.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/en/customer.json','utf8')); console.log('both valid')"`
Expected: in ra `both valid`.

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/locales/vi/customer.json app/order-ui/src/locales/en/customer.json
git commit -m "TaskId: 441-FE (6) Add i18n keys for customer analytics"
```

---

### Task 7: `chart-colors.ts` — màu series theo theme

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/chart-colors.ts`

**Interfaces:**
- Consumes: `useTheme` từ `@/components/app/theme-provider` (trả `{ theme: 'dark' | 'light' }`).
- Produces: `useChartColors(): ChartColors`; `ChartColors { newCustomer, spending, previous, trend, label, splitLine, mixBank, mixCash, mixPoint, mixCredit }` (tất cả `string`). Task 8 dùng nhóm series, Task 9 dùng nhóm `mix*`.

- [ ] **Step 1: Viết file**

Tạo `app/order-ui/src/app/system/customers/components/analytics/chart-colors.ts`:

```ts
import { useTheme } from '@/components/app/theme-provider'

export interface ChartColors {
  newCustomer: string
  spending: string
  previous: string
  trend: string
  label: string
  splitLine: string
  /** 4 hue của thanh phân bổ phương thức — tách khỏi màu series của chart. */
  mixBank: string
  mixCash: string
  mixPoint: string
  mixCredit: string
}

/**
 * Bước màu dark KHÔNG phải là bản lật của light — chúng được chọn lại cho nền
 * tối và đã chạy qua validator (dải sáng, sàn chroma, tách CVD, contrast >= 3:1).
 * Cặp cam <-> xanh giữ CVD ΔE 29.9 (light) / 21.5 (dark), thừa ngưỡng 8.
 * Bộ 4 màu mix cũng đã validate cả hai mode; riêng bản light có 2 hue dưới 3:1
 * contrast nên thanh mix BẮT BUỘC kèm nhãn % + số tiền (Task 9 có).
 */
const PALETTE: Record<'light' | 'dark', ChartColors> = {
  light: {
    newCustomer: '#f89209',
    spending: '#2a78d6',
    previous: '#cbd5e1',
    trend: '#6b6459',
    label: '#6b7280',
    splitLine: '#e5e7eb',
    mixBank: '#2a78d6',
    mixCash: '#1baf7a',
    mixPoint: '#eda100',
    mixCredit: '#4a3aa7',
  },
  dark: {
    newCustomer: '#c97a07',
    spending: '#3987e5',
    previous: '#4d5561',
    trend: '#a49d92',
    label: '#9ca3af',
    splitLine: '#2b2927',
    mixBank: '#3987e5',
    mixCash: '#199e70',
    mixPoint: '#c98500',
    mixCredit: '#9085e9',
  },
}

export const useChartColors = (): ChartColors => {
  const { theme } = useTheme()
  return PALETTE[theme] ?? PALETTE.light
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app/order-ui && npx tsc -b`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/chart-colors.ts
git commit -m "TaskId: 441-FE (7) Add theme-aware chart colors"
```

---

### Task 8: `customer-analytics-chart.tsx` — ECharts 2 grid chung trục X

**Đây là task mang ràng buộc cứng của spec.** Hai grid, mỗi grid một `yAxis` riêng. Tuyệt đối không đặt hai `yAxis` vào cùng một grid.

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-chart.tsx`

**Interfaces:**
- Consumes: `useChartColors` (Task 7); `fillSpendingBuckets` (Task 2); `fillTimeBuckets`, `linearRegression` (đã có); `IUserStatisticsItem`, `ICustomerAccountRevenueTimeItem`, `UserStatisticsGroupBy`.
- Produces: `CustomerAnalyticsChart` (default export) với props:
  ```ts
  interface CustomerAnalyticsChartProps {
    newCustomers: IUserStatisticsItem[]
    newCustomersPrev: IUserStatisticsItem[]
    spending: ICustomerAccountRevenueTimeItem[]
    spendingPrev: ICustomerAccountRevenueTimeItem[]
    groupBy: UserStatisticsGroupBy
    compareEnabled: boolean
    isLoading: boolean
    spendingUnavailable: boolean
  }
  ```

- [ ] **Step 1: Viết component**

Tạo `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-chart.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui'
import {
  ICustomerAccountRevenueTimeItem,
  IUserStatisticsItem,
  UserStatisticsGroupBy,
} from '@/types'
import { linearRegression } from '@/utils'

import { useChartColors } from './chart-colors'

interface CustomerAnalyticsChartProps {
  newCustomers: IUserStatisticsItem[]
  newCustomersPrev: IUserStatisticsItem[]
  spending: ICustomerAccountRevenueTimeItem[]
  spendingPrev: ICustomerAccountRevenueTimeItem[]
  groupBy: UserStatisticsGroupBy
  compareEnabled: boolean
  isLoading: boolean
  /** BE chưa trả `data` → panel chi tiêu hiện thông báo thay vì cột rỗng. */
  spendingUnavailable: boolean
}

/** Trend = hồi quy tuyến tính trên miền có dữ liệu (bỏ padding 0 hai đầu), clamp >= 0. */
const trendOf = (values: number[]): (number | null)[] | null => {
  const first = values.findIndex((v) => v > 0)
  if (first === -1) return null
  const last = values.length - 1 - [...values].reverse().findIndex((v) => v > 0)
  const points = []
  for (let i = first; i <= last; i++) points.push({ x: i, y: values[i] })
  const reg = linearRegression(points)
  if (!reg) return null
  return values.map((_, i) =>
    i >= first && i <= last ? Number(Math.max(0, reg.at(i)).toFixed(2)) : null,
  )
}

export default function CustomerAnalyticsChart({
  newCustomers,
  newCustomersPrev,
  spending,
  spendingPrev,
  groupBy,
  compareEnabled,
  isLoading,
  spendingUnavailable,
}: CustomerAnalyticsChartProps) {
  const { t } = useTranslation('customer')
  const chartRef = useRef<HTMLDivElement>(null)
  const colors = useChartColors()

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
        default:
          return moment(dateStr).format('DD/MM')
      }
    },
    [groupBy],
  )

  const xLabels = useMemo(
    () => newCustomers.map((it) => formatDate(it.time)),
    [newCustomers, formatDate],
  )
  const newValues = useMemo(() => newCustomers.map((it) => it.count), [newCustomers])
  const newPrevValues = useMemo(
    () => newCustomers.map((_, i) => newCustomersPrev[i]?.count ?? 0),
    [newCustomers, newCustomersPrev],
  )
  const spendValues = useMemo(
    () => newCustomers.map((_, i) => spending[i]?.totalAmount ?? 0),
    [newCustomers, spending],
  )
  const spendPrevValues = useMemo(
    () => newCustomers.map((_, i) => spendingPrev[i]?.totalAmount ?? 0),
    [newCustomers, spendingPrev],
  )

  const isEmpty = !isLoading && newCustomers.length === 0

  useEffect(() => {
    if (!chartRef.current || isLoading || isEmpty) return

    const chart = echarts.init(chartRef.current)
    const nameNew = t('customer.analytics.seriesNewCustomers')
    const nameSpend = t('customer.analytics.seriesSpending')
    const namePrev = t('customer.analytics.seriesPrevious')
    const nameTrend = t('customer.analytics.trendLine')

    const barStyle = { borderRadius: [4, 4, 0, 0] as [number, number, number, number] }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series: any[] = [
      {
        name: nameNew, type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
        data: newValues, itemStyle: { color: colors.newCustomer, ...barStyle },
      },
    ]
    if (compareEnabled) {
      series.push({
        name: `${nameNew} · ${namePrev}`, type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
        data: newPrevValues, itemStyle: { color: colors.previous, ...barStyle },
      })
    }
    const newTrend = trendOf(newValues)
    if (newTrend) {
      series.push({
        name: `${nameNew} · ${nameTrend}`, type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: newTrend, symbol: 'circle', symbolSize: 7, smooth: false, connectNulls: false,
        lineStyle: { color: colors.trend, type: 'dashed', width: 2 },
        itemStyle: { color: colors.trend }, z: 3,
      })
    }

    if (!spendingUnavailable) {
      series.push({
        name: nameSpend, type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
        data: spendValues, itemStyle: { color: colors.spending, ...barStyle },
      })
      if (compareEnabled) {
        series.push({
          name: `${nameSpend} · ${namePrev}`, type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
          data: spendPrevValues, itemStyle: { color: colors.previous, ...barStyle },
        })
      }
      const spendTrend = trendOf(spendValues)
      if (spendTrend) {
        series.push({
          name: `${nameSpend} · ${nameTrend}`, type: 'line', xAxisIndex: 1, yAxisIndex: 1,
          data: spendTrend, symbol: 'circle', symbolSize: 7, smooth: false, connectNulls: false,
          lineStyle: { color: colors.trend, type: 'dashed', width: 2 },
          itemStyle: { color: colors.trend }, z: 3,
        })
      }
    }

    chart.setOption({
      // HAI GRID — mỗi grid một trục Y riêng. Không bao giờ hai thang Y trong một plot.
      grid: [
        { left: 64, right: 20, top: 44, height: 130 },
        { left: 64, right: 20, top: 210, height: 150 },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      // Nối con trỏ trục giữa hai grid: hover một ngày sẽ soi cùng ngày ở cả hai panel.
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      legend: { top: 0, textStyle: { color: colors.label }, data: series.map((s) => s.name) },
      xAxis: [
        { type: 'category', gridIndex: 0, data: xLabels, axisLabel: { show: false }, axisTick: { show: false } },
        { type: 'category', gridIndex: 1, data: xLabels, axisLabel: { rotate: 45, color: colors.label } },
      ],
      yAxis: [
        {
          type: 'value', gridIndex: 0, name: t('customer.analytics.axisCustomers'),
          nameTextStyle: { color: colors.label }, minInterval: 1,
          axisLabel: { color: colors.label },
          splitLine: { show: true, lineStyle: { type: 'dashed', color: colors.splitLine } },
        },
        {
          type: 'value', gridIndex: 1, name: t('customer.analytics.axisAmount'),
          nameTextStyle: { color: colors.label },
          axisLabel: {
            color: colors.label,
            formatter: (v: number) => (v >= 1_000_000 ? `${v / 1_000_000}tr` : `${v / 1000}k`),
          },
          splitLine: { show: true, lineStyle: { type: 'dashed', color: colors.splitLine } },
        },
      ],
      series,
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      chart.dispose()
      window.removeEventListener('resize', onResize)
    }
  }, [
    xLabels, newValues, newPrevValues, spendValues, spendPrevValues,
    compareEnabled, colors, isEmpty, isLoading, spendingUnavailable, t,
  ])

  return (
    <div className="relative w-full h-[24rem]">
      <div
        ref={chartRef}
        className={'h-full w-full ' + (isLoading || isEmpty ? 'invisible' : '')}
      />
      {isLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
      {!isLoading && isEmpty && (
        <div className="flex absolute inset-0 justify-center items-center text-muted-foreground">
          {t('customer.analytics.emptySpendingChart')}
        </div>
      )}
      {!isLoading && !isEmpty && spendingUnavailable && (
        <div className="absolute right-5 left-16 bottom-6 py-6 text-xs text-center rounded-md border border-dashed text-muted-foreground">
          {t('customer.analytics.emptySpendingChart')}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b && npm run lint`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/customer-analytics-chart.tsx
git commit -m "TaskId: 441-FE (8) Add two-grid analytics chart sharing one x axis"
```

---

### Task 9: `customer-analytics-summary.tsx` — KPI gộp + thanh phương thức

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-summary.tsx`

**Interfaces:**
- Consumes: `computeSpendingKpis`, `computePaymentMix`, `PaymentMixKey` (Task 3); `useChartColors`, `ChartColors` (Task 7) — lấy 4 slot `mixBank/mixCash/mixPoint/mixCredit`; `formatCurrency` từ `@/utils`.
- Produces: `CustomerAnalyticsSummary` (default export) với props:
  ```ts
  interface CustomerAnalyticsSummaryProps {
    revenue?: ICustomerAccountRevenue
    newCustomerTotal: number
    customerType: CustomerAccountRevenueType
    isLoading: boolean
  }
  ```

- [ ] **Step 1: Viết component**

Tạo `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-summary.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { UserPlus, Wallet, TrendingUp, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { CustomerAccountRevenueType, ICustomerAccountRevenue } from '@/types'
import { formatCurrency } from '@/utils'

import { computePaymentMix, computeSpendingKpis, PaymentMixKey } from './spending-kpis'
import { ChartColors, useChartColors } from './chart-colors'

interface CustomerAnalyticsSummaryProps {
  revenue?: ICustomerAccountRevenue
  newCustomerTotal: number
  customerType: CustomerAccountRevenueType
  isLoading: boolean
}

const MIX_COLOR_KEY: Record<PaymentMixKey, keyof ChartColors> = {
  bank: 'mixBank',
  cash: 'mixCash',
  point: 'mixPoint',
  credit: 'mixCredit',
}

const MIX_LABEL: Record<PaymentMixKey, string> = {
  bank: 'customer.analytics.paymentBank',
  cash: 'customer.analytics.paymentCash',
  point: 'customer.analytics.paymentPoint',
  credit: 'customer.analytics.paymentCredit',
}

export default function CustomerAnalyticsSummary({
  revenue,
  newCustomerTotal,
  customerType,
  isLoading,
}: CustomerAnalyticsSummaryProps) {
  const { t } = useTranslation('customer')
  const colors = useChartColors()
  const kpis = computeSpendingKpis({ revenue, newCustomerTotal, customerType })
  const mix = computePaymentMix(revenue?.summary)
  const mixColor = (key: PaymentMixKey) => colors[MIX_COLOR_KEY[key]]

  const value = (node: React.ReactNode) =>
    isLoading ? <Skeleton className="w-20 h-7" /> : node

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card className="text-white shadow-none bg-primary">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-bold">
              {t('customer.analytics.totalNewCustomers')}
            </CardTitle>
            <UserPlus className="w-4 h-4" />
          </CardHeader>
          <CardContent>
            {value(<div className="text-2xl font-bold tabular-nums">{newCustomerTotal}</div>)}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {t('customer.analytics.totalSpending')}
            </CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {value(
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(kpis.totalAmount)}
              </div>,
            )}
          </CardContent>
        </Card>

        {/* Chuyển đổi chỉ có nghĩa khi lọc new-register; nếu không, hiện số tuyệt đối. */}
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {kpis.conversion === null
                ? t('customer.analytics.spendingCustomers')
                : t('customer.analytics.conversion')}
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {value(
              kpis.conversion === null ? (
                <div className="text-2xl font-bold tabular-nums">{kpis.spendingCustomers}</div>
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums">{kpis.conversion}%</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {t('customer.analytics.conversionHint', {
                      count: kpis.spendingCustomers,
                      total: newCustomerTotal,
                    })}
                  </div>
                </>
              ),
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {t('customer.analytics.avgPerCustomer')}
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {value(
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(kpis.avgPerCustomer)}
              </div>,
            )}
          </CardContent>
        </Card>
      </div>

      {!isLoading && mix.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-2 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t('customer.analytics.paymentMix')}
            </span>
            {/* Thanh part-to-whole: khe 2px giữa các đoạn để chúng không dính vào nhau. */}
            <div className="flex gap-0.5 w-full h-2.5">
              {mix.map((s) => (
                <div
                  key={s.key}
                  className="h-full rounded-sm"
                  style={{ width: `${s.percent}%`, background: mixColor(s.key) }}
                />
              ))}
            </div>
            {/* Nhãn % + số tiền là BẮT BUỘC, không phải trang trí: ở light mode hai
                hue của thanh dưới 3:1 contrast nên nhãn là phần relief bù lại. */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {mix.map((s) => (
                <span key={s.key} className="inline-flex gap-1.5 items-center text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: mixColor(s.key) }}
                  />
                  <span className="text-muted-foreground">{t(MIX_LABEL[s.key])}</span>
                  <span className="font-medium tabular-nums">{s.percent}%</span>
                  <span className="text-muted-foreground tabular-nums">
                    ({formatCurrency(s.amount)})
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b && npm run lint`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/customer-analytics-summary.tsx
git commit -m "TaskId: 441-FE (9) Add analytics KPI summary and payment mix bar"
```

---

### Task 10: Bảng chi tiêu — cột + component

**Files:**
- Create: `app/order-ui/src/app/system/customers/DataTable/columns/customer-spending-columns.tsx`
- Create: `app/order-ui/src/app/system/customers/components/analytics/customer-spending-table.tsx`
- Modify: `app/order-ui/src/app/system/customers/DataTable/columns/index.tsx`

**Interfaces:**
- Consumes: `buildSpendingCsv` (Task 4); `formatCurrency`; primitives `Table, TableHeader, TableBody, TableHead, TableRow, TableCell` từ `@/components/ui`.
- Produces:
  - `useUserSpendingColumns(): ColumnDef<SpendingRow>[]`
  - `CustomerSpendingTable` (default export) với props `{ rows: SpendingRow[]; isLoading: boolean }`
  - `type SpendingRow = ICustomerAccountRevenue['customer'][number]`

- [ ] **Step 1: Viết định nghĩa cột**

Tạo `app/order-ui/src/app/system/customers/DataTable/columns/customer-spending-columns.tsx`:

```tsx
import { useMemo } from 'react'
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { DataTableColumnHeader } from '@/components/ui'
import { ICustomerAccountRevenue } from '@/types'
import { formatCurrency } from '@/utils'

export type SpendingRow = ICustomerAccountRevenue['customer'][number]

const money = (v: number) => (
  <div className="text-sm text-right tabular-nums">{formatCurrency(v)}</div>
)

export const useUserSpendingColumns = (): ColumnDef<SpendingRow>[] => {
  const { t } = useTranslation('customer')
  return useMemo<ColumnDef<SpendingRow>[]>(
    () => [
      {
        accessorKey: 'customerName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colCustomer')} />
        ),
        cell: ({ row }) => <div className="text-sm min-w-36">{row.original.customerName}</div>,
      },
      {
        accessorKey: 'customerRegisteredAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colRegisteredAt')} />
        ),
        cell: ({ row }) => (
          <div className="w-28 text-sm text-muted-foreground tabular-nums">
            {row.original.customerRegisteredAt
              ? moment(row.original.customerRegisteredAt).format('DD/MM/YYYY')
              : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colTotal')} />
        ),
        cell: ({ row }) => (
          <div className="text-sm font-semibold text-right tabular-nums">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
      {
        accessorKey: 'totalAmountBank',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colBank')} />
        ),
        cell: ({ row }) => money(row.original.totalAmountBank),
      },
      {
        accessorKey: 'totalAmountCash',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colCash')} />
        ),
        cell: ({ row }) => money(row.original.totalAmountCash),
      },
      {
        accessorKey: 'totalAmountPoint',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colPoint')} />
        ),
        cell: ({ row }) => money(row.original.totalAmountPoint),
      },
      {
        accessorKey: 'totalAmountCreditCard',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('customer.analytics.colCredit')} />
        ),
        cell: ({ row }) => money(row.original.totalAmountCreditCard),
      },
    ],
    [t],
  )
}
```

- [ ] **Step 2: Thêm export vào barrel cột**

Trong `app/order-ui/src/app/system/customers/DataTable/columns/index.tsx`, thêm:

```ts
export * from './customer-spending-columns'
```

- [ ] **Step 3: Viết bảng**

Tạo `app/order-ui/src/app/system/customers/components/analytics/customer-spending-table.tsx`:

```tsx
import { useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { ROUTE } from '@/constants'
import { useUserSpendingColumns, SpendingRow } from '@/app/system/customers/DataTable/columns'

import { buildSpendingCsv } from './spending-csv'

interface CustomerSpendingTableProps {
  rows: SpendingRow[]
  isLoading: boolean
}

export default function CustomerSpendingTable({ rows, isLoading }: CustomerSpendingTableProps) {
  const { t } = useTranslation('customer')
  const navigate = useNavigate()
  const columns = useUserSpendingColumns()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'totalAmount', desc: true }])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleExport = () => {
    const headers = [
      t('customer.analytics.colCustomer'),
      t('customer.analytics.colRegisteredAt'),
      t('customer.analytics.colTotal'),
      t('customer.analytics.colBank'),
      t('customer.analytics.colCash'),
      t('customer.analytics.colPoint'),
      t('customer.analytics.colCredit'),
    ]
    // ﻿ = BOM, để Excel nhận đúng UTF-8 (tên khách có dấu tiếng Việt).
    const blob = new Blob(['﻿' + buildSpendingCsv(rows, headers)], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `${t('customer.analytics.csvFileName')}-${moment().format('DD-MM-YYYY')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row justify-between items-center pb-3 space-y-0">
        <CardTitle className="text-base">{t('customer.analytics.spendingTableTitle')}</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
          <Download className="mr-2 w-4 h-4" />
          {t('customer.analytics.exportCsv')}
        </Button>
      </CardHeader>
      <CardContent className="p-2">
        {isLoading ? (
          <Skeleton className="w-full h-64" />
        ) : rows.length === 0 ? (
          <div className="py-12 text-sm text-center text-muted-foreground">
            {t('customer.analytics.emptySpendingTable')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(
                        `${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.original.customerSlug}`,
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b && npm run lint`
Expected: không lỗi. (Nếu `DataTableColumnHeader` không export từ `@/components/ui` → kiểm tra `src/components/ui/index.tsx`; nó đang được `customer-columns.tsx` import từ đó.)

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/app/system/customers/DataTable/columns/customer-spending-columns.tsx app/order-ui/src/app/system/customers/DataTable/columns/index.tsx app/order-ui/src/app/system/customers/components/analytics/customer-spending-table.tsx
git commit -m "TaskId: 441-FE (10) Add spending table with client-side sort and CSV export"
```

---

### Task 11: `customer-analytics-panel.tsx` — toolbar + ghép tất cả

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-panel.tsx`
- Modify: `app/order-ui/src/app/system/customers/components/index.tsx`

**Interfaces:**
- Consumes: `CustomerAnalyticsFilters` (Task 5); `isSpendingSeriesUnavailable` (Task 3); `CustomerAnalyticsChart` (Task 8); `CustomerAnalyticsSummary` (Task 9); `SpendingRow` (Task 10); `fillSpendingBuckets` (Task 2); `fillTimeBuckets` (đã có); `useUserStatistics`, `useCustomerAccountRevenue` (Task 1); `suggestPrevious`, `PRESETS`, `PRESET_GROUPBY`, `presetRange`, `Preset` từ `../registration-range.constants`; `UserStatisticsGroupBySelect`, `BranchSelect` từ `@/components/app/select`.
- Produces: `CustomerAnalyticsPanel` (default export), props:
  ```ts
  interface CustomerAnalyticsPanelProps {
    filters: CustomerAnalyticsFilters
    /** Panel render bảng do cha truyền xuống, để cha giữ quyền quyết định bảng nào. */
    children?: React.ReactNode
    onSpendingRowsChange?: (rows: SpendingRow[], isLoading: boolean) => void
  }
  ```

- [ ] **Step 1: Viết component**

Tạo `app/order-ui/src/app/system/customers/components/analytics/customer-analytics-panel.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { BranchSelect, UserStatisticsGroupBySelect } from '@/components/app/select'
import { useCustomerAccountRevenue, useUserStatistics } from '@/hooks'
import { CustomerAccountRevenueType, PaymentMethod } from '@/types'
import { fillSpendingBuckets, fillTimeBuckets } from '@/utils'
import { CustomerAnalyticsFilters } from '@/app/system/customers/hooks'
import { SpendingRow } from '@/app/system/customers/DataTable/columns'

import {
  PRESETS,
  PRESET_GROUPBY,
  Preset,
  presetRange,
  suggestPrevious,
} from '../registration-range.constants'
import CustomerAnalyticsSummary from './customer-analytics-summary'
import CustomerAnalyticsChart from './customer-analytics-chart'
import { isSpendingSeriesUnavailable } from './spending-kpis'

interface CustomerAnalyticsPanelProps {
  filters: CustomerAnalyticsFilters
  children?: React.ReactNode
  onSpendingRowsChange?: (rows: SpendingRow[], isLoading: boolean) => void
}

const DAY = 'YYYY-MM-DD'
const DATETIME = 'YYYY-MM-DDTHH:mm:ss'
const startOfDay = (d: string) => moment(d).startOf('day').format(DATETIME)
const endOfDay = (d: string) => moment(d).endOf('day').format(DATETIME)

const PAYMENT_METHODS: { value: PaymentMethod; i18n: string }[] = [
  { value: PaymentMethod.BANK_TRANSFER, i18n: 'customer.analytics.paymentBank' },
  { value: PaymentMethod.CASH, i18n: 'customer.analytics.paymentCash' },
  { value: PaymentMethod.POINT, i18n: 'customer.analytics.paymentPoint' },
  { value: PaymentMethod.CREDIT_CARD, i18n: 'customer.analytics.paymentCredit' },
]

const ALL = '__all__'

export default function CustomerAnalyticsPanel({
  filters,
  children,
  onSpendingRowsChange,
}: CustomerAnalyticsPanelProps) {
  const { t } = useTranslation('customer')

  const startDate = startOfDay(filters.from)
  const endDate = endOfDay(filters.to)
  const compareOn = filters.compareEnabled && !!filters.compareFrom && !!filters.compareTo

  const { data: newData, isLoading: newLoading } = useUserStatistics(
    { startDate, endDate, groupBy: filters.groupBy },
    true,
  )
  const { data: newPrevData } = useUserStatistics(
    {
      startDate: compareOn ? startOfDay(filters.compareFrom) : '',
      endDate: compareOn ? endOfDay(filters.compareTo) : '',
      groupBy: filters.groupBy,
    },
    compareOn,
  )

  const spendQuery = {
    startDate,
    endDate,
    groupBy: filters.groupBy,
    branch: filters.branch || undefined,
    paymentMethod: (filters.paymentMethod as PaymentMethod) || undefined,
    phonenumber: filters.phone || undefined,
    customerType: filters.customerType,
  }
  const { data: spendData, isLoading: spendLoading } = useCustomerAccountRevenue(spendQuery, true)
  const { data: spendPrevData } = useCustomerAccountRevenue(
    {
      ...spendQuery,
      startDate: compareOn ? startOfDay(filters.compareFrom) : '',
      endDate: compareOn ? endOfDay(filters.compareTo) : '',
    },
    compareOn,
  )

  // API trả về MẢNG; bản tổng hợp nằm ở phần tử đầu.
  const revenue = spendData?.result?.[0]
  const revenuePrev = spendPrevData?.result?.[0]
  const spendingUnavailable = isSpendingSeriesUnavailable(revenue, spendLoading)

  const newCustomers = useMemo(
    () => fillTimeBuckets(newData?.result?.data ?? [], startDate, endDate, filters.groupBy),
    [newData, startDate, endDate, filters.groupBy],
  )
  const newCustomersPrev = useMemo(
    () =>
      compareOn
        ? fillTimeBuckets(
            newPrevData?.result?.data ?? [],
            startOfDay(filters.compareFrom),
            endOfDay(filters.compareTo),
            filters.groupBy,
          )
        : [],
    [compareOn, newPrevData, filters.compareFrom, filters.compareTo, filters.groupBy],
  )
  const spending = useMemo(
    () => fillSpendingBuckets(revenue?.data ?? [], startDate, endDate, filters.groupBy),
    [revenue, startDate, endDate, filters.groupBy],
  )
  const spendingPrev = useMemo(
    () =>
      compareOn
        ? fillSpendingBuckets(
            revenuePrev?.data ?? [],
            startOfDay(filters.compareFrom),
            endOfDay(filters.compareTo),
            filters.groupBy,
          )
        : [],
    [compareOn, revenuePrev, filters.compareFrom, filters.compareTo, filters.groupBy],
  )

  const spendingRows = useMemo(() => revenue?.customer ?? [], [revenue])
  useEffect(() => {
    onSpendingRowsChange?.(spendingRows, spendLoading)
  }, [spendingRows, spendLoading, onSpendingRowsChange])

  const handlePreset = (preset: Preset) => {
    const range = presetRange(preset)
    filters.setDateRange(
      moment(range.start).format(DAY),
      moment(range.end).format(DAY),
    )
    filters.setGroupBy(PRESET_GROUPBY[preset])
  }

  const handleToggleCompare = () => {
    if (filters.compareEnabled) {
      filters.setCompare(false)
      return
    }
    const s = suggestPrevious(startDate, endDate)
    filters.setCompare(true, moment(s.start).format(DAY), moment(s.end).format(DAY))
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('customer.analytics.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3 pt-0">
        {/* Nhóm 1 — áp cho CẢ HAI biểu đồ */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('customer.analytics.scopeShared')}
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="inline-flex p-1 h-9 rounded-md border border-input bg-background">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePreset(p.key)}
                  className="px-3 h-full text-xs font-medium whitespace-nowrap rounded transition-colors text-muted-foreground hover:text-foreground"
                >
                  {t(p.i18n)}
                </button>
              ))}
            </div>
            <UserStatisticsGroupBySelect value={filters.groupBy} onChange={filters.setGroupBy} />
            <label className="flex gap-2 items-center text-xs font-medium cursor-pointer">
              <Checkbox checked={filters.compareEnabled} onCheckedChange={handleToggleCompare} />
              {t('customer.registrationDashboard.compareWithPrevious')}
            </label>
          </div>
        </div>

        {/* Nhóm 2 — CHỈ áp cho khối chi tiêu */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('customer.analytics.scopeSpending')}
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="w-[12rem]">
              <BranchSelect value={filters.branch} onChange={filters.setBranch} />
            </div>
            <Select
              value={filters.paymentMethod || ALL}
              onValueChange={(v) => filters.setPaymentMethod(v === ALL ? '' : v)}
            >
              <SelectTrigger className="w-[11rem] h-9">
                <SelectValue placeholder={t('customer.analytics.allPaymentMethods')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('customer.analytics.allPaymentMethods')}</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.i18n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.customerType}
              onValueChange={(v) => filters.setCustomerType(v as CustomerAccountRevenueType)}
            >
              <SelectTrigger className="w-[11rem] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CustomerAccountRevenueType.NEW_REGISTER}>
                  {t('customer.analytics.customerTypeNewRegister')}
                </SelectItem>
                <SelectItem value={CustomerAccountRevenueType.ALL}>
                  {t('customer.analytics.customerTypeAll')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-[10rem] h-9"
              placeholder={t('customer.analytics.filterPhone')}
              value={filters.phone}
              onChange={(e) => filters.setPhone(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={filters.reset}>
              <RotateCcw className="mr-2 w-4 h-4" />
              {t('customer.analytics.reset')}
            </Button>
          </div>
        </div>

        <CustomerAnalyticsSummary
          revenue={revenue}
          newCustomerTotal={newData?.result?.total ?? 0}
          customerType={filters.customerType}
          isLoading={newLoading || spendLoading}
        />

        <CustomerAnalyticsChart
          newCustomers={newCustomers}
          newCustomersPrev={newCustomersPrev}
          spending={spending}
          spendingPrev={spendingPrev}
          groupBy={filters.groupBy}
          compareEnabled={compareOn}
          isLoading={newLoading || spendLoading}
          spendingUnavailable={spendingUnavailable}
        />

        {children}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Thêm export vào barrel components**

Trong `app/order-ui/src/app/system/customers/components/index.tsx`, thêm:

```ts
export { default as CustomerAnalyticsPanel } from './analytics/customer-analytics-panel'
export { default as CustomerSpendingTable } from './analytics/customer-spending-table'
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b && npm run lint`
Expected: không lỗi. (Nếu `Input` hoặc `Checkbox` không export từ `@/components/ui` → kiểm tra `src/components/ui/index.tsx`; `Checkbox` đang được `date-range-compare-sheet.tsx` import từ đó.)

- [ ] **Step 4: Commit**

```bash
git add app/order-ui/src/app/system/customers/components/analytics/customer-analytics-panel.tsx app/order-ui/src/app/system/customers/components/index.tsx
git commit -m "TaskId: 441-FE (11) Add customer analytics panel with scoped filter groups"
```

---

### Task 12: Ghép vào tab + switch bảng

**Files:**
- Modify: `app/order-ui/src/components/app/tabscontent/system-customer-management.tabscontent.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `CustomerAnalyticsPanel`, `CustomerSpendingTable` (Task 11); `useCustomerAnalyticsFilters` (Task 5); `useCustomerListFilters` (đã có); `SpendingRow` (Task 10).

- [ ] **Step 1: Thay nội dung file**

Thay toàn bộ `app/order-ui/src/components/app/tabscontent/system-customer-management.tabscontent.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { CustomerAnalyticsPanel, CustomerSpendingTable } from '@/app/system/customers/components'
import { DataTable } from '@/components/ui'
import { useUsers } from '@/hooks'
import {
  useCustomerAnalyticsFilters,
  useCustomerListFilters,
} from '@/app/system/customers/hooks'
import { useUserListColumns, SpendingRow } from '@/app/system/customers/DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { CustomerAction, CustomerDateRangeFilter } from '@/app/system/customers/DataTable/actions'
import { IUserInfo } from '@/types'
import { showErrorToastMessage } from '@/utils'

export function SystemCustomerManagementTabsContent() {
  const { t } = useTranslation('customer')
  const { t: tToast } = useTranslation('toast')
  const navigate = useNavigate()

  const analytics = useCustomerAnalyticsFilters()
  const {
    page, size, phone, card, from, to,
    setPage, setSize, setPhone, setCard, setDateRange, reset,
  } = useCustomerListFilters()

  const columns = useUserListColumns()
  const hasShownToastForCurrentFilterRef = useRef<string>('')

  const [spendingRows, setSpendingRows] = useState<SpendingRow[]>([])
  const [spendingLoading, setSpendingLoading] = useState(true)
  const handleSpendingRows = useCallback((rows: SpendingRow[], isLoading: boolean) => {
    setSpendingRows(rows)
    setSpendingLoading(isLoading)
  }, [])

  const { data, isLoading } = useUsers(
    {
      page,
      size,
      order: 'DESC',
      phonenumber: phone,
      membershipCard: card || undefined,
      hasPaging: true,
      role: Role.CUSTOMER,
      // Backend cần 'YYYY-MM-DDTHH:mm:ss' (local, no tz); URL giữ 'YYYY-MM-DD' cho dễ đọc.
      startDate: from ? moment(from).startOf('day').format('YYYY-MM-DDTHH:mm:ss') : undefined,
      endDate: to ? moment(to).endOf('day').format('YYYY-MM-DDTHH:mm:ss') : undefined,
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

  const handleSearchChange = useCallback(
    (value: string) => {
      if (value !== phone) setPhone(value)
    },
    [phone, setPhone],
  )

  const handleRFIDScan = useCallback((code: string) => setCard(code), [setCard])
  const handleRFIDClear = useCallback(() => setCard(''), [setCard])
  const handleReset = useCallback(() => reset(), [reset])

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

  const segButton = (value: 'dir' | 'spend', label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => analytics.setTable(value)}
      className={
        'px-3 h-full text-xs font-medium rounded transition-colors ' +
        (analytics.table === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <CustomerAnalyticsPanel filters={analytics} onSpendingRowsChange={handleSpendingRows} />

      {/* Switch bảng ĐỘC LẬP với chart: cả hai dashboard cùng hiện nên bảng không thuộc về view nào. */}
      <div className="inline-flex self-start p-1 h-9 rounded-md border border-input bg-background">
        {segButton('dir', t('customer.analytics.tableDirectory'))}
        {segButton('spend', t('customer.analytics.tableSpending'))}
      </div>

      {analytics.table === 'spend' ? (
        <CustomerSpendingTable rows={spendingRows} isLoading={spendingLoading} />
      ) : (
        <DataTable
          columns={columns}
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
      )}
    </div>
  )
}
```

- [ ] **Step 2: Chạy toàn bộ test**

Run: `cd app/order-ui && npm run test`
Expected: PASS toàn bộ, bao gồm các test đã có (`use-customer-list-filters`, `fill-time-buckets`, `linear-regression`, `registration-range.constants`) và các test mới ở Task 2–5.

- [ ] **Step 3: Typecheck + lint**

Run: `cd app/order-ui && npx tsc -b && npm run lint`
Expected: không lỗi.

- [ ] **Step 4: Kiểm tra bằng mắt trên trình duyệt**

Run: `cd app/order-ui && npm run dev`
Mở `http://localhost:5173` → vào Quản lý khách hàng → tab Khách hàng. Xác nhận:
1. Hai panel biểu đồ xếp chồng, **nhãn trục X chỉ xuất hiện một lần ở đáy**, hover một cột soi cùng ngày ở cả hai panel.
2. Đổi "Loại khách" sang **Tất cả khách** → thẻ KPI đổi nhãn thành "Khách có chi tiêu" và **biến mất số %**.
3. Gạt switch bảng → đổi giữa danh bạ và bảng chi tiêu; URL có `tbl=spend`.
4. Bấm "Xuất CSV" → tải file, mở bằng Excel thấy tiếng Việt đúng dấu.
5. Nếu BE chưa deploy `groupBy`: panel chi tiêu hiện thông báo trống, **trang không vỡ**, KPI + bảng chi tiêu vẫn có số.

- [ ] **Step 5: Commit**

```bash
git add app/order-ui/src/components/app/tabscontent/system-customer-management.tabscontent.tsx
git commit -m "TaskId: 441-FE (12) Wire analytics panel and table switch into customer tab"
```

---

### Task 13: Dọn code chết

`CustomerRegistrationDashboard`, `CustomerRegistrationChart`, `CustomerRegistrationSummary` và `DateRangeCompareSheet` không còn ai dùng sau Task 12 — panel mới đã thay thế. `page.tsx` cũng đang là bản cũ dùng `useState` (tab content mới là đường sống thật).

**Files:**
- Delete: `app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx`
- Delete: `app/order-ui/src/app/system/customers/components/customer-registration-chart.tsx`
- Delete: `app/order-ui/src/app/system/customers/components/customer-registration-summary.tsx`
- Delete: `app/order-ui/src/app/system/customers/components/date-range-compare-sheet.tsx`
- Modify: `app/order-ui/src/app/system/customers/components/index.tsx`
- Modify: `app/order-ui/src/app/system/customers/page.tsx`

- [ ] **Step 1: Xác nhận không còn ai import**

Run:
```bash
cd app/order-ui && grep -rn "CustomerRegistrationDashboard\|CustomerRegistrationChart\|CustomerRegistrationSummary\|DateRangeCompareSheet" src/ --include=*.tsx --include=*.ts
```
Expected: chỉ còn các dòng trong chính 4 file sắp xoá và trong `components/index.tsx`, `page.tsx`. Nếu có chỗ khác import → **dừng lại**, xử lý chỗ đó trước.

- [ ] **Step 2: Xoá 4 file**

```bash
cd app/order-ui && rm \
  src/app/system/customers/components/customer-registration-dashboard.tsx \
  src/app/system/customers/components/customer-registration-chart.tsx \
  src/app/system/customers/components/customer-registration-summary.tsx \
  src/app/system/customers/components/date-range-compare-sheet.tsx
```

- [ ] **Step 3: Dọn barrel**

Thay toàn bộ `app/order-ui/src/app/system/customers/components/index.tsx`:

```ts
export { default as CustomerInfoPage } from './customer-info-page'
export { default as CustomerAnalyticsPanel } from './analytics/customer-analytics-panel'
export { default as CustomerSpendingTable } from './analytics/customer-spending-table'
```

- [ ] **Step 4: Cho `page.tsx` dùng chung một đường sống với tab content**

`page.tsx` đang giữ bản filter cũ bằng `useState`, lệch hẳn với tab content. Thay toàn bộ để nó chỉ bọc lại tab content:

```tsx
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'

import { SystemCustomerManagementTabsContent } from '@/components/app/tabscontent'

export default function CustomerPage() {
  const { t } = useTranslation('customer')
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.customer.title')}</title>
        <meta name="description" content={tHelmet('helmet.customer.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('customer.title')}
      </span>
      <SystemCustomerManagementTabsContent />
    </div>
  )
}
```

- [ ] **Step 5: `registration-range.constants.ts` — giữ lại**

**Không xoá** file này. Panel mới vẫn dùng `PRESETS`, `PRESET_GROUPBY`, `presetRange`, `suggestPrevious`, và test của nó vẫn chạy. Các export không còn dùng (`DateFilterValue`, `presetToValue`, `defaultDateFilter`, `formatRangeLabel`) sẽ bị lint bắt nếu thừa — nếu `npm run lint` báo, xoá đúng những export đó cùng test tương ứng trong `components/__tests__/registration-range.constants.test.ts`.

- [ ] **Step 6: Chạy full test + typecheck + lint**

Run: `cd app/order-ui && npm run test && npx tsc -b && npm run lint`
Expected: PASS toàn bộ, không lỗi type, không lỗi lint.

- [ ] **Step 7: Commit**

```bash
git add -A app/order-ui/src/app/system/customers app/order-ui/src/components/app/tabscontent
git commit -m "TaskId: 441-FE (13) Remove superseded registration dashboard components"
```

---

## Ghi chú bàn giao Backend

Task 1 khai báo `data` là **optional** nên FE merge được ngay mà không cần chờ BE. Yêu cầu gửi BE:

- `GET /revenue/account` nhận thêm query param `groupBy` ∈ `hour | day | week | month | year`.
- Khi có `groupBy`, response bổ sung `data: { time, totalAmount }[]` — một phần tử mỗi bucket **có phát sinh** (FE tự điền mốc trống = 0).
- `time` định dạng `'YYYY-MM-DDTHH:mm:ss'`, giờ địa phương, **không** hậu tố timezone — giống hệt `/user/statistics`.
- `data` phải tôn trọng mọi filter đang có (`branch`, `paymentMethod`, `phonenumber`, `customerType`).

Khi BE deploy xong, cờ `spendingUnavailable` tự tắt, không cần sửa FE.
