# Customer Registration — Period Comparison & Trend Line

**Date:** 2026-07-09
**Scope:** Dashboard đăng ký khách hàng trong tab `customer` (`customer-registration-dashboard` + chart + summary)
**Status:** Approved design → ready for implementation plan

## Mục tiêu

Thêm cho dashboard đăng ký khách hàng:
1. **So sánh 2 khoảng thời gian** tự chọn (kỳ trước / kỳ sau).
2. **Card "Tăng trưởng"** riêng (chỉ hiện khi bật so sánh) thể hiện % thay đổi.
3. **Trend line** (đường xu hướng) trên biểu đồ.

## Quyết định thiết kế (đã chốt với người dùng)

- **Trend line = hồi quy tuyến tính (least-squares)**, 1 đường thẳng. Lý do: số liệu là đếm đăng ký theo bucket thời gian (nhiễu, có gai); đường thẳng đọc ngay hướng + độ dốc, khớp với card tăng trưởng. (Không dùng moving average / cumulative.)
- **Chart khi so sánh = bar nhóm theo vị trí bucket** (kỳ sau cam / kỳ trước xám), trục X = thứ tự bucket 1..n (căn theo vị trí, vì 2 kỳ có thể lệch ngày).
- **Chọn kỳ = 2 kỳ tự do + auto-suggest**: đặt kỳ sau → tự gợi ý kỳ trước = kỳ liền trước cùng độ dài (sửa được).
- **Trend line chỉ vẽ cho kỳ sau** (không vẽ kỳ trước — tránh rối).
- **Card tăng trưởng là card RIÊNG** (không phải badge), % to, `text-green-500` khi tăng / `text-destructive` khi giảm.
- **State so sánh là ephemeral** (toggle + kỳ trước/sau) — KHÔNG lên URL, giống dashboard hiện tại.

## Kiến trúc & data flow

- Backend `getUserStatistics({startDate, endDate, groupBy})` chỉ query **1 khoảng** → so sánh = gọi `useUserStatistics` **2 lần**:
  - **Kỳ sau** (primary) = `startDate/endDate` hiện có của dashboard.
  - **Kỳ trước** = range thứ 2, chỉ fetch khi bật so sánh (`enabled = compareEnabled`).
  - Cả hai dùng **cùng `groupBy`**.
- Trả về mỗi kỳ: `{ data: [{time, count}], total }`.
- Card + chart tính delta/hồi quy ở **client**.
- **Sở hữu fetch:** chart & summary tiếp tục tự fetch **kỳ sau** như hiện tại. **Dashboard** fetch **kỳ trước** (1 lần, `enabled = compareEnabled`, `groupBy` = groupBy hiện tại của chart) rồi truyền `compareData` (mảng đã sort) + `compareTotal` xuống chart và summary. Tránh mỗi con tự fetch kỳ trước (trùng request).

## Các đơn vị & thay đổi

### A. `customer-registration-dashboard.tsx` — state + điều khiển

- State mới (ephemeral, `useState`):
  - `compareEnabled: boolean` (mặc định `false`).
  - `compareStart: string`, `compareEnd: string` (kỳ trước, full datetime `YYYY-MM-DDTHH:mm:ss`).
- Kỳ sau tiếp tục là `startDate/endDate` sẵn có.
- Nút toggle **"So sánh"** trong toolbar. Khi bật:
  - Hiện thêm khối chọn **Kỳ trước** (dùng `TimeRangeRevenueFilter` như kỳ sau).
  - **Auto-suggest** kỳ trước khi bật hoặc khi kỳ sau đổi: độ dài kỳ sau = `endDate − startDate`; kỳ trước = `[startDate − length − 1day , startDate − 1day]` (kỳ liền trước, cùng độ dài), theo ngày. Người dùng sửa được.
- Truyền xuống chart + summary: dữ liệu kỳ sau, kỳ trước (nếu bật), `compareEnabled`.
- `trigger` (refresh) áp dụng cho cả 2 kỳ.

### B. `customer-registration-chart.tsx` — grouped bars + trend line

- Props thêm: `compareEnabled: boolean`, `compareData?: IUserStatisticsItem[]` (data kỳ trước đã sort).
- **Không so sánh:** 1 bar series (như hiện tại) + **1 line series trend line** (hồi quy trên kỳ sau).
- **Có so sánh:** 2 bar series nhóm theo index bucket:
  - Series "Kỳ sau" (cam `#f89209`), series "Kỳ trước" (xám, vd `#cbd5e1`).
  - Trục X = nhãn theo **vị trí bucket** của kỳ sau (dùng `formatDate(afterItem.time)`); kỳ trước align theo index (`compareData[i]`), độ dài lệch thì phần thiếu = 0/rỗng.
  - Tooltip mỗi bucket: "Kỳ sau: A", "Kỳ trước: B", "Δ: A−B".
  - **Trend line vẫn chỉ cho kỳ sau.**
