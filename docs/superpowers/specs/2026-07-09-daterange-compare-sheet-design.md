# Date Range + Compare → Responsive Sheet (with outside presets)

**Date:** 2026-07-09
**Scope:** Toolbar dashboard đăng ký khách hàng (tab `customer`)
**Status:** Approved design → ready for implementation plan

## Mục tiêu

Chuyển bộ chọn thời gian từ **Popover** sang **Sheet responsive** (trượt phải desktop / bottom-sheet mobile) để rộng rãi + có footer **Áp dụng/Đặt lại**; đồng thời **đưa dải preset ra ngoài toolbar** (thao tác nhanh, thường xuyên), đồng bộ với preset trong sheet.

## Quyết định đã chốt

- **Preset ngoài toolbar = áp dụng NGAY (live)**. Bấm là chart đổi luôn.
- **Trong Sheet = nháp (draft) + footer "Áp dụng"/"Đặt lại" (batch)**. Thay đổi trong sheet chỉ vào nháp; "Áp dụng" mới commit; "Đặt lại" = về mặc định (Tất cả, tắt so sánh); đóng sheet không Áp dụng = bỏ nháp.
- **Seed nháp** = trạng thái đang áp dụng, mỗi lần mở sheet.
- **Preset ở cả 2 nơi**, đồng bộ qua state chung (ngoài) + seed nháp (trong).
- **Sheet side** = `useIsMobile() ? 'bottom' : 'right'`.
- Data flow/chart/summary/trend không đổi. Backend không đổi. State vẫn ephemeral (không URL).

## Kiến trúc

- **Dashboard** giữ state áp dụng (nguồn sự thật) + fetch. Render: **dải preset ngoài (live)** + **`DateRangeCompareSheet`** (nút mở + sheet) + cụm icon (danh sách/refresh/reset).
- **`DateRangeCompareSheet`** controlled: nhận `value` (trạng thái áp dụng) + `onApply(value)`. Tự quản **draft** bên trong; commit qua `onApply` khi bấm "Áp dụng".
- Preset ngoài dùng `handleSelectPreset` (live) đã có; preset trong sheet sửa draft.

### File structure

- Modify `registration-range.constants.ts`: thêm `interface DateFilterValue`, `presetToValue(preset)`, `defaultDateFilter()`.
- Create `date-range-compare-sheet.tsx` (thay `date-range-compare-popover.tsx` — **xóa** file popover).
- Modify `customer-registration-dashboard.tsx`: dải preset ngoài + sheet + `handleApplyDateFilter`.
- Modify `src/locales/{vi,en}/customer.json`: thêm `apply`, `reset` (reuse `reset` sẵn có), tiêu đề sheet.
- Test: `registration-range.constants.test.ts` thêm test `presetToValue` + `defaultDateFilter`.

## Kiểu dữ liệu (constants)

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

export const presetToValue = (preset: Preset): Pick<
  DateFilterValue,
  'startDate' | 'endDate' | 'groupBy' | 'activePreset'
> => {
  const r = presetRange(preset)
  return { startDate: r.start, endDate: r.end, groupBy: PRESET_GROUPBY[preset], activePreset: preset }
}

