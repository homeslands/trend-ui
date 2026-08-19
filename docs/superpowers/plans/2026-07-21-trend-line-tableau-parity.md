# Plan — Trend line theo chuẩn BI/Tableau

Mục tiêu: nâng cách xử lý đường xu hướng ở hai chart (lịch sử xu + thống kê khách hàng)
lên đúng thực hành của công cụ BI: cổng chặn bằng **p-value** thay vì ngưỡng R² cố định,
**dải tin cậy 95%** để độ bất định nhìn thấy được, và popover **"Chi tiết mô hình"**.

Baseline commit: `8f00f8a1f` (toàn bộ UI trang Quản lý xu đã xong, cây sạch, 387 test pass).

## Global Constraints

Áp cho MỌI task:

1. **Thư mục làm việc**: `app/order-ui`. Mọi lệnh verify chạy từ đó bằng binary local:
   - `./node_modules/.bin/tsc -b` → phải exit 0
   - `./node_modules/.bin/eslint <file...>` → phải 0 error
   - `./node_modules/.bin/vitest run` → toàn bộ phải pass
   KHÔNG dùng `npx` (cwd hay bị reset, npx sẽ tải nhầm gói ngoài project).
2. **Style**: không dấu chấm phẩy cuối câu lệnh, nháy đơn, dấu phẩy cuối ở object/array
   nhiều dòng. Bám theo style của file xung quanh.
3. **i18n**: mọi chuỗi hiển thị cho người dùng PHẢI có ở cả `src/locales/vi/*.json` và
   `src/locales/en/*.json`.
   - File `common.json` có cấu trúc **phẳng** ở cấp gốc: `common`, `compare`, `hint`,
     `trend`, `dataTable`, `dayOfWeek`. Gọi bằng `useTranslation('common')` +
     `t('trend.xxx')`.
   - File `gift-card.json` **lồng thêm một cấp**: gốc là `giftCard`, nên key đầy đủ là
     `t('giftCard.pointTransaction.chart.xxx')` và PHẢI dùng translator gắn đúng
     namespace `useTranslation('giftCard')`.
   - Sửa JSON bằng edit thủ công, KHÔNG dùng `JSON.stringify` ghi đè cả file (làm
     reformat toàn bộ, gây diff khổng lồ).
4. **Không bao giờ hai thang Y trong một plot.** Đây là ràng buộc đã ghi trong codebase.
5. **Container ECharts phải LUÔN được render và KHÔNG BAO GIỜ có React children.**
   Loading/empty là lớp phủ anh em (`absolute inset-0`), không phải nhánh ternary thay
   thế container. Vi phạm gây lỗi runtime `removeChild ... is not a child of this node`.
6. **Không đổi hành vi ngoài phạm vi task.** Không refactor thêm, không đổi tên biến
   không liên quan, không "tiện tay dọn".
7. Hai chart bị ảnh hưởng:
   - `src/app/system/card-order-history/components/point-transaction-chart.tsx` (xu)
   - `src/app/system/customers/components/analytics/customer-analytics-chart.tsx` (khách)
   Cả hai dùng chung `src/utils/trend.ts` và `src/components/app/badge/trend-badge.tsx`.

---

## Task 1 — Util thống kê: beta không đầy đủ, p-value, t-quantile

**File mới**: `src/utils/statistics.ts`
**File test mới**: `src/utils/__tests__/statistics.test.ts`

Tạo module toán thuần, không phụ thuộc React/chart.

Export đúng ba hàm sau (chữ ký cố định, các task sau phụ thuộc vào đây):

```ts
/** Beta không đầy đủ đã chuẩn hoá I_x(a,b). Nền tảng cho cả F-test lẫn t-quantile. */
export function regularizedIncompleteBeta(a: number, b: number, x: number): number

/** p-value hai phía cho độ dốc hồi quy tuyến tính đơn biến, từ R² và số điểm n.
 *  Trả về 1 khi df < 1 (không đủ điểm để kiểm định). */
export function pValueFromR2(r2: number, n: number): number

/** Phân vị t hai phía, ví dụ tQuantile(0.975, 5) = 2.571. */
export function tQuantile(p: number, df: number): number
```

Cài đặt đã được kiểm chứng, dùng nguyên (thuật toán Numerical Recipes `betacf`/`betai`):

```ts
const lgamma = (z: number): number => {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = z
  const x = z
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

const betacf = (a: number, b: number, x: number): number => {
  const MAXIT = 200
  const EPS = 3e-14
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
```

`regularizedIncompleteBeta(a, b, x)`: trả 0 khi `x <= 0`, trả 1 khi `x >= 1`; ngược lại
`bt = exp(lgamma(a+b) - lgamma(a) - lgamma(b) + a*ln(x) + b*ln(1-x))`, rồi
`x < (a+1)/(a+b+2) ? bt*betacf(a,b,x)/a : 1 - bt*betacf(b,a,1-x)/b`.

