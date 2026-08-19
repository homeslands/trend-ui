# Unified Date Range + Compare Popover (GA-style)

**Date:** 2026-07-09
**Scope:** Toolbar của dashboard đăng ký khách hàng (tab `customer`)
**Status:** Approved design → ready for implementation plan

## Mục tiêu

Gộp toàn bộ điều khiển thời gian rời rạc (dải preset + "Tuỳ chọn khoảng" + nút "So sánh" + hàng "Chọn kỳ trước") thành **một popover ngày duy nhất kiểu Google Analytics**: preset + khoảng tùy chọn + so sánh + kỳ trước, tất cả trong một chỗ. Làm gọn toolbar, đúng thói quen người dùng.

## Quyết định đã chốt

- **Đưa hết vào popover**; toolbar chỉ còn 1 nút ngày (+ refresh/reset).
- **Áp dụng trực tiếp** — không có nút "Áp dụng"; mỗi lựa chọn cập nhật state ngay (chỉ emit khi range đủ from+to).
- **Calendar range 1 tháng** (gọn cho popover).
- Dùng `Calendar mode="range"` **inline** (react-day-picker v8) — KHÔNG lồng popover-trong-popover (tránh lỗi đóng nhầm).
- State so sánh vẫn **ephemeral** (không lên URL). Data flow không đổi.

## Kiến trúc

- **`DateRangeComparePopover`** — component *controlled*, thuần trình bày. Dashboard giữ toàn bộ state (nguồn sự thật) + fetch; popover nhận value + callback.
- **Tách helper preset** ra file dùng chung để cả dashboard lẫn popover dùng và test được.
- Chart/summary vẫn tự fetch kỳ sau; dashboard fetch kỳ trước và truyền xuống (giữ nguyên).

### File structure

- Create `src/app/system/customers/components/registration-range.constants.ts`
  - Export: `Preset` (union), `ALL_TIME_START`, `fmt(m)`, `PRESETS[]`, `PRESET_GROUPBY`,
    `presetRange(preset)`, `suggestPrevious(afterStart, afterEnd)`, `formatRangeLabel(activePreset, startDate, endDate, tAllTimeLabel)`.
  - Đây là các hàm/hằng hiện đang nằm trong `customer-registration-dashboard.tsx` — chuyển ra, dashboard import lại.
- Create `src/app/system/customers/components/date-range-compare-popover.tsx` — popover UI.
- Modify `src/app/system/customers/components/customer-registration-dashboard.tsx` — thay cụm điều khiển cũ bằng popover; giữ state; thêm `handleUseSamePeriod`; import helpers từ constants.
- Modify `src/locales/{vi,en}/customer.json` — thêm khoá.
- Test `src/app/system/customers/components/__tests__/registration-range.constants.test.ts` — test `suggestPrevious`.

## Component: `DateRangeComparePopover`

### Props (controlled)
```ts
interface DateRangeComparePopoverProps {
  startDate: string                 // full datetime, 'YYYY-MM-DDTHH:mm:ss'
  endDate: string
  activePreset: Preset | null
  onSelectPreset: (preset: Preset) => void
  onSelectRange: (start: string, end: string) => void        // args 'YYYY-MM-DD'
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  onToggleCompare: () => void
  onSelectCompareRange: (start: string, end: string) => void  // args 'YYYY-MM-DD'
  onUseSamePeriod: () => void
}
```

### Trigger
- `<Button variant="outline">` hiển thị `formatRangeLabel(...)` + đuôi ` · {t('compare')}` khi `compareEnabled`, kèm icon lịch + chevron.

### Nội dung popover (PopoverContent, w ~ 20rem)
1. **Preset**: các nút từ `PRESETS`, highlight khi `activePreset === p.key`, onClick → `onSelectPreset(p.key)`.
2. **Khoảng thời gian** (label `dateRange`): `<Calendar mode="range" numberOfMonths={1}>`,
   `selected = { from: parse(startDate), to: parse(endDate) }`,
   `onSelect(range)` → nếu `range?.from && range?.to` → `onSelectRange(fmtYMD(range.from), fmtYMD(range.to))`.
   `disabled` các ngày tương lai.