export const defaultDateFilter = (): DateFilterValue => ({
  ...presetToValue('allTime'),
  compareEnabled: false,
  compareStart: '',
  compareEnd: '',
})
```

## Component `DateRangeCompareSheet`

### Props
```ts
interface DateRangeCompareSheetProps {
  value: DateFilterValue
  onApply: (value: DateFilterValue) => void
}
```

### State nội bộ
- `open: boolean` (Sheet). `onOpenChange`: khi mở → `setDraft(value)` (seed).
- `draft: DateFilterValue` (khởi tạo = value).
- `showCurrentCalendar` = `draft.activePreset === null`; `showCompareCalendar` = false.
- `currentDraft`/`compareDraft` (DateRange) cho 2 calendar — như logic popover cũ (draft + bắt-đầu-lại khi click ngày mới khi range đủ).
- `isMobile = useIsMobile()` → `side = isMobile ? 'bottom' : 'right'`.

### Trigger
`SheetTrigger` bọc `<Button variant="outline" className="gap-2 justify-between min-w-[15rem]">` hiển thị `formatRangeLabel(value.activePreset, value.startDate, value.endDate, allTimeLabel)` + ` · {compare}` khi `value.compareEnabled` + icon lịch/chevron.

### Nội dung sheet (SheetContent)
- `SheetHeader` + `SheetTitle`: "Khoảng thời gian".
- **Preset**: lưới 3 cột; bấm → cập nhật **draft** bằng `presetToValue(p)` + `setShowCurrentCalendar(false)`; highlight khi `!showCurrentCalendar && draft.activePreset === p.key`.
- **Chip "Tùy chọn"** → `setShowCurrentCalendar(true)`; highlight khi `showCurrentCalendar`.
- **Lịch kỳ hiện tại** (khi `showCurrentCalendar`): select Tháng/Năm + `Calendar mode="range"` (caption ẩn), chọn → cập nhật `draft.startDate/endDate` (chuẩn hoá `startOf/endOf('day')`, `activePreset=null`).
- Gạch ngăn.
- **Checkbox "So sánh với kỳ trước"** ↔ `draft.compareEnabled`; khi bật mà chưa có compare range → seed `suggestPrevious(draft.startDate, draft.endDate)`.
- Khi bật: card [Kỳ trước + range text] + [Kỳ liền trước | Chọn khoảng khác] + lịch kỳ trước (khi "Chọn khoảng khác").
- `SheetFooter`: **[Đặt lại]** (`setDraft(defaultDateFilter())` + reset showCurrent/showCompare) và **[Áp dụng]** (`onApply(draft)` + `setOpen(false)`).

### Chuẩn hoá ngày
- Preset: dùng nguyên `presetToValue` (full datetime).
- Calendar emit `YYYY-MM-DD` → `fmt(moment(x).startOf('day'))` / `endOf('day')` khi ghi vào draft (giống popover cũ).

## Dashboard

- Giữ state + `handleSelectPreset` (live, cho preset ngoài).
- `value: DateFilterValue` = gom từ state áp dụng.
- `handleApplyDateFilter(v)`: set toàn bộ startDate/endDate/activePreset/groupBy/compareEnabled/compareStart/compareEnd từ `v`.
- Toolbar:
  ```
  <div className="flex flex-nowrap gap-2 items-center overflow-x-auto scrollbar-hide lg:justify-end [&>*]:shrink-0">
    <PresetRow (live, dùng handleSelectPreset, highlight theo activePreset) />
    <DateRangeCompareSheet value={value} onApply={handleApplyDateFilter} />
    <TooltipProvider> applyToList? / refresh / reset </TooltipProvider>
  </div>
  ```
- Preset ngoài: có thể render inline hoặc tách `RegistrationPresetRow` nhỏ (tùy chọn — giữ inline cho gọn).

## i18n (thêm dưới `customer.registrationDashboard`)

vi: `"apply": "Áp dụng"`, `"filterTitle": "Khoảng thời gian"` (reuse `reset`="Đặt lại", `custom`, `selectOtherRange`, `samePeriod`, `compareWithPrevious`, `dateRange`, `previousPeriod`, presets).
en: `"apply": "Apply"`, `"filterTitle": "Date range"`.

## Kiểm thử & hoàn tất

- Unit test `presetToValue` (allTime → activePreset='allTime', groupBy=YEAR, startDate=ALL_TIME_START) + `defaultDateFilter` (compareEnabled=false, compareStart/End='').
- Verify thủ công:
  - Desktop: nút mở → sheet trượt **phải**; mobile (thu nhỏ <768px): **bottom sheet**.
  - Preset ngoài → chart đổi ngay; mở sheet thấy preset đó highlight (seed đúng).
  - Trong sheet đổi preset/lịch/so sánh → chart **chưa đổi**; bấm **Áp dụng** mới đổi; **Đặt lại** về Tất cả; đóng không Áp dụng = giữ nguyên.
  - Chọn range mới trên lịch hoạt động (bắt đầu lại khi range đủ).
- **Không commit** — người dùng tự commit.

## Ngoài phạm vi (YAGNI)

- Không đưa state lên URL. Không đổi backend. Không đổi groupBy select ở biểu đồ (vẫn live riêng). Không đụng filter ngày của bảng/chart/summary logic.
- Không làm 2-tháng calendar (giữ 1 tháng).
