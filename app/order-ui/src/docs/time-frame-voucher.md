Voucher chỉ được kích hoạt trong 1 khung giờ nhất định mỗi ngày (ví dụ 14:00–16:00)
để khuyến khích người dùng đặt hàng vào giờ trống.

Xác định khung giờ active voucher: activeStartTime, activeEndTime

format: hh:mm





Rule cụ thể:
- Cả hai null → hợp lệ (voucher cả ngày)
- Cả hai có giá trị → hợp lệ nếu `activeStartTime < activeEndTime`
- Một cái null, một cái có giá trị → **không hợp lệ**, báo lỗi rõ ràng

## Grace Period: thời gian cộng thêm dùng khi voucher đã hết hạn
- Áp dụng grace period cho `activeEndTime` (nhất quán với `endDate`)
- **Không** áp dụng cho `activeStartTime`
- Lý do: active time window thay thế use case voucher thời hạn ngắn vài giờ,
  vốn đã có grace period để user hoàn tất đơn đang dở

