# Dashboard Chi tiêu khách hàng — ghép chung tab với Khách mới

- **Task:** TRE-441 (phần *Coin Usage Report*)
- **Ngày:** 2026-07-17
- **Trạng thái:** Design đã chốt, chờ implement
- **Nhánh:** `feature/TRE-441-FE-Optimize-User-Registration-Trend-Chart-Period-Comparison-Filter-and-Coin-Usage-Report`

## 1. Mục tiêu

Tab **Khách hàng** hiện chỉ có dashboard *Khách mới đăng ký* (`/user/statistics`) và bảng danh bạ. Bổ sung
thống kê **chi tiêu khách hàng** (`/revenue/account`) vào **cùng tab**, bố trí sao cho theo dõi được cả hai
cùng lúc.

Giá trị cốt lõi của việc ghép chung: mở ra insight mà **không dashboard nào có một mình** — tương quan giữa
lượng khách mới và tiền họ tiêu, cùng **tỉ lệ chuyển đổi** khách mới → có chi tiêu.

## 2. Bố cục — Phương án C: hai chart căn chung trục thời gian

```
[ Toolbar: ngày chung · groupBy chung | chi nhánh · phương thức · loại khách · SĐT ]
[ KPI gộp:  Khách mới | Tổng chi tiêu | Khách mới có chi tiêu (chuyển đổi) | TB/khách ]
[ Thanh phân bổ phương thức: bank ▓▓▓ cash ▓▓ point ▓ credit ▏  42% / 28% / 19% / 11% ]
[ Khung chart:                                                                        ]
[   panel 1 — Khách mới (trục Y: khách)      cột cam  + kỳ trước + trend             ]
[   panel 2 — Chi tiêu  (trục Y: triệu đ)    cột xanh + kỳ trước + trend             ]
[   ─── một trục X duy nhất ở đáy, dùng chung ───                                     ]
[ Bảng dữ liệu:  [ Danh bạ | Chi tiêu ]  ← switch ĐỘC LẬP với chart                  ]
```

### 2.1. Vì sao không phải chart 2 trục Y

Hai trục Y (người và tiền) căn với nhau **tuỳ ý** → chart tự bịa ra tương quan không có trong dữ liệu. Đây là
anti-pattern trực quan hoá số một. Cách đúng cho hai đại lượng khác thang đo: **hai panel riêng, mỗi panel một
trục Y, căn chung trục X**. Mắt vẫn đối chiếu theo cột dọc, nhưng mỗi đại lượng giữ thang đo trung thực.

> **Ràng buộc bất di bất dịch:** không bao giờ vẽ hai thang Y trong một plot.

### 2.2. Vì sao không phải xếp chồng hai dashboard đầy đủ

Đã cân nhắc và loại: (a) bảng dưới mất "chủ sở hữu" — không rõ là danh bạ hay chi tiêu; (b) toolbar trộn filter
của hai khối, không rõ cái nào áp cho khối nào; (c) trang dài, hai chart rời nhau nên **trục X không căn** →
mất chính insight cần có.

### 2.3. Hệ quả: bảng có switch độc lập

Quyết định trước đó ("bảng dưới hoán đổi theo view") **bị thay thế**. Vì cả hai dashboard cùng hiện, bảng không
còn thuộc về view nào → bảng mang switch riêng `[Danh bạ | Chi tiêu]`, tách bạch khỏi phần chart.

## 3. Thay đổi hợp đồng API (cần Backend)

`/revenue/account` nhận thêm `groupBy` và trả thêm chuỗi thời gian. **Giữ nguyên** `summary` + `customer[]`.

```ts
// ICustomerAccountRevenueQuery — thêm:
groupBy?: UserStatisticsGroupBy   // 'hour' | 'day' | 'week' | 'month' | 'year'

// ICustomerAccountRevenue — thêm:
data: { time: string; totalAmount: number }[]   // tổng chi tiêu theo từng bucket
```

- `time` định dạng `'YYYY-MM-DDTHH:mm:ss'` (local, không timezone) — **khớp với `/user/statistics`** để
  `fillTimeBuckets` dùng chung được.
- Tái dùng enum `UserStatisticsGroupBy` (đã có `WEEK`, khác `RevenueTypeQuery` vốn thiếu `week`).

### 3.1. Xuống cấp khi Backend chưa xong

