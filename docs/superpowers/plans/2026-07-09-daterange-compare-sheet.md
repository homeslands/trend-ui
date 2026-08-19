# Date Range + Compare Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Chuyển bộ chọn thời gian sang Sheet responsive (phải/desktop, bottom/mobile) có footer Áp dụng/Đặt lại, và đưa dải preset ra ngoài toolbar (live), đồng bộ với preset trong sheet.

**Architecture:** Dashboard giữ state áp dụng + preset ngoài (live). `DateRangeCompareSheet` controlled: nhận `value` + `onApply`, quản draft nội bộ, commit khi bấm Áp dụng. `side` theo `useIsMobile`.

**Tech Stack:** React 18, TS, Radix Sheet/Checkbox/Select (shadcn), react-day-picker v8 Calendar, moment, date-fns locale, i18next, Vitest.

## Global Constraints

- **KHÔNG commit** — người dùng tự commit. Mỗi task: lint + test.
- Preset ngoài = live; trong sheet = draft + "Áp dụng"; "Đặt lại" = mặc định (Tất cả, tắt so sánh); đóng không Áp dụng = bỏ nháp.
- `side = useIsMobile() ? 'bottom' : 'right'`; desktop width `sm:max-w-md`; bottom `max-h-[85vh]`; body cuộn.
- State ephemeral (không URL). Không đổi backend/chart/summary/table.
- Lệnh gốc `app/order-ui/`. tsc `npx tsc -b --noEmit`; lint `npm run lint`; test `npx vitest run <path>`.

---

### Task 1: constants — DateFilterValue + presetToValue + defaultDateFilter

**Files:**
- Modify: `app/order-ui/src/app/system/customers/components/registration-range.constants.ts`
- Test: `app/order-ui/src/app/system/customers/components/__tests__/registration-range.constants.test.ts` (append)

**Interfaces:**
- Produces: `interface DateFilterValue`, `presetToValue(preset)`, `defaultDateFilter()`.

- [ ] **Step 1: Append failing tests**

Thêm vào cuối file test hiện có:
```ts
import { presetToValue, defaultDateFilter } from '../registration-range.constants'
import { UserStatisticsGroupBy } from '@/types'

describe('presetToValue', () => {
  it('maps allTime to year groupBy + allTime start', () => {
    const v = presetToValue('allTime')
    expect(v.activePreset).toBe('allTime')
    expect(v.groupBy).toBe(UserStatisticsGroupBy.YEAR)
    expect(v.startDate).toBe('2020-01-01T00:00:00')
  })
  it('maps last7Days to day groupBy', () => {
    expect(presetToValue('last7Days').groupBy).toBe(UserStatisticsGroupBy.DAY)
    expect(presetToValue('last7Days').activePreset).toBe('last7Days')
  })
})

describe('defaultDateFilter', () => {
  it('is allTime with comparison off', () => {
    const v = defaultDateFilter()
    expect(v.activePreset).toBe('allTime')
    expect(v.compareEnabled).toBe(false)
    expect(v.compareStart).toBe('')
    expect(v.compareEnd).toBe('')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`presetToValue`/`defaultDateFilter` not exported).

Run: `cd app/order-ui && npx vitest run src/app/system/customers/components/__tests__/registration-range.constants.test.ts`

- [ ] **Step 3: Add to constants file**

Thêm vào cuối `registration-range.constants.ts`:
```ts
export interface DateFilterValue {
  startDate: string
  endDate: string
  activePreset: Preset | null
  groupBy: UserStatisticsGroupBy
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
}

export const presetToValue = (
  preset: Preset,
): Pick<DateFilterValue, 'startDate' | 'endDate' | 'groupBy' | 'activePreset'> => {
  const r = presetRange(preset)
  return {
    startDate: r.start,
    endDate: r.end,
    groupBy: PRESET_GROUPBY[preset],
    activePreset: preset,
  }
}

