# Time-Frame Voucher Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm `activeStartTime`/`activeEndTime` (HH:mm local) vào voucher để chỉ cho phép áp dụng trong khung giờ nhất định mỗi ngày.

**Architecture:** Util `voucher-time.ts` là nguồn truth duy nhất cho time logic (grace period + active window check). Types và Zod schemas thêm 2 field mới. 3 form sheet thêm Switch toggle UI. 6 apply-voucher sheet refactor để dùng util chung thay vì copy-paste grace period logic.

**Tech Stack:** TypeScript, Zod, React Hook Form, moment.js (đã có trong project), Vitest

---

## File Map

| Action | File |
|---|---|
| Modify | `src/types/voucher.type.ts` |
| Modify | `src/schemas/voucher.schema.ts` |
| **Create** | `src/utils/voucher-time.ts` |
| **Create** | `src/tests/utils/voucher-time.test.ts` |
| Modify | `src/locales/vi/voucher.json` |
| Modify | `src/locales/en/voucher.json` |
| Modify | `src/components/app/sheet/create-voucher-sheet.tsx` |
| Modify | `src/components/app/sheet/update-voucher-sheet.tsx` |
| Modify | `src/components/app/sheet/create-multiple-voucher-sheet.tsx` |
| Modify | `src/components/app/sheet/voucher-list-sheet.tsx` |
| Modify | `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx` |
| Modify | `src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx` |
| Modify | `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` |
| Modify | `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx` |
| Modify | `src/components/app/sheet/staff-voucher-list-sheet.tsx` |
| Modify | `src/components/app/dialog/voucher-detail-info-dialog.tsx` |
| Modify | `src/app/system/voucher/DataTable/columns/voucher-columns.tsx` |

---

## Task 1: Thêm types cho activeStartTime / activeEndTime

**Files:**
- Modify: `src/types/voucher.type.ts`

- [ ] **Step 1: Thêm field vào IVoucher** (dòng 41, sau `endDate: string`)

```ts
// trong interface IVoucher
startDate: string
endDate: string
activeStartTime: string | null
activeEndTime: string | null
```

- [ ] **Step 2: Thêm field vào ICreateVoucherRequest** (dòng 122, sau `endDate: string`)

```ts
// trong interface ICreateVoucherRequest
startDate: string
endDate: string
activeStartTime: string | null
activeEndTime: string | null
```

- [ ] **Step 3: Thêm field vào IUpdateVoucherRequest** (dòng 149, sau `endDate: string`)

```ts
// trong interface IUpdateVoucherRequest
startDate: string
endDate: string
activeStartTime: string | null
activeEndTime: string | null
```

- [ ] **Step 4: Thêm field vào ICreateMultipleVoucherRequest** (dòng 166, sau `endDate: string`)

```ts
// trong interface ICreateMultipleVoucherRequest
startDate: string
endDate: string
activeStartTime: string | null
activeEndTime: string | null
```

- [ ] **Step 5: Kiểm tra TypeScript compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: Không có lỗi liên quan đến `voucher.type.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/types/voucher.type.ts
git commit -m "feat(TRE-414): add activeStartTime/activeEndTime to voucher types"
```

---

## Task 2: Thêm Zod schema validation

**Files:**
- Modify: `src/schemas/voucher.schema.ts`

- [ ] **Step 1: Thêm field vào createVoucherSchema** (sau `endDate: z.string()`, dòng ~63)

```ts
// trong createVoucherSchema z.object({ ... })
startDate: z.string(),
endDate: z.string(),
activeStartTime: z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
  .nullable(),
activeEndTime: z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Định dạng giờ không hợp lệ (HH:mm)')
  .nullable(),
```

- [ ] **Step 2: Thêm cross-field validation vào superRefine của createVoucherSchema** (trong block `superRefine`, sau validation `assignedUser`)

