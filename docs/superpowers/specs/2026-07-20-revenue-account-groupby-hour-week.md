# Yêu cầu Backend: `/user/revenue/account` thêm `groupBy = hour | week`

- **Ngày:** 2026-07-20
- **Liên quan:** TRE-441 (Coin Usage Report — dashboard Khách hàng)
- **Người yêu cầu (FE):** cần để đồng bộ trục thời gian giữa hai chart

## Vấn đề

Dashboard tab Khách hàng vẽ **hai chart căn chung một trục thời gian**:
- Panel trên (Khách mới) ← `GET /user/statistics`
- Panel dưới (Chi tiêu, stacked theo phương thức) ← `GET /user/revenue/account`

Vì hai chart **chung trục X**, cả hai **phải gom theo cùng một `groupBy`**. FE đang truyền cùng một giá trị
`groupBy` cho cả hai request.

Nhưng hai endpoint hiện **hỗ trợ tập `groupBy` khác nhau:**

| `groupBy` | `/user/statistics` | `/user/revenue/account` |
|---|---|---|
| `hour`  | ✅ | ❌ |
| `day`   | ✅ | ✅ |
| `week`  | ✅ | ❌ |
| `month` | ✅ | ✅ |
| `year`  | ✅ | ✅ |

Hệ quả: khi người dùng chọn **"Hôm nay"** (→ `hour`) hoặc một khoảng **32–92 ngày** (→ `week`), panel Khách mới
gom đúng, nhưng `/user/revenue/account` **không hiểu `hour`/`week`** → panel Chi tiêu gom sai hoặc rỗng, hai
trục X lệch nhau.

## Yêu cầu

`GET /user/revenue/account` bổ sung hỗ trợ **`groupBy = hour`** và **`groupBy = week`**, để bằng đúng tập giá
trị của `/user/statistics`: `hour | day | week | month | year`.

- **`hour`**: gom theo từng giờ. `data[].time` là mốc đầu giờ, ví dụ `2026-07-20T14:00:00`.
- **`week`**: gom theo tuần ISO (thứ Hai đầu tuần, khớp cách `/user/statistics` đang gom `week`). `data[].time`
  là mốc đầu tuần, ví dụ `2026-07-14T00:00:00`.

Cả hai giữ **nguyên shape `data[]` hiện tại** — chỉ khác độ mịn của bucket. Mỗi phần tử vẫn gồm:
```jsonc
{
  "time": "...",                    // 'YYYY-MM-DDTHH:mm:ss', local, không timezone
  "count": 0,                       // tổng số giao dịch trong bucket
  "countPoint": 0, "countBank": 0, "countCash": 0, "countCreditCard": 0,
  "totalAmount": 0,                 // tổng tiền trong bucket
  "totalAmountPoint": 0, "totalAmountBank": 0, "totalAmountCash": 0, "totalAmountCreditCard": 0
}
```

## Ràng buộc định dạng (quan trọng — để FE điền mốc trống khớp)

- `time` phải là `'YYYY-MM-DDTHH:mm:ss'`, **giờ địa phương, KHÔNG hậu tố timezone** — giống hệt
  `/user/statistics` và các `groupBy` `day/month/year` hiện có. FE dùng cùng một hàm `fillTimeBuckets` để điền
  mốc thiếu = 0, và nó gom bucket bằng `moment().startOf(unit)` — lệch định dạng sẽ làm lệch bucket.
- `week` phải gom theo **ISO week** (thứ Hai) đúng như `/user/statistics`, nếu không hai panel sẽ lệch mốc dù
  cùng danh nghĩa "tuần".

## Ngoài phạm vi

- Không đổi `summary`, `customers[]`, `total`.
- Không đổi tập `groupBy` của `/user/statistics` (nó đã đủ 5 mức).

## Phía FE (đã/đang làm, không cần BE làm gì)

- FE thêm lại select **"Theo:"** cho người dùng chọn tay `Giờ/Ngày/Tuần/Tháng/Năm`.
- Cho tới khi BE deploy `hour`/`week`: chọn hai mức đó thì panel Chi tiêu hiện **empty state** (không vỡ trang).
  Khi BE xong, tự chạy — FE không phải sửa thêm.
