# Thống kê khách hàng & chi tiêu — giải thích các chỉ số

Tài liệu này giải thích **từng con số** hiển thị trên màn "Khách hàng" (`/system/customers`):
nó đo cái gì, tính từ đâu, và những chỗ dễ hiểu nhầm.

Viết cho cả người không đọc code. Chỗ nào cần chính xác tuyệt đối thì có kèm tên file để
lập trình viên tra cứu.

---

## 1. Ba nguồn dữ liệu — và vì sao điều đó quan trọng

Cả trang lấy dữ liệu từ **ba** API, và chúng **không giống nhau về phạm vi lọc**:

| API | Cung cấp | Có lọc theo chi nhánh? |
|---|---|---|
| `GET /user/statistics` | Số khách **đăng ký mới** | ❌ **Không** |
| `GET /user` | **Tổng khách** (chỉ lấy số đếm) | ⚠️ Có hỗ trợ, nhưng **không dùng** — xem 3.2 |
| `GET /user/revenue/account` | Mọi con số về **chi tiêu** | ✅ Có |

> ⚠️ **Điểm dễ sai nhất của cả trang.** Card "Khách mới" và "Tổng khách" là **toàn hệ
> thống**; các card tiền (Tổng chi tiêu, TB mỗi khách, bốn phương thức) là **của một chi
> nhánh**. Đổi chi nhánh trên bộ lọc, hai card đầu **đứng yên** còn các card tiền
> **nhảy**.
>
> Hệ quả thực tế: **không được ghép tỉ lệ giữa "Khách mới" và bất kỳ card chi tiêu nào.**
> Chúng mô tả hai tập khách khác nhau.
>
> Card "Khách mới" vì thế có nhãn `Toàn hệ thống` ngay dưới con số. Khi nào backend bổ
> sung lọc chi nhánh cho `/user/statistics` thì gỡ nhãn đó đi.

---

## 2. Bộ lọc

| Bộ lọc | Ảnh hưởng tới |
|---|---|
| **Chi nhánh** | Mọi con số chi tiêu. *Không* ảnh hưởng "Khách mới" và "Tổng khách" (mục 1) |
| **Khoảng ngày** | Tất cả, **trừ** "Tổng khách" (mục 3.2) |
| **Nhóm theo** (giờ / ngày / tuần / tháng / năm) | Độ mịn của biểu đồ — mỗi cột là một mốc |
| **Phương thức thanh toán** | Chỉ tính tiền của phương thức đã chọn |
| **Số điện thoại** | Thu hẹp còn đúng một khách |
| **Loại khách** (tất cả / khách mới đăng ký) | Nhóm khách được tính chi tiêu — xem 2.1 |
| **So sánh kỳ trước** | Bật/tắt cột "kỳ trước" và dòng `% so với kỳ trước` |

**Về "So sánh kỳ trước":** mặc định **tắt**. Khi tắt, trang gọi 3 request (khách mới, chi
tiêu, tổng khách); khi bật, gọi 5 (thêm một cặp cho kỳ trước). Nếu bạn mở Network tab và
chỉ thấy mỗi API được gọi một lần — đó là vì chế độ so sánh đang tắt, không phải lỗi.

### 2.1 Bộ lọc "Loại khách" — dùng khi nào

Select này trả lời câu hỏi: **"con số chi tiêu đang nói về nhóm khách nào?"**

| Lựa chọn | Nghĩa |
|---|---|
| **Tất cả khách** *(mặc định)* | Doanh thu từ mọi người mua hàng trong kỳ — khách quen lẫn khách mới |
| **Khách mới đăng ký** | Chỉ doanh thu của những người **vừa tạo tài khoản trong chính khoảng ngày đang xem** |

**Dùng khi nào:** sau một chiến dịch kéo khách mới.

Ví dụ tháng 7 chạy khuyến mãi và có thêm 72 khách mới. Câu hỏi thật sự là *"72 người đó có
mua gì không, hay chỉ tạo tài khoản rồi thôi?"*

- Để **"Tất cả khách"** → thấy tổng doanh thu, nhưng phần lớn là tiền của khách quen. Không
  trả lời được câu hỏi.
- Chuyển **"Khách mới đăng ký"** → chỉ còn tiền của 72 người mới đó. Đây mới là con số đo
  hiệu quả chiến dịch.

Nói gọn: **"Tất cả khách" là doanh thu của cả quán; "Khách mới đăng ký" là doanh thu của
riêng người mới tới.**

Bộ lọc này ảnh hưởng tới mọi con số chi tiêu (Tổng chi tiêu, TB mỗi khách, bốn thẻ phương
thức, biểu đồ khung dưới, bảng "Chi tiêu theo khách"). Nó **không** ảnh hưởng card "Khách
mới" và "Tổng khách" — hai card đó đến từ API khác.