`pValueFromR2(r2, n)`: `df = n - 2`; nếu `df < 1` trả `1`; nếu `r2 >= 1` trả `0`;
ngược lại `F = (r2/(1-r2))*df` rồi trả `regularizedIncompleteBeta(df/2, 0.5, df/(df+F))`.

`tQuantile(p, df)`: tìm nhị phân trên `[0, 100]`, 200 vòng, dùng
`cdf(t) = 1 - 0.5*regularizedIncompleteBeta(df/2, 0.5, df/(df+t*t))`, trả điểm giữa.

**Test bắt buộc** (`statistics.test.ts`) — đối chiếu **bảng tra chuẩn**, không phải
giá trị tự sinh:

- `tQuantile(0.975, df)` với df = 5, 10, 20, 30 → 2.571, 2.228, 2.086, 2.042
  (sai số cho phép 0.005)
- `pValueFromR2(0.018, 7)` ≈ 0.774 và `pValueFromR2(0.025, 7)` ≈ 0.735 (sai số 0.005)
  — đây là dữ liệu xu thật, cả hai đều >> 0.05
- `pValueFromR2(r2, 7)` với r2 = 0.57 → xấp xỉ 0.05 (biên có ý nghĩa ở n = 7)
- `pValueFromR2(x, 3)` → 1 khi n = 2 (df < 1, không đủ điểm)
- `regularizedIncompleteBeta(a, b, 0)` = 0 và `(a, b, 1)` = 1

Thêm `export * from './statistics'` vào `src/utils/index.ts`.

---

## Task 2 — Cổng chặn theo p-value + số mốc tối thiểu

**File sửa**: `src/utils/trend.ts`, `src/utils/__tests__/trend.test.ts`,
`src/components/app/badge/trend-badge.tsx`

Hiện tại `trend.ts` chặn bằng hằng số `MIN_TREND_R2 = 0.1`. Ngưỡng R² cố định là **sai
về nguyên tắc**: với n = 7 phải R² ≥ 0.57 mới đạt p < 0.05, còn với n = 60 thì R² = 0.15
đã có ý nghĩa. Cổng chặn phải phụ thuộc số mốc.

Thay đổi:

1. `TrendResult` thêm hai trường: `pValue: number` và `n: number` (số điểm THỰC SỰ
   tham gia hồi quy, tức sau khi bỏ padding 0 hai đầu — không phải `values.length`).
2. Thêm hằng số, có doc comment giải thích:
   ```ts
   /** Số mốc tối thiểu để hồi quy có ý nghĩa. Dưới ngưỡng này thống kê không đủ lực
    *  phát hiện xu hướng dù dữ liệu trông có dạng. */
   export const MIN_TREND_POINTS = 8
   /** Mức ý nghĩa quy ước. p < 0.05 nghĩa là độ dốc khó có thể chỉ do ngẫu nhiên. */
   export const TREND_SIGNIFICANCE = 0.05
   ```
3. `isTrendVisible(trend)` đổi điều kiện thành:
   `trend !== null && trend.n >= MIN_TREND_POINTS && trend.pValue < TREND_SIGNIFICANCE`
4. **Xoá** `MIN_TREND_R2` (không còn ai dùng). GIỮ `WEAK_TREND_R2` — `TrendBadge` vẫn
   dùng nó để làm mờ badge khi độ khớp yếu.

Cập nhật `trend.test.ts` cho khớp — các test hiện có tham chiếu `MIN_TREND_R2` sẽ hỏng.
Bộ test sau khi sửa phải phủ:
- Chuỗi gai `[300000, 0, 0, 0, 1700000, 0, 100000]` (dữ liệu xu thật, n = 7) →
  `isTrendVisible` = false, và lý do là **cả hai**: n < 8 lẫn p >= 0.05.
- Chuỗi tăng đều, sạch, **ít nhất 8 mốc** → `isTrendVisible` = true.
- Chuỗi 8+ mốc nhưng nhiễu mạnh (p >= 0.05) → false. Ca này chứng minh cổng p-value
  thực sự có tác dụng, không phải chỉ mỗi điều kiện n.
- `isTrendVisible(null)` = false.

`TrendBadge` hiển thị thêm p-value cạnh R²: `· p 0.03`. Thêm khoá i18n
`trend.pValue` (vi: `"p"`, en: `"p"`) và `hint.pValue` vào `common.json` cả hai ngôn ngữ
— nội dung hint viết cho người ngoài ngành, ví dụ tiếng Việt:
`"Khả năng con số xu hướng này chỉ là ngẫu nhiên. Dưới 0,05 mới được coi là đáng tin."`

---

## Task 3 — Dải tin cậy 95%

**File sửa**: `src/utils/trend.ts`, hai file chart, `src/utils/__tests__/trend.test.ts`