```ts
// Validate activeStartTime / activeEndTime
const { activeStartTime, activeEndTime } = data
const hasStart = activeStartTime !== null && activeStartTime !== undefined
const hasEnd = activeEndTime !== null && activeEndTime !== undefined
if (hasStart !== hasEnd) {
  const msg = 'Phải nhập cả giờ bắt đầu và kết thúc'
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeStartTime'], message: msg })
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeEndTime'], message: msg })
}
if (hasStart && hasEnd && activeStartTime! >= activeEndTime!) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['activeEndTime'],
    message: 'Giờ bắt đầu phải trước giờ kết thúc',
  })
}
```

- [ ] **Step 3: Lặp lại cho createMultipleVoucherSchema** — thêm đúng như Step 1–2 vào `createMultipleVoucherSchema`.

- [ ] **Step 4: Lặp lại cho updateVoucherSchema** — thêm đúng như Step 1–2 vào `updateVoucherSchema`.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: Không có lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/voucher.schema.ts
git commit -m "feat(TRE-414): add activeStartTime/activeEndTime Zod validation"
```

---

## Task 3: Tạo voucher-time util và tests

**Files:**
- Create: `src/utils/voucher-time.ts`
- Create: `src/tests/utils/voucher-time.test.ts`

- [ ] **Step 1: Viết failing tests trước**

Tạo file `src/tests/utils/voucher-time.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import moment from 'moment'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
import { IVoucher } from '@/types/voucher.type'

const makeVoucher = (overrides: Partial<IVoucher>): IVoucher =>
  ({
    endDate: '2099-12-31T23:59:59Z',
    activeStartTime: null,
    activeEndTime: null,
    ...overrides,
  } as IVoucher)

describe('isVoucherExpired', () => {
  it('returns false when endDate is in the future', () => {
    const voucher = makeVoucher({ endDate: '2099-12-31T23:59:59Z' })
    expect(isVoucherExpired(voucher)).toBe(false)
  })

  it('returns false within 30-min grace period after endDate', () => {
    const endDate = moment().subtract(20, 'minutes').toISOString()
    expect(isVoucherExpired(makeVoucher({ endDate }))).toBe(false)
  })

  it('returns true after grace period', () => {
    const endDate = moment().subtract(31, 'minutes').toISOString()
    expect(isVoucherExpired(makeVoucher({ endDate }))).toBe(true)
  })
})