> ℹ️ Quy tắc chính xác của "khách mới đăng ký" do **backend** quyết định (tham số
> `customerType`). Mô tả ở trên là ý nghĩa nghiệp vụ đã thống nhất; nếu cần con số tuyệt
> đối chính xác đến từng trường hợp biên, hãy đối chiếu với handler
> `GET /user/revenue/account` ở backend.

---

## 3. Các thẻ chỉ số (card)

### 3.1 Khách mới

Số tài khoản khách **đăng ký mới** trong khoảng ngày đã chọn.

- Backend đếm số user có vai trò "Khách hàng" và có ngày tạo nằm trong khoảng.
- **Không liên quan gì tới đơn hàng hay chi tiêu** — một khách đăng ký rồi không mua gì
  vẫn được tính.
- Phạm vi: **toàn hệ thống**, không theo chi nhánh (mục 1).

### 3.2 Tổng khách

Tổng số tài khoản khách **hiện có**, không giới hạn khoảng ngày.

Khác mọi card còn lại trên trang ở một điểm quan trọng: **kéo khoảng ngày, con số này
không đổi**. Nó là con số nền — "hệ thống đang có bao nhiêu khách" — chứ không phải một
chỉ số theo kỳ. Nhãn `Toàn hệ thống, mọi thời điểm` dưới con số nói đúng điều đó.

> **Vì sao không lọc được theo chi nhánh?**
>
> Vì trong mô hình dữ liệu hiện tại, **khách hàng không thuộc chi nhánh nào cả**.
>
> Khi khách tự đăng ký, backend chỉ gán mật khẩu và vai trò — không gán chi nhánh
> (`auth.service.ts`, hàm `register`). Cột chi nhánh trên bảng `user` chỉ được điền khi
> nhân viên tạo tài khoản hộ và chủ động chọn chi nhánh, hoặc khi cập nhật hồ sơ. Thực tế
> gần như toàn bộ khách có chi nhánh **rỗng**.
>
> Nếu ép lọc theo chi nhánh, backend dùng phép nối bảng loại bỏ mọi bản ghi rỗng — con số
> sẽ tụt xuống chỉ còn vài khách tình cờ có chi nhánh, tức **sai**.
>
> Cột chi nhánh trên bảng `user` thực chất phục vụ **nhân viên** (nhân viên thuộc chi
> nhánh). Mối liên hệ thật giữa khách và chi nhánh chỉ tồn tại qua **đơn hàng**. Muốn có
> "tổng khách của chi nhánh" đúng nghĩa thì phải đếm qua đơn hàng — cần API mới ở backend.

### 3.3 Tổng chi tiêu

Tổng số tiền khách đã chi trong kỳ, theo bộ lọc hiện tại.

Nếu đã chọn một phương thức thanh toán cụ thể thì đây là tiền của **riêng** phương thức đó.

### 3.4 TB mỗi khách

```
Tổng chi tiêu ÷ Số khách có phát sinh chi tiêu
```

Mẫu số là số khách **thực sự tiêu tiền**, không phải tổng số khách. Khách đăng ký mà không
mua gì không kéo con số này xuống.

Làm tròn tới đơn vị đồng. Bằng 0 khi không có khách nào chi tiêu (không chia cho 0).

### 3.5 Khách có chi tiêu / Tỉ lệ chuyển đổi — ⏸️ **ĐANG TẠM TẮT**

```
Số khách có chi tiêu ÷ Tổng số khách × 100
```

Card này **đã bị ẩn** khỏi giao diện, bật lại bằng cờ `SHOW_CONVERSION_CARD` trong
`customer-analytics-summary.tsx`.

**Lý do tắt:** mẫu số ("tổng số khách") lấy từ trường `total` của API chi tiêu, và hiện
**chưa xác minh được nó đếm gì**. (Endpoint có thật và đang chạy — chỉ là *handler* của nó
nằm ở branch backend chưa merge vào checkout này, nên đọc được lời gọi mà không đọc được
cách xử lý.) Số liệu thực tế
làm giả định hiện tại đáng ngờ: với 31 khách chi tiêu và tỉ lệ 17,4%, mẫu số suy ra là
**178**, trong khi card "Khách mới" cùng hàng đang hiện **72**.

Nếu 178 là *tổng khách mọi thời đại* của chi nhánh (không giới hạn theo khoảng ngày), thì
tỉ lệ này sẽ **tụt dần vĩnh viễn** theo thời gian — mẫu số lớn lên mãi trong khi tử số chỉ
đếm trong kỳ — và không đo lường được gì.