export const defaultDateFilter = (): DateFilterValue => ({
  ...presetToValue('allTime'),
  compareEnabled: false,
  compareStart: '',
  compareEnd: '',
})
```
(`UserStatisticsGroupBy` đã import sẵn trong file.)

- [ ] **Step 4: Run — expect PASS** (10 tests total).

- [ ] **Step 5: Lint** `cd app/order-ui && npm run lint` (no new errors).

---

### Task 2: `DateRangeCompareSheet` component + i18n

**Files:**
- Create: `app/order-ui/src/app/system/customers/components/date-range-compare-sheet.tsx`
- Delete: `app/order-ui/src/app/system/customers/components/date-range-compare-popover.tsx`
- Modify: `app/order-ui/src/locales/vi/customer.json`, `app/order-ui/src/locales/en/customer.json`

**Interfaces:**
- Consumes: `DateFilterValue`, `Preset`, `PRESETS`, `formatRangeLabel`, `presetToValue`, `defaultDateFilter`, `fmt`, `suggestPrevious` (Task 1 + constants); `useIsMobile` from `@/hooks`; Sheet/Calendar/Checkbox/Select from `@/components/ui`.
- Produces: `DateRangeCompareSheet({ value, onApply })`.

- [ ] **Step 1: i18n keys**

Trong CẢ HAI locale, `customer.registrationDashboard`, thêm (sau `dateRange`):
vi: `"filterTitle": "Khoảng thời gian",` `"apply": "Áp dụng",`
en: `"filterTitle": "Date range",` `"apply": "Apply",`
(reuse `reset`, `custom`, `selectOtherRange`, `samePeriod`, `compareWithPrevious`, `previousPeriod`, presets, `compare`.)

- [ ] **Step 2: Create component**

```tsx
import { useEffect, useState } from 'react'
import moment from 'moment'
import { format, type Locale } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DateRange } from 'react-day-picker'

