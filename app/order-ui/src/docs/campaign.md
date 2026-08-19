## 1. Tổng quan

Xây dựng hệ thống chiến dịch marketing có thể cấu hình động, cho phép admin tạo và 
quản lý các chiến dịch tặng voucher theo điều kiện mà không cần thay đổi code.

**Đối tượng sử dụng:**
- Admin/Manager: tạo, cập nhật, quản lý campaign
- Customer: nhận voucher tự động khi đủ điều kiện (không có API trực tiếp)

---

## 2. Flow nghiệp vụ

### NEW_USER campaign
1. Admin tạo campaign type `new-user`, gắn VoucherGroup và VoucherCampaignTemplate
2. Khách hàng đăng ký tài khoản mới thành công
3. `AuthService.register()` emit event `campaign.user.created`
4. `CampaignListener` nhận event (`@OnEvent`, async, không block HTTP response), gọi `CampaignService.triggerForUser(user, NEW_USER)`
5. Service tìm tất cả campaign `NEW_USER` đang `OPENING` và trong thời gian hiệu lực
6. Với mỗi campaign: kiểm tra eligibility → nếu đủ điều kiện thì gọi `NewUserCampaignStrategy.execute()`
7. Strategy tạo voucher mới từ `campaign.voucherCampaignTemplate`, gán vào `campaign.voucherGroup`, ghi `CampaignRecipient` với `year = null`

### USER_BIRTHDAY campaign
1. Admin tạo campaign type `user-birthday`, gắn VoucherGroup và VoucherCampaignTemplate
2. `CampaignScheduler.handleBirthdayCampaigns()` chạy cron (production: `1 0 * * *` — mỗi ngày 00:01)
3. Query tất cả user có `dob` khớp ngày/tháng hôm nay (format `DD/MM/YYYY`)
4. Với mỗi user: gọi `CampaignService.triggerForUser(user, USER_BIRTHDAY)`
5. Service kiểm tra eligibility: user đã nhận campaign này trong năm nay chưa (check `year = năm hiện tại`)
6. Nếu chưa: gọi `UserBirthdayCampaignStrategy.execute()`, ghi `CampaignRecipient` với `year = năm hiện tại`

**Bảo vệ chống gian lận sinh nhật:** Unique constraint `(campaign_id, user_id, year)` kết hợp service-layer check đảm bảo mỗi user chỉ nhận tối đa 1 lần/năm/campaign.

### Tự động chuyển trạng thái campaign
`CampaignScheduler.syncCampaignStatuses()` chạy mỗi phút (`* * * * *`):
- `SCHEDULED` → `OPENING` khi `startDate <= NOW`
- `OPENING` → `CLOSED` khi `endDate < NOW`

---