**Cách xác minh trước khi bật lại:** mở Network tab, đổi khoảng ngày, xem `total` có đổi
theo không. Nếu `total` đứng yên → mẫu số không theo khoảng ngày → phải sửa cách tính hoặc
đổi nhãn card trước khi bật.

Khi bật lại, card sẽ hiện **cả tử số lẫn mẫu số** (`31 / 178`) chứ không chỉ mỗi tỉ lệ —
để người đọc không phải đoán mẫu số và đoán nhầm sang con số "Khách mới" bên cạnh.

### 3.6 Bốn thẻ phương thức thanh toán

Chuyển khoản · Tiền mặt · Xu · Thẻ tín dụng.

Mỗi thẻ hiện số tiền + **tỉ trọng trên tổng chi tiêu của chính kỳ đang xem** (bốn tỉ lệ
cộng lại ≈ 100%). Đây **không phải** so sánh với kỳ trước.

Luôn hiện đủ bốn thẻ, kể cả khi một phương thức bằng 0 đ — để biết chắc phương thức đó
không có giao dịch, thay vì phải đoán.

Ẩn cả hàng khi đã lọc theo một phương thức cụ thể (lúc đó bảng chia này thừa).

### 3.7 Dòng `% so với kỳ trước`

Chỉ xuất hiện dưới **hai** card: **Khách mới** và **Tổng chi tiêu**. Cần bật "So sánh kỳ
trước".

```
(kỳ này − kỳ trước) ÷ kỳ trước × 100
```

Hai trường hợp đặc biệt được xử lý riêng thay vì hiện số vô nghĩa:

- **Kỳ trước = 0, kỳ này > 0** → hiện chữ **"Mới"**, không hiện `+∞%`.
- **Kỳ trước = 0, kỳ này = 0** → không hiện gì (không có gì thay đổi để báo cáo).

---

## 4. Biểu đồ

Hai khung xếp dọc, dùng chung trục thời gian. Rê chuột vào một mốc sẽ soi cùng mốc đó ở cả
hai khung.

Hai khung có **trục dọc riêng biệt** và điều này là cố ý: "số khách" và "số tiền" là hai
đơn vị không liên quan, ép chung một trục sẽ tạo ra một mối tương quan thị giác **không có
thật** trong dữ liệu.

### 4.1 Khung trên — Khách mới

Cột đứng, mỗi cột là số khách đăng ký mới trong một mốc. Bật so sánh sẽ có thêm cột "kỳ
trước" đứng cạnh.

### 4.2 Khung dưới — Chi tiêu

**Cột chồng**: mỗi cột chia thành bốn tầng màu theo bốn phương thức thanh toán, chiều cao
cả cột là tổng chi tiêu của mốc đó. Con số ghi trên đỉnh cột là **tổng**, không phải tầng
trên cùng.

### 4.3 Mốc trống

Mốc không có dữ liệu vẫn được vẽ với giá trị **0**, không bị bỏ qua. Nhờ vậy trục thời gian
luôn đều nhau và một tuần vắng khách nhìn ra là *vắng*, chứ không bị nén lại trông như
không tồn tại.

Nhãn số trên đỉnh cột được **ẩn khi giá trị bằng 0** để biểu đồ không rối vì một dãy số 0.

### 4.4 Đường xu hướng (trend line) — nét đứt

Mỗi khung có một đường nét đứt: **đường xu hướng**, trả lời câu hỏi *"nhìn tổng thể cả kỳ,
xu hướng đang đi lên hay đi xuống?"*

**Cách tính:** hồi quy tuyến tính theo phương pháp bình phương nhỏ nhất — vẽ một đường
thẳng duy nhất sao cho tổng bình phương khoảng cách từ các cột tới đường đó là nhỏ nhất.
Nói đơn giản: **đường thẳng "vừa khít" nhất với hình dạng chung của các cột**.

Vài điểm cần biết để không đọc sai:

| Đặc điểm | Ý nghĩa |
|---|---|
| **Không phải dự báo** | Đường này *mô tả* dữ liệu đã có, không dự đoán tương lai. Không được kéo dài nó ra để suy ngày mai |
| **Chỉ vẽ trong đoạn có dữ liệu** | Cắt bỏ các mốc 0 ở *hai đầu* kỳ. Ví dụ chọn cả tháng nhưng chỉ có phát sinh từ ngày 5 đến ngày 20 thì đường chỉ chạy từ 5 đến 20 |
| **Không âm** | Bị chặn sàn ở 0 — đường không bao giờ tụt xuống dưới trục, vì "âm 3 khách" là vô nghĩa |
| **Cần ít nhất 2 mốc có dữ liệu** | Ít hơn thì không có đường nào (một điểm không tạo thành xu hướng) |
| **Không nằm trong tooltip** | Cố ý — giá trị của nó là số thập phân nội suy (vd. "0,51 khách"), không phải số liệu thật. Hiện ra chỉ gây hiểu nhầm |
| **Bị kéo bởi giá trị đột biến** | Một ngày bùng nổ doanh thu sẽ kéo nghiêng cả đường. Nên đọc nó *cùng với* các cột, đừng đọc một mình |