import {
  Button,
  Calendar,
  Checkbox,
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks'
import {
  DateFilterValue,
  Preset,
  PRESETS,
  fmt,
  formatRangeLabel,
  presetToValue,
  defaultDateFilter,
  suggestPrevious,
} from './registration-range.constants'

const toDate = (v: string) => (v ? moment(v).toDate() : undefined)
const ymd = (d: Date) => moment(d).format('YYYY-MM-DD')
const dmy = (v: string) => (v ? moment(v).format('DD/MM/YYYY') : '')
const rangeText = (from: string, to: string) =>
  from && to ? `${dmy(from)} - ${dmy(to)}` : '—'
const buildRange = (start: string, end: string): DateRange | undefined =>
  start ? { from: toDate(start), to: toDate(end) } : undefined
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const chipClass = (active: boolean) =>
  'px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ' +
  (active
    ? 'bg-primary text-primary-foreground border-primary'
    : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')

const YEARS: number[] = (() => {
  const years: number[] = []
  for (let y = moment().year(); y >= 2020; y--) years.push(y)
  return years
})()

function RangeCalendar({
  selected,
  onSelect,
  disabled,
  locale,
}: {
  selected: DateRange | undefined
  onSelect: (range: DateRange | undefined, day: Date) => void
  disabled: (date: Date) => boolean
  locale: Locale
}) {
  const anchor = selected?.to ?? selected?.from ?? moment().toDate()
  const [month, setMonth] = useState<number>(anchor.getMonth())
  const [year, setYear] = useState<number>(anchor.getFullYear())
  const anchorTime = (selected?.to ?? selected?.from)?.getTime()
  useEffect(() => {
    const a = selected?.to ?? selected?.from
    if (a) {
      setMonth(a.getMonth())
      setYear(a.getFullYear())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorTime])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="flex-1 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={String(i)}>
                {cap(format(new Date(2020, i, 1), 'LLLL', { locale }))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[5.5rem] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-center">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={selected}
          onSelect={onSelect}
          month={new Date(year, month)}
          onMonthChange={(d) => {
            setMonth(d.getMonth())
            setYear(d.getFullYear())
          }}
          disabled={disabled}
          locale={locale}
          className="p-0"
          classNames={{ caption: 'hidden' }}
        />
      </div>
    </div>
  )
}

interface DateRangeCompareSheetProps {
  value: DateFilterValue
  onApply: (value: DateFilterValue) => void
}

export default function DateRangeCompareSheet({
  value,
  onApply,
}: DateRangeCompareSheetProps) {
  const { t, i18n } = useTranslation('customer')
  const locale = i18n.language === 'en' ? enUS : vi
  const isMobile = useIsMobile()
  const allTimeLabel = t('customer.registrationDashboard.presetAllTime')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateFilterValue>(value)
  const [showCurrentCalendar, setShowCurrentCalendar] = useState(
    value.activePreset === null,
  )
  const [showCompareCalendar, setShowCompareCalendar] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<DateRange | undefined>(
    buildRange(value.startDate, value.endDate),
  )
  const [compareDraft, setCompareDraft] = useState<DateRange | undefined>(
    buildRange(value.compareStart, value.compareEnd),
  )

  // Seed nháp mỗi lần mở sheet.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value)
      setShowCurrentCalendar(value.activePreset === null)
      setShowCompareCalendar(false)
    }
    setOpen(next)
  }

  useEffect(() => {
    setCurrentDraft(buildRange(draft.startDate, draft.endDate))
  }, [draft.startDate, draft.endDate])
  useEffect(() => {
    setCompareDraft(buildRange(draft.compareStart, draft.compareEnd))
  }, [draft.compareStart, draft.compareEnd])

  const handlePreset = (preset: Preset) => {
    setDraft((d) => ({ ...d, ...presetToValue(preset) }))
    setShowCurrentCalendar(false)
  }

  const handleCurrentSelect = (range: DateRange | undefined, day: Date) => {
    if (currentDraft?.from && currentDraft?.to) {
      setCurrentDraft({ from: day, to: undefined })
      return
    }
    setCurrentDraft(range)
    if (range?.from && range?.to) {
      setDraft((d) => ({
        ...d,
        startDate: fmt(moment(range.from).startOf('day')),
        endDate: fmt(moment(range.to).endOf('day')),
        activePreset: null,
      }))
    }
  }

  const handleToggleCompare = () => {
    setDraft((d) => {
      const next = !d.compareEnabled
      if (next && !d.compareStart) {
        const s = suggestPrevious(d.startDate, d.endDate)
        return { ...d, compareEnabled: true, compareStart: s.start, compareEnd: s.end }
      }
      return { ...d, compareEnabled: next }
    })
  }

  const handleUseSamePeriod = () => {
    setDraft((d) => {
      const s = suggestPrevious(d.startDate, d.endDate)
      return { ...d, compareStart: s.start, compareEnd: s.end }
    })
    setShowCompareCalendar(false)
  }

  const handleCompareSelect = (range: DateRange | undefined, day: Date) => {
    if (compareDraft?.from && compareDraft?.to) {
      setCompareDraft({ from: day, to: undefined })
      return
    }
    setCompareDraft(range)
    if (range?.from && range?.to) {
      setDraft((d) => ({
        ...d,
        compareStart: fmt(moment(range.from).startOf('day')),
        compareEnd: fmt(moment(range.to).endOf('day')),
      }))
    }
  }

  const handleReset = () => {
    setDraft(defaultDateFilter())
    setShowCurrentCalendar(false)
    setShowCompareCalendar(false)
  }

  const handleApply = () => {
    onApply(draft)
    setOpen(false)
  }

  const disableFuture = (date: Date) => date > moment().endOf('day').toDate()
  const triggerLabel = formatRangeLabel(
    value.activePreset,
    value.startDate,
    value.endDate,
    allTimeLabel,
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 justify-between min-w-[13rem] whitespace-nowrap"
        >
          <CalendarDays className="flex-shrink-0 w-4 h-4" />
          <span className="flex-1 text-left truncate">
            {triggerLabel}
            {value.compareEnabled ? ` · ${t('customer.registrationDashboard.compare')}` : ''}
          </span>
          <ChevronDown className="flex-shrink-0 w-4 h-4 opacity-60" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 p-0',
          isMobile ? 'max-h-[85vh]' : 'sm:max-w-md',
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t('customer.registrationDashboard.filterTitle')}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 gap-3 p-4 overflow-y-auto">
          {/* Presets */}
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key)}
                className={'w-full ' + chipClass(!showCurrentCalendar && draft.activePreset === p.key)}
              >
                {t(p.i18n)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCurrentCalendar(true)}
            className={'w-full ' + chipClass(showCurrentCalendar)}
          >
            {t('customer.registrationDashboard.custom')}
          </button>

          {showCurrentCalendar && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold">
                  {t('customer.registrationDashboard.dateRange')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {rangeText(draft.startDate, draft.endDate)}
                </span>
              </div>
              <RangeCalendar
                selected={currentDraft}
                onSelect={handleCurrentSelect}
                disabled={disableFuture}
                locale={locale}
              />
            </div>
          )}

          <div className="border-t" />

          <label className="flex gap-2 items-center text-sm font-medium cursor-pointer">
            <Checkbox
              checked={draft.compareEnabled}
              onCheckedChange={() => handleToggleCompare()}
            />
            {t('customer.registrationDashboard.compareWithPrevious')}
          </label>

          {draft.compareEnabled && (
            <div className="flex flex-col gap-2 p-2 rounded-md border bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold">
                  {t('customer.registrationDashboard.previousPeriod')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {rangeText(draft.compareStart, draft.compareEnd)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleUseSamePeriod}
                  className={chipClass(!showCompareCalendar)}
                >
                  {t('customer.registrationDashboard.samePeriod')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompareCalendar(true)}
                  className={chipClass(showCompareCalendar)}
                >
                  {t('customer.registrationDashboard.selectOtherRange')}
                </button>
              </div>
              {showCompareCalendar && (
                <RangeCalendar
                  selected={compareDraft}
                  onSelect={handleCompareSelect}
                  disabled={disableFuture}
                  locale={locale}
                />
              )}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 p-4 border-t">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            {t('customer.registrationDashboard.reset')}
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            {t('customer.registrationDashboard.apply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Delete popover file**

Run: `rm app/order-ui/src/app/system/customers/components/date-range-compare-popover.tsx`

- [ ] **Step 4: Typecheck + lint + JSON** (dashboard sẽ báo lỗi import popover — sửa ở Task 3; nếu muốn tách, chấp nhận tsc lỗi tạm ở dashboard tới Task 3). Chạy JSON parse:

Run: `cd app/order-ui && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: `OK`.

*(Ghi chú: Task 2 + 3 nên làm liền nhau vì xóa popover khiến dashboard lỗi import tới khi Task 3 thay bằng sheet.)*

---

### Task 3: Dashboard — preset ngoài (live) + sheet + apply

**Files:**
- Modify: `app/order-ui/src/app/system/customers/components/customer-registration-dashboard.tsx`

**Interfaces:**
- Consumes: `DateRangeCompareSheet` (Task 2); `DateFilterValue`, `PRESETS`, `presetRange`, `PRESET_GROUPBY`, `fmt`, `suggestPrevious`, `Preset` (constants).

- [ ] **Step 1: Imports**

- Đổi `import DateRangeComparePopover from './date-range-compare-popover'` → `import DateRangeCompareSheet from './date-range-compare-sheet'`.
- Thêm `PRESETS`, `DateFilterValue` vào import từ `./registration-range.constants` (đã import `Preset, PRESET_GROUPBY, fmt, presetRange, suggestPrevious`).

- [ ] **Step 2: Thêm `value` + `handleApplyDateFilter`**

Sau `handleSelectPreset` (giữ nguyên, dùng cho preset ngoài live), thêm:
```ts
  const dateFilterValue: DateFilterValue = {
    startDate,
    endDate,
    activePreset,
    groupBy,
    compareEnabled,
    compareStart,
    compareEnd,
  }

  const handleApplyDateFilter = (v: DateFilterValue) => {
    setStartDate(v.startDate)
    setEndDate(v.endDate)
    setActivePreset(v.activePreset)
    setGroupBy(v.groupBy)
    setCompareEnabled(v.compareEnabled)
    setCompareStart(v.compareStart)
    setCompareEnd(v.compareEnd)
  }
```

- [ ] **Step 3: Thay toolbar**

Thay `<div className="flex flex-nowrap ...">` (chứa `<DateRangeComparePopover .../>` + TooltipProvider) bằng: dải preset ngoài (live) + sheet + icon:

```tsx
      <div className="flex flex-nowrap gap-2 items-center w-full overflow-x-auto scrollbar-hide lg:justify-end [&>*]:shrink-0">
        <div className="inline-flex p-1 h-9 rounded-md border border-input bg-background">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handleSelectPreset(p.key)}
              className={
                'px-3 h-full text-xs font-medium rounded whitespace-nowrap transition-colors ' +
                (activePreset === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {t(p.i18n)}
            </button>
          ))}
        </div>

        <DateRangeCompareSheet value={dateFilterValue} onApply={handleApplyDateFilter} />

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

- [ ] **Step 4: Typecheck + lint + JSON**

Run: `cd app/order-ui && npx tsc -b --noEmit && npm run lint && node -e "require('./src/locales/vi/customer.json');require('./src/locales/en/customer.json');console.log('OK')"`
Expected: clean + `OK`. Không còn tham chiếu `date-range-compare-popover`.

- [ ] **Step 5: Verify thủ công**

`cd app/order-ui && npm run dev` → tab customer:
- Dải preset ngoài → chart đổi ngay (live).
- Bấm nút ngày → **desktop: sheet trượt phải; mobile (<768px): bottom sheet**.
- Trong sheet đổi preset/lịch/so sánh → chart **chưa đổi**; **Áp dụng** mới đổi; **Đặt lại** về Tất cả; đóng (X/overlay) không Áp dụng = giữ nguyên.
- Mở lại sheet → seed đúng trạng thái đang áp dụng.
- Chọn range mới trên lịch OK; select Tháng/Năm nhảy đúng; caption ẩn.

---

## Self-Review

**Spec coverage:**
- Preset ngoài live + sheet batch → Task 3 (preset row live) + Task 2 (draft+Apply). ✅
- Đồng bộ preset 2 nơi → state chung (ngoài) + seed nháp (trong, `handleOpenChange`). ✅
- Sheet responsive side → Task 2 (`useIsMobile`). ✅
- Footer Áp dụng/Đặt lại → Task 2 (`handleApply`/`handleReset`). ✅
- DateFilterValue/presetToValue/defaultDateFilter + test → Task 1. ✅
- i18n `filterTitle`/`apply` → Task 2. ✅
- Xóa popover → Task 2 step 3. ✅
- Không đụng backend/chart/summary/table → không task nào vi phạm. ✅

**Placeholder scan:** không TBD; code cụ thể. ✅

**Type consistency:** `DateFilterValue` (Task 1) dùng đồng nhất ở sheet props + `dateFilterValue`/`handleApplyDateFilter` (Task 3). `onApply(value)` khớp. `presetToValue`/`defaultDateFilter`/`suggestPrevious`/`fmt` chữ ký khớp. ✅

**Ghi chú:** Task 2 xóa popover → dashboard lỗi import tới Task 3; làm 2+3 liền nhau. Không commit.