Panel chi tiêu hiển thị **empty state** (không vỡ layout), panel khách mới vẫn chạy bình thường. KPI chi tiêu
vẫn hiện được vì `summary` không phụ thuộc `groupBy`. Chỉ panel chart là chờ BE.

## 4. Bộ lọc & state trên URL

```
/system/customers?tab=customer
  &from=YYYY-MM-DD & to=YYYY-MM-DD    ← DÙNG CHUNG cả 2 panel
  &gb=day                              ← groupBy, DÙNG CHUNG (bắt buộc: 2 panel chung trục X)
  &cmp=1 & cfrom= & cto=               ← compare bật/tắt + khoảng kỳ trước, DÙNG CHUNG cả 2 panel
  &branch= & pm= & ctype= & phone=     ← chỉ tác động khối chi tiêu
  &tbl=dir|spend                       ← bảng đang mở
  &page= & size=                       ← phân trang bảng danh bạ
```

- **Ngày & groupBy dùng chung** — trục X chung nên không thể tách.
- **Compare kỳ trước** bật/tắt chung, áp cho **cả hai panel** (đối xứng; KPI `%` tăng trưởng của cả hai đều cần
  số kỳ trước). Kỳ trước suy ra bằng `suggestPrevious` (cùng độ dài ngày, liền kề).
- 4 filter riêng của chi tiêu (`branch`, `pm`, `ctype`, `phone`) **không** ảnh hưởng panel khách mới.

> **Ghi chú UX:** toolbar phải gom nhóm rõ — nhóm trái = "áp cho cả hai" (ngày, groupBy, compare), nhóm phải =
> "chỉ chi tiêu". Nếu không, người dùng sẽ tưởng filter chi nhánh áp cho cả biểu đồ khách mới.

## 5. KPI gộp

| KPI | Nguồn | Ghi chú |
|---|---|---|
| Khách mới | `/user/statistics` → `result.total` | |
| Tổng chi tiêu | `/revenue/account` → `summary.totalAmount` | format VND |
| **Khách mới có chi tiêu (chuyển đổi)** | `customer[].length` ÷ `statistics.total` | **xem ràng buộc dưới** |
| TB mỗi khách | `summary.totalAmount ÷ customer[].length` | |

### 5.1. Ràng buộc của KPI chuyển đổi

Đây là số **ghép từ hai nguồn khác nhau**, chỉ có nghĩa khi:
- `customerType = new-register` (tử số mới là khách mới), **và**
- hai request dùng **cùng khoảng ngày**.

Khi `customerType = all`, mẫu số ("khách mới trong kỳ") không khớp tử số ("mọi khách có chi tiêu") → **ẩn KPI
này**, thay bằng "Số khách có chi tiêu" (số tuyệt đối, không kèm %). Không được hiển thị tỉ lệ sai.

## 6. Phân bổ phương thức thanh toán

**Thanh ngang xếp lớp** một dòng, 4 đoạn (bank / cash / point / credit), **khe 2px giữa các đoạn**, kèm nhãn %
và số tiền. Nguồn: `summary.percentBank/percentCash/percentPoint/percentCreditCard` + số tiền tương ứng.

Không dùng donut: các giá trị khá gần nhau (vd 42/28/19/11) → thanh/số so sánh tốt hơn, và donut chiếm diện
tích tranh chỗ với hai panel thời gian.

## 7. Bảng "Chi tiêu theo khách"

- Cột: Tên khách · Ngày đăng ký · **Tổng chi** · Bank · Cash · Point · Credit card.
- Nguồn `customer[]` — **không phân trang server**, trả về đủ trong một response.
- **Sắp xếp client-side** (mặc định Tổng chi ↓).
- Click hàng → `ROUTE.STAFF_CUSTOMER_MANAGEMENT/:customerSlug`.
- **Xuất CSV client-side** (không thêm dependency — repo chưa có xlsx/sheetjs; CSV mở được bằng Excel).
- Số căn phải, `font-variant-numeric: tabular-nums`.

Bảng **Danh bạ** giữ nguyên toàn bộ hành vi hiện có (tìm SĐT, quét RFID/QR, actions, phân trang server).

## 8. Màu sắc (đã chạy validator)