Đường xu hướng của khung dưới bám theo **tổng** chi tiêu, không tách theo từng phương thức.

---

## 5. Hai bảng bên dưới

Chuyển qua lại bằng nút gạt. Bấm vào một dòng sẽ mở trang chi tiết khách.

### 5.1 Khách hàng (danh bạ)

Danh sách tài khoản khách: ngày tạo, trạng thái, tên, số điện thoại, thẻ thành viên, email,
ngày sinh, chi nhánh, tình trạng xác thực, yêu cầu đang chờ xử lý.

Cột số điện thoại có nút **sao chép** (hiện khi rê chuột vào ô). Bấm nút này **không** mở
trang chi tiết khách.

Bảng này **không** chịu ảnh hưởng của bộ lọc chi tiêu — nó có bộ lọc riêng.

### 5.2 Chi tiêu theo khách

Mỗi dòng là một khách **có phát sinh chi tiêu** trong kỳ: tên, ngày đăng ký, tổng chi tiêu,
và chia theo bốn phương thức thanh toán.

Số dòng của bảng này chính là con số "Khách có chi tiêu" ở mục 3.5.

Xuất được ra CSV. Phân trang xử lý ngay tại trình duyệt (API trả về toàn bộ danh sách một
lần).

---

## 6. Bảng tra nhanh: con số này so với cái gì?

| Con số | So với |
|---|---|
| `17,4% chuyển đổi` *(đang tắt)* | Tổng số khách trong cùng response chi tiêu — **chưa xác minh**, xem 3.5 |
| `62,19%` trên thẻ Tiền mặt | Tổng chi tiêu của **chính kỳ này** |
| `+12% so với kỳ trước` | Kỳ so sánh đã chọn — **chỉ có** ở card Khách mới và Tổng chi tiêu |
| Đường nét đứt | Không so với gì cả — là đường khớp với chính dữ liệu đang hiển thị |
| Cột màu nhạt cạnh cột chính | Cùng chỉ số đó ở kỳ so sánh |

---

## 7. Các việc còn treo

1. **"Khách mới" theo chi nhánh** — hiện là toàn hệ thống, lệch phạm vi với các card tiền.
   ⚠️ Đây **không phải** việc chỉ cần thêm tham số chi nhánh vào `/user/statistics`. Bảng
   `user` có cột chi nhánh, nhưng nó **rỗng với gần như toàn bộ khách** (mục 3.2) — lọc
   theo nó sẽ cho số sai y hệt trường hợp "Tổng khách". Muốn đúng thì phải đếm khách **qua
   đơn hàng tại chi nhánh**, tức một endpoint mới ở backend, không phải sửa endpoint cũ.

2. **Xác minh `total`** rồi bật lại card chuyển đổi (mục 3.5).
   💡 Từ khi có card "Tổng khách", việc này làm được **ngay trên giao diện**: nếu "Tổng
   khách" hiện **đúng 178** thì `total` chính là *tổng khách toàn hệ thống*, chứ không phải
   "tổng khách trong phạm vi lọc" như code đang giả định — và card chuyển đổi cần đổi nhãn
   trước khi bật lại. Nếu hai số **khác nhau**, `total` là thứ khác và vẫn phải tra backend.

---

## 8. Tra cứu cho lập trình viên

| Nội dung | File |
|---|---|
| Công thức các card | `components/analytics/spending-kpis.ts` |
| Giao diện các card | `components/analytics/customer-analytics-summary.tsx` |
| Biểu đồ + đường xu hướng | `components/analytics/customer-analytics-chart.tsx` |
| Hồi quy tuyến tính | `src/utils/linear-regression.ts` |
| Điền mốc trống | `src/utils/fill-time-buckets.ts`, `src/utils/fill-spending-buckets.ts` |
| Gọi API + bộ lọc | `components/analytics/customer-analytics-panel.tsx` |
| Trạng thái bộ lọc trên URL | `hooks/use-customer-analytics-filters.ts` |
| Cột bảng | `DataTable/columns/customer-columns.tsx`, `DataTable/columns/customer-spending-columns.tsx` |