3. Gạch ngăn.
4. **Checkbox** `compareWithPrevious` (label) ↔ `compareEnabled`, onChange → `onToggleCompare()`.
5. Khi `compareEnabled`:
   - Nút **`samePeriod`** ("Kỳ liền trước") → `onUseSamePeriod()`.
   - Text khoảng kỳ trước hiện tại: `compareStart–compareEnd` (DD/MM/YYYY) hoặc "—".
   - `<Calendar mode="range" numberOfMonths={1}>` cho kỳ trước, `selected` từ `compareStart/compareEnd`, `onSelect` → `onSelectCompareRange(...)`, chặn ngày tương lai.

Ghi chú: `fmtYMD(date) = moment(date).format('YYYY-MM-DD')`. Parse: `startDate ? moment(startDate).toDate() : undefined`.

## Dashboard thay đổi

- Import helpers từ `registration-range.constants` (bỏ định nghĩa nội bộ trùng lặp).
- Giữ nguyên state: `startDate/endDate/activePreset/groupBy/compareEnabled/compareStart/compareEnd`, handlers `handleSelectPreset/handleSelectDateRange/handleToggleCompare/handleSelectCompareRange`.
- Thêm `handleUseSamePeriod`:
  ```ts
  const handleUseSamePeriod = () => {
    const s = suggestPrevious(startDate, endDate)
    setCompareStart(s.start)
    setCompareEnd(s.end)
  }
  ```
- **Thay** khối toolbar cũ (Badge rangeLabel + dải preset + `TimeRangeRevenueFilter` + nút So sánh + hàng "Chọn kỳ trước") **bằng**:
  ```tsx
  <div className="flex flex-nowrap gap-2 items-center overflow-x-auto scrollbar-hide lg:justify-end [&>*]:shrink-0">
    <DateRangeComparePopover {...} />
    <TooltipProvider>… refresh, reset …</TooltipProvider>
  </div>
  ```
- Giữ nút **"Xem danh sách khoảng này"** (`onApplyToList`) ở đâu? → chuyển vào cụm icon cạnh refresh/reset (giữ như hiện tại, icon + tooltip). Không bỏ.
- `TimeRangeRevenueFilter` không còn dùng trong dashboard (component vẫn giữ cho nơi khác).
- Badge `rangeLabel` cũ ở đầu hàng: bỏ (nhãn đã nằm trên nút popover).

## i18n (thêm dưới `customer.registrationDashboard`)

vi: `"dateRange": "Khoảng thời gian"`, `"compareWithPrevious": "So sánh với kỳ trước"`, `"samePeriod": "Kỳ liền trước"`
en: `"dateRange": "Date range"`, `"compareWithPrevious": "Compare with previous period"`, `"samePeriod": "Previous period"`
(Tái dùng: `compare`, `previousPeriod`, các `preset*`.)

## Kiểm thử & hoàn tất

- Unit test `suggestPrevious` (Vitest): kỳ 7 ngày → gợi ý 7 ngày liền trước; kỳ 1 ngày → ngày liền trước; đúng độ dài & liền kề.
- Verify thủ công: mở popover → chọn preset/khoảng → chart+summary cập nhật; bật So sánh → "Kỳ liền trước" + calendar kỳ trước hoạt động; nhãn nút hiện đúng khoảng + "· So sánh"; đóng/mở popover không lỗi; các trang khác dùng `TimeRangeRevenueFilter` không đổi.
- **Không commit** — người dùng tự commit.

## Ngoài phạm vi (YAGNI)

- Không nút "Áp dụng" (áp trực tiếp).
- Không calendar 2 tháng.
- Không đổi groupBy select (giữ ở góc biểu đồ).
- Không đụng filter ngày của bảng / URL của tab / backend.
- Không đưa state so sánh lên URL.
