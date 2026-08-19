# Time-Frame Restriction for Vouchers — Design Spec

**Task:** TRE-414-FE  
**Date:** 2026-05-27  
**Branch:** feature/TRE-414-FE-Implement-Time-Frame-Restriction-for-Vouchers

---

## Overview

Voucher chỉ được kích hoạt trong một khung giờ nhất định mỗi ngày (ví dụ 14:00–16:00) để khuyến khích người dùng đặt hàng vào giờ trống.

Hai field mới: `activeStartTime` và `activeEndTime`, format `"HH:mm"` local time.

---

## Validation Rules

| Case | Kết quả |
|---|---|
| Cả hai `null` | Hợp lệ — voucher áp dụng cả ngày |
| Cả hai có giá trị | Hợp lệ nếu `activeStartTime < activeEndTime` |
| Một `null`, một có giá trị | Không hợp lệ — báo lỗi rõ ràng |

**Grace period:** áp dụng 30 phút cho `activeEndTime` (nhất quán với `endDate`). Không áp dụng cho `activeStartTime`.

---

## Section 1 — Types & Schema

### `src/types/voucher.type.ts`

Thêm vào `IVoucher`, `ICreateVoucherRequest`, `IUpdateVoucherRequest`, `ICreateMultipleVoucherRequest`:

```ts
activeStartTime: string | null  // "HH:mm" local time
activeEndTime: string | null
```

### `src/schemas/voucher.schema.ts`

Thêm vào cả 3 schema (`createVoucherSchema`, `updateVoucherSchema`, `createMultipleVoucherSchema`):

```ts
activeStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
activeEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
```

Cross-field validation trong `superRefine`:
- Cả hai `null` → pass
- Cả hai có giá trị → pass nếu `activeStartTime < activeEndTime` (string compare đủ vì zero-padded)
- Một `null`, một có giá trị → `ctx.addIssue` ở cả hai path với message `activeTimeMustBeBothOrNone`

---

## Section 2 — Util Layer

### `src/utils/voucher-time.ts` (file mới)

Nguồn truth duy nhất cho toàn bộ time validation logic. Thay thế code lặp ở 6 file hiện tại.

```ts
const GRACE_PERIOD_MINUTES = 30
```

**`isVoucherInActiveTimeWindow(voucher, now?)`**
- `activeStartTime === null` → `true` (cả ngày)
- Convert `activeEndTime` sang minutes-since-midnight, cộng `GRACE_PERIOD_MINUTES`
- Nếu kết quả > 1439 → wrap qua ngày hôm sau
- So sánh `now` với `[activeStartTime, activeEndTime + grace]`, handle wrap midnight

**`isVoucherExpired(voucher, now?)`**
- Extract từ 6 file hiện tại, behavior không đổi
- `endDate + GRACE_PERIOD_MINUTES < now` → expired

**`isVoucherValid(voucher, now?)`**
- `return !isVoucherExpired(voucher, now) && isVoucherInActiveTimeWindow(voucher, now)`

**`getVoucherErrorMessage(voucher, now, t)`**
- Expired → `t('voucher.expired')`
- Not in time window → `t('voucher.notInActiveTimeWindow', { start, end })`
- Valid → `null`

### `src/tests/utils/voucher-time.test.ts` (file mới)

| Test case | Input | Expected |
|---|---|---|
| Cả ngày | `null/null` | `true` |
| Trong window | `"14:00"/"16:00"`, now=15:00 | `true` |
| Trước window | `"14:00"/"16:00"`, now=13:59 | `false` |
| Sau window + trong grace | `"14:00"/"16:00"`, now=16:20 | `true` |
| Sau grace | `"14:00"/"16:00"`, now=16:31 | `false` |
| Wrap midnight trong grace | `activeEnd="23:50"`, now=00:10 | `true` |
| Đúng boundary start | `"14:00"/"16:00"`, now=14:00 | `true` |

---

## Section 3 — UI Form

**Files:** `create-voucher-sheet.tsx`, `update-voucher-sheet.tsx`, `create-multiple-voucher-sheet.tsx`

### State toggle

```ts
const [isActiveTimeEnabled, setIsActiveTimeEnabled] = useState(false)
```

Khi prefill (`update-voucher-sheet.tsx`):
```ts
setIsActiveTimeEnabled(!!specificVoucherData?.activeStartTime)
```