- **Trend line dựng bằng** `linearRegression` (mục E): tính `slope/intercept` trên các điểm `(index, count)` của kỳ sau; vẽ line series `y = intercept + slope*index` cho từng index, `symbol:'none'`, `smooth:false`, màu riêng (vd xanh `#2563eb`), `lineStyle.type:'dashed'`.
- Điều kiện: kỳ sau có **≥2 điểm** mới vẽ trend line; <2 → ẩn line series.

### C. `customer-registration-summary.tsx` — card Tăng trưởng

- Props thêm: `compareEnabled: boolean`, `compareTotal?: number` (tổng kỳ trước), `compareData?` nếu cần TB.
- **Không so sánh:** giữ nguyên 3 card hiện tại (Tổng KH mới / Hôm nay / TB/ngày).
- **Có so sánh:** thay card **"Hôm nay"** (vô nghĩa với kỳ tùy chọn) bằng card **"Tăng trưởng"**:
  - Nội dung: % thay đổi tổng = `(afterTotal − beforeTotal) / beforeTotal * 100`, làm tròn 1 chữ số.
  - Hiển thị: số % **to**, kèm mũi tên ▲/▼; `text-green-500` nếu ≥ 0, `text-destructive` nếu < 0.
  - Dòng phụ (caption): `kỳ trước: {beforeTotal} → kỳ sau: {afterTotal}`.
  - **Edge case:** `beforeTotal === 0`:
    - `afterTotal > 0` → hiển thị nhãn "Mới" (không tính %), màu green.
    - `afterTotal === 0` → hiển thị "0%" trung tính (dùng `text-muted-foreground`).
- 2 card còn lại (Tổng KH mới, TB/ngày) hiển thị số **kỳ sau** như thường.

### D. Toolbar (trong dashboard)

- Thêm nút toggle "So sánh" (icon vd `GitCompareArrows` / `Scale`) cạnh preset/refresh, nằm trong hàng scroll ngang đã có.
- Khi bật: khối chọn kỳ trước xuất hiện (dưới hàng preset hoặc trong cùng khu điều khiển). Preset vẫn set kỳ sau.

### E. `linearRegression` util (thuần, có test)

- File: `src/utils/linear-regression.ts` (hoặc gộp vào util toán học sẵn có nếu có — kiểm tra `src/utils` trước).
- API:
  ```ts
  interface LinearRegressionResult {
    slope: number
    intercept: number
    at: (x: number) => number
  }
  function linearRegression(points: { x: number; y: number }[]): LinearRegressionResult | null
  ```
  - `null` khi < 2 điểm hoặc mọi x giống nhau (mẫu số 0).
  - Công thức least-squares chuẩn: `slope = Σ((x−x̄)(y−ȳ)) / Σ((x−x̄)²)`, `intercept = ȳ − slope·x̄`.
- **Unit test (Vitest):** đường tăng hoàn hảo (slope đúng), đường giảm, dữ liệu hằng (slope 0), 1 điểm → null, tính `at(x)` đúng.

### F. i18n

- Thêm khoá vào `src/locales/{vi,en}/customer.json` dưới `customer.registrationDashboard`:
  - `compare` (nút So sánh), `previousPeriod`, `currentPeriod`, `growth`, `growthNew` ("Mới"),
    `seriesBefore`, `seriesAfter`, `trendLine`, `deltaLabel`.

## Kiểm thử & hoàn tất

- Unit test `linearRegression`.
- Verify thủ công: bật So sánh → 2 range picker, auto-suggest kỳ trước đúng độ dài; chart thành bar nhóm + tooltip Δ; trend line kỳ sau xuất hiện; card Tăng trưởng đúng dấu/màu; tắt So sánh về giao diện đơn (vẫn còn trend line).
- Edge: kỳ trước rỗng data, before=0, kỳ 1 bucket (trend line ẩn).
- **Không commit** — người dùng tự commit.

## Ngoài phạm vi (YAGNI)

- Không đổi backend (chỉ gọi 2 lần client).
- Không thêm moving average; không so sánh >2 kỳ.
- Không đưa state so sánh lên URL.
- Không đụng bảng khách hàng / filter URL của tab.