`TrendResult` thêm hai trường: `upper: (number | null)[]` và `lower: (number | null)[]`,
cùng độ dài và cùng vị trí `null` với `values`.

Công thức tại mỗi x thuộc miền có dữ liệu:
```
se(x) = s * sqrt( 1/n + (x - x̄)² / Σ(x - x̄)² )   với  s = sqrt(SS_res / (n - 2))
upper(x) = ŷ(x) + tQuantile(0.975, n - 2) * se(x)
lower(x) = max(0, ŷ(x) - tQuantile(0.975, n - 2) * se(x))
```
`lower` clamp về >= 0 cùng lý do với `values` (số xu/số khách không thể âm).
Khi `n - 2 < 1`, đặt cả `upper` và `lower` bằng `values` (không đủ bậc tự do).

Vẽ trên chart bằng **kỹ thuật hai series stack** của ECharts (chỉ thêm khi trend hiển thị):
- series 1: `lower`, `stack: 'trend-ci-<key>'`, `lineStyle: { opacity: 0 }`,
  `symbol: 'none'`, `areaStyle: { opacity: 0 }`, `tooltip: { show: false }`,
  `silent: true`, `z: 1`
- series 2: dữ liệu là `upper[i] - lower[i]`, cùng `stack`, `lineStyle: { opacity: 0 }`,
  `symbol: 'none'`, `areaStyle: { color: <màu chuỗi>, opacity: 0.12 }`,
  `tooltip: { show: false }`, `silent: true`, `z: 1`

`z: 1` để dải nằm DƯỚI cột dữ liệu. `silent: true` + `tooltip.show = false` để dải không
bắt hover và không lọt vào tooltip. Hai series này KHÔNG được xuất hiện trong `legend.data`.

Màu dải: chart xu dùng đúng màu chuỗi tương ứng (`COLOR_IN` / `colorOut`); chart khách
dùng `colors.trend`.

Test bổ sung trong `trend.test.ts`:
- `upper[i] >= values[i] >= lower[i]` tại mọi mốc có dữ liệu
- `lower` không bao giờ âm
- `upper`/`lower` là `null` đúng ở những vị trí `values` là `null`
- Chuỗi khớp hoàn hảo (vd `[10, 20, 30, 40, 50, 60, 70, 80]`) có dải **hẹp hơn** chuỗi
  nhiễu cùng độ dài — kiểm bằng cách so tổng `upper - lower`

---

## Task 4 — Popover "Chi tiết mô hình"

**File mới**: `src/components/app/popover/trend-model-popover.tsx`
**File sửa**: `src/components/app/popover/index.tsx`, `trend-badge.tsx`, i18n

Mô phỏng "Describe Trend Model" của Tableau, rút gọn cho người vận hành.

Bấm vào badge xu hướng mở `Popover` (dùng `Popover/PopoverTrigger/PopoverContent` có sẵn
từ `@/components/ui`) hiển thị:

| Dòng | Nội dung |
|---|---|
| Phương trình | `y = <slope> · x + <intercept>` (làm tròn 0 chữ số thập phân) |
| Số mốc | `n` |
| R² | 2 chữ số thập phân |
| p-value | 3 chữ số thập phân |
| Kết luận | câu tiếng Việt/Anh, chọn theo quy tắc bên dưới |

Quy tắc chọn câu kết luận (khoá i18n dưới `trend.verdict.*` trong `common.json`):
- `n < MIN_TREND_POINTS` → `notEnoughPoints`: "Chưa đủ số mốc để kết luận xu hướng
  (cần ít nhất 8)."
- `pValue >= TREND_SIGNIFICANCE` → `notSignificant`: "Không có xu hướng rõ ràng — con số
  này có thể chỉ do ngẫu nhiên."
- `r2 < WEAK_TREND_R2` → `weak`: "Có xu hướng nhưng dữ liệu dao động mạnh, chỉ nên tham
  khảo."
- còn lại → `reliable`: "Xu hướng rõ và đáng tin cậy."

Popover PHẢI hiển thị kể cả khi trend bị ẩn khỏi chart — đó chính là lúc người dùng cần
biết **vì sao** không thấy đường. Do đó `TrendBadge` cần nhận thêm prop
`intercept: number`, `n: number`, `pValue: number`, và hai chart phải truyền
`trendRaw` (kết quả `trendOf` CHƯA lọc qua `isTrendVisible`) xuống badge, còn `values`
chỉ dùng cho việc vẽ đường.

Chỗ hiển thị badge trên hai chart hiện đang bị bọc trong điều kiện `earnTrend && ...`
(tức đã lọc). Đổi để badge dùng `earnTrendRaw`/`spendTrendRaw` (chart xu) và
`newTrendRaw`/`spendTrendRaw` (chart khách), còn series đường + dải vẫn dùng bản đã lọc.

Trigger phải là `<button type="button">` để focus được bằng bàn phím, có `aria-label`.