| Vai trò | Light | Dark | Ghi chú |
|---|---|---|---|
| Khách mới | `#f89209` | `#c97a07` | cam thương hiệu; bước dark **re-step** cho nền tối, không lật máy móc |
| Chi tiêu | `#2a78d6` | `#3987e5` | |
| Kỳ trước | `#cbd5e1` | `#4d5561` | xám tham chiếu, **cố ý phi-định-danh** |
| Trend | dashed, mực phụ | dashed, mực phụ | |

- Cặp cam↔xanh: **CVD ΔE 29.9 (light) / 21.5 (dark)** — ngưỡng ≥8, dư an toàn cho người mù màu.
- `#f89209` trên nền trắng có contrast 2.31 (<3:1) → **bắt buộc có relief**: nhãn trục hiện rõ + bảng dữ liệu
  tồn tại. Cả hai đều có → đạt.
- Legend luôn hiện khi ≥2 series; **không** bao giờ dùng màu làm kênh phân biệt duy nhất.

## 9. Tổ chức file

```
app/system/customers/
  components/
    customer-analytics-panel.tsx          ← MỚI: toolbar + KPI gộp + khung chart 2 panel
    customer-registration-dashboard.tsx   ← thu gọn: chỉ còn panel khách mới
    spending/
      customer-spending-summary.tsx       ← KPI chi tiêu + thanh phương thức
      customer-spending-panel.tsx         ← panel chart chi tiêu
      customer-spending-table.tsx         ← bảng customer[] + CSV
      spending-csv.ts                     ← thuần hàm, dễ test
  hooks/
    use-customer-analytics-filters.ts     ← MỚI: URL state (from/to/gb/compare + branch/pm/ctype/phone)
    use-customer-list-filters.ts          ← giữ: state bảng danh bạ
  DataTable/
    columns/customer-spending-columns.tsx ← MỚI
```

Tái dùng nguyên trạng: `fillTimeBuckets`, `linearRegression`, `suggestPrevious`, `formatRangeLabel`,
`DateRangeCompareSheet`, `useCustomerAccountRevenue`, `useUserStatistics`, `formatCurrency`, `branch-select`,
`staff-payment-method-select`.

`customer-tab-view.tsx` **không cần** — vì bỏ segmented, `SystemCustomerManagementTabsContent` chỉ cần render
`CustomerAnalyticsPanel` + khu bảng có switch.

## 10. Kiểm thử

| Đơn vị | Kiểm thử |
|---|---|
| `spending-csv.ts` | escape dấu phẩy/nháy trong tên khách; hàng rỗng; format số |
| `use-customer-analytics-filters.ts` | đọc/ghi URL; đổi filter reset `page`; ngày & groupBy dùng chung |
| KPI chuyển đổi | **ẩn khi `ctype=all`**; tính đúng khi `ctype=new-register`; mẫu số 0 → không chia 0 |
| `customer-spending-table.tsx` | sắp xếp desc mặc định; click hàng điều hướng đúng slug |
| Panel chi tiêu | `data` rỗng → empty state, không vỡ layout |

Stack sẵn có: Vitest. Theo mẫu `__tests__` đang dùng trong module này.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| **BE chưa có `groupBy`** → panel chi tiêu rỗng, C mất một nửa giá trị | Empty state tử tế; KPI + bảng + thanh phương thức vẫn chạy (không phụ thuộc `groupBy`). Nếu BE trượt timeline, cân nhắc tạm ẩn panel chi tiêu thay vì để khung rỗng. |
| Mở tab tải tới **4 request** (khách mới, khách mới kỳ trước, chi tiêu, chi tiêu kỳ trước) | `keepPreviousData` đã bật sẵn trong các hook; compare chỉ gọi khi bật. |
| Hai panel chia đôi chiều cao → chart thấp, khó đọc | Panel dưới cao hơn panel trên (chứa trục X); tối thiểu ~150px/panel. |
| Mobile hai tầng chart chật | Panel xếp dọc vốn đã hợp mobile; trục X chung giảm được một hàng nhãn. |
| Toolbar hai nhóm filter gây hiểu nhầm phạm vi | Gom nhóm + nhãn rõ ràng (mục 4). |

## 12. Ngoài phạm vi

- Xuất Excel thật (.xlsx) — cần thêm dependency; CSV đủ dùng.
- Chi tiêu theo thời gian **cho từng khách lẻ** — endpoint không hỗ trợ.
- Đổi bảng danh bạ sang sắp xếp/lọc phía server.
