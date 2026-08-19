# Customer Tab — URL State Refactor & Fixes

**Date:** 2026-07-08
**Scope:** Tab "Khách hàng" của `/system/customer-and-marketing-management?tab=customer`
**Status:** Approved design → ready for implementation plan

## Bối cảnh

Tab Khách hàng gồm dashboard đăng ký (summary + chart ECharts) và bảng khách hàng
(phân trang, tìm SĐT, quét RFID/QR, quản lý thẻ thành viên). Phân tích code hiện tại
phát hiện các nhóm vấn đề: bug chức năng phân trang, không persist filter lên URL
(bookmark hỏng), re-render thừa, coupling dashboard↔bảng, và một số polish UX/i18n.

## Nguyên tắc kiến trúc

**URL = single source of truth cho state của BẢNG.**
- Toàn bộ state bảng (page, size, phone, card, from, to) nằm trên `searchParams`;
  đọc khi mount, ghi khi đổi → bookmark/refresh/share link khôi phục đúng.
- State DASHBOARD (preset thời gian, groupBy) là **ephemeral**, phục vụ xem thống kê,
  **không** lên URL. Dashboard đã được decouple khỏi bảng.

### URL schema

```
?tab=customer&page=1&size=10&phone=<sdt>&card=<rfid>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
```

- `phone` và `card` **loại trừ lẫn nhau** — set cái này xoá cái kia (giữ logic hiện tại).
- Đổi **bất kỳ** filter nào (`phone`/`card`/`from`/`to`/`size`) → **reset `page=1`**.
- Param vắng mặt = không áp dụng filter đó. `page` mặc định 1, `size` mặc định 10.
- Hydrate từ URL khi mount **không** được reset page (chỉ thao tác người dùng mới reset).

## Các đơn vị & thay đổi

### B. Hook mới `useCustomerListFilters` (test được độc lập)

- File: `src/app/system/customers/hooks/use-customer-list-filters.ts` (hoặc cạnh tabscontent).
- Trách nhiệm: nơi **duy nhất** đọc/ghi `searchParams` cho state bảng.
- API (đề xuất):
  ```ts
  const {
    page, size, phone, card, from, to,   // values đọc từ URL
    setPage, setSize,                     // setSize reset page=1
    setPhone,                             // set phone, clear card, reset page=1
    setCard,                              // set card, clear phone, reset page=1
    setDateRange,                         // set from/to, reset page=1
    reset,                                // xoá phone/card/from/to, reset page=1
  } = useCustomerListFilters()
  ```
- Thay cho: `usePagination` (trùng lặp) + 3 `useState` (phone/card/dateRange) trong tabscontent.
- **Unit test (Vitest):** đọc giá trị từ URL, mỗi setter ghi đúng param + reset page,
  phone/card loại trừ nhau, `reset` xoá đúng.

### C. `DataTable` — thêm props opt-in (backward-compatible)

`<DataTable>` được dùng ở 56 nơi → **không đổi hành vi mặc định**. Chỉ thêm props tùy chọn:

- **Controlled pagination (1a):**
  - `pageIndex?: number` (0-based). Khi truyền → bật controlled: gắn `state.pagination`,
    đồng bộ nút first/prev/next/last và `getCanPrevious/NextPage` với `pageIndex`+`pages`.
    Bỏ phép cộng `+2`/`+0` mong manh.
  - `onPaginationChange?: (pageIndex0: number, pageSize: number) => void` — callback dùng
    trong controlled mode. Khi **không** truyền `pageIndex` → giữ nguyên hành vi uncontrolled
    hiện tại (dùng `onPageChange`/`onPageSizeChange` cũ).
- **Search value từ URL (5c):**
  - `searchValue?: string` — init/đồng bộ ô Input search từ URL, tránh lệch sau F5.
  - Lần hydrate đầu **không** được kích hoạt reset page (tránh vòng lặp với 1b).
- **Sort arrow (🟢):** khi cột chưa sort, không hiện mũi tên DESC gây hiểu nhầm.

### D. Tabscontent — lắp ráp lại

File: `src/components/app/tabscontent/system-customer-management.tabscontent.tsx`
- Dùng `useCustomerListFilters` thay `usePagination` + `useState` rải rác.
- `columns` bọc `useMemo` (không gọi `useUserListColumns()` thẳng trong JSX). (2)
- `data?.result?.items` / `data?.result?.totalPages` — optional-chain đủ để tránh crash. (2)
- Truyền `pageIndex`, `onPaginationChange`, `searchValue` xuống DataTable (controlled).
- `useUsers` nhận filter từ hook → **một** lần fetch khi load (double-fetch biến mất
  nhờ decouple ở mục E). (1c)
- Toast "không tìm thấy" áp dụng cho **cả** phone lẫn card, không chỉ card. (🟢)

### E. Decouple dashboard ↔ bảng (issue 3)

- Bỏ prop `onDateRangeChange` nối `CustomerRegistrationDashboard` → bảng.
- Dashboard giữ preset/groupBy riêng chỉ cho chart + summary.
- Bảng có **filter ngày riêng**, dùng sẵn `hiddenDatePicker`/`onDateChange` của DataTable,
  map vào `from`/`to` trên URL qua `useCustomerListFilters`.
- Hệ quả: bỏ luôn effect gây fetch lần 2 lúc mount → giải quyết 1c.

### F. Tabs wrapper (1d)

File: `src/components/app/tabs/system-customer-and-marketing-management.tabs.tsx`
- Chuyển `<Tabs>` sang **controlled** `value={tab}` + `onValueChange` (thay `defaultValue`),
  để redirect theo permission đổi đúng panel hiển thị.

### G. Polish 🟢

File: `src/app/system/customers/DataTable/actions/rfid-filter.tsx`
- Bỏ các ternary trùng hai nhánh (dead code).
- Đưa chuỗi hardcode "Quét thẻ / QR…" vào i18n (`t()`), đồng bộ với phần còn lại.
- `onClear`: bỏ nếu thừa, hoặc nối lại cho đúng chức năng clear.
- `customer-action.tsx`: bỏ fallback vô nghĩa `t(...) || 'Reset'`.

## Thứ tự thực thi (subagent-driven)

1. **B** — hook `useCustomerListFilters` + unit test.
2. **C** — DataTable props opt-in (controlled pagination + searchValue + sort arrow).
   *(B và C độc lập → có thể song song.)*
3. **E** — decouple dashboard ↔ bảng.
4. **D** — tabscontent lắp ráp lại (phụ thuộc B, C, E).
5. **F** — tabs wrapper controlled.
6. **G** — polish RFID/i18n.

## Ngoài phạm vi (YAGNI)

- Không đổi hành vi mặc định của DataTable cho 55 trang khác.
- Không persist state dashboard (preset/groupBy) lên URL.
- Không refactor các tab khác (voucher/promotion/campaign/customer-group).
- Không gộp 2 request `useUserStatistics` (summary vs chart) — để lần sau nếu cần.

## Kiểm thử & hoàn tất

- Unit test cho `useCustomerListFilters` (Vitest).
- Verify thủ công: bookmark link có filter → F5 khôi phục đúng; phân trang deep-link
  `?page=N` hoạt động đúng (prev/next không lệch); đổi filter reset về trang 1;
  decouple dashboard không còn lọc bảng.
- **Không commit** — người dùng tự commit.