describe('isVoucherInActiveTimeWindow', () => {
  it('returns true when both times are null (all day)', () => {
    expect(isVoucherInActiveTimeWindow(makeVoucher({}))).toBe(true)
  })

  it('returns true when now is inside the window', () => {
    const now = moment().set({ hour: 15, minute: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false when now is before the window', () => {
    const now = moment().set({ hour: 13, minute: 59 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })

  it('returns true when now is at exact start boundary', () => {
    const now = moment().set({ hour: 14, minute: 0 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns true within 30-min grace after activeEndTime', () => {
    const now = moment().set({ hour: 16, minute: 20 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false after grace period', () => {
    const now = moment().set({ hour: 16, minute: 31 })
    const v = makeVoucher({ activeStartTime: '14:00', activeEndTime: '16:00' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })

  it('handles grace period wrapping past midnight', () => {
    const now = moment().set({ hour: 0, minute: 10 })
    const v = makeVoucher({ activeStartTime: '23:00', activeEndTime: '23:50' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(true)
  })

  it('returns false well past midnight grace wrap', () => {
    const now = moment().set({ hour: 0, minute: 21 })
    const v = makeVoucher({ activeStartTime: '23:00', activeEndTime: '23:50' })
    expect(isVoucherInActiveTimeWindow(v, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy tests — phải FAIL vì chưa có implementation**

```bash
npx vitest run src/tests/utils/voucher-time.test.ts
```

Expected: FAIL với `Cannot find module '@/utils/voucher-time'`

- [ ] **Step 3: Tạo implementation** — tạo `src/utils/voucher-time.ts`:

```ts
import moment, { Moment } from 'moment'
import { IVoucher } from '@/types/voucher.type'

const GRACE_PERIOD_MINUTES = 30

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const isVoucherExpired = (voucher: IVoucher, now: Moment = moment()): boolean => {
  const endWithGrace = moment.utc(voucher.endDate).add(GRACE_PERIOD_MINUTES, 'minutes')
  return endWithGrace.isBefore(now)
}

export const isVoucherInActiveTimeWindow = (
  voucher: IVoucher,
  now: Moment = moment(),
): boolean => {
  const { activeStartTime, activeEndTime } = voucher
  if (!activeStartTime || !activeEndTime) return true

  const nowMinutes = now.hours() * 60 + now.minutes()
  const startMinutes = toMinutes(activeStartTime)
  const endWithGrace = toMinutes(activeEndTime) + GRACE_PERIOD_MINUTES

  if (endWithGrace > 1439) {
    // Grace wraps past midnight — valid if >= start OR < wrapped end
    const wrappedEnd = endWithGrace - 1440
    return nowMinutes >= startMinutes || nowMinutes <= wrappedEnd
  }

  return nowMinutes >= startMinutes && nowMinutes <= endWithGrace
}
```

- [ ] **Step 4: Chạy lại tests — phải PASS**

```bash
npx vitest run src/tests/utils/voucher-time.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/voucher-time.ts src/tests/utils/voucher-time.test.ts
git commit -m "feat(TRE-414): add voucher-time util with grace period and active window logic"
```

---

## Task 4: Thêm i18n keys

**Files:**
- Modify: `src/locales/vi/voucher.json`
- Modify: `src/locales/en/voucher.json`

- [ ] **Step 1: Thêm vào `src/locales/vi/voucher.json`** (trong object `"voucher": { ... }`, trước dấu `}` đóng cuối)

```json
"activeTimeWindow": "Khung giờ áp dụng",
"activeStartTime": "Giờ bắt đầu",
"activeEndTime": "Giờ kết thúc",
"applyTimeFrame": "Áp dụng khung giờ trong ngày",
"enterActiveStartTime": "Nhập giờ bắt đầu",
"enterActiveEndTime": "Nhập giờ kết thúc",
"activeTimeMustBeBothOrNone": "Phải nhập cả giờ bắt đầu và kết thúc",
"activeStartMustBeBeforeEnd": "Giờ bắt đầu phải trước giờ kết thúc",
"notInActiveTimeWindow": "Voucher chỉ áp dụng từ {{start}} - {{end}}"
```

- [ ] **Step 2: Thêm vào `src/locales/en/voucher.json`** (cùng vị trí)

```json
"activeTimeWindow": "Active Time Window",
"activeStartTime": "Start Time",
"activeEndTime": "End Time",
"applyTimeFrame": "Apply Time Frame",
"enterActiveStartTime": "Enter start time",
"enterActiveEndTime": "Enter end time",
"activeTimeMustBeBothOrNone": "Both start and end time are required",
"activeStartMustBeBeforeEnd": "Start time must be before end time",
"notInActiveTimeWindow": "Voucher only valid from {{start}} to {{end}}"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/vi/voucher.json src/locales/en/voucher.json
git commit -m "feat(TRE-414): add i18n keys for active time window"
```

---

## Task 5: Form UI — create-voucher-sheet.tsx

**Files:**
- Modify: `src/components/app/sheet/create-voucher-sheet.tsx`

- [ ] **Step 1: Thêm state toggle** (sau dòng `const [isMaxItemsEnabled, setIsMaxItemsEnabled] = useState(false)`)

```ts
const [isActiveTimeEnabled, setIsActiveTimeEnabled] = useState(false)
```

- [ ] **Step 2: Thêm vào `defaultValues`** (trong `useForm`, sau `maxItems: null`)

```ts
activeStartTime: null,
activeEndTime: null,
```

- [ ] **Step 3: Thêm vào `resetForm`** (sau `setIsMaxItemsEnabled(false)`)

```ts
form.setValue('activeStartTime', null)
form.setValue('activeEndTime', null)
setIsActiveTimeEnabled(false)
```

- [ ] **Step 4: Thêm UI block** vào JSX, ngay sau block `startDate/endDate` (tìm `DateAndTimePicker` thứ hai rồi thêm sau đóng `</div>` của row đó):

```tsx
{/* Active Time Frame */}
<div className="flex flex-col gap-2">
  <div className="flex items-center gap-2">
    <Switch
      checked={isActiveTimeEnabled}
      onCheckedChange={(checked) => {
        setIsActiveTimeEnabled(checked)
        if (!checked) {
          form.setValue('activeStartTime', null)
          form.setValue('activeEndTime', null)
        } else {
          form.setValue('activeStartTime', '08:00')
          form.setValue('activeEndTime', '22:00')
        }
      }}
    />
    <span className="text-sm font-medium">{t('voucher.applyTimeFrame')}</span>
  </div>
  {isActiveTimeEnabled && (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="activeStartTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('voucher.activeStartTime')}</FormLabel>
            <FormControl>
              <Input
                type="time"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="activeEndTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('voucher.activeEndTime')}</FormLabel>
            <FormControl>
              <Input
                type="time"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )}
</div>
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "create-voucher-sheet"
```

Expected: Không có lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/sheet/create-voucher-sheet.tsx
git commit -m "feat(TRE-414): add active time frame toggle to create-voucher-sheet"
```

---

## Task 6: Form UI — update-voucher-sheet.tsx

**Files:**
- Modify: `src/components/app/sheet/update-voucher-sheet.tsx`

- [ ] **Step 1: Thêm state** (sau các `isMaxItemsEnabled`, `isUsageFrequencyEnabled` state tương tự)

```ts
const [isActiveTimeEnabled, setIsActiveTimeEnabled] = useState(false)
```

- [ ] **Step 2: Thêm prefill** trong `useEffect` khi `specificVoucherData` thay đổi (tìm chỗ set `setIsMaxItemsEnabled` khi prefill, thêm ngay bên dưới):

```ts
setIsActiveTimeEnabled(!!specificVoucherData?.activeStartTime)
if (specificVoucherData?.activeStartTime) {
  form.setValue('activeStartTime', specificVoucherData.activeStartTime)
  form.setValue('activeEndTime', specificVoucherData.activeEndTime)
}
```

- [ ] **Step 3: Thêm vào `defaultValues`** (sau `maxItems: null` hoặc cuối object)

```ts
activeStartTime: null,
activeEndTime: null,
```

- [ ] **Step 4: Thêm vào reset** (tìm hàm `resetForm` hoặc `form.reset(...)`, thêm 2 field)

```ts
activeStartTime: null,
activeEndTime: null,
// sau reset:
setIsActiveTimeEnabled(false)
```

- [ ] **Step 5: Thêm UI block** — cùng JSX như Task 5 Step 4, đặt sau block `startDate/endDate`.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "update-voucher-sheet"
```

Expected: Không có lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/sheet/update-voucher-sheet.tsx
git commit -m "feat(TRE-414): add active time frame toggle to update-voucher-sheet"
```

---

## Task 7: Form UI — create-multiple-voucher-sheet.tsx

**Files:**
- Modify: `src/components/app/sheet/create-multiple-voucher-sheet.tsx`

- [ ] **Step 1–5:** Lặp lại chính xác như Task 5 (không có prefill vì là create).

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "create-multiple-voucher-sheet"
```

Expected: Không có lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/sheet/create-multiple-voucher-sheet.tsx
git commit -m "feat(TRE-414): add active time frame toggle to create-multiple-voucher-sheet"
```

---

## Task 8: Refactor apply-voucher sheets (6 files)

**Files:**
- Modify: `src/components/app/sheet/voucher-list-sheet.tsx`
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx`
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- Modify: `src/components/app/sheet/staff-voucher-list-sheet.tsx`

Mỗi file thực hiện 4 bước sau:

**Pattern lặp lại cho từng file:**

- [ ] **Step A: Thêm import** (đầu file, sau các import hiện có)

```ts
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'
```

- [ ] **Step B: Thay thế grace period trong `isVoucherValid`**

Tìm dòng:
```ts
const endDateWithGrace = moment.utc(voucher.endDate).add(30, 'minutes')
const isExpired = endDateWithGrace.isBefore(moment())
```

Thay bằng:
```ts
const isExpired = isVoucherExpired(voucher)
const isInActiveWindow = isVoucherInActiveTimeWindow(voucher)
```

Và trong `return` của `isVoucherValid`, thêm `&& isInActiveWindow`:
```ts
return isActive && !isExpired && isInActiveWindow && hasUsage && isValidAmount && isValidDate && isIdentityValid && hasValidProducts
```
*(thứ tự field có thể khác nhau giữa các file — giữ nguyên thứ tự cũ, chỉ thêm `&& isInActiveWindow`)*

- [ ] **Step C: Thêm check vào `getVoucherErrorMessage`**

Trong array `errorChecks`, thay dòng hardcode 30 minutes:
```ts
// XÓA:
condition: moment.utc(voucher.endDate).add(30, 'minutes').isBefore(moment()),
// THÊM:
condition: isVoucherExpired(voucher),
```

Thêm 1 entry mới vào `errorChecks` (sau entry expired):
```ts
{
  condition: !isVoucherInActiveTimeWindow(voucher),
  message: voucher.activeStartTime && voucher.activeEndTime
    ? t('voucher.notInActiveTimeWindow', {
        start: voucher.activeStartTime,
        end: voucher.activeEndTime,
      })
    : t('voucher.invalidVoucher'),
},
```

- [ ] **Step D: Verify TypeScript cho file đó**

```bash
npx tsc --noEmit 2>&1 | grep "<tên-file>"
```

Expected: Không có lỗi.

---

Sau khi xong cả 6 file:

- [ ] **Step E: Chạy toàn bộ test suite**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step F: Commit**

```bash
git add \
  src/components/app/sheet/voucher-list-sheet.tsx \
  src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx \
  src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx \
  src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx \
  src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx \
  src/components/app/sheet/staff-voucher-list-sheet.tsx
git commit -m "refactor(TRE-414): extract grace period and active time check to voucher-time util"
```

---

## Task 9: Display UI

**Files:**
- Modify: `src/components/app/dialog/voucher-detail-info-dialog.tsx`
- Modify: `src/app/system/voucher/DataTable/columns/voucher-columns.tsx`

- [ ] **Step 1: voucher-detail-info-dialog.tsx** — tìm section "Thời gian" (chứa `startDate`/`endDate`), thêm row mới ngay bên dưới:

```tsx
{voucher.activeStartTime && voucher.activeEndTime && (
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">{t('voucher.activeTimeWindow')}</span>
    <span className="text-sm font-medium">
      {voucher.activeStartTime} – {voucher.activeEndTime}
    </span>
  </div>
)}
```

- [ ] **Step 2: voucher-columns.tsx** — tìm cell render `startDate`/`endDate` (dùng `moment().format('HH:mm DD/MM/YYYY')`), thêm badge sau datetime:

```tsx
{row.original.activeStartTime && (
  <span className="ml-1 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
    {row.original.activeStartTime}–{row.original.activeEndTime}
  </span>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "voucher-detail|voucher-columns"
```

Expected: Không có lỗi.

- [ ] **Step 4: Chạy toàn bộ test suite lần cuối**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add \
  src/components/app/dialog/voucher-detail-info-dialog.tsx \
  src/app/system/voucher/DataTable/columns/voucher-columns.tsx
git commit -m "feat(TRE-414): display active time window in voucher detail and table"
```

---

## Checklist cuối

- [ ] `npx tsc --noEmit` — không có lỗi
- [ ] `npm run test` — tất cả pass
- [ ] `npm run lint` — không có lỗi
- [ ] Test thủ công: tạo voucher mới với Switch ON, điền khung giờ → submit → xem trong danh sách
- [ ] Test thủ công: apply voucher ngoài khung giờ → hiển thị error message đúng
- [ ] Test thủ công: apply voucher với null/null → hoạt động như cũ (cả ngày)