### Default values

```ts
activeStartTime: null,
activeEndTime: null,
```

### Layout UI

Thêm 1 row mới ngay sau block `startDate/endDate`:

```
┌─────────────────────────────────────────────┐
│  [Switch] Áp dụng khung giờ trong ngày      │
│                                             │
│  (khi Switch ON)                            │
│  Giờ bắt đầu          Giờ kết thúc         │
│  [input type="time"]  [input type="time"]   │
└─────────────────────────────────────────────┘
```

### Behavior Switch

- **OFF** → set cả 2 về `null`, ẩn 2 input
- **ON** → hiện 2 input, default `"08:00"` / `"22:00"`

### Reset form

```ts
setValue('activeStartTime', null)
setValue('activeEndTime', null)
setIsActiveTimeEnabled(false)
```

---

## Section 4 — Apply Voucher Sheets (Refactor)

**6 files cần refactor:**
- `client-voucher-list-sheet-in-payment.tsx`
- `client-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- `staff-voucher-list-sheet-in-payment.tsx`
- `staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- `staff-voucher-list-sheet.tsx`
- `voucher-list-sheet.tsx`

### Thay đổi mỗi file

Xóa toàn bộ inline `isVoucherValid()` / `getVoucherErrorMessage()` / grace period logic. Import từ util:

```ts
import { isVoucherValid, getVoucherErrorMessage } from '@/utils/voucher-time'
```

### Behavior mới với active time

| Trạng thái | UI |
|---|---|
| Trước window | Disabled, hiện `"Voucher chỉ áp dụng từ HH:mm - HH:mm"` |
| Trong window | Enabled bình thường |
| Trong grace (sau end, trước end+30m) | Vẫn enabled |
| Sau grace | Disabled, cùng message |
| `null/null` | Enabled (behavior không đổi) |

---

## Section 5 — i18n & Display UI

### i18n keys (vi + en)

| Key | VI | EN |
|---|---|---|
| `activeTimeWindow` | `"Khung giờ áp dụng"` | `"Active Time Window"` |
| `activeStartTime` | `"Giờ bắt đầu"` | `"Start Time"` |
| `activeEndTime` | `"Giờ kết thúc"` | `"End Time"` |
| `applyTimeFrame` | `"Áp dụng khung giờ trong ngày"` | `"Apply Time Frame"` |
| `enterActiveStartTime` | `"Nhập giờ bắt đầu"` | `"Enter start time"` |
| `enterActiveEndTime` | `"Nhập giờ kết thúc"` | `"Enter end time"` |
| `activeTimeMustBeBothOrNone` | `"Phải nhập cả giờ bắt đầu và kết thúc"` | `"Both start and end time are required"` |
| `activeStartMustBeBeforeEnd` | `"Giờ bắt đầu phải trước giờ kết thúc"` | `"Start time must be before end time"` |
| `notInActiveTimeWindow` | `"Voucher chỉ áp dụng từ {{start}} - {{end}}"` | `"Voucher only valid from {{start}} to {{end}}"` |

### `voucher-detail-info-dialog.tsx`

Thêm vào section "Thời gian" (hiển thị khi `activeStartTime !== null`):
```
Khung giờ áp dụng:  14:00 – 16:00
```

### `voucher-columns.tsx`

Thêm badge trong cell thời gian khi `activeStartTime !== null`:
```
27/12/2024  [14:00–16:00]
```

---

## Implementation Order

1. Types (`voucher.type.ts`)
2. Schema (`voucher.schema.ts`)
3. Util + Tests (`voucher-time.ts` + `voucher-time.test.ts`)
4. i18n (`locales/vi/voucher.json`, `locales/en/voucher.json`)
5. Forms (3 sheet files)
6. Apply-voucher refactor (6 sheet files)
7. Display UI (`voucher-detail-info-dialog.tsx`, `voucher-columns.tsx`)

---

## Edge Cases

- **Grace period wrap midnight:** `activeEndTime = "23:50"` + 30m → so sánh bằng minutes-since-midnight, không clamp về 23:59
- **Voucher cũ trong DB:** BE trả `null` cho cả 2 field → behavior không đổi (cả ngày)
- **String compare HH:mm:** hợp lệ vì zero-padded, lexicographic = numeric order
